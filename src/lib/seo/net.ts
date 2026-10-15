export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
]);

export function isPrivateAddress(ip: string): boolean {
  let value = ip.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));

  if (value.includes(":")) {
    if (value === "::1" || value === "::") return true;
    const head = value.split(":")[0] ?? "";
    const first = Number.parseInt(head || "0", 16);
    if (Number.isNaN(first)) return true;
    if (first >= 0xfc00 && first <= 0xfdff) return true;
    if (first >= 0xfe80 && first <= 0xfebf) return true;
    if (head === "2001" && value.split(":")[1] === "db8") return true;
    if (first >= 0xff00) return true;
    return false;
  }

  const parts = value.split(".");
  if (parts.length !== 4) return true;
  const nums = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    return Number(part);
  });
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return true;
  const a = nums[0] ?? 0;
  const b = nums[1] ?? 0;
  const c = nums[2] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function decimalToIpv4(host: string): string | null {
  if (!/^\d+$/.test(host)) return null;
  const n = Number(host);
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return null;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function precheckUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedUrlError("Enter a full URL, including https://.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https URLs can be audited.");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("URLs with embedded usernames or passwords are blocked.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) throw new BlockedUrlError("The URL is missing a hostname.");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new BlockedUrlError("Local, link-local, and internal hostnames are blocked.");
  }
  if (host === "0" || host === "0.0.0.0" || host === "::" || host === "::1") {
    throw new BlockedUrlError("That address is not a public website.");
  }
  const decimal = decimalToIpv4(host);
  if (decimal) {
    throw new BlockedUrlError("Numeric IP encodings are blocked.");
  }
  if (/^0x[0-9a-f]+$/i.test(host)) {
    throw new BlockedUrlError("Hexadecimal IP encodings are blocked.");
  }
  if (host.includes(":")) {
    if (isPrivateAddress(host)) throw new BlockedUrlError("Private and local network addresses are blocked.");
    return url;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (host.split(".").some((part) => part.length > 1 && part.startsWith("0"))) {
      throw new BlockedUrlError("Ambiguous IP addresses are blocked.");
    }
    if (isPrivateAddress(host)) throw new BlockedUrlError("Private and local network addresses are blocked.");
  }
  return url;
}

const TRACKING = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|mc_cid$|mc_eid$|igshid$|vero_id$)/i;

export function normalizeUrl(
  raw: string,
  base: string,
  opts: { includeQuery: boolean },
): string | null {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  if (!opts.includeQuery) {
    url.search = "";
  } else {
    const params = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key));
    params.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    url.search = "";
    for (const [key, value] of params) url.searchParams.append(key, value);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  const out = url.toString();
  if (out.length > 2000) return null;
  return out;
}

export function registrableHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function sameSite(hostname: string, rootHost: string, includeSubdomains: boolean): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const root = rootHost.toLowerCase().replace(/\.$/, "");
  const bareHost = registrableHost(host);
  const bareRoot = registrableHost(root);
  if (bareHost === bareRoot) return true;
  if (!includeSubdomains) return false;
  return bareHost.endsWith(`.${bareRoot}`) || host.endsWith(`.${root}`);
}
