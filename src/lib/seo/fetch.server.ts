import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import zlib from "node:zlib";
import { BlockedUrlError, isPrivateAddress, precheckUrl } from "./net.ts";

export const USER_AGENT = "NorthlineAudit/1.0 (+https://northline.audit/bot; public technical SEO audit)";

type LookupOptions = { all?: boolean };
type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;

function safeLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  lookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      if (!addresses.length) {
        callback(Object.assign(new Error(`No public address for ${hostname}`), { code: "ENOTFOUND" }), "");
        return;
      }
      for (const address of addresses) {
        if (isPrivateAddress(address.address)) {
          callback(Object.assign(new Error(`Blocked a non-public address for ${hostname}`), { code: "EBLOCKED" }), "");
          return;
        }
      }
      if (options.all) {
        callback(
          null,
          addresses.map((address) => ({ address: address.address, family: address.family })),
        );
        return;
      }
      const first = addresses[0];
      if (!first) {
        callback(Object.assign(new Error("No public address"), { code: "ENOTFOUND" }), "");
        return;
      }
      callback(null, first.address, first.family);
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error("DNS lookup failed");
      callback(err as NodeJS.ErrnoException, "");
    });
}

export async function assertPublicHost(input: string): Promise<URL> {
  const url = precheckUrl(input);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new BlockedUrlError("The hostname did not resolve.");
  for (const address of addresses) {
    if (isPrivateAddress(address.address)) {
      throw new BlockedUrlError("The hostname resolves to a non-public address and was blocked.");
    }
  }
  return url;
}

type Once = { status: number; headers: http.IncomingHttpHeaders; body: Buffer };

function requestOnce(target: URL, method: string, timeoutMs: number, maxBytes: number): Promise<Once> {
  return new Promise((resolve, reject) => {
    const lib = target.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-encoding": "identity",
        },
        lookup: safeLookup as unknown as typeof lookup,
        timeout: timeoutMs,
        servername: target.hostname,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("The request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

function headerMap(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out[key.toLowerCase()] = value;
    else if (Array.isArray(value)) out[key.toLowerCase()] = value.join(", ");
  }
  return out;
}

function decodeBody(body: Buffer, encoding: string): string {
  try {
    let decoded = body;
    if (/gzip/i.test(encoding)) decoded = zlib.gunzipSync(body);
    else if (/deflate/i.test(encoding)) decoded = zlib.inflateSync(body);
    else if (/br/i.test(encoding)) decoded = zlib.brotliDecompressSync(body);
    return decoded.toString("utf8");
  } catch {
    return body.toString("utf8");
  }
}

export type SafeResponse = {
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirectChain: { url: string; status: number }[];
  redirectLoop: boolean;
  contentType: string;
};

export async function safeFetch(
  raw: string,
  opts?: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number; maxRedirects?: number },
): Promise<SafeResponse> {
  const method = opts?.method ?? "GET";
  const timeoutMs = opts?.timeoutMs ?? 10000;
  const maxBytes = opts?.maxBytes ?? 1_200_000;
  const maxRedirects = opts?.maxRedirects ?? 5;
  const chain: { url: string; status: number }[] = [];
  let current = precheckUrl(raw);
  const seen = new Set<string>();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const here = current.toString();
    if (seen.has(here)) {
      return {
        finalUrl: here,
        status: chain.at(-1)?.status ?? 0,
        headers: {},
        body: "",
        redirectChain: chain,
        redirectLoop: true,
        contentType: "",
      };
    }
    seen.add(here);
    const response = await requestOnce(current, hop === 0 ? method : "GET", timeoutMs, maxBytes);
    chain.push({ url: here, status: response.status });
    const location = response.headers.location;
    const redirect = response.status >= 300 && response.status < 400 && location;
    if (redirect && hop < maxRedirects) {
      const next = new URL(Array.isArray(location) ? location[0] ?? "" : location, current);
      current = precheckUrl(next.toString());
      continue;
    }
    const headers = headerMap(response.headers);
    return {
      finalUrl: here,
      status: response.status,
      headers,
      body: method === "HEAD" ? "" : decodeBody(response.body, headers["content-encoding"] ?? ""),
      redirectChain: chain,
      redirectLoop: false,
      contentType: headers["content-type"] ?? "",
    };
  }

  return {
    finalUrl: current.toString(),
    status: chain.at(-1)?.status ?? 0,
    headers: {},
    body: "",
    redirectChain: chain,
    redirectLoop: false,
    contentType: "",
  };
}

export function publicError(error: unknown): string {
  if (error instanceof BlockedUrlError) return error.message;
  if (error instanceof Error) {
    return error.message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[address]").slice(0, 240);
  }
  return "The request failed.";
}
