import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IssueBrowser } from "@/components/issues";
import { Shell } from "@/components/shell";
import { STATUS_LABEL } from "@/lib/seo/catalog";
import { downloadText, STATUS_TONE, useSessionToken } from "@/lib/seo/client";
import { cancelAudit, continueAudit, downloadReport, explainAudit, finishAudit, readAudit, setFindingStatus } from "@/lib/seo/fns";
import type { Issue, IssueStatus, ScanDetail } from "@/lib/seo/types";

const TABS = [
  ["overview", "Overview"],
  ["technical", "Technical"],
  ["onpage", "On-page"],
  ["content", "Content"],
  ["performance", "Performance"],
  ["backlinks", "Backlinks"],
  ["keywords", "Visibility"],
  ["local", "Local"],
  ["actions", "Actions"],
  ["report", "Report"],
] as const;

export const Route = createFileRoute("/audit/$scanId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "overview",
  }),
  component: ScanScreen,
});

function ScanScreen() {
  const { scanId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const token = useSessionToken();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    let stop = false;
    readAudit({ data: { scanId } })
      .then((row) => { if (!stop) setScan(row); })
      .catch((reason: unknown) => { if (!stop) setError(reason instanceof Error ? reason.message : "Could not load the scan."); });
    return () => { stop = true; };
  }, [scanId]);

  useEffect(() => {
    if (!scan || !token) return;
    if (scan.status !== "crawling" && scan.status !== "analyzing_pending") return;
    if (running.current) return;
    running.current = true;
    let stop = false;
    void (async () => {
      try {
        let status = scan.status;
        for (let i = 0; i < 40 && !stop && status === "crawling"; i += 1) {
          const step = await continueAudit({ data: { scanId } });
          status = step.status;
          const fresh = await readAudit({ data: { scanId } });
          if (!stop) setScan(fresh);
          if (fresh.status === "cancelled") return;
        }
        if (!stop && status === "analyzing_pending") {
          const done = await finishAudit({ data: { scanId, token } });
          if (!stop && done) setScan(done);
        }
      } catch (reason) {
        if (!stop) setError(reason instanceof Error ? reason.message : "The scan stopped.");
      } finally {
        running.current = false;
      }
    })();
    return () => { stop = true; };
  }, [scan, scanId, token]);

  async function onStatus(issue: Issue, status: IssueStatus) {
    const scores = await setFindingStatus({ data: { scanId, issueId: issue.id, status } });
    setScan((current) => current ? {
      ...current,
      scores: scores.scores,
      coverage: scores.scores.coverage,
      issues: current.issues.map((item) => item.id === issue.id ? { ...item, status } : item),
    } : current);
  }

  async function onReport(mode: "executive" | "technical") {
    const file = await downloadReport({ data: { scanId, mode } });
    downloadText(file.html, file.filename);
  }

  async function onExplain() {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await explainAudit({ data: { scanId } });
      if (!result.ok) setAiError(result.error);
      else setScan((current) => current ? { ...current, aiSummary: result.text } : current);
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "AI request failed.");
    } finally {
      setAiBusy(false);
    }
  }

  const active = TABS.some((item) => item[0] === tab) ? tab : "overview";
  const category = ["technical", "onpage", "content", "performance", "backlinks", "keywords", "local"].includes(active) ? active : null;

  return (
    <Shell>
      {!scan ? <p className="text-muted">{error ?? "Loading scan…"}</p> : (
        <>
          <p className="text-sm text-muted">{scan.createdAt.slice(0, 16).replace("T", " ")} UTC · {scan.status.replaceAll("_", " ")}</p>
          <h1 className="mt-1 break-all text-3xl md:text-4xl">{scan.host}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">{scan.summary ?? scan.progress.notes.join(" ")}</p>
          {error ? <p className="mt-3 text-crit" role="alert">{error}</p> : null}
          {(scan.status === "crawling" || scan.status === "analyzing" || scan.status === "analyzing_pending") ? (
            <div className="mt-4 rounded-lg border border-line bg-surface p-4" aria-live="polite">
              <p className="text-sm uppercase tracking-widest text-primary">{scan.progress.stage.replaceAll("_", " ")}</p>
              <p className="mt-2 text-sm">Crawled {scan.progress.crawled} · discovered {scan.progress.discovered} · remaining in queue {scan.progress.remaining} · fetch errors {scan.progress.errors}</p>
              <p className="mt-1 break-all text-xs text-muted">{scan.progress.currentUrl ?? "Working…"}</p>
              <p className="mt-2 text-xs text-muted">This bar is pages fetched toward the configured limit, not a predicted finish time.</p>
              <div className="mt-3 h-2 bg-bg"><div className="h-2 bg-primary" style={{ width: `${Math.min(100, Math.round((scan.progress.crawled / Math.max(1, scan.config.maxPages)) * 100))}%` }} /></div>
              <button type="button" className="btn btn-ghost mt-4" onClick={() => void cancelAudit({ data: { scanId } }).then(() => setScan({ ...scan, status: "cancelled" }))}>Cancel scan</button>
            </div>
          ) : null}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" className={`btn ${active === id ? "btn-primary" : "btn-ghost"}`} onClick={() => void navigate({ search: { tab: id }, replace: true })}>
                {label}
              </button>
            ))}
          </div>
          {active === "overview" ? <Overview scan={scan} /> : null}
          {category ? (
            <IssueBrowser
              issues={scan.issues.filter((issue) => issue.category === category)}
              onStatus={(issue, status) => void onStatus(issue, status)}
            />
          ) : null}
          {active === "actions" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-line bg-surface p-4">
                <h2 className="text-2xl">Plain-language brief</h2>
                <p className="mt-1 text-sm text-muted">Optional. Uses only the stored findings. It does not fetch new rankings or metrics.</p>
                <button type="button" className="btn btn-primary mt-3" disabled={aiBusy} onClick={() => void onExplain()}>{aiBusy ? "Writing…" : "Explain these findings"}</button>
                {aiError ? <p className="mt-2 text-sm text-crit">{aiError}</p> : null}
                {scan.aiSummary ? <p className="mt-3 whitespace-pre-wrap text-sm">{scan.aiSummary}</p> : null}
              </div>
              <IssueBrowser issues={scan.issues} onStatus={(issue, status) => void onStatus(issue, status)} />
            </div>
          ) : null}
          {active === "report" ? (
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-2xl">Standalone HTML report</h2>
              <p className="mt-2 text-sm text-muted">The file includes its own styles and filters. It does not call this app or embed API keys.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={() => void onReport("technical")}>Download technical report</button>
                <button type="button" className="btn btn-ghost" onClick={() => void onReport("executive")}>Download executive report</button>
              </div>
            </section>
          ) : null}
          {active === "performance" && scan.issues.filter((issue) => issue.category === "performance").length === 0 ? <PsiPanel scan={scan} /> : null}
          {active === "performance" && scan.issues.some((issue) => issue.category === "performance") ? <PsiPanel scan={scan} /> : null}
          {active === "backlinks" ? <PayloadList items={scan.external.backlinks} empty="Backlink data was not collected. Connect Ahrefs, Moz, Majestic, or DataForSEO, then include the provider. Unit-spending calls stay off until you allow them." /> : null}
          {active === "keywords" ? <PayloadList items={scan.external.visibility} empty="Search visibility was not collected. Connect Search Console, Bing, GA4, Semrush, or SerpApi. Metrics appear only after a real response." /> : null}
          <p className="mt-6 text-sm"><Link to="/compare" search={{ older: "", newer: scan.id }} className="text-primary underline">Compare with another scan</Link></p>
        </>
      )}
    </Shell>
  );
}

function Overview({ scan }: { scan: ScanDetail }) {
  const chart = (scan.scores?.categories ?? []).map((category) => ({ name: category.label, score: category.score ?? 0, missing: category.score == null }));
  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-muted">Health score</p>
          <p className="font-display text-5xl text-primary">{scan.scores?.overall ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-muted">Coverage</p>
          <p className="font-display text-5xl">{scan.scores?.coverage ?? scan.coverage}%</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-muted">Pages fetched</p>
          <p className="font-display text-5xl">{scan.pageCount}</p>
        </div>
      </div>
      <div className="h-56 rounded-lg border border-line bg-surface p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="var(--color-muted)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
            <Bar dataKey="score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm text-muted">
        {(scan.scores?.rules ?? []).map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted"><tr><th className="py-2">Provider</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            {scan.validation.map((row) => (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="py-2 pr-3">{row.name}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs ${STATUS_TONE[row.status] ?? ""}`}>{STATUS_LABEL[row.status] ?? row.status}</span></td>
                <td>{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PsiPanel({ scan }: { scan: ScanDetail }) {
  const psi = scan.psi;
  if (!psi) return <p className="mb-4 text-sm text-muted">PageSpeed Insights was not run. Add a key or allow an unkeyed attempt, and include the provider.</p>;
  if (psi.error && !psi.lab) return <p className="mb-4 text-sm text-crit">{psi.error}</p>;
  return (
    <section className="mb-4 rounded-lg border border-line bg-surface p-4 text-sm">
      <h2 className="text-xl">Lab versus field</h2>
      <p className="mt-2 text-muted">Strategy {psi.strategy}. Lab performance {psi.lab?.performance ?? "n/a"}. Lighthouse SEO category {psi.lab?.seo ?? "n/a"} is a separate lab checklist, not the Northline score.</p>
      <p className="mt-2">LCP {psi.lab?.lcp ?? "n/a"} · CLS {psi.lab?.cls ?? "n/a"} · INP {psi.lab?.inp ?? "n/a"} · FCP {psi.lab?.fcp ?? "n/a"} · TBT {psi.lab?.tbt ?? "n/a"} · Speed Index {psi.lab?.speedIndex ?? "n/a"}</p>
      <p className="mt-2">Field data: {psi.field?.overall ?? "not returned for this URL"}. Origin field: {psi.originField?.overall ?? "not returned"}.</p>
      <ul className="mt-2 list-disc pl-5">{(psi.field?.metrics ?? []).map((metric) => <li key={metric.name}>{metric.name}: {metric.category} ({metric.percentile})</li>)}</ul>
      {psi.error ? <p className="mt-2 text-crit">{psi.error}</p> : null}
    </section>
  );
}

function PayloadList({ items, empty }: { items: ScanDetail["external"]["backlinks"]; empty: string }) {
  if (!items.length) return <p className="mb-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="mb-4 space-y-3">
      {items.map((item) => (
        <section key={item.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h2 className="text-xl">{item.name}</h2>
          <p className="mt-1 text-muted">{item.message}</p>
          <ul className="mt-2 space-y-1">{item.metrics.map((metric) => <li key={metric.label}><strong>{metric.label}:</strong> {metric.value}{metric.note ? ` — ${metric.note}` : ""}</li>)}</ul>
          {item.rows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr>{Object.keys(item.rows[0] ?? {}).map((key) => <th key={key} className="py-1 pr-3">{key}</th>)}</tr></thead>
                <tbody>
                  {item.rows.slice(0, 15).map((row, index) => (
                    <tr key={index} className="border-t border-line">{Object.values(row).map((value, cell) => <td key={cell} className="py-1 pr-3">{value}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
