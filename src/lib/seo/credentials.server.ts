import type { ValidationRow } from "./types.ts";

export type SecretBag = Record<string, Record<string, string>>;

type Bucket = {
  secrets: SecretBag;
  tests: Record<string, ValidationRow>;
  hits: Record<string, number[]>;
};

const globalRef = globalThis as typeof globalThis & {
  __northlineCreds?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalRef.__northlineCreds) globalRef.__northlineCreds = new Map();
  return globalRef.__northlineCreds;
}

export function assertToken(token: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error("Open Settings once so this browser has a credential session.");
  }
  return token;
}

function bucket(token: string): Bucket {
  const map = store();
  let row = map.get(token);
  if (!row) {
    row = { secrets: {}, tests: {}, hits: {} };
    map.set(token, row);
  }
  return row;
}

export function allow(token: string, action: string, limit: number, windowMs: number): boolean {
  const row = bucket(assertToken(token));
  const now = Date.now();
  const recent = (row.hits[action] ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  row.hits[action] = recent;
  return true;
}

export function readSecrets(token: string, providerId: string): Record<string, string> {
  return { ...(bucket(assertToken(token)).secrets[providerId] ?? {}) };
}

export function writeSecrets(token: string, providerId: string, fields: Record<string, string>, replaceNames: string[]) {
  const row = bucket(assertToken(token));
  const current = { ...(row.secrets[providerId] ?? {}) };
  for (const name of replaceNames) {
    const value = fields[name]?.trim() ?? "";
    if (value) current[name] = value;
  }
  row.secrets[providerId] = current;
}

export function clearSecrets(token: string, providerId: string) {
  const row = bucket(assertToken(token));
  delete row.secrets[providerId];
  delete row.tests[providerId];
}

export function rememberTest(token: string, result: ValidationRow) {
  bucket(assertToken(token)).tests[result.id] = result;
}

export function lastTest(token: string, providerId: string): ValidationRow | null {
  return bucket(assertToken(token)).tests[providerId] ?? null;
}

export function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function scrub(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length > 3) out = out.split(secret).join("••••");
  }
  return out.replace(/key=[^&\s]+/gi, "key=••••").slice(0, 420);
}
