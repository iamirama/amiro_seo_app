import type { ExternalBundle, Issue, PageRecord, PsiResult, ScanConfig, Scores, ValidationRow } from "./types.ts";

export type ReportModel = {
  fixture: boolean;
  mode: "executive" | "technical";
  targetUrl: string;
  host: string;
  createdAt: string;
  finishedAt: string | null;
  config: ScanConfig;
  scores: Scores | null;
  summary: string;
  issues: Issue[];
  pages: { url: string; status: number; title: string | null; words: number; indexable: boolean }[];
  psi: PsiResult | null;
  external: ExternalBundle;
  validation: ValidationRow[];
  limitations: string[];
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function sevColor(severity: string): string {
  if (severity === "critical") return "#9d3418";
  if (severity === "high") return "#9a5b12";
  if (severity === "medium") return "#6d6220";
  if (severity === "low") return "#1d5c72";
  return "#3e5248";
}

export function buildReport(model: ReportModel): string {
  const scores = model.scores;
  const issues = model.mode === "executive" ? model.issues.filter((issue) => issue.severity === "critical" || issue.severity === "high") : model.issues;
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of model.issues) counts[issue.severity] += 1;
  const bars = (["critical", "high", "medium", "low", "info"] as const)
    .map((name) => {
      const width = model.issues.length ? Math.round((counts[name] / model.issues.length) * 100) : 0;
      return `<div class="bar-row"><span>${name}</span><span class="track"><span class="fill" style="width:${width}%;background:${sevColor(name)}"></span></span><span>${counts[name]}</span></div>`;
    })
    .join("");
  const scoreBars = (scores?.categories ?? [])
    .map((category) => {
      const width = category.score == null ? 0 : category.score;
      return `<div class="bar-row"><span>${esc(category.label)}</span><span class="track"><span class="fill" style="width:${width}%;background:#1c3430"></span></span><span>${category.score == null ? "n/a" : category.score}</span></div><p class="note">${esc(category.reason)}</p>`;
    })
    .join("");

  const issueCards = issues
    .map((issue) => {
      const steps = issue.steps.map((step) => `<li>${esc(step)}</li>`).join("");
      return `<article class="issue" data-sev="${esc(issue.severity)}" data-cat="${esc(issue.category)}" data-status="${esc(issue.status)}" data-text="${esc(`${issue.title} ${issue.url ?? ""} ${issue.evidence}`.toLowerCase())}">
        <header><span class="pill" style="background:${sevColor(issue.severity)}">${esc(issue.severity)}</span>
        <span class="pill muted">${esc(issue.category)}</span>
        <span class="pill muted">${issue.heuristic ? "Heuristic" : "Observed"}</span>
        <span class="pill muted">${esc(issue.status)}</span>
        <h3>${esc(issue.title)}</h3></header>
        <p class="url">${issue.url ? esc(issue.url) : "Site-wide"}</p>
        <p>${esc(issue.description)}</p>
        <h4>Why it matters</h4><p>${esc(issue.why)}</p>
        <h4>Evidence</h4><pre>${esc(issue.evidence)}</pre>
        <h4>What to do</h4><p>${esc(issue.solution)}</p>
        <ol>${steps}</ol>
        ${issue.example ? `<h4>Example</h4><pre>${esc(issue.example)}</pre>` : ""}
        <p class="note">Effort: ${esc(issue.effort)}. Benefit: ${esc(issue.benefit)} Confidence: ${esc(issue.confidence)}. Source: ${esc(issue.source)}. Priority ${issue.priority}.${issue.docs ? ` <a href="${esc(issue.docs)}">Documentation</a>` : ""}</p>
      </article>`;
    })
    .join("");

  const pages = model.pages
    .map(
      (page) =>
        `<tr><td>${esc(page.url)}</td><td>${page.status}</td><td>${esc(page.title ?? "")}</td><td>${page.words}</td><td>${page.indexable ? "yes" : "no"}</td></tr>`,
    )
    .join("");

  const providers = model.validation
    .map(
      (row) =>
        `<tr><td>${esc(row.name)}</td><td>${esc(row.role)}</td><td>${esc(row.status)}</td><td>${esc(row.message)}</td><td>${esc(row.quota ?? "")}</td></tr>`,
    )
    .join("");

  const metricBlocks = [...model.external.backlinks, ...model.external.visibility]
    .map((payload) => {
      const metrics = payload.metrics.map((metric) => `<li><strong>${esc(metric.label)}:</strong> ${esc(metric.value)}${metric.note ? ` — ${esc(metric.note)}` : ""}</li>`).join("");
      const tableRows = payload.rows
        .slice(0, 20)
        .map((row) => `<tr>${Object.values(row).map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`)
        .join("");
      const head = payload.rows[0] ? Object.keys(payload.rows[0]).map((key) => `<th>${esc(key)}</th>`).join("") : "";
      return `<section><h3>${esc(payload.name)}</h3><p>${esc(payload.message)} Retrieved ${esc(payload.retrievedAt)}. ${payload.spentUnits ? "This call was allowed to spend provider units." : "No unit-spending call was made."}</p><ul>${metrics}</ul>${tableRows ? `<table><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table>` : ""}</section>`;
    })
    .join("");

  const psi = model.psi;
  const psiBlock = !psi
    ? "<p>PageSpeed Insights was not run for this scan.</p>"
    : psi.error
      ? `<p>PageSpeed Insights did not return data. ${esc(psi.error)}</p>`
      : `<p>Strategy: ${esc(psi.strategy)}. Requested ${esc(psi.requestedUrl)}. Final ${esc(psi.finalUrl ?? "unknown")}. Fetched ${esc(psi.fetchedAt)}.</p>
        <p>Lab scores — performance ${psi.lab?.performance ?? "n/a"}, accessibility ${psi.lab?.accessibility ?? "n/a"}, best practices ${psi.lab?.bestPractices ?? "n/a"}, Lighthouse SEO ${psi.lab?.seo ?? "n/a"}.</p>
        <p>Lab timings — LCP ${esc(psi.lab?.lcp ?? "n/a")}, INP ${esc(psi.lab?.inp ?? "n/a")}, CLS ${esc(psi.lab?.cls ?? "n/a")}, FCP ${esc(psi.lab?.fcp ?? "n/a")}, TBT ${esc(psi.lab?.tbt ?? "n/a")}, Speed Index ${esc(psi.lab?.speedIndex ?? "n/a")}.</p>
        <p>Field overall: ${esc(psi.field?.overall ?? "No field data for this URL.")} Origin field: ${esc(psi.originField?.overall ?? "none")}.</p>
        <ul>${(psi.field?.metrics ?? []).map((metric) => `<li>${esc(metric.name)}: ${esc(metric.category)} (${esc(metric.percentile)})</li>`).join("")}</ul>`;

  const rules = (scores?.rules ?? []).map((rule) => `<li>${esc(rule)}</li>`).join("");
  const limits = model.limitations.map((line) => `<li>${esc(line)}</li>`).join("");
  const configRows = [
    ["Max pages", String(model.config.maxPages)],
    ["Max depth", String(model.config.maxDepth)],
    ["Timeout ms", String(model.config.timeoutMs)],
    ["Robots respected", model.config.respectRobots ? "yes" : "no"],
    ["Sitemap seeds", model.config.useSitemap ? "yes" : "no"],
    ["External links checked", model.config.checkExternal ? "yes" : "no"],
    ["Subdomains", model.config.includeSubdomains ? "yes" : "no"],
    ["Query parameters kept", model.config.includeQuery ? "yes" : "no"],
  ]
    .map((row) => `<tr><td>${esc(row[0] ?? "")}</td><td>${esc(row[1] ?? "")}</td></tr>`)
    .join("");

  const data = JSON.stringify(issues.map((issue) => ({ title: issue.title, severity: issue.severity, category: issue.category, url: issue.url, status: issue.status }))).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${model.fixture ? "FIXTURE report" : "SEO report"} — ${esc(model.host)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 16px/1.5 Georgia, "Iowan Old Style", Palatino, serif; color: #17211c; background: #f4f1e8; }
  header, main, footer { max-width: 980px; margin: 0 auto; padding: 24px; }
  header { background: #1c3430; color: #f4f1e8; max-width: none; }
  header div { max-width: 980px; margin: 0 auto; }
  h1, h2, h3, h4 { font-family: Georgia, serif; line-height: 1.2; }
  h1 { font-size: 2.2rem; margin: 0 0 8px; }
  a { color: #1d5c72; }
  .banner { background: #d6f25c; color: #1a2410; display: inline-block; padding: 2px 8px; font-family: ui-sans-serif, sans-serif; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .card { background: #fffdf8; border: 1px solid #d9d2c3; padding: 12px 14px; }
  .score { font-size: 3rem; margin: 0; }
  .bar-row { display: grid; grid-template-columns: 110px 1fr 48px; gap: 8px; align-items: center; font-family: ui-sans-serif, sans-serif; font-size: 13px; }
  .track { background: #e6e0d4; height: 8px; }
  .fill { display: block; height: 8px; }
  .issue { background: #fffdf8; border: 1px solid #d9d2c3; padding: 14px; margin: 12px 0; }
  .pill { color: #fff; font-family: ui-sans-serif, sans-serif; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; padding: 2px 6px; margin-right: 4px; }
  .pill.muted { background: #3e5248; }
  .url, .note, pre { font-family: ui-sans-serif, sans-serif; font-size: 13px; }
  pre { white-space: pre-wrap; background: #f4f1e8; padding: 8px; }
  table { width: 100%; border-collapse: collapse; font-family: ui-sans-serif, sans-serif; font-size: 13px; background: #fffdf8; }
  th, td { border-bottom: 1px solid #d9d2c3; text-align: left; vertical-align: top; padding: 6px; word-break: break-word; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; font-family: ui-sans-serif, sans-serif; }
  input, select, button { font: inherit; padding: 8px; }
  button { background: #1c3430; color: #f4f1e8; border: 0; }
  nav a { margin-right: 12px; }
  @media print {
    header { background: #fff; color: #000; }
    .tools, button { display: none; }
    .issue { break-inside: avoid; }
    body { background: #fff; }
  }
</style>
</head>
<body>
<header><div>
  <p class="banner">${model.fixture ? "Fixture — not a live crawl" : model.mode === "executive" ? "Executive report" : "Technical report"}</p>
  <h1>Northline SEO report</h1>
  <p>${esc(model.targetUrl)}</p>
  <p>Started ${esc(model.createdAt)}${model.finishedAt ? ` · Finished ${esc(model.finishedAt)}` : ""}</p>
</div></header>
<main>
<nav>
  <a href="#summary">Summary</a>
  <a href="#findings">Findings</a>
  <a href="#performance">Performance</a>
  <a href="#offpage">Off-page and visibility</a>
  <a href="#providers">Providers</a>
  <a href="#pages">Pages</a>
  <a href="#rules">Scoring rules</a>
</nav>
<section id="summary">
  <h2>Summary</h2>
  <div class="grid">
    <div class="card"><p>Health score</p><p class="score">${scores?.overall ?? "n/a"}</p></div>
    <div class="card"><p>Data coverage</p><p class="score">${scores?.coverage ?? 0}%</p></div>
    <div class="card"><p>Critical</p><p class="score">${counts.critical}</p></div>
    <div class="card"><p>High</p><p class="score">${counts.high}</p></div>
  </div>
  <p>${esc(model.summary)}</p>
  ${bars}
  <h3>Category scores</h3>
  ${scoreBars || "<p>No scored categories.</p>"}
  <h3>Scan configuration</h3>
  <table>${configRows}</table>
</section>
<section id="findings">
  <h2>${model.mode === "executive" ? "Critical and high findings" : "Findings"}</h2>
  <div class="tools">
    <input id="q" type="search" placeholder="Search findings" aria-label="Search findings">
    <select id="sev" aria-label="Severity"><option value="">All severities</option><option>critical</option><option>high</option><option>medium</option><option>low</option><option>info</option></select>
    <select id="cat" aria-label="Category"><option value="">All categories</option><option>technical</option><option>onpage</option><option>content</option><option>performance</option><option>backlinks</option><option>keywords</option><option>local</option></select>
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div id="list">${issueCards || "<p>No findings in this view.</p>"}</div>
</section>
<section id="performance"><h2>Performance and Core Web Vitals</h2>${psiBlock}<p class="note">Lab figures come from Lighthouse. Field figures come from the Chrome UX Report only when PageSpeed included them. They are not interchangeable.</p></section>
<section id="offpage"><h2>Backlinks and search visibility</h2>${metricBlocks || "<p>No external provider returned metrics. Connect a provider and allow a unit-spending call if you need backlink or keyword data. Nothing here was estimated to fill the gap.</p>"}</section>
<section id="providers"><h2>Provider status</h2><table><thead><tr><th>Provider</th><th>Role</th><th>Status</th><th>Message</th><th>Quota</th></tr></thead><tbody>${providers}</tbody></table></section>
${model.mode === "technical" ? `<section id="pages"><h2>Crawled URLs</h2><table><thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Words</th><th>Indexable signal</th></tr></thead><tbody>${pages}</tbody></table></section>` : `<section id="pages"><h2>Crawl size</h2><p>${model.pages.length} URLs were fetched. Open the technical report for the URL table.</p></section>`}
<section id="rules"><h2>Scoring rules and limitations</h2><ul>${rules}</ul><h3>Limitations of this scan</h3><ul>${limits}</ul></section>
</main>
<footer><p>Generated by Northline. Findings are either observed responses, provider responses, or labeled heuristics. No API keys are included in this file.</p></footer>
<script>
const data = ${data};
const q = document.getElementById("q");
const sev = document.getElementById("sev");
const cat = document.getElementById("cat");
function apply() {
  const query = (q.value || "").toLowerCase();
  document.querySelectorAll(".issue").forEach((node) => {
    const ok = (!sev.value || node.dataset.sev === sev.value) && (!cat.value || node.dataset.cat === cat.value) && (!query || (node.dataset.text || "").includes(query));
    node.hidden = !ok;
  });
}
q.addEventListener("input", apply);
sev.addEventListener("change", apply);
cat.addEventListener("change", apply);
</script>
</body>
</html>`;
}

export function pagesForReport(pages: PageRecord[]): ReportModel["pages"] {
  return pages.map((page) => ({
    url: page.finalUrl || page.url,
    status: page.status,
    title: page.title,
    words: page.wordCount,
    indexable: page.indexable,
  }));
}
