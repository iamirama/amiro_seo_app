import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Shell } from "@/components/shell";
import { listAudits } from "@/lib/seo/fns";
import type { ScanSummary } from "@/lib/seo/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listAudits({ data: { limit: 8 } })
      .then(setScans)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load audits."));
  }, []);
  const latest = scans?.find((scan) => scan.status === "complete") ?? scans?.[0];
  const chart = latest
    ? ["critical", "high", "medium", "low", "info"].map((name) => ({ name, count: latest.issueCounts[name] ?? 0 }))
    : [];

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-primary">Free-first technical audits</p>
      <h1 className="mt-2 max-w-xl text-4xl text-fg md:text-5xl">See what is actually wrong.</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Northline crawls a public site, explains each finding, and writes a report you can open offline. Paid SEO APIs stay optional. Nothing is filled in when a provider is disconnected.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/audit" className="btn btn-primary">Start an audit</Link>
        <Link to="/history" className="btn btn-ghost">Scan history</Link>
      </div>
      {error ? <p className="mt-6 text-crit">{error}</p> : null}
      {!scans ? <p className="mt-8 text-muted">Loading the desk…</p> : null}
      {scans && scans.length === 0 ? (
        <section className="mt-8 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-2xl">No audits yet</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">The first scan uses the built-in crawler. PageSpeed, Search Console, Bing, and the commercial indexes appear only after you connect them and they pass a real test.</p>
        </section>
      ) : null}
      {latest ? (
        <section className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm text-muted">Latest {latest.host}</p>
            <p className="font-display text-6xl text-primary">{latest.scores?.overall ?? "—"}</p>
            <p className="text-sm text-muted">{latest.scores ? `${latest.coverage}% of the scored weights had data.` : "Score not ready."} {latest.openCritical} open critical, {latest.openHigh} open high.</p>
            <Link to="/audit/$scanId" params={{ scanId: latest.id }} className="mt-4 inline-flex text-sm text-primary underline">Open this audit</Link>
          </div>
          <div className="h-56 rounded-lg border border-line bg-surface p-4">
            <p className="mb-2 text-sm text-muted">Findings by severity</p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chart}>
                <XAxis dataKey="name" stroke="#93a79c" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#93a79c" fontSize={12} />
                <Tooltip contentStyle={{ background: "#18211d", border: "1px solid #31443b", color: "#e8f2ec" }} />
                <Bar dataKey="count" fill="#d6f25c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
      {scans && scans.length > 0 ? (
        <section className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr><th className="py-2">Site</th><th>When</th><th>Status</th><th>Score</th><th>Critical</th></tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-t border-line">
                  <td className="py-3"><Link to="/audit/$scanId" params={{ scanId: scan.id }} className="text-primary underline">{scan.host}</Link></td>
                  <td>{scan.createdAt.slice(0, 16).replace("T", " ")} UTC</td>
                  <td>{scan.status.replaceAll("_", " ")}</td>
                  <td>{scan.scores?.overall ?? "—"}</td>
                  <td>{scan.openCritical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </Shell>
  );
}
