import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { PROVIDERS, STATUS_LABEL } from "@/lib/seo/catalog";
import { STATUS_TONE, useSessionToken } from "@/lib/seo/client";
import { startAudit } from "@/lib/seo/fns";
import { defaultConfig, type ScanConfig, type ValidationRow } from "@/lib/seo/types";

export const Route = createFileRoute("/audit")({ component: AuditForm });

function AuditForm() {
  const token = useSessionToken();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ScanConfig>(defaultConfig);
  const [url, setUrl] = useState("https://example.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationRow[] | null>(null);

  function patchProvider(id: string, patch: Partial<ScanConfig["providers"][number]>) {
    setConfig((current) => ({
      ...current,
      providers: current.providers.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)),
    }));
  }

  async function onStart() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startAudit({ data: { token, url, config } });
      setValidation(result.validation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: "/audit/$scanId", params: { scanId: result.scanId } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The audit could not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-primary">Website SEO audit</p>
      <h1 className="mt-2 text-4xl">Start a scan</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Required providers are tested before any crawl begins. A failed required provider stops the scan. Optional failures are recorded and skipped. The URL is sent only to providers you include.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <section className="space-y-4 rounded-lg border border-line bg-surface p-4">
          <label className="block text-sm">
            Website URL
            <input className="field mt-1" value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" aria-label="Website URL" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Max pages" value={config.maxPages} min={1} max={25} onChange={(maxPages) => setConfig({ ...config, maxPages })} />
            <NumberField label="Max depth" value={config.maxDepth} min={0} max={4} onChange={(maxDepth) => setConfig({ ...config, maxDepth })} />
            <NumberField label="Timeout (ms)" value={config.timeoutMs} min={3000} max={20000} step={500} onChange={(timeoutMs) => setConfig({ ...config, timeoutMs })} />
            <NumberField label="Delay (ms)" value={config.delayMs} min={0} max={3000} step={50} onChange={(delayMs) => setConfig({ ...config, delayMs })} />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Check label="Respect robots.txt" checked={config.respectRobots} onChange={(respectRobots) => setConfig({ ...config, respectRobots })} />
            <Check label="Use sitemap URLs as seeds" checked={config.useSitemap} onChange={(useSitemap) => setConfig({ ...config, useSitemap })} />
            <Check label="Check up to 12 external links" checked={config.checkExternal} onChange={(checkExternal) => setConfig({ ...config, checkExternal })} />
            <Check label="Include subdomains" checked={config.includeSubdomains} onChange={(includeSubdomains) => setConfig({ ...config, includeSubdomains })} />
            <Check label="Keep query parameters" checked={config.includeQuery} onChange={(includeQuery) => setConfig({ ...config, includeQuery })} />
            <Check label="Try PageSpeed without a key" checked={config.psiAllowUnkeyed} onChange={(psiAllowUnkeyed) => setConfig({ ...config, psiAllowUnkeyed })} />
          </div>
          <label className="block text-sm">
            PageSpeed strategy
            <select className="field mt-1" value={config.psiStrategy} onChange={(event) => setConfig({ ...config, psiStrategy: event.target.value as ScanConfig["psiStrategy"] })}>
              <option value="mobile">Mobile only</option>
              <option value="desktop">Desktop only</option>
              <option value="both">Mobile and desktop</option>
            </select>
          </label>
        </section>
        <section className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h2 className="text-xl">What this scan will not invent</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
            <li>Rankings, search volume, or traffic without a provider response.</li>
            <li>A complete backlink index from a partial API.</li>
            <li>A connection just because a key field is filled in.</li>
            <li>Progress time estimates.</li>
          </ul>
          <p className="mt-4 text-muted">www and the apex host are treated as one site. Private networks, localhost, and cloud metadata addresses are blocked.</p>
        </section>
      </div>
      <section className="mt-6 space-y-3">
        <h2 className="text-2xl">Providers for this scan</h2>
        {PROVIDERS.filter((provider) => provider.selectable).map((provider) => {
          const pick = config.providers.find((item) => item.id === provider.id);
          if (!pick) return null;
          return (
            <article key={provider.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg">{provider.name}</h3>
                  <p className="mt-1 max-w-3xl text-sm text-muted">{provider.accessNote}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Check label="Include" checked={pick.included} onChange={(included) => patchProvider(provider.id, { included, required: included ? pick.required : false, spend: included ? pick.spend : false })} />
                  <Check label="Required" checked={pick.required} onChange={(required) => patchProvider(provider.id, { required })} />
                  {provider.canSpend ? <Check label="Spend units" checked={pick.spend} onChange={(spend) => patchProvider(provider.id, { spend })} /> : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>
      {error ? <p className="mt-4 text-crit" role="alert">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={!token || busy} onClick={() => void onStart()}>
          {busy ? "Validating…" : "Validate and start"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setValidation(null); setError(null); void onStart(); }}>
          Retry validation
        </button>
      </div>
      {validation ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted"><tr><th className="py-2">Provider</th><th>Role</th><th>Status</th><th>Quota</th><th>Detail</th></tr></thead>
            <tbody>
              {validation.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="py-3 pr-3">{row.name}</td>
                  <td>{row.role}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs ${STATUS_TONE[row.status] ?? ""}`}>{STATUS_LABEL[row.status] ?? row.status}</span></td>
                  <td>{row.quota ?? "—"}</td>
                  <td><p>{row.message}</p><p className="mt-1 text-muted">{row.action}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Shell>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="block text-sm">
      {label}
      <input className="field mt-1" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
