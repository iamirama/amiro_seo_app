import * as cheerio from "cheerio";
import { normalizeUrl, sameSite } from "./net.ts";
import type { PageRecord } from "./types.ts";

const FILE_ALT = /(^|\/)(img|image|dsc|photo|picture|screenshot)[-_]?\d*\.(png|jpe?g|webp|gif|svg)$|^(img|dsc|photo)[-_]?\d+$/i;

function abs(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function collectTypes(node: unknown, out: string[], addressBits: { street: boolean; locality: boolean; phone: boolean; local: boolean }) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out, addressBits);
    return;
  }
  const record = node as Record<string, unknown>;
  const kind = record["@type"];
  const types = Array.isArray(kind) ? kind : kind ? [kind] : [];
  for (const type of types) {
    if (typeof type === "string") {
      out.push(type);
      if (/localbusiness|store|restaurant|dentist|physician|hotel/i.test(type)) addressBits.local = true;
    }
  }
  const address = record.address;
  if (address && typeof address === "object") {
    const addr = address as Record<string, unknown>;
    if (typeof addr.streetAddress === "string" && addr.streetAddress.trim()) addressBits.street = true;
    if (typeof addr.addressLocality === "string" && addr.addressLocality.trim()) addressBits.locality = true;
  }
  if (typeof record.telephone === "string" && record.telephone.trim()) addressBits.phone = true;
  if (record["@graph"]) collectTypes(record["@graph"], out, addressBits);
}

export type ParsedExtras = {
  localIncomplete: boolean;
  localFound: boolean;
};

export function parseHtml(input: {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  redirectChain: { url: string; status: number }[];
  redirectLoop: boolean;
  headerMap: Record<string, string>;
  body: string;
  loadMs: number;
  depth: number;
  host: string;
  error: string | null;
  includeQuery: boolean;
  includeSubdomains: boolean;
}): { page: PageRecord; localFound: boolean; localIncomplete: boolean } {
  const headers = input.headerMap;
  const xRobots = headers["x-robots-tag"] ?? null;
  const contentType = input.contentType || headers["content-type"] || "";
  const htmlLike = /html|xml/i.test(contentType) || (!contentType && input.body.trim().startsWith("<"));
  const basePage: PageRecord = {
    url: input.url,
    finalUrl: input.finalUrl,
    status: input.status,
    contentType,
    redirectChain: input.redirectChain,
    redirectLoop: input.redirectLoop,
    title: null,
    titleCount: 0,
    metaDescription: null,
    canonical: null,
    canonicalCount: 0,
    robotsMeta: null,
    xRobotsTag: xRobots,
    headings: [],
    imagesMissingAlt: [],
    filenameAlts: [],
    internalLinks: [],
    externalLinks: [],
    hreflang: [],
    schemaTypes: [],
    schemaErrors: [],
    openGraph: {},
    twitter: {},
    wordCount: 0,
    textSample: "",
    loadMs: input.loadMs,
    error: input.error,
    mixedContent: [],
    depth: input.depth,
    indexable: true,
    viewport: false,
    htmlLang: null,
    nonHtml: !htmlLike,
    headers: {
      hsts: Boolean(headers["strict-transport-security"]),
      csp: Boolean(headers["content-security-policy"] || headers["content-security-policy-report-only"]),
      xContentTypeOptions: /nosniff/i.test(headers["x-content-type-options"] ?? ""),
      xFrameOptions: Boolean(headers["x-frame-options"] || /frame-ancestors/i.test(headers["content-security-policy"] ?? "")),
      referrerPolicy: Boolean(headers["referrer-policy"]),
    },
  };

  if (input.error || input.status >= 400 || !htmlLike) {
    const robotsBlocked = /noindex/i.test(`${basePage.robotsMeta ?? ""} ${xRobots ?? ""}`);
    basePage.indexable = !robotsBlocked && input.status < 400 && !input.error;
    return { page: basePage, localFound: false, localIncomplete: false };
  }

  const $ = cheerio.load(input.body.slice(0, 1_200_000));
  $("script, style, noscript, svg, template").remove();
  const lang = $("html").attr("lang")?.trim() || null;
  basePage.htmlLang = lang;
  basePage.viewport = $('meta[name="viewport" i]').length > 0;
  const titles = $("title")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  basePage.titleCount = $("title").length;
  basePage.title = titles[0] ?? null;
  basePage.metaDescription =
    $('meta[name="description" i]').attr("content")?.replace(/\s+/g, " ").trim() || null;
  basePage.robotsMeta = $('meta[name="robots" i]').attr("content")?.trim() || null;

  const canonicals = $('link[rel="canonical" i]')
    .toArray()
    .map((node) => $(node).attr("href")?.trim() || "")
    .filter(Boolean);
  basePage.canonicalCount = canonicals.length;
  basePage.canonical = canonicals[0] ? abs(canonicals[0], input.finalUrl) : null;

  $("h1, h2, h3, h4, h5, h6").each((_, node) => {
    const level = Number(node.tagName.replace("h", ""));
    const text = $(node).text().replace(/\s+/g, " ").trim();
    if (text) basePage.headings.push({ level, text: text.slice(0, 180) });
  });

  $("img").each((_, node) => {
    if (basePage.imagesMissingAlt.length + basePage.filenameAlts.length > 40) return;
    const src = $(node).attr("src")?.trim() || $(node).attr("data-src")?.trim() || "";
    const alt = $(node).attr("alt");
    if (alt == null) {
      if (src) basePage.imagesMissingAlt.push({ src: src.slice(0, 300) });
      return;
    }
    if (FILE_ALT.test(alt.trim())) {
      basePage.filenameAlts.push({ src: src.slice(0, 200), alt: alt.slice(0, 120) });
    }
  });

  const securePage = input.finalUrl.startsWith("https://");
  $("img, script, iframe, link, source, video, audio").each((_, node) => {
    if (basePage.mixedContent.length > 20) return;
    const src = $(node).attr("src") || $(node).attr("href") || "";
    if (securePage && src.startsWith("http://")) basePage.mixedContent.push(src.slice(0, 300));
  });

  const linkOpts = { includeQuery: input.includeQuery };
  $("a[href]").each((_, node) => {
    if (basePage.internalLinks.length + basePage.externalLinks.length > 120) return;
    const href = $(node).attr("href")?.trim() || "";
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    const normalized = normalizeUrl(href, input.finalUrl, linkOpts);
    if (!normalized) return;
    let hostname = "";
    try {
      hostname = new URL(normalized).hostname;
    } catch {
      return;
    }
    if (sameSite(hostname, input.host, input.includeSubdomains)) {
      if (!basePage.internalLinks.includes(normalized)) basePage.internalLinks.push(normalized);
    } else if (!basePage.externalLinks.includes(normalized)) {
      basePage.externalLinks.push(normalized);
    }
  });

  $('link[rel="alternate" i]').each((_, node) => {
    const langCode = $(node).attr("hreflang")?.trim() || "";
    const href = $(node).attr("href")?.trim() || "";
    if (!langCode && !href) return;
    if (basePage.hreflang.length < 30) {
      basePage.hreflang.push({
        lang: langCode,
        href: href ? abs(href, input.finalUrl) || href : "",
      });
    }
  });

  $('meta[property^="og:" i], meta[property^="OG:"]').each((_, node) => {
    const key = ($(node).attr("property") || "").toLowerCase();
    const value = $(node).attr("content")?.trim() || "";
    if (key && value) basePage.openGraph[key] = value.slice(0, 300);
  });
  $('meta[name^="twitter:" i]').each((_, node) => {
    const key = ($(node).attr("name") || "").toLowerCase();
    const value = $(node).attr("content")?.trim() || "";
    if (key && value) basePage.twitter[key] = value.slice(0, 300);
  });

  const addressBits = { street: false, locality: false, phone: false, local: false };
  $('script[type="application/ld+json" i]').each((_, node) => {
    const raw = $(node).text().trim();
    if (!raw) return;
    try {
      collectTypes(JSON.parse(raw), basePage.schemaTypes, addressBits);
    } catch (error) {
      basePage.schemaErrors.push(error instanceof Error ? error.message.slice(0, 180) : "Invalid JSON-LD");
    }
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean);
  basePage.wordCount = words.length;
  basePage.textSample = words.slice(0, 180).join(" ");
  const noindex = /noindex/i.test(`${basePage.robotsMeta ?? ""} ${xRobots ?? ""}`);
  basePage.indexable = !noindex && input.status < 400;

  const localFound = addressBits.local || basePage.schemaTypes.some((type) => /localbusiness/i.test(type));
  const localIncomplete = localFound && (!addressBits.street || !addressBits.locality || !addressBits.phone);
  return { page: basePage, localFound, localIncomplete };
}
