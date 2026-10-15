import { registrableHost } from "./net.ts";
import { makeIssue } from "./remedies.ts";
import type { Issue, PageRecord, PsiResult, ScanConfig, SitemapSnapshot } from "./types.ts";

export type AnalyzeInput = {
  pages: PageRecord[];
  skipped: { url: string; reason: string }[];
  sitemap: SitemapSnapshot | null;
  robotsStatus: number | null;
  robotsError?: string;
  config: Pick<ScanConfig, "titleShort" | "titleLong" | "metaShort" | "metaLong" | "thinWords" | "maxDepth">;
  psi: PsiResult | null;
  brokenExternal: { from: string; to: string; status: number }[];
  host: string;
  localFlags: { url: string; incomplete: boolean }[];
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function syllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function flesch(text: string): number | null {
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().split(/\s+/).length > 2);
  const words = text.split(/\s+/).filter((word) => /[a-z]/i.test(word));
  if (words.length < 80 || sentences.length < 3) return null;
  const syllableCount = words.reduce((sum, word) => sum + syllables(word), 0);
  return 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllableCount / words.length);
}

function shingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 400);
  const out = new Set<string>();
  for (let i = 0; i < words.length - 4; i += 1) out.add(words.slice(i, i + 5).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const value of small) if (large.has(value)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function isHome(url: string, host: string): boolean {
  try {
    const u = new URL(url);
    return registrableHost(u.hostname) === registrableHost(host) && (u.pathname === "/" || u.pathname === "");
  } catch {
    return false;
  }
}

export function analyze(input: AnalyzeInput): Issue[] {
  const issues: Issue[] = [];
  const htmlPages = input.pages.filter((page) => !page.nonHtml && !page.error && page.status < 400 && !page.redirectLoop);

  if (input.robotsError || (input.robotsStatus != null && input.robotsStatus >= 500)) {
    issues.push(
      makeIssue(
        "robots_unreachable",
        null,
        input.robotsError || `HTTP ${input.robotsStatus}`,
        "robots.txt did not return a usable document.",
      ),
    );
  }

  for (const skip of input.skipped) {
    const home = isHome(skip.url, input.host);
    issues.push(
      makeIssue(
        home ? "robots_blocks_home" : "robots_blocks_page",
        skip.url,
        `Skipped because ${skip.reason}.`,
        home
          ? "The homepage matches a robots.txt disallow, so it was not fetched."
          : "This URL was discovered but left unfetched because robots.txt disallows it.",
        home ? { severity: "critical" } : undefined,
      ),
    );
  }

  if (!input.sitemap || input.sitemap.locs.length === 0) {
    const failed = input.sitemap?.fetched.find((file) => file.error || file.status >= 400);
    if (failed) {
      issues.push(
        makeIssue(
          "sitemap_error",
          failed.url,
          failed.error || `HTTP ${failed.status}`,
          "A sitemap URL was discovered but could not be used.",
        ),
      );
    } else if (input.sitemap && input.sitemap.fetched.length === 0) {
      issues.push(
        makeIssue(
          "sitemap_missing",
          null,
          "No sitemap in robots.txt and /sitemap.xml was not a usable URL list.",
          "Northline did not find a usable XML sitemap for this host.",
        ),
      );
    }
  } else {
    for (const file of input.sitemap.fetched) {
      if (file.error || file.status >= 400) {
        issues.push(
          makeIssue(
            "sitemap_error",
            file.url,
            file.error || `HTTP ${file.status}, ${file.count} URLs read`,
            "One of the sitemap files failed or was empty.",
          ),
        );
      }
    }
  }

  const titles = new Map<string, string[]>();
  const metas = new Map<string, string[]>();
  for (const page of htmlPages) {
    if (page.title) {
      const key = page.title.toLowerCase();
      titles.set(key, [...(titles.get(key) ?? []), page.finalUrl]);
    }
    if (page.metaDescription) {
      const key = page.metaDescription.toLowerCase();
      metas.set(key, [...(metas.get(key) ?? []), page.finalUrl]);
    }
  }

  const statusByUrl = new Map<string, number>();
  for (const page of input.pages) {
    statusByUrl.set(page.url, page.status);
    statusByUrl.set(page.finalUrl, page.status);
  }

  for (const page of input.pages) {
    if (page.redirectLoop) {
      issues.push(
        makeIssue(
          "redirect_loop",
          page.url,
          page.redirectChain.map((hop) => `${hop.status} ${hop.url}`).join(" → ") || page.url,
          "The redirect chain repeats a URL and never finishes.",
        ),
      );
      continue;
    }
    if (page.error) {
      issues.push(makeIssue("fetch_error", page.url, page.error, "The crawler could not read this URL."));
      continue;
    }
    if (page.status >= 500) {
      issues.push(
        makeIssue("http_5xx", page.finalUrl || page.url, `HTTP ${page.status}`, `The final response was HTTP ${page.status}.`),
      );
      continue;
    }
    if (page.status >= 400) {
      issues.push(
        makeIssue(
          "http_4xx",
          page.finalUrl || page.url,
          `HTTP ${page.status}`,
          `The final response was HTTP ${page.status}.`,
          { severity: page.status === 404 || page.status === 410 ? "high" : "medium" },
        ),
      );
      continue;
    }
    if (page.redirectChain.length >= 3) {
      issues.push(
        makeIssue(
          "redirect_chain",
          page.url,
          page.redirectChain.map((hop) => `${hop.status} ${hop.url}`).join(" → "),
          `This URL redirected ${page.redirectChain.length - 1} times before the final response.`,
          { severity: page.redirectChain.length >= 4 ? "high" : "medium" },
        ),
      );
    }
    if (page.finalUrl.startsWith("http://")) {
      issues.push(
        makeIssue(
          "not_https",
          page.finalUrl,
          page.finalUrl,
          "The final URL uses HTTP.",
          { severity: isHome(page.finalUrl, input.host) ? "critical" : "high" },
        ),
      );
    }
    if (page.nonHtml) {
      issues.push(
        makeIssue("non_html", page.finalUrl, page.contentType || "unknown content type", "The response was not treated as HTML."),
      );
      continue;
    }

    if (page.mixedContent.length) {
      issues.push(
        makeIssue(
          "mixed_content",
          page.finalUrl,
          page.mixedContent.slice(0, 8).join("\n"),
          `${page.mixedContent.length} HTTP resource${page.mixedContent.length === 1 ? "" : "s"} on an HTTPS page.`,
        ),
      );
    }
    if (!page.canonical) {
      issues.push(
        makeIssue("canonical_missing", page.finalUrl, "No rel=canonical href was found.", "This HTML response has no canonical link."),
      );
    } else if (page.canonicalCount > 1) {
      issues.push(
        makeIssue(
          "canonical_multiple",
          page.finalUrl,
          `${page.canonicalCount} canonical links. First: ${page.canonical}`,
          "More than one canonical link was present.",
        ),
      );
    } else if (registrableHost(hostOf(page.canonical)) !== registrableHost(input.host)) {
      issues.push(
        makeIssue(
          "canonical_offhost",
          page.finalUrl,
          page.canonical,
          "The canonical host is not the host that was audited.",
        ),
      );
    }
    const noindex = /noindex/i.test(`${page.robotsMeta ?? ""} ${page.xRobotsTag ?? ""}`);
    if (noindex && isHome(page.finalUrl, input.host)) {
      issues.push(
        makeIssue(
          "noindex_home",
          page.finalUrl,
          `meta robots: ${page.robotsMeta ?? "none"}; X-Robots-Tag: ${page.xRobotsTag ?? "none"}`,
          "The homepage carries a noindex directive.",
        ),
      );
    } else if (noindex) {
      issues.push(
        makeIssue(
          "noindex",
          page.finalUrl,
          `meta robots: ${page.robotsMeta ?? "none"}; X-Robots-Tag: ${page.xRobotsTag ?? "none"}`,
          "The page carries a noindex directive.",
        ),
      );
    }
    if (noindex && page.canonical === page.finalUrl && input.sitemap?.locs.includes(page.finalUrl)) {
      issues.push(
        makeIssue(
          "index_conflict",
          page.finalUrl,
          "noindex is set, the canonical points at this URL, and the URL is in the sitemap.",
          "Indexability signals disagree.",
        ),
      );
    }
    for (const alt of page.hreflang) {
      if (!alt.lang || !alt.href || !/^https?:\/\//i.test(alt.href) || !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(alt.lang)) {
        if (alt.lang.toLowerCase() === "x-default" && alt.href) continue;
        issues.push(
          makeIssue(
            "hreflang_bad",
            page.finalUrl,
            `hreflang="${alt.lang}" href="${alt.href}"`,
            "An alternate link has a missing, relative, or unusual hreflang value.",
          ),
        );
        break;
      }
    }
    const crawled = new Map(htmlPages.map((item) => [item.finalUrl, item]));
    for (const alt of page.hreflang) {
      const other = crawled.get(alt.href);
      if (!other) continue;
      const returns = other.hreflang.some((item) => item.href === page.finalUrl);
      if (!returns) {
        issues.push(
          makeIssue(
            "hreflang_no_return",
            page.finalUrl,
            `${alt.lang} → ${alt.href} does not link back.`,
            "A crawled alternate does not point back to this URL.",
          ),
        );
        break;
      }
    }
    if (page.depth >= 4) {
      issues.push(
        makeIssue("deep_page", page.finalUrl, `Crawl depth ${page.depth}.`, "The URL was only reached after several links."),
      );
    }
    if (
      isHome(page.finalUrl, input.host) &&
      page.finalUrl.startsWith("https://") &&
      (!page.headers.hsts || !page.headers.xContentTypeOptions || !page.headers.referrerPolicy)
    ) {
      const missing = [
        !page.headers.hsts ? "Strict-Transport-Security" : null,
        !page.headers.csp ? "Content-Security-Policy" : null,
        !page.headers.xContentTypeOptions ? "X-Content-Type-Options" : null,
        !page.headers.xFrameOptions ? "frame protection" : null,
        !page.headers.referrerPolicy ? "Referrer-Policy" : null,
      ].filter(Boolean);
      issues.push(
        makeIssue(
          "security_headers",
          page.finalUrl,
          `Missing: ${missing.join(", ")}`,
          "Some recommended security headers were not on the homepage response.",
        ),
      );
    }

    if (!page.title) {
      issues.push(makeIssue("title_missing", page.finalUrl, "The title element was empty or absent.", "No title text was extracted."));
    } else {
      if (page.titleCount > 1) {
        issues.push(makeIssue("title_multiple", page.finalUrl, `${page.titleCount} title elements.`, "Multiple title elements were present."));
      }
      if (page.title.length < input.config.titleShort) {
        issues.push(
          makeIssue(
            "title_short",
            page.finalUrl,
            `"${page.title}" (${page.title.length} characters). Threshold: ${input.config.titleShort}.`,
            "The title is below the configured review length.",
          ),
        );
      }
      if (page.title.length > input.config.titleLong) {
        issues.push(
          makeIssue(
            "title_long",
            page.finalUrl,
            `"${page.title}" (${page.title.length} characters). Threshold: ${input.config.titleLong}.`,
            "The title is above the configured review length.",
          ),
        );
      }
      const dupes = titles.get(page.title.toLowerCase()) ?? [];
      if (dupes.length > 1) {
        issues.push(
          makeIssue(
            "title_duplicate",
            page.finalUrl,
            `Shared title "${page.title}" with ${dupes.filter((url) => url !== page.finalUrl).slice(0, 6).join(", ")}`,
            "Another crawled page uses the same title.",
          ),
        );
      }
    }
    if (!page.metaDescription) {
      issues.push(
        makeIssue("meta_missing", page.finalUrl, "No meta description content was found.", "The description hint is absent."),
      );
    } else {
      if (page.metaDescription.length < input.config.metaShort) {
        issues.push(
          makeIssue(
            "meta_short",
            page.finalUrl,
            `${page.metaDescription.length} characters. Threshold: ${input.config.metaShort}.`,
            "The meta description is below the configured review length.",
          ),
        );
      }
      if (page.metaDescription.length > input.config.metaLong) {
        issues.push(
          makeIssue(
            "meta_long",
            page.finalUrl,
            `${page.metaDescription.length} characters. Threshold: ${input.config.metaLong}.`,
            "The meta description is above the configured review length.",
          ),
        );
      }
      const dupes = metas.get(page.metaDescription.toLowerCase()) ?? [];
      if (dupes.length > 1) {
        issues.push(
          makeIssue(
            "meta_duplicate",
            page.finalUrl,
            `Shared description with ${dupes.filter((url) => url !== page.finalUrl).slice(0, 6).join(", ")}`,
            "Another crawled page uses the same meta description.",
          ),
        );
      }
    }
    const h1s = page.headings.filter((heading) => heading.level === 1);
    if (h1s.length === 0) {
      issues.push(makeIssue("h1_missing", page.finalUrl, "No H1 text was found.", "The parsed HTML has no H1."));
    } else if (h1s.length > 1) {
      issues.push(
        makeIssue(
          "h1_multiple",
          page.finalUrl,
          h1s.map((heading) => heading.text).slice(0, 6).join(" | "),
          `${h1s.length} H1 headings were found.`,
        ),
      );
    }
    let previous = 0;
    for (const heading of page.headings) {
      if (previous && heading.level > previous + 1) {
        issues.push(
          makeIssue(
            "heading_skip",
            page.finalUrl,
            `H${previous} is followed later by H${heading.level} ("${heading.text}").`,
            "The heading outline skips a level.",
          ),
        );
        break;
      }
      previous = heading.level;
    }
    if (page.imagesMissingAlt.length) {
      issues.push(
        makeIssue(
          "alt_missing",
          page.finalUrl,
          page.imagesMissingAlt.map((image) => image.src).slice(0, 8).join("\n"),
          `${page.imagesMissingAlt.length} image${page.imagesMissingAlt.length === 1 ? "" : "s"} had no alt attribute.`,
          { severity: page.imagesMissingAlt.length >= 8 ? "high" : "medium" },
        ),
      );
    }
    if (page.filenameAlts.length) {
      issues.push(
        makeIssue(
          "alt_filename",
          page.finalUrl,
          page.filenameAlts.map((image) => `${image.alt} (${image.src})`).slice(0, 6).join("\n"),
          "At least one alt attribute looks like a file name.",
        ),
      );
    }
    if (!page.openGraph["og:title"] || !page.openGraph["og:description"] || !page.openGraph["og:image"]) {
      issues.push(
        makeIssue(
          "og_missing",
          page.finalUrl,
          `og:title=${Boolean(page.openGraph["og:title"])}, og:description=${Boolean(page.openGraph["og:description"])}, og:image=${Boolean(page.openGraph["og:image"])}`,
          "Open Graph title, description, or image is missing.",
        ),
      );
    }
    if (!page.twitter["twitter:card"]) {
      issues.push(makeIssue("twitter_missing", page.finalUrl, "No twitter:card meta tag.", "X card markup was not found."));
    }
    if (page.schemaErrors.length) {
      issues.push(
        makeIssue("schema_invalid", page.finalUrl, page.schemaErrors.slice(0, 3).join("\n"), "A JSON-LD block failed to parse."),
      );
    } else if (page.schemaTypes.length === 0 && isHome(page.finalUrl, input.host)) {
      issues.push(
        makeIssue(
          "schema_missing",
          page.finalUrl,
          "No JSON-LD @type was parsed on the homepage.",
          "The homepage HTML did not contain detectable JSON-LD.",
        ),
      );
    }
    if (!page.viewport) {
      issues.push(makeIssue("viewport_missing", page.finalUrl, "No meta viewport element.", "The viewport tag is missing."));
    }
    if (!page.htmlLang) {
      issues.push(makeIssue("lang_missing", page.finalUrl, "The html element has no lang attribute.", "Document language is not declared."));
    }
    if (page.indexable && page.wordCount < input.config.thinWords) {
      issues.push(
        makeIssue(
          "thin_content",
          page.finalUrl,
          `${page.wordCount} words extracted. Review threshold: ${input.config.thinWords}. Sample: ${page.textSample.slice(0, 220)}`,
          "The extracted text is below the configured thin-content threshold.",
          { severity: page.wordCount < 40 ? "high" : "medium", confidence: "low" },
        ),
      );
    }
    if (page.wordCount > 500 && !page.headings.some((heading) => heading.level === 2)) {
      issues.push(
        makeIssue("no_h2", page.finalUrl, `${page.wordCount} words and no H2.`, "A long page has no section headings."),
      );
    }
    const ease = flesch(page.textSample);
    if (ease != null && ease < 30) {
      issues.push(
        makeIssue(
          "readability",
          page.finalUrl,
          `Approximate Flesch reading ease ${ease.toFixed(0)} on the extracted sample. This is not a Google metric.`,
          "The extracted prose scored as difficult.",
        ),
      );
    }
    try {
      const u = new URL(page.finalUrl);
      const ugly =
        u.pathname.length > 120 ||
        u.pathname.split("/").filter(Boolean).length > 6 ||
        u.pathname.includes("_") ||
        (u.search && u.search.length > 80);
      if (ugly) {
        issues.push(
          makeIssue("url_structure", page.finalUrl, page.finalUrl, "The URL is long, deeply nested, or uses underscores."),
        );
      }
    } catch {
      /* ignore */
    }

    for (const link of page.internalLinks) {
      const status = statusByUrl.get(link);
      if (status != null && status >= 400) {
        issues.push(
          makeIssue("broken_internal", page.finalUrl, `${link} returned HTTP ${status}.`, "An internal link points at an error URL that was also fetched."),
        );
      }
    }
  }

  for (const broken of input.brokenExternal.slice(0, 20)) {
    issues.push(
      makeIssue(
        "broken_external",
        broken.from,
        `${broken.to} returned HTTP ${broken.status}.`,
        "An external link check returned an error status.",
      ),
    );
  }

  const linked = new Set<string>();
  for (const page of input.pages) {
    for (const link of page.internalLinks) linked.add(link);
  }
  const sitemapLocs = input.sitemap?.locs ?? [];
  if (sitemapLocs.length) {
    for (const loc of sitemapLocs) {
      if (isHome(loc, input.host)) continue;
      const crawled = input.pages.some((page) => page.finalUrl === loc || page.url === loc);
      if (crawled && !linked.has(loc)) {
        issues.push(
          makeIssue(
            "orphan_page",
            loc,
            "Present in the sitemap. No crawled page linked to this exact URL.",
            "Within this crawl, the sitemap URL had no internal in-links.",
          ),
        );
      }
    }
    const locSet = new Set(sitemapLocs);
    let sitemapGaps = 0;
    for (const page of htmlPages) {
      if (sitemapGaps >= 8) break;
      if (page.indexable && !locSet.has(page.finalUrl) && !isHome(page.finalUrl, input.host)) {
        sitemapGaps += 1;
        issues.push(
          makeIssue(
            "not_in_sitemap",
            page.finalUrl,
            "Crawled and indexable, but not in the sitemap URLs that were read.",
            "This URL was crawled and was not listed in the parsed sitemap sample.",
          ),
        );
      }
    }
  }

  const samples = htmlPages
    .filter((page) => page.wordCount >= 120 && page.indexable)
    .map((page) => ({ url: page.finalUrl, set: shingles(page.textSample) }));
  const paired = new Set<string>();
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const left = samples[i];
      const right = samples[j];
      if (!left || !right) continue;
      const score = jaccard(left.set, right.set);
      if (score < 0.82) continue;
      const stamp = [left.url, right.url].sort().join("|");
      if (paired.has(stamp)) continue;
      paired.add(stamp);
      issues.push(
        makeIssue(
          "near_duplicate",
          right.url,
          `Jaccard similarity ${score.toFixed(2)} with ${left.url}. Shared navigation can inflate this.`,
          "Extracted text overlaps heavily with another crawled URL.",
        ),
      );
    }
  }

  if (input.localFlags.length === 0 && input.pages.some((page) => isHome(page.finalUrl, input.host))) {
    issues.push(
      makeIssue(
        "local_no_schema",
        input.pages.find((page) => isHome(page.finalUrl, input.host))?.finalUrl ?? null,
        "No LocalBusiness JSON-LD with address facts was parsed.",
        "Local schema was not detected. Ignore this for sites that are not local businesses.",
      ),
    );
  }
  for (const flag of input.localFlags) {
    if (!flag.incomplete) continue;
    issues.push(
      makeIssue(
        "local_partial",
        flag.url,
        "LocalBusiness-like JSON-LD is missing a street, locality, or telephone value.",
        "Local markup was found without a complete name-address-phone set.",
      ),
    );
  }

  if (input.psi?.lab) {
    for (const item of input.psi.opportunities.slice(0, 6)) {
      issues.push(
        makeIssue(
          "psi_opportunity",
          input.psi.finalUrl || input.psi.requestedUrl,
          `${item.title}. ${item.displayValue}. ${item.explanation}`.slice(0, 500),
          `Lighthouse lab opportunity on the ${input.psi.strategy} run.`,
          { title: item.title, source: "Google PageSpeed Insights" },
        ),
      );
    }
  }
  const fieldMetrics = input.psi?.field?.metrics ?? [];
  for (const metric of fieldMetrics) {
    const category = metric.category.toUpperCase();
    if (category !== "SLOW" && category !== "AVERAGE" && category !== "POOR" && category !== "NEEDS_IMPROVEMENT") {
      if (category === "FAST" || category === "GOOD") continue;
    }
    const poor = category === "SLOW" || category === "POOR";
    const mid = category === "AVERAGE" || category === "NEEDS_IMPROVEMENT";
    if (!poor && !mid) continue;
    issues.push(
      makeIssue(
        poor ? "cwv_poor" : "cwv_ni",
        input.psi?.finalUrl || input.psi?.requestedUrl || null,
        `${metric.name}: category ${metric.category}, percentile ${metric.percentile}. Overall field category: ${input.psi?.field?.overall ?? "unknown"}.`,
        `Field data for ${metric.name} is ${metric.category}.`,
        { title: `${metric.name} is ${metric.category.toLowerCase()} in field data`, source: "Chrome UX Report via PageSpeed Insights" },
      ),
    );
  }

  const seen = new Set<string>();
  const unique: Issue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.id)) continue;
    seen.add(issue.id);
    unique.push(issue);
  }
  unique.sort((a, b) => b.priority - a.priority || a.url?.localeCompare(b.url ?? "") || a.code.localeCompare(b.code));
  return unique.slice(0, 300);
}

export function visibilityIssues(
  rows: { query: string; page: string; clicks: string; impressions: string; ctr: string; position: string }[],
): Issue[] {
  const issues: Issue[] = [];
  for (const row of rows) {
    const impressions = Number(row.impressions);
    const ctr = Number(row.ctr);
    const position = Number(row.position);
    if (!Number.isFinite(impressions) || impressions < 50) continue;
    if (!Number.isFinite(ctr) || ctr >= 0.02) continue;
    if (Number.isFinite(position) && position > 20) continue;
    issues.push(
      makeIssue(
        "low_ctr",
        row.page || null,
        `Query “${row.query}”. Clicks ${row.clicks}, impressions ${row.impressions}, CTR ${row.ctr}, average position ${row.position}. Source date range is whatever Search Console returned for the last 28 days.`,
        "Search Console shows a query with visibility and a relatively low click-through rate.",
        { source: "Google Search Console" },
      ),
    );
  }
  return issues.slice(0, 15);
}
