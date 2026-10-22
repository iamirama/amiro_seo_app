import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { listAudits, compareAudits } from "@/lib/seo/fns";
import type { ScanSummary } from "@/lib/seo/types";

export const Route = createFileRoute("/compare")({ component: ComparePage });

function ComparePage() {
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAudits({ data: { limit: 50 } }).then((data) => {
      const complete = data.filter((s) => s.status === "complete");
      setScans(complete);
      if (complete.length >= 2) {
        setLeftId(complete[1].id);
        setRightId(complete[0].id);
      }
    }).catch(console.error);
  }, []);

  async function handleCompare() {
    if (!leftId || !rightId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await compareAudits({ data: { leftId, rightId } });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-primary">Analysis</p>
      <h1 className="mt-2 text-3xl text-fg md:text-4xl">Compare Audits</h1>
      <p className="mt-3 max-w-2xl text-muted">Select two completed scans to see what changed.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted">Base Scan (Older)</span>
          <select className="field" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            <option value="">Select a scan…</option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>{s.host} — {new Date(s.createdAt).toLocaleDateString()}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted">Target Scan (Newer)</span>
          <select className="field" value={rightId} onChange={(e) => setRightId(e.target.value)}>
            <option value="">Select a scan…</option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>{s.host} — {new Date(s.createdAt).toLocaleDateString()}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="btn btn-primary mt-6"
        onClick={handleCompare}
        disabled={!leftId || !rightId || leftId === rightId || loading}
      >
        {loading ? "Comparing…" : "Compare Scans"}
      </button>

      {error ? <p className="mt-4 text-crit">{error}</p> : null}

      {result ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="text-xl text-fg mb-4">Score Delta</h2>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-mono text-muted">{result.left.scores?.overall ?? "—"}</span>
              <span className="text-muted">→</span>
              <span className="text-3xl font-mono text-primary">{result.right.scores?.overall ?? "—"}</span>
            </div>
          </section>
          
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-ok font-medium mb-2">Fixed Issues</h3>
              <ul className="list-disc pl-5 text-sm text-muted space-y-1">
                {result.fixed?.length ? result.fixed.map((i: any) => <li key={i.id}>{i.title}</li>) : <li>None</li>}
              </ul>
            </div>
            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-crit font-medium mb-2">New Issues</h3>
              <ul className="list-disc pl-5 text-sm text-muted space-y-1">
                {result.added?.length ? result.added.map((i: any) => <li key={i.id}>{i.title}</li>) : <li>None</li>}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
