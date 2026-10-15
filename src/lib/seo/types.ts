export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  "technical",
  "onpage",
  "content",
  "performance",
  "backlinks",
  "keywords",
  "local",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type IssueStatus = "open" | "in_progress" | "fixed" | "ignored";
export type Effort = "low" | "medium" | "high";
export type Confidence = "high" | "medium" | "low";

export type ConnStatus =
  | "connected"
  | "connected_limited"
  | "auth_failed"
  | "permission_denied"
  | "rate_limited"
  | "quota_exhausted"
  | "unavailable"
  | "not_configured"
  | "inconclusive";

export type Issue = {
  id: string;
  code: string;
  title: string;
  url: string | null;
  category: Category;
  severity: Severity;
  confidence: Confidence;
  description: string;
  why: string;
  evidence: string;
  solution: string;
  steps: string[];
  example: string | null;
  docs: string | null;
  effort: Effort;
  benefit: string;
  priority: number;
  status: IssueStatus;
  source: string;
  heuristic: boolean;
};

export type PageRecord = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  redirectChain: { url: string; status: number }[];
  redirectLoop: boolean;
  title: string | null;
  titleCount: number;
  metaDescription: string | null;
  canonical: string | null;
  canonicalCount: number;
  robotsMeta: string | null;
  xRobotsTag: string | null;
  headings: { level: number; text: string }[];
  imagesMissingAlt: { src: string }[];
  filenameAlts: { src: string; alt: string }[];
  internalLinks: string[];
  externalLinks: string[];
  hreflang: { lang: string; href: string }[];
  schemaTypes: string[];
  schemaErrors: string[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  wordCount: number;
  textSample: string;
  loadMs: number;
  error: string | null;
  mixedContent: string[];
  depth: number;
  indexable: boolean;
  viewport: boolean;
  htmlLang: string | null;
  nonHtml: boolean;
  headers: {
    hsts: boolean;
    csp: boolean;
    xContentTypeOptions: boolean;
    xFrameOptions: boolean;
    referrerPolicy: boolean;
  };
};

export type ProviderPick = {
  id: string;
  included: boolean;
  required: boolean;
  spend: boolean;
};

export type ScanConfig = {
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  delayMs: number;
  checkExternal: boolean;
  includeSubdomains: boolean;
  includeQuery: boolean;
  respectRobots: boolean;
  useSitemap: boolean;
  titleShort: number;
  titleLong: number;
  metaShort: number;
  metaLong: number;
  thinWords: number;
  providers: ProviderPick[];
  psiStrategy: "mobile" | "desktop" | "both";
  psiAllowUnkeyed: boolean;
};

export type Progress = {
  stage: string;
  discovered: number;
  crawled: number;
  remaining: number;
  errors: number;
  currentUrl: string | null;
  notes: string[];
};

export type CategoryScore = {
  id: "technical" | "onpage" | "content" | "performance";
  label: string;
  score: number | null;
  weight: number;
  reason: string;
};

export type Scores = {
  overall: number | null;
  coverage: number;
  categories: CategoryScore[];
  rules: string[];
};

export type ValidationRow = {
  id: string;
  name: string;
  role: "required" | "optional" | "info";
  status: ConnStatus;
  auth: string;
  permission: string;
  quota: string | null;
  message: string;
  action: string;
  checkedAt: string;
};

export type PsiMetric = { name: string; category: string; percentile: string };

export type PsiResult = {
  strategy: string;
  requestedUrl: string;
  finalUrl: string | null;
  fetchedAt: string;
  lab: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    lcp: string | null;
    cls: string | null;
    inp: string | null;
    fcp: string | null;
    tbt: string | null;
    speedIndex: string | null;
  } | null;
  field: { overall: string | null; metrics: PsiMetric[] } | null;
  originField: { overall: string | null } | null;
  opportunities: { title: string; displayValue: string; explanation: string }[];
  error?: string;
  source: string;
};

export type MetricRow = { label: string; value: string; note?: string };

export type ProviderPayload = {
  id: string;
  name: string;
  ok: boolean;
  status: ConnStatus;
  message: string;
  metrics: MetricRow[];
  rows: Record<string, string>[];
  retrievedAt: string;
  spentUnits: boolean;
};

export type ExternalBundle = {
  backlinks: ProviderPayload[];
  visibility: ProviderPayload[];
};

export type RobotsSnapshot = {
  status: number;
  error?: string;
  sitemaps: string[];
  crawlDelayMs: number | null;
  blockedHome: boolean;
  raw?: string;
};

export type SitemapSnapshot = {
  fetched: { url: string; status: number; count: number; error?: string }[];
  locs: string[];
  error?: string;
};

export type ScanSummary = {
  id: string;
  targetUrl: string;
  host: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  scores: Scores | null;
  coverage: number;
  pageCount: number;
  issueCounts: Record<string, number>;
  openCritical: number;
  openHigh: number;
};

export type ScanDetail = ScanSummary & {
  config: ScanConfig;
  progress: Progress;
  summary: string | null;
  validation: ValidationRow[];
  external: ExternalBundle;
  psi: PsiResult | null;
  aiSummary: string | null;
  error: string | null;
  issues: Issue[];
  pages: PageRecord[];
  robots: RobotsSnapshot | null;
  sitemap: SitemapSnapshot | null;
  skipped: { url: string; reason: string }[];
};

export type MaskedField = { name: string; label: string; configured: boolean; mask: string | null };

export type ProviderSettingsView = {
  id: string;
  configured: boolean;
  fields: MaskedField[];
  lastTest: ValidationRow | null;
};

export function defaultProviders(): ProviderPick[] {
  return [
    { id: "crawler", included: true, required: true, spend: false },
    { id: "pagespeed", included: true, required: false, spend: false },
    { id: "search_console", included: false, required: false, spend: false },
    { id: "ga4", included: false, required: false, spend: false },
    { id: "bing", included: false, required: false, spend: false },
    { id: "ahrefs", included: false, required: false, spend: false },
    { id: "semrush", included: false, required: false, spend: false },
    { id: "moz", included: false, required: false, spend: false },
    { id: "dataforseo", included: false, required: false, spend: false },
    { id: "serpapi", included: false, required: false, spend: false },
    { id: "majestic", included: false, required: false, spend: false },
  ];
}

export function defaultConfig(): ScanConfig {
  return {
    maxPages: 12,
    maxDepth: 2,
    timeoutMs: 10000,
    delayMs: 300,
    checkExternal: false,
    includeSubdomains: false,
    includeQuery: false,
    respectRobots: true,
    useSitemap: true,
    titleShort: 15,
    titleLong: 60,
    metaShort: 50,
    metaLong: 160,
    thinWords: 250,
    providers: defaultProviders(),
    psiStrategy: "mobile",
    psiAllowUnkeyed: false,
  };
}

export function blankPage(over: Partial<PageRecord> & Pick<PageRecord, "url">): PageRecord {
  return {
    finalUrl: over.url,
    status: 200,
    contentType: "text/html",
    redirectChain: [],
    redirectLoop: false,
    title: null,
    titleCount: 0,
    metaDescription: null,
    canonical: null,
    canonicalCount: 0,
    robotsMeta: null,
    xRobotsTag: null,
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
    loadMs: 0,
    error: null,
    mixedContent: [],
    depth: 0,
    indexable: true,
    viewport: true,
    htmlLang: "en",
    nonHtml: false,
    headers: {
      hsts: true,
      csp: true,
      xContentTypeOptions: true,
      xFrameOptions: true,
      referrerPolicy: true,
    },
    ...over,
  };
}

export function clampConfig(input: ScanConfig): ScanConfig {
  const base = defaultConfig();
  const providers = defaultProviders().map((slot) => {
    const found = input.providers?.find((p) => p.id === slot.id);
    if (!found) return slot;
    return {
      id: slot.id,
      included: Boolean(found.included),
      required: Boolean(found.included && found.required),
      spend: Boolean(found.included && found.spend),
    };
  });
  const strategy = input.psiStrategy;
  return {
    maxPages: clampNum(input.maxPages, 1, 25, base.maxPages),
    maxDepth: clampNum(input.maxDepth, 0, 4, base.maxDepth),
    timeoutMs: clampNum(input.timeoutMs, 3000, 20000, base.timeoutMs),
    delayMs: clampNum(input.delayMs, 0, 3000, base.delayMs),
    checkExternal: Boolean(input.checkExternal),
    includeSubdomains: Boolean(input.includeSubdomains),
    includeQuery: Boolean(input.includeQuery),
    respectRobots: input.respectRobots !== false,
    useSitemap: input.useSitemap !== false,
    titleShort: clampNum(input.titleShort, 5, 40, base.titleShort),
    titleLong: clampNum(input.titleLong, 40, 120, base.titleLong),
    metaShort: clampNum(input.metaShort, 20, 80, base.metaShort),
    metaLong: clampNum(input.metaLong, 80, 320, base.metaLong),
    thinWords: clampNum(input.thinWords, 50, 800, base.thinWords),
    providers,
    psiStrategy: strategy === "desktop" || strategy === "both" ? strategy : "mobile",
    psiAllowUnkeyed: Boolean(input.psiAllowUnkeyed),
  };
}

function clampNum(value: number, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
