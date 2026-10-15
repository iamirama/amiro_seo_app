export type FieldKind = "password" | "text";

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder: string;
};

export type ProviderMeta = {
  id: string;
  name: string;
  description: string;
  website: string;
  docs: string;
  pricing: string;
  authMethod: string;
  access: "free" | "free-key" | "free-quota" | "oauth" | "paid" | "no-api";
  accessNote: string;
  selectable: boolean;
  canSpend: boolean;
  fields: FieldSpec[];
  capabilities: string[];
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "crawler",
    name: "Northline crawler",
    description:
      "Fetches public pages, robots.txt, and XML sitemaps, then checks status codes, indexability, metadata, links, and structured data.",
    website: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
    docs: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
    pricing: "https://developers.google.com/search/docs",
    authMethod: "None. Public HTTP only.",
    access: "free",
    accessNote: "Runs inside this app. No API key. Does not bypass robots.txt, logins, or bot walls.",
    selectable: true,
    canSpend: false,
    fields: [],
    capabilities: [
      "Status codes and redirects",
      "robots.txt and sitemaps",
      "Titles, descriptions, headings, canonicals",
      "Indexability signals",
      "Alt text, hreflang, Open Graph, JSON-LD",
      "Internal links and limited external checks",
    ],
  },
  {
    id: "pagespeed",
    name: "Google PageSpeed Insights",
    description: "Lighthouse lab data plus Chrome UX Report field data when Google has enough traffic for the URL.",
    website: "https://pagespeed.web.dev/",
    docs: "https://developers.google.com/speed/docs/insights/v5/get-started",
    pricing: "https://developers.google.com/speed/docs/insights/v5/get-started#APIKey",
    authMethod: "API key (query parameter). A key is optional in the docs and recommended for automation.",
    access: "free-key",
    accessNote:
      "Free. Anonymous quota is often exhausted, so a Cloud API key is the reliable path. Referrer-restricted keys fail from this server.",
    selectable: true,
    canSpend: false,
    fields: [{ name: "apiKey", label: "API key", kind: "password", placeholder: "AIza..." }],
    capabilities: ["Lab performance score", "Field Core Web Vitals when present", "Lighthouse opportunities"],
  },
  {
    id: "search_console",
    name: "Google Search Console",
    description: "Search analytics for a property you already verified. Not a public crawl and not available for sites you do not own.",
    website: "https://search.google.com/search-console/",
    docs: "https://developers.google.com/webmaster-tools/v1/api_reference_index",
    pricing: "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
    authMethod: "OAuth 2.0 refresh token plus your OAuth client.",
    access: "oauth",
    accessNote:
      "Free for verified properties. This app exchanges a refresh token. It does not start Google's consent screen, because that needs your own OAuth client and a stable redirect URL.",
    selectable: true,
    canSpend: false,
    fields: [
      { name: "clientId", label: "OAuth client ID", kind: "text", placeholder: "....apps.googleusercontent.com" },
      { name: "clientSecret", label: "OAuth client secret", kind: "password", placeholder: "GOCSPX-..." },
      { name: "refreshToken", label: "Refresh token", kind: "password", placeholder: "1//..." },
    ],
    capabilities: ["Queries, pages, clicks, impressions, CTR, position", "Only for properties on the authorized account"],
  },
  {
    id: "ga4",
    name: "Google Analytics Data API",
    description: "Organic landing-page metrics from a GA4 property. These are analytics, not rankings.",
    website: "https://analytics.google.com/",
    docs: "https://developers.google.com/analytics/devguides/reporting/data/v1",
    pricing: "https://developers.google.com/analytics/devguides/reporting/data/v1/quotas",
    authMethod: "OAuth 2.0 refresh token and a numeric GA4 property ID.",
    access: "oauth",
    accessNote: "Free quota on the Data API for properties you can access. A property ID is required.",
    selectable: true,
    canSpend: false,
    fields: [
      { name: "propertyId", label: "GA4 property ID", kind: "text", placeholder: "123456789" },
      { name: "clientId", label: "OAuth client ID", kind: "text", placeholder: "....apps.googleusercontent.com" },
      { name: "clientSecret", label: "OAuth client secret", kind: "password", placeholder: "GOCSPX-..." },
      { name: "refreshToken", label: "Refresh token", kind: "password", placeholder: "1//..." },
    ],
    capabilities: ["Organic landing pages and sessions", "Engaged sessions when the property returns them"],
  },
  {
    id: "bing",
    name: "Bing Webmaster Tools",
    description: "Sites, rank, and traffic stats for a Bing property you verified.",
    website: "https://www.bing.com/webmasters/",
    docs: "https://learn.microsoft.com/en-us/bingwebmaster/",
    pricing: "https://www.bing.com/webmasters/help/getting-started-with-bing-webmaster-tools-6b6c1b0d",
    authMethod: "API key from Bing Webmaster settings.",
    access: "free-key",
    accessNote: "Free for verified sites. The key only returns data for sites on that Bing account.",
    selectable: true,
    canSpend: false,
    fields: [{ name: "apiKey", label: "API key", kind: "password", placeholder: "Bing API key" }],
    capabilities: ["Verified site list", "Rank and traffic stats when the endpoint accepts the site"],
  },
  {
    id: "ahrefs",
    name: "Ahrefs",
    description: "Commercial backlink and domain metrics. API units depend on your plan.",
    website: "https://ahrefs.com/",
    docs: "https://docs.ahrefs.com/",
    pricing: "https://ahrefs.com/api",
    authMethod: "Bearer API token.",
    access: "paid",
    accessNote: "Paid. A free Ahrefs account does not include API access unless Ahrefs currently says so on the pricing page. The limits call used for testing does not spend units. Domain rating is opt-in and can spend units.",
    selectable: true,
    canSpend: true,
    fields: [{ name: "apiToken", label: "API token", kind: "password", placeholder: "Ahrefs API token" }],
    capabilities: ["Subscription units", "Domain rating when you allow unit spend"],
  },
  {
    id: "semrush",
    name: "Semrush",
    description: "Commercial domain and keyword analytics. API units are plan-specific.",
    website: "https://www.semrush.com/",
    docs: "https://developer.semrush.com/api/",
    pricing: "https://www.semrush.com/prices/",
    authMethod: "API key.",
    access: "paid",
    accessNote: "Paid API units. A free Semrush login is not the same as API access. The unit-balance check does not run a report. Domain ranks are opt-in and spend units.",
    selectable: true,
    canSpend: true,
    fields: [{ name: "apiKey", label: "API key", kind: "password", placeholder: "Semrush API key" }],
    capabilities: ["Remaining API units", "Domain ranks for the US database when you allow unit spend"],
  },
  {
    id: "moz",
    name: "Moz",
    description: "Domain authority and link metrics from the Moz Links API.",
    website: "https://moz.com/",
    docs: "https://moz.com/products/api",
    pricing: "https://moz.com/products/api",
    authMethod: "HTTP Basic with Access ID and Secret Key.",
    access: "paid",
    accessNote: "Paid rows on most plans. The usage endpoint is used for the connection test. URL metrics are opt-in and can consume rows.",
    selectable: true,
    canSpend: true,
    fields: [
      { name: "accessId", label: "Access ID", kind: "text", placeholder: "mozscape-..." },
      { name: "secretKey", label: "Secret key", kind: "password", placeholder: "Secret key" },
    ],
    capabilities: ["Usage and row quota when exposed", "URL metrics when you allow row spend"],
  },
  {
    id: "dataforseo",
    name: "DataForSEO",
    description: "Optional paid SERP, keyword, and backlink data. Not called unless you allow spend.",
    website: "https://dataforseo.com/",
    docs: "https://docs.dataforseo.com/v3/",
    pricing: "https://dataforseo.com/pricing",
    authMethod: "HTTP Basic with API login and password.",
    access: "paid",
    accessNote: "Pay-as-you-go. Account info is free to read. The backlink summary is opt-in and billed by DataForSEO.",
    selectable: true,
    canSpend: true,
    fields: [
      { name: "login", label: "API login", kind: "text", placeholder: "login@email" },
      { name: "password", label: "API password", kind: "password", placeholder: "API password" },
    ],
    capabilities: ["Account balance", "Backlink summary when you allow spend"],
  },
  {
    id: "serpapi",
    name: "SerpApi",
    description: "Optional Google result pages for an explicit query. This is not a private keyword index.",
    website: "https://serpapi.com/",
    docs: "https://serpapi.com/search-api",
    pricing: "https://serpapi.com/pricing",
    authMethod: "API key.",
    access: "free-quota",
    accessNote: "Limited free searches, then paid. The account call is the connection test. A site: query is opt-in and uses a search credit.",
    selectable: true,
    canSpend: true,
    fields: [{ name: "apiKey", label: "API key", kind: "password", placeholder: "SerpApi key" }],
    capabilities: ["Account quota", "One site: query when you allow a search credit"],
  },
  {
    id: "majestic",
    name: "Majestic",
    description: "Optional Majestic index metrics such as Trust Flow and referring domains.",
    website: "https://majestic.com/",
    docs: "https://developer.majestic.com/",
    pricing: "https://majestic.com/api",
    authMethod: "API key.",
    access: "paid",
    accessNote: "Paid. Subscription info is the connection test. Index item info is opt-in and can consume retrieval units.",
    selectable: true,
    canSpend: true,
    fields: [{ name: "apiKey", label: "API key", kind: "password", placeholder: "Majestic API key" }],
    capabilities: ["Subscription info", "Fresh index item info when you allow spend"],
  },
  {
    id: "screamingfrog",
    name: "Screaming Frog SEO Spider",
    description: "Desktop crawler used as the reference for the checks Northline runs itself. There is no free public cloud API to connect.",
    website: "https://www.screamingfrog.co.uk/seo-spider/",
    docs: "https://www.screamingfrog.co.uk/seo-spider/user-guide/",
    pricing: "https://www.screamingfrog.co.uk/seo-spider/pricing/",
    authMethod: "No cloud API in this app.",
    access: "no-api",
    accessNote: "Northline does not pretend to call Screaming Frog. The built-in crawler covers the overlapping public checks.",
    selectable: false,
    canSpend: false,
    fields: [],
    capabilities: ["Reference only", "Equivalent public checks run by the Northline crawler"],
  },
];

export function providerById(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  connected_limited: "Connected with limitations",
  auth_failed: "Authentication failed",
  permission_denied: "Permission denied",
  rate_limited: "Rate limited",
  quota_exhausted: "Quota exhausted",
  unavailable: "Service unavailable",
  not_configured: "Not configured",
  inconclusive: "Validation inconclusive",
};
