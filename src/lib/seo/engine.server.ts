import { analyze, visibilityIssues } from "./analyze.ts";
import { parseHtml } from "./parse-html.ts";
import { normalizeUrl, precheckUrl, sameSite } from "./net.ts";
import { parseRobots, robotsAllows, type RobotsRules } from "./robots.ts";
import { computeScores } from "./score.ts";
import { assertPublicHost, publicError, safeFetch } from "./fetch.server.ts";
import { allow, readSecrets } from "./credentials.server.ts";
import { collectExternal, runPageSpeed, testProvider } from "./providers.server.ts";
import {
  createScan,
  insertPage,
  loadCrawl,
  loadPages,
  markFailed,
  replaceIssues,
  saveCrawlState,
  countPages,
  type QueueItem,
  type StoredPage,
} from "./store.server.ts";
import type { Progress, RobotsSnapshot, ScanConfig, SitemapSnapshot, ValidationRow } from "./types.ts";
import { clampConfig } from "./types.ts";

function now() {
  return new Date().toISOString();
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const pattern = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) && locs.length < 80) {
    locs.push((match[1] ?? "").replace(/&/g, "&").trim());
  }
  return locs;
}

async function readRobots(origin: string, timeoutMs: number): Promise<{ snapshot: RobotsSnapshot; rules: RobotsRules | null }> {
  try {
    const response = await safeFetch(new URL("/robots.txt", origin).toString(), { timeoutMs, maxBytes: 500_000 });
    if (response.status >= 500 || response.redirectLoop) {
      return {
        snapshot: { status: response.status, error: response.redirectLoop ? "Redirect loop" : `HTTP ${response.status}`, sitemaps: [], crawlDelayMs: null, blockedHome: false },
        rules: null,
      };
    }
    if (response.status >= 400) {
      return { snapshot: { status: response.status, sitemaps: [], crawlDelayMs: null, blockedHome: false }, rules: null };
    }
    const rules = parseRobots(response.body);
    return {
      snapshot: {
        status: response.status,
        sitemaps: rules.sitemaps.slice(0, 5),
        crawlDelayMs: rules.crawlDelayMs,
        blockedHome: false,
        raw: response.body.slice(0, 100_000),
      },
      rules,
    };
  } catch (error) {
    return {
      snapshot: { status: 0, error: publicError(error), sitemaps: [], crawlDelayMs: null, blockedHome: false },
      rules: null,
    };
  }
}

async function readSitemaps(origin: string, seeds: string[], timeoutMs: number, includeQuery: boolean): Promise<SitemapSnapshot> {
  const fetched: SitemapSnapshot["fetched"] = [];
  const locs: string[] = [];
  const queue = [...new Set(seeds.length ? seeds : [new URL("/sitemap.xml", origin).toString()])].slice(0, 3);
  const seen = new Set<string>();
  while (queue.length && fetched.length < 3 && locs.length < 80) {
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const response = await safeFetch(url, { timeoutMs, maxBytes: 1_000_000 });
      if (response.status >= 400 || response.redirectLoop) {
        fetched.push({ url, status: response.status, count: 0, error: response.redirectLoop ? "Redirect loop" : `HTTP ${response.status}` });
        continue;
      }
      const found = extractLocs(response.body);
      fetched.push({ url, status: response.status, count: found.length });
      if (/<sitemapindex/i.test(response.body)) {
        for (const loc of found.slice(0, 2)) queue.push(loc);
        continue;
      }
      for (const loc of found) {
        const normalized = normalizeUrl(loc, origin, { includeQuery });
        if (normalized) locs.push(normalized);
      }
    } catch (error) {
      fetched.push({ url, status: 0, count: 0, error: publicError(error) });
    }
  }
  return { fetched, locs: [...new Set(locs)].slice(0, 80) };
}

function validationShell(partial: Omit<ValidationRow, "checkedAt">): ValidationRow {
  return { ...partial, checkedAt: now() };
}

export async function validateAndStart(token: string, rawUrl: string, rawConfig: ScanConfig) {
  if (!allow(token, "scan", 8, 60 * 60 * 1000)) {
    return { ok: false as const, error: "Too many audits were started from this session. Wait and try again.", validation: [] as ValidationRow[] };
  }
  const config = clampConfig(rawConfig);
  let target: URL;
  try {
    target = precheckUrl(rawUrl.trim());
    await assertPublicHost(target.toString());
  } catch (error) {
    const message = publicError(error);
    const validation = [
      validationShell({
        id: "crawler",
        name: "Northline crawler",
        role: "required",
        status: "unavailable",
        auth: "Not applicable",
        permission: "Blocked",
        quota: null,
        message,
        action: "Use a public http or https URL. Local and private addresses are rejected.",
      }),
    ];
    return { ok: false as const, error: message, validation };
  }

  const normalized = normalizeUrl(target.toString(), target.toString(), { includeQuery: config.includeQuery });
  if (!normalized) {
    return { ok: false as const, error: "The URL could not be normalized.", validation: [] as ValidationRow[] };
  }
  const host = new URL(normalized).hostname;
  const selected = config.providers.filter((provider) => provider.included && provider.id !== "crawler");
  const tests = await Promise.all(
    selected.map(async (provider) => {
      const result = await testProvider(token, provider.id);
      return validationShell({
        ...result,
        role: provider.required ? "required" : "optional",
        checkedAt: now(),
      });
    }),
  );

  const crawler = config.providers.find((provider) => provider.id === "crawler");
  const crawlerOn = Boolean(crawler?.included);
  const validation: ValidationRow[] = [];
  if (crawlerOn) {
    validation.push(
      validationShell({
        id: "crawler",
        name: "Northline crawler",
        role: crawler?.required ? "required" : "optional",
        status: "connected",
        auth: "No credentials",
        permission: "Public URL accepted",
        quota: null,
        message: "The hostname resolves to a public address. Pages are fetched with robots.txt rules unless you turned that off.",
        action: "No action needed.",
      }),
    );
  }
  validation.push(...tests);

  const failedRequired = validation.filter(
    (item) => item.role === "required" && !["connected", "connected_limited"].includes(item.status),
  );
  const usable = validation.some((item) => item.role !== "info" && ["connected", "connected_limited"].includes(item.status) && (item.id === "crawler" || item.id === "pagespeed" || config.providers.find((provider) => provider.id === item.id)?.included));
  if (!crawlerOn && !config.providers.some((provider) => provider.included && provider.id === "pagespeed" && ["connected", "connected_limited"].includes(validation.find((item) => item.id === "pagespeed")?.status ?? ""))) {
    if (!usable) {
      return {
        ok: false as const,
        error: "No scan method is available. Turn on the crawler or a validated PageSpeed connection.",
        validation,
      };
    }
  }
  if (failedRequired.length) {
    return {
      ok: false as const,
      error: `Required providers failed: ${failedRequired.map((item) => item.name).join(", ")}.`,
      validation,
    };
  }
  if (!validation.some((item) => ["connected", "connected_limited"].includes(item.status))) {
    return { ok: false as const, error: "Nothing validated. Add the crawler or fix a provider.", validation };
  }

  const id = crypto.randomUUID();
  const queue: QueueItem[] = [];
  const seen: string[] = [];
  const skipped: { url: string; reason: string }[] = [];
  let robots: RobotsSnapshot | null = null;
  let sitemap: SitemapSnapshot | null = null;
  let rules: RobotsRules | null = null;

  if (crawlerOn) {
    const origin = `${target.protocol}//${target.host}`;
    const robotsRead = await readRobots(origin, config.timeoutMs);
    robots = robotsRead.snapshot;
    rules = robotsRead.rules;
    if (config.useSitemap) {
      sitemap = await readSitemaps(origin, robots?.sitemaps ?? [], config.timeoutMs, config.includeQuery);
    } else {
      sitemap = { fetched: [], locs: [] };
    }
    const homeBlocked = Boolean(config.respectRobots && rules && !robotsAllows(rules, normalized));
    if (robots) robots.blockedHome = homeBlocked;
    if (homeBlocked) {
      skipped.push({ url: normalized, reason: "robots.txt" });
      seen.push(normalized);
    } else {
      queue.push({ url: normalized, depth: 0 });
    }
    for (const loc of sitemap?.locs ?? []) {
      try {
        if (!sameSite(new URL(loc).hostname, host, config.includeSubdomains)) continue;
      } catch {
        continue;
      }
      if (seen.includes(loc) || queue.some((item) => item.url === loc)) continue;
      if (config.respectRobots && rules && !robotsAllows(rules, loc)) {
        skipped.push({ url: loc, reason: "robots.txt" });
        seen.push(loc);
        continue;
      }
      queue.push({ url: loc, depth: 1 });
    }
  }

  const progress: Progress = {
    stage: queue.length ? "crawling" : "analyzing_pending",
    discovered: seen.length + queue.length,
    crawled: 0,
    remaining: queue.length,
    errors: 0,
    currentUrl: null,
    notes: crawlerOn ? ["Robots.txt and sitemap discovery finished."] : ["Crawl disabled. External checks only."],
  };

  await createScan({
    id,
    targetUrl: normalized,
    host,
    config,
    progress,
    queue,
    seen,
    skipped,
    robots,
    sitemap,
    validation,
    status: queue.length ? "crawling" : "analyzing_pending",
  });

  return { ok: true as const, scanId: id, validation };
}

export async function crawlBatch(scanId: string) {
  const loaded = await loadCrawl(scanId);
  if (!loaded) throw new Error("Scan not found.");
  if (loaded.row.status === "cancelled") return { status: "cancelled", progress: loaded.progress };
  if (loaded.row.status !== "crawling") return { status: loaded.row.status, progress: loaded.progress };

  const config = loaded.config;
  const queue = loaded.queue;
  const seen = new Set(loaded.seen);
  const skipped = loaded.skipped;
  let errors = loaded.progress.errors;
  const batch = queue.splice(0, 2);
  let rules: RobotsRules | null = loaded.robots?.raw ? parseRobots(loaded.robots.raw) : null;

  for (const item of batch) {
    if (loaded.pageCount >= config.maxPages) {
      queue.length = 0;
      break;
    }
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    if (config.respectRobots && rules && !robotsAllows(rules, item.url)) {
      skipped.push({ url: item.url, reason: "robots.txt" });
      continue;
    }
    const fresh = await loadCrawl(scanId);
    if (fresh?.row.status === "cancelled") return { status: "cancelled", progress: fresh.progress };
    try {
      const response = await safeFetch(item.url, { timeoutMs: config.timeoutMs, maxBytes: 1_200_000 });
      const parsed = parseHtml({
        url: item.url,
        finalUrl: response.finalUrl,
        status: response.status,
        contentType: response.contentType,
        redirectChain: response.redirectChain,
        redirectLoop: response.redirectLoop,
        headerMap: response.headers,
        body: response.body,
        loadMs: 0,
        depth: item.depth,
        host: loaded.row.host,
        error: null,
        includeQuery: config.includeQuery,
        includeSubdomains: config.includeSubdomains,
      });
      const stored: StoredPage = { ...parsed.page, localFound: parsed.localFound, localIncomplete: parsed.localIncomplete };
      await insertPage(scanId, stored);
      loaded.pageCount += 1;
      if (parsed.page.status >= 400 || parsed.page.error) errors += 1;
      if (!parsed.page.nonHtml && parsed.page.status < 400 && !parsed.page.redirectLoop) {
        for (const link of parsed.page.internalLinks) {
          if (seen.has(link) || queue.some((queued) => queued.url === link)) continue;
          if (item.depth + 1 > config.maxDepth) continue;
          try {
            if (!sameSite(new URL(link).hostname, loaded.row.host, config.includeSubdomains)) continue;
          } catch {
            continue;
          }
          if (config.respectRobots && rules && !robotsAllows(rules, link)) {
            skipped.push({ url: link, reason: "robots.txt" });
            seen.add(link);
            continue;
          }
          queue.push({ url: link, depth: item.depth + 1 });
          if (queue.length + loaded.pageCount >= config.maxPages * 3) break;
        }
      }
    } catch (error) {
      errors += 1;
      const message = publicError(error);
      await insertPage(scanId, {
        ...parseHtml({
          url: item.url,
          finalUrl: item.url,
          status: 0,
          contentType: "",
          redirectChain: [],
          redirectLoop: false,
          headerMap: {},
          body: "",
          loadMs: 0,
          depth: item.depth,
          host: loaded.row.host,
          error: message,
          includeQuery: config.includeQuery,
          includeSubdomains: config.includeSubdomains,
        }).page,
        error: message,
      });
      loaded.pageCount += 1;
    }
    const delay = Math.max(config.delayMs, loaded.robots?.crawlDelayMs ?? 0);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const pageCount = await countPages(scanId);
  const done = queue.length === 0 || pageCount >= config.maxPages;
  const progress: Progress = {
    stage: done ? "analyzing_pending" : "crawling",
    discovered: seen.size,
    crawled: pageCount,
    remaining: done ? 0 : queue.length,
    errors,
    currentUrl: batch.at(-1)?.url ?? null,
    notes: done ? ["Page fetch finished."] : ["Fetching public pages."],
  };
  await saveCrawlState({
    id: scanId,
    status: done ? "analyzing_pending" : "crawling",
    progress,
    queue: done ? [] : queue,
    seen: [...seen],
    skipped,
    pageCount,
  });
  return { status: done ? "analyzing_pending" : "crawling", progress };
}

export async function finalizeScan(scanId: string, token: string) {
  const loaded = await loadCrawl(scanId);
  if (!loaded) throw new Error("Scan not found.");
  if (loaded.row.status === "complete") {
    const { getScan } = await import("./store.server.ts");
    return getScan(scanId);
  }
  if (loaded.row.status === "cancelled") throw new Error("This scan was cancelled.");
  if (loaded.row.status === "crawling") throw new Error("The crawl is still running.");

  await saveCrawlState({
    id: scanId,
    status: "analyzing",
    progress: { ...loaded.progress, stage: "analyzing", notes: ["Checking optional providers and scoring."] },
    queue: [],
    seen: loaded.seen,
    skipped: loaded.skipped,
    pageCount: loaded.pageCount,
  });

  const pages = await loadPages(scanId);
  const config = loaded.config;
  let psi = null;
  const psiPick = config.providers.find((provider) => provider.id === "pagespeed");
  if (psiPick?.included) {
    const key = readSecrets(token, "pagespeed").apiKey ?? "";
    if (key || config.psiAllowUnkeyed) {
      const strategies = config.psiStrategy === "both" ? (["mobile", "desktop"] as const) : ([config.psiStrategy] as const);
      const target = loaded.row.target_url;
      const runs = [];
      for (const strategy of strategies) {
        runs.push(await runPageSpeed(target, strategy, key));
      }
      psi = runs.find((run) => run.lab?.performance != null) ?? runs[0] ?? null;
      if (runs.length > 1 && psi) {
        psi = { ...psi, error: [psi.error, runs[1]?.error].filter(Boolean).join(" ") || undefined };
      }
    }
  }

  let external = { backlinks: [] as Awaited<ReturnType<typeof collectExternal>>["backlinks"], visibility: [] as Awaited<ReturnType<typeof collectExternal>>["visibility"], gscRows: [] as Awaited<ReturnType<typeof collectExternal>>["gscRows"] };
  try {
    external = await collectExternal({
      token,
      host: loaded.row.host,
      pageUrl: loaded.row.target_url,
      picks: config.providers,
    });
  } catch (error) {
    external.visibility.push({
      id: "external",
      name: "External providers",
      ok: false,
      status: "unavailable",
      message: publicError(error),
      metrics: [],
      rows: [],
      retrievedAt: now(),
      spentUnits: false,
    });
  }

  const brokenExternal: { from: string; to: string; status: number }[] = [];
  if (config.checkExternal) {
    const pairs: { from: string; to: string }[] = [];
    for (const page of pages) {
      for (const link of page.externalLinks.slice(0, 3)) {
        if (pairs.length >= 12) break;
        pairs.push({ from: page.finalUrl, to: link });
      }
    }
    for (const pair of pairs) {
      try {
        const response = await safeFetch(pair.to, { method: "HEAD", timeoutMs: Math.min(config.timeoutMs, 8000), maxBytes: 10_000 });
        if (response.status >= 400 || response.status === 0) brokenExternal.push({ ...pair, status: response.status });
      } catch {
        brokenExternal.push({ ...pair, status: 0 });
      }
    }
  }

  const localFlags = pages
    .filter((page) => page.localFound)
    .map((page) => ({ url: page.finalUrl, incomplete: Boolean(page.localIncomplete) }));
  const issues = analyze({
    pages,
    skipped: loaded.skipped,
    sitemap: loaded.sitemap,
    robotsStatus: loaded.robots?.status ?? null,
    robotsError: loaded.robots?.error,
    config,
    psi,
    brokenExternal,
    host: loaded.row.host,
    localFlags,
  });
  issues.push(...visibilityIssues(external.gscRows));
  const scores = computeScores({
    issues,
    crawledPages: pages.filter((page) => !page.nonHtml && !page.error && page.status < 400).length,
    psiScore: psi?.lab?.performance ?? null,
  });
  const summary = [
    `Northline fetched ${pages.length} URL${pages.length === 1 ? "" : "s"} on ${loaded.row.host}.`,
    scores.overall == null ? "No scored category had data." : `Health score ${scores.overall} with ${scores.coverage}% data coverage.`,
    `${issues.filter((issue) => issue.severity === "critical").length} critical and ${issues.filter((issue) => issue.severity === "high").length} high findings.`,
    psi?.lab ? `PageSpeed ${psi.strategy} lab performance is ${psi.lab.performance ?? "unavailable"}.` : "PageSpeed did not add a lab score.",
    external.backlinks.some((item) => item.metrics.length) ? "Backlink metrics were returned by a connected provider and are not part of the health score." : "No backlink index was queried.",
  ].join(" ");

  try {
    await replaceIssues(scanId, issues, scores, summary, psi, { backlinks: external.backlinks, visibility: external.visibility }, pages.length);
  } catch (error) {
    await markFailed(scanId, publicError(error));
    throw error;
  }
  const { getScan } = await import("./store.server.ts");
  return getScan(scanId);
}
