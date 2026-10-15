import { providerById } from "./catalog.ts";
import { readSecrets, scrub } from "./credentials.server.ts";
import type { ConnStatus, ProviderPayload, PsiResult, ValidationRow } from "./types.ts";

type TestResult = Omit<ValidationRow, "role" | "checkedAt"> & { checkedAt?: string };

function row(id: string, status: ConnStatus, message: string, extra?: Partial<TestResult>): TestResult {
  const meta = providerById(id);
  return {
    id,
    name: meta?.name ?? id,
    status,
    auth: status === "connected" || status === "connected_limited" ? "Accepted" : status === "not_configured" ? "Missing" : "Rejected or unknown",
    permission: status === "permission_denied" ? "Denied" : status === "connected" ? "Sufficient for the test call" : "Not verified",
    quota: extra?.quota ?? null,
    message,
    action: extra?.action ?? actionFor(status, meta?.name ?? id),
    ...extra,
    status,
  };
}

function actionFor(status: ConnStatus, name: string): string {
  if (status === "not_configured") return `Add credentials for ${name} in Settings, or leave it out of the scan.`;
  if (status === "auth_failed") return "Replace the key or refresh token. The provider rejected the credentials.";
  if (status === "permission_denied") return "The credentials are recognized but cannot perform this call. Check API restrictions and property access.";
  if (status === "rate_limited") return "Wait and retry. Do not start a scan that requires this provider until the limit clears.";
  if (status === "quota_exhausted") return "Add credits or wait for the quota reset. You can continue only if this provider is optional.";
  if (status === "unavailable") return "The provider could not be reached. Retry later or drop it from required providers.";
  if (status === "inconclusive") return "The response did not prove the credentials. Check the documentation link and try again.";
  if (status === "connected_limited") return "You can continue, but part of the data will be missing or restricted.";
  return "No action needed for this test.";
}

async function readBody(res: Response, secrets: string[]): Promise<{ text: string; json: unknown }> {
  const text = scrub(await res.text(), secrets);
  try {
    return { text, json: JSON.parse(text) as unknown };
  } catch {
    return { text, json: null };
  }
}

function classify(status: number, text: string): ConnStatus | null {
  if (status === 401 || /invalid api key|api key not valid|unauthorized|invalid_grant|invalid_client/i.test(text)) return "auth_failed";
  if (status === 403 || /permission|forbidden|access denied/i.test(text)) {
    if (/quota|credit|unit/i.test(text)) return "quota_exhausted";
    return "permission_denied";
  }
  if (status === 429) return /quota|credit|unit|exhaust/i.test(text) ? "quota_exhausted" : "rate_limited";
  if (status === 402) return "quota_exhausted";
  if (status >= 500) return "unavailable";
  return null;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function googleToken(fields: Record<string, string>, secrets: string[]) {
  const body = new URLSearchParams({
    client_id: fields.clientId ?? "",
    client_secret: fields.clientSecret ?? "",
    refresh_token: fields.refreshToken ?? "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const parsed = await readBody(res, secrets);
  const json = parsed.json as { access_token?: string; error?: string; error_description?: string } | null;
  if (!res.ok || !json?.access_token) {
    const message = json?.error_description || json?.error || parsed.text || `HTTP ${res.status}`;
    const status = classify(res.status, message) ?? "auth_failed";
    return { ok: false as const, status, message };
  }
  return { ok: true as const, token: json.access_token };
}

export async function testProvider(token: string, providerId: string): Promise<TestResult> {
  const fields = readSecrets(token, providerId);
  const secrets = Object.values(fields);
  try {
    if (providerId === "crawler") {
      return row("crawler", "connected", "The crawler does not need an API key. The target URL is checked when the scan starts.");
    }
    if (providerId === "pagespeed") {
      const key = fields.apiKey ?? "";
      if (!key) return row("pagespeed", "not_configured", "No PageSpeed API key is saved in this session.", { auth: "Missing" });
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent("https://invalid.invalid")}&key=${encodeURIComponent(key)}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
      const parsed = await readBody(res, [key]);
      if (/API key not valid|API_KEY_INVALID/i.test(parsed.text)) {
        return row("pagespeed", "auth_failed", "Google rejected the API key.");
      }
      if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED/i.test(parsed.text)) {
        return row("pagespeed", "permission_denied", "The key is restricted away from server-side PageSpeed calls. Use an unrestricted key or an IP restriction that includes this server.");
      }
      const classified = classify(res.status, parsed.text);
      if (classified && classified !== "auth_failed") return row("pagespeed", classified, parsed.text.slice(0, 240));
      if (/invalid/i.test(parsed.text) && res.status === 400) {
        return row("pagespeed", "connected", "The key was accepted. The test used an invalid URL on purpose so it would not run a full Lighthouse audit.");
      }
      if (res.ok) return row("pagespeed", "connected", "PageSpeed accepted the key.");
      return row("pagespeed", "inconclusive", parsed.text.slice(0, 240) || `HTTP ${res.status}`);
    }
    if (providerId === "search_console") {
      if (!fields.clientId || !fields.clientSecret || !fields.refreshToken) {
        return row("search_console", "not_configured", "Client ID, client secret, and refresh token are all required.");
      }
      const auth = await googleToken(fields, secrets);
      if (!auth.ok) return row("search_console", auth.status, auth.message);
      const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { authorization: `Bearer ${auth.token}` },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, secrets);
      const classified = classify(res.status, parsed.text);
      if (!res.ok) return row("search_console", classified ?? "unavailable", parsed.text.slice(0, 240));
      const sites = ((parsed.json as { siteEntry?: unknown[] } | null)?.siteEntry ?? []).length;
      return row("search_console", "connected", `Token accepted. The account lists ${sites} Search Console site${sites === 1 ? "" : "s"}.`, {
        quota: "Search Analytics quota was not consumed by this sites list.",
      });
    }
    if (providerId === "ga4") {
      if (!fields.propertyId || !fields.clientId || !fields.clientSecret || !fields.refreshToken) {
        return row("ga4", "not_configured", "Property ID, client ID, client secret, and refresh token are required.");
      }
      if (!/^\d+$/.test(fields.propertyId)) return row("ga4", "inconclusive", "The GA4 property ID should be numeric.");
      const auth = await googleToken(fields, secrets);
      if (!auth.ok) return row("ga4", auth.status, auth.message);
      const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${fields.propertyId}/metadata`, {
        headers: { authorization: `Bearer ${auth.token}` },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, secrets);
      if (!res.ok) return row("ga4", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      return row("ga4", "connected", `Data API metadata is readable for property ${fields.propertyId}.`);
    }
    if (providerId === "bing") {
      if (!fields.apiKey) return row("bing", "not_configured", "No Bing Webmaster API key is saved.");
      const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?apikey=${encodeURIComponent(fields.apiKey)}`, {
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.apiKey]);
      if (!res.ok) return row("bing", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240) || `HTTP ${res.status}`);
      if (parsed.text.trim().startsWith("<")) return row("bing", "inconclusive", "Bing returned HTML instead of JSON, so the method was not confirmed.");
      const count = ((parsed.json as { d?: unknown[] } | null)?.d ?? []).length;
      return row("bing", "connected", `Bing accepted the key and returned ${count} verified site${count === 1 ? "" : "s"}.`);
    }
    if (providerId === "ahrefs") {
      if (!fields.apiToken) return row("ahrefs", "not_configured", "No Ahrefs API token is saved.");
      const res = await fetch("https://api.ahrefs.com/v3/subscription-info/limits-and-usage", {
        headers: { authorization: `Bearer ${fields.apiToken}`, accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.apiToken]);
      if (!res.ok) return row("ahrefs", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      const limits = (parsed.json as { limits_and_usage?: Record<string, unknown> } | null)?.limits_and_usage;
      const quota = limits
        ? `Units used ${String(limits.units_usage_api_key ?? "unknown")} / ${String(limits.units_limit_api_key ?? "unlimited")}`
        : null;
      return row("ahrefs", "connected", "Ahrefs accepted the token on the free limits endpoint.", { quota });
    }
    if (providerId === "semrush") {
      if (!fields.apiKey) return row("semrush", "not_configured", "No Semrush API key is saved.");
      const res = await fetch(`https://www.semrush.com/users/countapiunits.html?key=${encodeURIComponent(fields.apiKey)}`, {
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.apiKey]);
      if (!res.ok) return row("semrush", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      if (/error|invalid|denied/i.test(parsed.text) && !/^\d+$/.test(parsed.text.trim())) {
        return row("semrush", classify(res.status, parsed.text) ?? "auth_failed", parsed.text.slice(0, 240));
      }
      return row("semrush", "connected", "Semrush returned an API unit balance.", { quota: `${parsed.text.trim()} units reported` });
    }
    if (providerId === "moz") {
      if (!fields.accessId || !fields.secretKey) return row("moz", "not_configured", "Moz Access ID and Secret Key are both required.");
      const basic = Buffer.from(`${fields.accessId}:${fields.secretKey}`).toString("base64");
      const res = await fetch("https://lsapi.seomoz.com/v2/usage_data", {
        headers: { authorization: `Basic ${basic}` },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.accessId, fields.secretKey, basic]);
      if (res.status === 404) return row("moz", "inconclusive", "Moz did not expose the usage endpoint for this account, so the credentials were not confirmed.");
      if (!res.ok) return row("moz", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      return row("moz", "connected", "Moz accepted the credentials on the usage endpoint.", { quota: parsed.text.slice(0, 180) });
    }
    if (providerId === "dataforseo") {
      if (!fields.login || !fields.password) return row("dataforseo", "not_configured", "DataForSEO login and password are required.");
      const basic = Buffer.from(`${fields.login}:${fields.password}`).toString("base64");
      const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        headers: { authorization: `Basic ${basic}` },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.login, fields.password, basic]);
      if (!res.ok) return row("dataforseo", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      const money = (parsed.json as { tasks?: { result?: { money?: { balance?: number } }[] }[] } | null)?.tasks?.[0]?.result?.[0]?.money?.balance;
      return row("dataforseo", "connected", "DataForSEO returned account data.", {
        quota: money == null ? null : `Balance ${money}`,
      });
    }
    if (providerId === "serpapi") {
      if (!fields.apiKey) return row("serpapi", "not_configured", "No SerpApi key is saved.");
      const res = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(fields.apiKey)}`, {
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(res, [fields.apiKey]);
      if (!res.ok) return row("serpapi", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      const account = parsed.json as { plan_searches_left?: number; total_searches_left?: number } | null;
      const left = account?.total_searches_left ?? account?.plan_searches_left;
      if (left === 0) {
        return row("serpapi", "quota_exhausted", "SerpApi accepted the key and reported no searches left.", { quota: "0 searches left" });
      }
      return row("serpapi", "connected", "SerpApi accepted the key.", {
        quota: left == null ? null : `${left} searches left`,
      });
    }
    if (providerId === "majestic") {
      if (!fields.apiKey) return row("majestic", "not_configured", "No Majestic API key is saved.");
      const res = await fetch(
        `https://api.majestic.com/api/json?app_api_key=${encodeURIComponent(fields.apiKey)}&cmd=get-subscription-info`,
        { signal: AbortSignal.timeout(12000) },
      );
      const parsed = await readBody(res, [fields.apiKey]);
      if (!res.ok) return row("majestic", classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240));
      const code = (parsed.json as { Code?: string; ErrorMessage?: string } | null)?.Code;
      if (code && code !== "OK") {
        return row("majestic", /key|auth/i.test(parsed.text) ? "auth_failed" : "inconclusive", parsed.text.slice(0, 240));
      }
      return row("majestic", "connected", "Majestic returned subscription info.");
    }
    return row(providerId, "inconclusive", "This provider has no connection test.");
  } catch (error) {
    const message = scrub(error instanceof Error ? error.message : "Request failed", secrets);
    return row(providerId, /timed out|timeout/i.test(message) ? "unavailable" : "unavailable", message);
  }
}

function payload(id: string, ok: boolean, status: ConnStatus, message: string, metrics: ProviderPayload["metrics"], rows: Record<string, string>[] = [], spent = false): ProviderPayload {
  return {
    id,
    name: providerById(id)?.name ?? id,
    ok,
    status,
    message,
    metrics,
    rows,
    retrievedAt: new Date().toISOString(),
    spentUnits: spent,
  };
}

function auditValue(audits: Record<string, { displayValue?: string }>, key: string): string | null {
  return audits[key]?.displayValue ?? null;
}

export async function runPageSpeed(pageUrl: string, strategy: "mobile" | "desktop", apiKey: string): Promise<PsiResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("strategy", strategy);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    endpoint.searchParams.append("category", category);
  }
  if (apiKey) endpoint.searchParams.set("key", apiKey);
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(50000) });
    const text = scrub(await res.text(), apiKey ? [apiKey] : []);
    const json = JSON.parse(text) as {
      lighthouseResult?: {
        finalUrl?: string;
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, { title?: string; description?: string; displayValue?: string; score?: number | null; details?: { type?: string }; numericValue?: number }>;
      };
      loadingExperience?: { overall_category?: string; metrics?: Record<string, { category?: string; percentile?: number }> };
      originLoadingExperience?: { overall_category?: string };
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        strategy,
        requestedUrl: pageUrl,
        finalUrl: null,
        fetchedAt,
        lab: null,
        field: null,
        originField: null,
        opportunities: [],
        error: json.error?.message || text.slice(0, 280),
        source: "Google PageSpeed Insights",
      };
    }
    const categories = json.lighthouseResult?.categories ?? {};
    const audits = json.lighthouseResult?.audits ?? {};
    const score = (name: string) => {
      const value = categories[name]?.score;
      return typeof value === "number" ? Math.round(value * 100) : null;
    };
    const fieldMetrics = Object.entries(json.loadingExperience?.metrics ?? {}).map(([name, metric]) => ({
      name,
      category: String(metric.category ?? "unknown"),
      percentile: metric.percentile == null ? "n/a" : String(metric.percentile),
    }));
    const opportunities = Object.values(audits)
      .filter((audit) => audit.details?.type === "opportunity" && (audit.score ?? 1) < 0.9)
      .sort((a, b) => (b.numericValue ?? 0) - (a.numericValue ?? 0))
      .slice(0, 6)
      .map((audit) => ({
        title: audit.title ?? "Opportunity",
        displayValue: audit.displayValue ?? "",
        explanation: (audit.description ?? "").replace(/\[(.+?)\]\(.+?\)/g, "$1").slice(0, 280),
      }));
    return {
      strategy,
      requestedUrl: pageUrl,
      finalUrl: json.lighthouseResult?.finalUrl ?? null,
      fetchedAt,
      lab: {
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
        lcp: auditValue(audits, "largest-contentful-paint"),
        cls: auditValue(audits, "cumulative-layout-shift"),
        inp: auditValue(audits, "interaction-to-next-paint") ?? auditValue(audits, "experimental-interaction-to-next-paint"),
        fcp: auditValue(audits, "first-contentful-paint"),
        tbt: auditValue(audits, "total-blocking-time"),
        speedIndex: auditValue(audits, "speed-index"),
      },
      field: json.loadingExperience
        ? { overall: json.loadingExperience.overall_category ?? null, metrics: fieldMetrics }
        : null,
      originField: json.originLoadingExperience ? { overall: json.originLoadingExperience.overall_category ?? null } : null,
      opportunities,
      source: "Google PageSpeed Insights",
    };
  } catch (error) {
    return {
      strategy,
      requestedUrl: pageUrl,
      finalUrl: null,
      fetchedAt,
      lab: null,
      field: null,
      originField: null,
      opportunities: [],
      error: scrub(error instanceof Error ? error.message : "PageSpeed failed", apiKey ? [apiKey] : []),
      source: "Google PageSpeed Insights",
    };
  }
}

function matchSite(sites: string[], host: string): string | null {
  const bare = host.replace(/^www\./, "");
  for (const site of sites) {
    if (site === `sc-domain:${bare}` || site === `sc-domain:${host}`) return site;
    try {
      const url = new URL(site);
      if (url.hostname === host || url.hostname.replace(/^www\./, "") === bare) return site;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function collectExternal(input: {
  token: string;
  host: string;
  pageUrl: string;
  picks: { id: string; included: boolean; spend: boolean }[];
}): Promise<{ backlinks: ProviderPayload[]; visibility: ProviderPayload[]; gscRows: { query: string; page: string; clicks: string; impressions: string; ctr: string; position: string }[] }> {
  const backlinks: ProviderPayload[] = [];
  const visibility: ProviderPayload[] = [];
  const gscRows: { query: string; page: string; clicks: string; impressions: string; ctr: string; position: string }[] = [];
  const wanted = new Set(input.picks.filter((pick) => pick.included).map((pick) => pick.id));
  const spend = new Set(input.picks.filter((pick) => pick.spend).map((pick) => pick.id));

  if (wanted.has("search_console")) {
    const fields = readSecrets(input.token, "search_console");
    const secrets = Object.values(fields);
    try {
      const auth = await googleToken(fields, secrets);
      if (!auth.ok) {
        visibility.push(payload("search_console", false, auth.status, auth.message, []));
      } else {
        const list = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
          headers: { authorization: `Bearer ${auth.token}` },
          signal: AbortSignal.timeout(12000),
        });
        const parsed = await readBody(list, secrets);
        const entries = ((parsed.json as { siteEntry?: { siteUrl?: string }[] } | null)?.siteEntry ?? [])
          .map((entry) => entry.siteUrl ?? "")
          .filter(Boolean);
        const site = matchSite(entries, input.host);
        if (!list.ok) {
          visibility.push(payload("search_console", false, classify(list.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), []));
        } else if (!site) {
          visibility.push(
            payload(
              "search_console",
              false,
              "permission_denied",
              `No verified property matches ${input.host}. Sites on this account: ${entries.slice(0, 6).join(", ") || "none"}.`,
              [],
            ),
          );
        } else {
          const query = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
            method: "POST",
            headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
            body: JSON.stringify({
              startDate: isoDaysAgo(28),
              endDate: isoDaysAgo(1),
              dimensions: ["query", "page"],
              rowLimit: 25,
            }),
            signal: AbortSignal.timeout(20000),
          });
          const body = await readBody(query, secrets);
          if (!query.ok) {
            visibility.push(payload("search_console", false, classify(query.status, body.text) ?? "unavailable", body.text.slice(0, 240), []));
          } else {
            const rows = ((body.json as { rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[] } | null)?.rows ?? []).map((item) => ({
              query: item.keys?.[0] ?? "",
              page: item.keys?.[1] ?? "",
              clicks: String(item.clicks ?? ""),
              impressions: String(item.impressions ?? ""),
              ctr: item.ctr == null ? "" : item.ctr.toFixed(4),
              position: item.position == null ? "" : item.position.toFixed(1),
            }));
            gscRows.push(...rows);
            visibility.push(
              payload(
                "search_console",
                true,
                "connected",
                `Search Console property ${site}, last 28 days ending yesterday. ${rows.length} query/page rows.`,
                [{ label: "Property", value: site }, { label: "Rows", value: String(rows.length) }],
                rows,
              ),
            );
          }
        }
      }
    } catch (error) {
      visibility.push(payload("search_console", false, "unavailable", error instanceof Error ? error.message : "Search Console failed", []));
    }
  }

  if (wanted.has("ga4")) {
    const fields = readSecrets(input.token, "ga4");
    const secrets = Object.values(fields);
    try {
      const auth = await googleToken(fields, secrets);
      if (!auth.ok) visibility.push(payload("ga4", false, auth.status, auth.message, []));
      else {
        const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${fields.propertyId}:runReport`, {
          method: "POST",
          headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
            dimensions: [{ name: "landingPage" }],
            metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
            dimensionFilter: {
              filter: {
                fieldName: "sessionDefaultChannelGroup",
                stringFilter: { matchType: "EXACT", value: "Organic Search" },
              },
            },
            limit: 15,
          }),
          signal: AbortSignal.timeout(20000),
        });
        const parsed = await readBody(res, secrets);
        if (!res.ok) {
          visibility.push(payload("ga4", false, classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), []));
        } else {
          const rows = ((parsed.json as { rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[] } | null)?.rows ?? []).map((item) => ({
            landingPage: item.dimensionValues?.[0]?.value ?? "",
            sessions: item.metricValues?.[0]?.value ?? "",
            engagedSessions: item.metricValues?.[1]?.value ?? "",
          }));
          visibility.push(
            payload(
              "ga4",
              true,
              "connected",
              "GA4 organic landing pages for the last 28 days. These are analytics sessions, not rankings.",
              [{ label: "Property", value: fields.propertyId ?? "" }, { label: "Rows", value: String(rows.length) }],
              rows,
            ),
          );
        }
      }
    } catch (error) {
      visibility.push(payload("ga4", false, "unavailable", error instanceof Error ? error.message : "GA4 failed", []));
    }
  }

  if (wanted.has("bing")) {
    const fields = readSecrets(input.token, "bing");
    try {
      const list = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?apikey=${encodeURIComponent(fields.apiKey ?? "")}`, {
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(list, [fields.apiKey ?? ""]);
      const sites = ((parsed.json as { d?: { Url?: string }[] } | null)?.d ?? []).map((site) => site.Url ?? "").filter(Boolean);
      const site = sites.find((url) => {
        try {
          return new URL(url).hostname.replace(/^www\./, "") === input.host.replace(/^www\./, "");
        } catch {
          return false;
        }
      });
      if (!list.ok || !site) {
        visibility.push(
          payload(
            "bing",
            false,
            list.ok ? "permission_denied" : classify(list.status, parsed.text) ?? "unavailable",
            site ? parsed.text.slice(0, 200) : `No verified Bing site matches ${input.host}.`,
            [],
          ),
        );
      } else {
        const stats = await fetch(
          `https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats?apikey=${encodeURIComponent(fields.apiKey ?? "")}&siteUrl=${encodeURIComponent(site)}`,
          { signal: AbortSignal.timeout(15000) },
        );
        const body = await readBody(stats, [fields.apiKey ?? ""]);
        if (!stats.ok || body.text.trim().startsWith("<")) {
          visibility.push(payload("bing", false, "inconclusive", body.text.slice(0, 220) || `HTTP ${stats.status}`, [{ label: "Site", value: site }]));
        } else {
          const rows = ((body.json as { d?: Record<string, unknown>[] } | null)?.d ?? []).slice(0, 14).map((item) =>
            Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value ?? "")])),
          );
          visibility.push(payload("bing", true, "connected", `Bing rank and traffic stats for ${site}.`, [{ label: "Site", value: site }], rows));
        }
      }
    } catch (error) {
      visibility.push(payload("bing", false, "unavailable", error instanceof Error ? error.message : "Bing failed", []));
    }
  }

  if (wanted.has("ahrefs")) {
    const fields = readSecrets(input.token, "ahrefs");
    if (!spend.has("ahrefs")) {
      backlinks.push(payload("ahrefs", true, "connected_limited", "Ahrefs is connected, but domain rating was not requested. Turn on unit spend to fetch it. No backlink list was invented.", []));
    } else {
      try {
        const res = await fetch(
          `https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${encodeURIComponent(input.host)}&date=${isoDaysAgo(1)}`,
          { headers: { authorization: `Bearer ${fields.apiToken ?? ""}`, accept: "application/json" }, signal: AbortSignal.timeout(20000) },
        );
        const parsed = await readBody(res, [fields.apiToken ?? ""]);
        if (!res.ok) backlinks.push(payload("ahrefs", false, classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), [], true));
        else {
          const rating = (parsed.json as { domain_rating?: { domain_rating?: number; ahrefs_rank?: number } } | null)?.domain_rating;
          backlinks.push(
            payload(
              "ahrefs",
              true,
              "connected_limited",
              "Domain rating only. This is not a full backlink index.",
              [
                { label: "Domain rating", value: String(rating?.domain_rating ?? "n/a"), note: "Ahrefs vendor metric" },
                { label: "Ahrefs rank", value: String(rating?.ahrefs_rank ?? "n/a") },
              ],
              [],
              true,
            ),
          );
        }
      } catch (error) {
        backlinks.push(payload("ahrefs", false, "unavailable", error instanceof Error ? error.message : "Ahrefs failed", [], true));
      }
    }
  }

  if (wanted.has("semrush")) {
    const fields = readSecrets(input.token, "semrush");
    if (!spend.has("semrush")) {
      visibility.push(payload("semrush", true, "connected_limited", "Semrush is connected. Domain ranks were not requested, so no estimate was fetched.", []));
    } else {
      try {
        const res = await fetch(
          `https://api.semrush.com/?type=domain_ranks&key=${encodeURIComponent(fields.apiKey ?? "")}&export_columns=Dn,Rk,Or,Ot,Oc&domain=${encodeURIComponent(input.host)}&database=us`,
          { signal: AbortSignal.timeout(20000) },
        );
        const text = scrub(await res.text(), [fields.apiKey ?? ""]);
        if (!res.ok || /^ERROR/i.test(text)) {
          visibility.push(payload("semrush", false, classify(res.status, text) ?? "unavailable", text.slice(0, 240), [], true));
        } else {
          const lines = text.trim().split(/\r?\n/);
          const headers = (lines[0] ?? "").split(";");
          const values = (lines[1] ?? "").split(";");
          const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
          visibility.push(
            payload(
              "semrush",
              true,
              "connected_limited",
              "Semrush domain_ranks for database=us. Organic traffic figures are Semrush estimates, not analytics.",
              Object.entries(record).map(([label, value]) => ({ label, value, note: "Semrush estimate or index metric" })),
              [record],
              true,
            ),
          );
        }
      } catch (error) {
        visibility.push(payload("semrush", false, "unavailable", error instanceof Error ? error.message : "Semrush failed", [], true));
      }
    }
  }

  if (wanted.has("moz")) {
    const fields = readSecrets(input.token, "moz");
    if (!spend.has("moz")) {
      backlinks.push(payload("moz", true, "connected_limited", "Moz is connected. URL metrics were not requested, so no rows were spent.", []));
    } else {
      try {
        const basic = Buffer.from(`${fields.accessId ?? ""}:${fields.secretKey ?? ""}`).toString("base64");
        const res = await fetch("https://lsapi.seomoz.com/v2/url_metrics", {
          method: "POST",
          headers: { authorization: `Basic ${basic}`, "content-type": "application/json" },
          body: JSON.stringify({ targets: [input.host] }),
          signal: AbortSignal.timeout(20000),
        });
        const parsed = await readBody(res, [fields.accessId ?? "", fields.secretKey ?? "", basic]);
        if (!res.ok) backlinks.push(payload("moz", false, classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), [], true));
        else {
          const result = ((parsed.json as { results?: Record<string, unknown>[] } | null)?.results ?? [])[0] ?? {};
          const metrics = ["domain_authority", "page_authority", "spam_score", "root_domains_to_root_domain", "pages_to_root_domain"]
            .filter((key) => result[key] != null)
            .map((key) => ({
              label: key,
              value: String(result[key]),
              note: key === "spam_score" ? "Moz vendor metric. Not a verdict that links are harmful." : "Moz metric",
            }));
          backlinks.push(payload("moz", true, "connected_limited", "Moz URL metrics for the host. This is not a complete backlink list.", metrics, [], true));
        }
      } catch (error) {
        backlinks.push(payload("moz", false, "unavailable", error instanceof Error ? error.message : "Moz failed", [], true));
      }
    }
  }

  if (wanted.has("dataforseo")) {
    const fields = readSecrets(input.token, "dataforseo");
    if (!spend.has("dataforseo")) {
      backlinks.push(payload("dataforseo", true, "connected_limited", "DataForSEO is connected. The billed backlink summary was not requested.", []));
    } else {
      try {
        const basic = Buffer.from(`${fields.login ?? ""}:${fields.password ?? ""}`).toString("base64");
        const res = await fetch("https://api.dataforseo.com/v3/backlinks/summary/live", {
          method: "POST",
          headers: { authorization: `Basic ${basic}`, "content-type": "application/json" },
          body: JSON.stringify([{ target: input.host, include_subdomains: true }]),
          signal: AbortSignal.timeout(25000),
        });
        const parsed = await readBody(res, [fields.login ?? "", fields.password ?? "", basic]);
        const task = (parsed.json as { tasks?: { status_message?: string; result?: Record<string, unknown>[] }[] } | null)?.tasks?.[0];
        if (!res.ok || !task?.result?.[0]) {
          backlinks.push(payload("dataforseo", false, classify(res.status, parsed.text) ?? "unavailable", task?.status_message || parsed.text.slice(0, 240), [], true));
        } else {
          const result = task.result[0];
          const metrics = ["rank", "backlinks", "referring_domains", "referring_main_domains"]
            .filter((key) => result[key] != null)
            .map((key) => ({ label: key, value: String(result[key]), note: "DataForSEO index, not the entire web" }));
          backlinks.push(payload("dataforseo", true, "connected_limited", "DataForSEO backlink summary. A partial index is not the whole web.", metrics, [], true));
        }
      } catch (error) {
        backlinks.push(payload("dataforseo", false, "unavailable", error instanceof Error ? error.message : "DataForSEO failed", [], true));
      }
    }
  }

  if (wanted.has("serpapi")) {
    const fields = readSecrets(input.token, "serpapi");
    if (!spend.has("serpapi")) {
      visibility.push(payload("serpapi", true, "connected_limited", "SerpApi is connected. No search credit was spent.", []));
    } else {
      try {
        const query = `site:${input.host}`;
        const res = await fetch(
          `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${encodeURIComponent(fields.apiKey ?? "")}`,
          { signal: AbortSignal.timeout(20000) },
        );
        const parsed = await readBody(res, [fields.apiKey ?? ""]);
        if (!res.ok) visibility.push(payload("serpapi", false, classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), [], true));
        else {
          const organic = ((parsed.json as { organic_results?: { title?: string; link?: string; position?: number; snippet?: string }[] } | null)?.organic_results ?? []).slice(0, 5);
          visibility.push(
            payload(
              "serpapi",
              true,
              "connected",
              `Google results via SerpApi for the explicit query “${query}”. Positions belong to that query, not to a keyword list.`,
              [{ label: "Query", value: query }],
              organic.map((item) => ({
                position: String(item.position ?? ""),
                title: item.title ?? "",
                link: item.link ?? "",
                snippet: item.snippet ?? "",
              })),
              true,
            ),
          );
        }
      } catch (error) {
        visibility.push(payload("serpapi", false, "unavailable", error instanceof Error ? error.message : "SerpApi failed", [], true));
      }
    }
  }

  if (wanted.has("majestic")) {
    const fields = readSecrets(input.token, "majestic");
    if (!spend.has("majestic")) {
      backlinks.push(payload("majestic", true, "connected_limited", "Majestic is connected. Index item info was not requested.", []));
    } else {
      try {
        const res = await fetch(
          `https://api.majestic.com/api/json?app_api_key=${encodeURIComponent(fields.apiKey ?? "")}&cmd=get-index-item-info&items=1&item0=${encodeURIComponent(input.host)}&datasource=fresh`,
          { signal: AbortSignal.timeout(20000) },
        );
        const parsed = await readBody(res, [fields.apiKey ?? ""]);
        const data = (parsed.json as { DataTables?: { Results?: { Data?: Record<string, unknown>[] } } } | null)?.DataTables?.Results?.Data?.[0];
        if (!res.ok || !data) {
          backlinks.push(payload("majestic", false, classify(res.status, parsed.text) ?? "unavailable", parsed.text.slice(0, 240), [], true));
        } else {
          const metrics = ["TrustFlow", "CitationFlow", "RefDomains", "ExtBackLinks"]
            .filter((key) => data[key] != null)
            .map((key) => ({ label: key, value: String(data[key]), note: "Majestic fresh index" }));
          backlinks.push(payload("majestic", true, "connected_limited", "Majestic fresh index item. Not a complete copy of the web.", metrics, [], true));
        }
      } catch (error) {
        backlinks.push(payload("majestic", false, "unavailable", error instanceof Error ? error.message : "Majestic failed", [], true));
      }
    }
  }

  return { backlinks, visibility, gscRows };
}
