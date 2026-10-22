import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { listAudits } from "@/lib/seo/fns";
import type { ScanSummary } from "@/lib/seo/types";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAudits({ data: { limit: 50 } })
      .then(setScans)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load audits."));
  }, []);

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-primary">Archive</p>
      <h1 className="mt-2 text-3xl text-fg md:text-4xl">Scan History</h1>
      <p className="mt-3 max-w-2xl text-muted">All audits you have run in this session.</p>

      {error ? <p className="mt-6 text-crit">{error}</p> : null}
      {!scans ? <p className="mt-8 text-muted">Loading history…</p> : null}

      {scans && scans.length === 0 ? (
        <section className="mt-8 rounded-lg border border-line bg-surface p-6 text-center">
          <h2 className="text-xl text-fg">No scans yet</h2>
          <p className="mt-2 text-sm text-muted">Run your first audit to see it here.</p>
          <Link to="/audit" className="btn btn-primary mt-4 inline-flex">Start an audit</Link>
        </section>
      ) : null}

      {scans && scans.length > 0 ? (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="p-4 font-medium">Site</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Score</th>
                <th className="p-4 font-medium">Issues</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-t border-line hover:bg-surface-2/50 transition-colors">
                  <td className="p-4 font-medium text-fg">{scan.host}</td>
                  <td className="p-4 text-muted">{new Date(scan.createdAt).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-surface-2 px-2 py-1 text-xs uppercase text-fg">
                      {scan.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-primary">{scan.scores?.overall ?? "—"}</td>
                  <td className="p-4 text-muted">
                    {scan.openCritical > 0 ? <span className="text-crit font-bold">{scan.openCritical} crit</span> : "0 crit"}
                  </td>
                  <td className="p-4 text-right">
                    <Link to="/audit/$scanId" params={{ scanId: scan.id }} className="text-primary hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}
