import { useMemo, useState } from "react";
import type { Issue, IssueStatus } from "@/lib/seo/types";
import { STATUS_TONE } from "@/lib/seo/client";

const STATUSES: IssueStatus[] = ["open", "in_progress", "fixed", "ignored"];

export function IssueBrowser({
  issues,
  onStatus,
}: {
  issues: Issue[];
  onStatus?: (issue: Issue, status: IssueStatus) => void;
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"priority" | "severity" | "url">("priority");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = issues.filter((issue) => {
      if (severity && issue.severity !== severity) return false;
      if (category && issue.category !== category) return false;
      if (status && issue.status !== status) return false;
      if (!q) return true;
      return `${issue.title} ${issue.url ?? ""} ${issue.evidence} ${issue.code}`.toLowerCase().includes(q);
    });
    const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    rows.sort((a, b) => {
      if (sort === "url") return (a.url ?? "").localeCompare(b.url ?? "");
      if (sort === "severity") return rank[a.severity] - rank[b.severity] || b.priority - a.priority;
      return b.priority - a.priority;
    });
    return rows;
  }, [issues, query, severity, category, status, sort]);
  const size = 8;
  const slice = filtered.slice(page * size, page * size + size);
  const pages = Math.max(1, Math.ceil(filtered.length / size));

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className="field lg:col-span-2" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search title, URL, evidence" aria-label="Search findings" />
        <select className="field" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }} aria-label="Filter severity">
          <option value="">All severities</option>
          {["critical", "high", "medium", "low", "info"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }} aria-label="Filter category">
          <option value="">All categories</option>
          {["technical", "onpage", "content", "performance", "backlinks", "keywords", "local"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} aria-label="Filter status">
          <option value="">All statuses</option>
          {STATUSES.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-sm text-muted">
        <p>{filtered.length} findings</p>
        <label className="flex items-center gap-2">
          Sort
          <select className="field w-auto" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort findings">
            <option value="priority">Priority</option>
            <option value="severity">Severity</option>
            <option value="url">URL</option>
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {slice.map((issue) => (
          <article key={issue.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${STATUS_TONE[issue.severity]}`}>{issue.severity}</span>
              <span className="rounded-full bg-surface-2 px-2 py-1 text-xs uppercase text-muted">{issue.category}</span>
              <span className="rounded-full bg-surface-2 px-2 py-1 text-xs text-muted">{issue.heuristic ? "Heuristic" : "Observed"}</span>
              <span className="text-xs text-muted">{issue.confidence} confidence</span>
            </div>
            <h3 className="mt-3 text-xl">{issue.title}</h3>
            <p className="mt-1 break-all text-sm text-primary">{issue.url ?? "Site-wide"}</p>
            <p className="mt-3 text-sm">{issue.description}</p>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-muted">Why it matters</dt><dd>{issue.why}</dd></div>
              <div><dt className="text-muted">Benefit</dt><dd>{issue.benefit}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-muted">Evidence</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs">{issue.evidence}</pre>
            <p className="mt-3 text-sm">{issue.solution}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {issue.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {issue.example ? <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs">{issue.example}</pre> : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">Effort {issue.effort} · {issue.source}</span>
              {issue.docs ? <a className="text-primary underline" href={issue.docs} target="_blank" rel="noreferrer">Documentation</a> : null}
              {onStatus ? (
                <label className="ml-auto flex items-center gap-2">
                  Status
                  <select className="field w-auto" value={issue.status} aria-label={`Status for ${issue.title}`} onChange={(event) => onStatus(issue, event.target.value as IssueStatus)}>
                    {STATUSES.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          </article>
        ))}
        {slice.length === 0 ? <p className="rounded-lg border border-line bg-surface p-6 text-muted">No findings match these filters.</p> : null}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <p className="text-sm text-muted">Page {page + 1} of {pages}</p>
        <button type="button" className="btn btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </div>
  );
}
