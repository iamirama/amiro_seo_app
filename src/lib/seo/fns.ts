import { createServerFn } from "@tanstack/react-start";
import { PROVIDERS, providerById } from "./catalog.ts";
import { defaultConfig, type IssueStatus, type ScanConfig } from "./types.ts";
import { buildFixtureReport } from "./fixture.ts";

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Invalid request.");
  return input as Record<string, unknown>;
}

function tokenOf(input: Record<string, unknown>): string {
  const token = String(input.token ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error("Reload the page to start a credential session.");
  return token;
}

export const listAudits = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input ?? {});
    return { limit: Math.min(40, Math.max(1, Number(body.limit ?? 20) || 20)) };
  })
  .handler(async ({ data }) => {
    const { listScans } = await import("./store.server.ts");
    return listScans(data.limit);
  });

export const readAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const id = String(record(input).scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown scan.");
    return { scanId: id };
  })
  .handler(async ({ data }) => {
    const { getScan } = await import("./store.server.ts");
    const scan = await getScan(data.scanId);
    if (!scan) throw new Error("Scan not found.");
    return scan;
  });

export const startAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    return {
      token: tokenOf(body),
      url: String(body.url ?? ""),
      config:
        body.config && typeof body.config === "object"
          ? { ...defaultConfig(), ...(body.config as ScanConfig) }
          : defaultConfig(),
    };
  })
  .handler(async ({ data }) => {
    const { validateAndStart } = await import("./engine.server.ts");
    return validateAndStart(data.token, data.url, data.config);
  });

export const continueAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const id = String(record(input).scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown scan.");
    return { scanId: id };
  })
  .handler(async ({ data }) => {
    const { crawlBatch } = await import("./engine.server.ts");
    return crawlBatch(data.scanId);
  });

export const finishAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const scanId = String(body.scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("Unknown scan.");
    return { scanId, token: tokenOf(body) };
  })
  .handler(async ({ data }) => {
    const { finalizeScan } = await import("./engine.server.ts");
    return finalizeScan(data.scanId, data.token);
  });

export const cancelAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const scanId = String(record(input).scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("Unknown scan.");
    return { scanId };
  })
  .handler(async ({ data }) => {
    const { markCancelled } = await import("./store.server.ts");
    await markCancelled(data.scanId);
    return { ok: true };
  });

export const removeAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const scanId = String(record(input).scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("Unknown scan.");
    return { scanId };
  })
  .handler(async ({ data }) => {
    const { deleteScan } = await import("./store.server.ts");
    await deleteScan(data.scanId);
    return { ok: true };
  });

export const setFindingStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const status = String(body.status ?? "");
    if (!["open", "in_progress", "fixed", "ignored"].includes(status)) throw new Error("Unknown status.");
    return {
      scanId: String(body.scanId ?? ""),
      issueId: String(body.issueId ?? ""),
      status: status as IssueStatus,
    };
  })
  .handler(async ({ data }) => {
    const { setIssueStatus } = await import("./store.server.ts");
    const scores = await setIssueStatus(data.scanId, data.issueId, data.status);
    if (!scores) throw new Error("Finding not found.");
    return { scores };
  });

export const compareAudits = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    return { olderId: String(body.olderId ?? ""), newerId: String(body.newerId ?? "") };
  })
  .handler(async ({ data }) => {
    const { compareScans } = await import("./store.server.ts");
    const result = await compareScans(data.olderId, data.newerId);
    if (!result) throw new Error("One of those scans no longer exists.");
    return result;
  });

export const downloadReport = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const mode = body.mode === "executive" ? "executive" : "technical";
    const scanId = String(body.scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("Unknown scan.");
    return { scanId, mode: mode as "executive" | "technical" };
  })
  .handler(async ({ data }) => {
    const { getScan } = await import("./store.server.ts");
    const { buildReport, pagesForReport } = await import("./report-html.ts");
    const scan = await getScan(data.scanId);
    if (!scan) throw new Error("Scan not found.");
    const html = buildReport({
      fixture: false,
      mode: data.mode,
      targetUrl: scan.targetUrl,
      host: scan.host,
      createdAt: scan.createdAt,
      finishedAt: scan.finishedAt,
      config: scan.config,
      scores: scan.scores,
      summary: scan.summary ?? "No summary was stored.",
      issues: scan.issues,
      pages: pagesForReport(scan.pages),
      psi: scan.psi,
      external: scan.external,
      validation: scan.validation,
      limitations: [
        `At most ${scan.config.maxPages} pages and depth ${scan.config.maxDepth} were allowed.`,
        scan.config.respectRobots ? "robots.txt disallow rules were honored." : "robots.txt was not enforced for this scan.",
        "JavaScript-rendered content is not executed.",
        "External providers were called only when selected. Failed optional providers leave their section incomplete.",
        "Backlink and keyword figures are shown only when a provider returned them.",
      ],
    });
    return { html, filename: `northline-${scan.host}-${data.mode}.html` };
  });

export const downloadFixture = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const mode = record(input ?? {}).mode === "executive" ? "executive" : "technical";
    return { mode: mode as "executive" | "technical" };
  })
  .handler(async ({ data }) => ({
    html: buildFixtureReport(data.mode),
    filename: `northline-fixture-${data.mode}.html`,
  }));

export const readSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ token: tokenOf(record(input)) }))
  .handler(async ({ data }) => {
    const { lastTest, maskSecret, readSecrets } = await import("./credentials.server.ts");
    return PROVIDERS.map((provider) => {
      const secrets = readSecrets(data.token, provider.id);
      return {
        id: provider.id,
        configured: provider.fields.every((field) => Boolean(secrets[field.name])),
        fields: provider.fields.map((field) => ({
          name: field.name,
          label: field.label,
          configured: Boolean(secrets[field.name]),
          mask: maskSecret(secrets[field.name]),
        })),
        lastTest: lastTest(data.token, provider.id),
      };
    });
  });

export const saveSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const providerId = String(body.providerId ?? "");
    if (!providerById(providerId)) throw new Error("Unknown provider.");
    const fields: Record<string, string> = {};
    const raw = body.fields;
    if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === "string") fields[key] = value;
      }
    }
    return { token: tokenOf(body), providerId, fields };
  })
  .handler(async ({ data }) => {
    const { writeSecrets } = await import("./credentials.server.ts");
    const meta = providerById(data.providerId);
    writeSecrets(data.token, data.providerId, data.fields, meta?.fields.map((field) => field.name) ?? []);
    return { ok: true };
  });

export const disconnectSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const providerId = String(body.providerId ?? "");
    if (!providerById(providerId)) throw new Error("Unknown provider.");
    return { token: tokenOf(body), providerId };
  })
  .handler(async ({ data }) => {
    const { clearSecrets } = await import("./credentials.server.ts");
    clearSecrets(data.token, data.providerId);
    return { ok: true };
  });

export const testSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = record(input);
    const providerId = String(body.providerId ?? "");
    if (!providerById(providerId)) throw new Error("Unknown provider.");
    return { token: tokenOf(body), providerId };
  })
  .handler(async ({ data }) => {
    const { allow, rememberTest } = await import("./credentials.server.ts");
    if (!allow(data.token, "test", 30, 10 * 60 * 1000)) {
      throw new Error("Too many connection tests. Wait a few minutes.");
    }
    const { testProvider } = await import("./providers.server.ts");
    const result = await testProvider(data.token, data.providerId);
    const validation = {
      ...result,
      role: "optional" as const,
      checkedAt: new Date().toISOString(),
    };
    rememberTest(data.token, validation);
    return validation;
  });

export const explainAudit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const scanId = String(record(input).scanId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) throw new Error("Unknown scan.");
    return { scanId };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI explanations are unavailable in this environment. The written fixes above are the source of truth." };
    const { getScan, saveAiSummary } = await import("./store.server.ts");
    const scan = await getScan(data.scanId);
    if (!scan) throw new Error("Scan not found.");
    if (scan.aiSummary) return { ok: true as const, text: scan.aiSummary, cached: true };
    const findings = scan.issues.slice(0, 24).map((issue) => ({
      title: issue.title,
      severity: issue.severity,
      url: issue.url,
      evidence: issue.evidence.slice(0, 240),
      source: issue.source,
      heuristic: issue.heuristic,
    }));
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You explain SEO audit findings in plain language. Use only the findings JSON. Do not invent rankings, traffic, backlinks, scores, or pages. Say when a finding is a heuristic. Do not promise ranking gains. Keep it under 400 words.",
          },
          {
            role: "user",
            content: JSON.stringify({
              host: scan.host,
              score: scan.scores?.overall ?? null,
              coverage: scan.scores?.coverage ?? null,
              findings,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false as const, error: `The AI request failed (${res.status}). The template recommendations are still available.` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "The AI response was empty." };
    await saveAiSummary(data.scanId, text);
    return { ok: true as const, text, cached: false };
  });
