import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { PROVIDERS, STATUS_LABEL } from "@/lib/seo/catalog";
import { STATUS_TONE, useSessionToken } from "@/lib/seo/client";
import { disconnectSettings, readSettings, saveSettings, testSettings } from "@/lib/seo/fns";
import type { ProviderSettingsView, ValidationRow } from "@/lib/seo/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const ACCESS_LABEL: Record<string, string> = {
  free: "Free",
  "free-key": "Free with API key",
  "free-quota": "Limited free quota",
  oauth: "OAuth required",
  paid: "Paid",
  "no-api": "No API",
};

const ACCESS_TONE: Record<string, string> = {
  free: "bg-ok text-ink",
  "free-key": "bg-ok text-ink",
  "free-quota": "bg-med text-ink",
  oauth: "bg-low text-ink",
  paid: "bg-high text-ink",
  "no-api": "bg-surface-2 text-fg",
};

function SettingsPage() {
  const token = useSessionToken();
  const [views, setViews] = useState<ProviderSettingsView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!token) return;
    try {
      const data = await readSettings({ data: { token } });
      setViews(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load settings.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function onViewChange(next: ProviderSettingsView) {
    setViews((current) =>
      current ? current.map((view) => (view.id === next.id ? next : view)) : current,
    );
  }

  const configurable = PROVIDERS.filter((provider) => provider.fields.length > 0);
  const reference = PROVIDERS.filter((provider) => provider.fields.length === 0);

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-primary">Configuration</p>
      <h1 className="mt-2 text-3xl text-fg md:text-4xl">Settings</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Connect paid or authenticated SEO providers to enrich the audit. The built-in crawler and
        PageSpeed work without any paid key. Credentials stay on this server session and are wiped
        when the tab closes.
      </p>

      {error ? <p className="mt-6 text-crit">{error}</p> : null}
      {!views ? <p className="mt-8 text-muted">Loading providers…</p> : null}

      {views ? (
        <>
          <section className="mt-8">
            <h2 className="text-xl text-fg">Configurable providers</h2>
            <p className="mt-1 text-sm text-muted">
              Fill the fields, then run <strong>Test connection</strong> to verify the handshake.
              Save only after the test passes.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {configurable.map((provider) => {
                const view = views.find((item) => item.id === provider.id);
                if (!view) return null;
                return (
                  <ProviderCard
                    key={provider.id}
                    meta={provider}
                    view={view}
                    token={token}
                    onChange={onViewChange}
                    onError={setError}
                  />
                );
              })}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl text-fg">Reference only</h2>
            <p className="mt-1 text-sm text-muted">
              These do not require configuration. The built-in crawler covers the same public
              checks.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {reference.map((provider) => (
                <article
                  key={provider.id}
                  className="rounded-lg border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg text-fg">{provider.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${ACCESS_TONE[provider.access] ?? "bg-surface-2 text-fg"}`}
                    >
                      {ACCESS_LABEL[provider.access] ?? provider.access}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{provider.description}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </Shell>
  );
}

function ProviderCard({
  meta,
  view,
  token,
  onChange,
  onError,
}: {
  meta: (typeof PROVIDERS)[number];
  view: ProviderSettingsView;
  token: string | null;
  onChange: (next: ProviderSettingsView) => void;
  onError: (message: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"idle" | "saving" | "testing" | "disconnecting">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [test, setTest] = useState<ValidationRow | null>(view.lastTest);

  const anyFilled = Object.values(values).some((value) => value.trim().length > 0);
  const allFieldsFilled = meta.fields.every((field) => values[field.name]?.trim());

  async function onSave() {
    if (!token) return;
    setBusy("saving");
    setMessage(null);
    try {
      await saveSettings({ data: { token, providerId: meta.id, fields: values } });
      const data = await readSettings({ data: { token } });
      const next = data.find((item) => item.id === meta.id);
      if (next) onChange(next);
      setValues({});
      setMessage("Saved.");
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Save failed.";
      setMessage(text);
      onError(text);
    } finally {
      setBusy("idle");
    }
  }

  async function onTest() {
    if (!token) return;
    setBusy("testing");
    setMessage(null);
    try {
      const result = await testSettings({ data: { token, providerId: meta.id } });
      setTest(result);
      const data = await readSettings({ data: { token } });
      const next = data.find((item) => item.id === meta.id);
      if (next) onChange({ ...next, lastTest: result });
      setMessage(result.message || STATUS_LABEL[result.status] || result.status);
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Test failed.";
      setMessage(text);
      onError(text);
    } finally {
      setBusy("idle");
    }
  }

  async function onDisconnect() {
    if (!token) return;
    setBusy("disconnecting");
    setMessage(null);
    try {
      await disconnectSettings({ data: { token, providerId: meta.id } });
      const data = await readSettings({ data: { token } });
      const next = data.find((item) => item.id === meta.id);
      if (next) onChange({ ...next, lastTest: null });
      setTest(null);
      setValues({});
      setMessage("Disconnected.");
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Disconnect failed.";
      setMessage(text);
      onError(text);
    } finally {
      setBusy("idle");
    }
  }

  const status = view.lastTest?.status ?? (view.configured ? "connected" : "not_configured");
  const statusLabel = STATUS_LABEL[status] ?? status;

  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg text-fg">{meta.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_TONE[status] ?? "bg-surface-2 text-fg"}`}
            >
              {statusLabel}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${ACCESS_TONE[meta.access] ?? "bg-surface-2 text-fg"}`}
            >
              {ACCESS_LABEL[meta.access] ?? meta.access}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">{meta.description}</p>
        </div>
        <a
          href={meta.pricing}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-xs whitespace-nowrap"
        >
          Get API key →
        </a>
      </div>

      <p className="mt-3 text-xs text-muted">{meta.accessNote}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {meta.fields.map((field) => {
          const masked = view.fields.find((item) => item.name === field.name);
          const placeholder = masked?.mask
            ? `${masked.mask} (leave blank to keep)`
            : field.placeholder;
          return (
            <label key={field.name} className="flex flex-col gap-1 text-sm">
              <span className="text-muted">
                {field.label}
                {masked?.configured ? (
                  <span className="ml-2 text-xs text-ok">configured</span>
                ) : null}
              </span>
              <input
                type={field.kind === "password" ? "password" : "text"}
                className="field"
                placeholder={placeholder}
                value={values[field.name] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={busy !== "idle" || !allFieldsFilled}
        >
          {busy === "saving" ? "Saving…" : "Save credentials"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onTest}
          disabled={busy !== "idle" || (!view.configured && !anyFilled)}
        >
          {busy === "testing" ? "Testing…" : "Test connection"}
        </button>
        {view.configured ? (
          <button
            type="button"
            className="btn btn-ghost text-crit"
            onClick={onDisconnect}
            disabled={busy !== "idle"}
          >
            {busy === "disconnecting" ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : null}
        {message ? <span className="text-sm text-muted">{message}</span> : null}
      </div>

      {test ? (
        <div className="mt-4 rounded border border-line bg-bg p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold uppercase ${STATUS_TONE[test.status] ?? "bg-surface-2 text-fg"}`}
            >
              {STATUS_LABEL[test.status] ?? test.status}
            </span>
            <span className="text-muted">Auth: {test.auth}</span>
            {test.quota ? <span className="text-muted">Quota: {test.quota}</span> : null}
            <span className="text-muted">
              Checked {new Date(test.checkedAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-2 text-muted">{test.message}</p>
          {test.action ? <p className="mt-1 text-primary">{test.action}</p> : null}
        </div>
      ) : null}

      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-muted">Capabilities</summary>
        <ul className="mt-2 list-disc pl-5 text-muted">
          {meta.capabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
