import { analyze } from "./analyze.ts";
import { buildReport, type ReportModel } from "./report-html.ts";
import { computeScores } from "./score.ts";
import { blankPage, defaultConfig, type PageRecord } from "./types.ts";

export function fixturePages(): PageRecord[] {
  return [
    blankPage({
      url: "https://fixture.example/pricing",
      finalUrl: "https://fixture.example/pricing",
      title: null,
      titleCount: 0,
      metaDescription: null,
      canonical: null,
      headings: [{ level: 1, text: "Pricing" }, { level: 3, text: "Plans" }],
      imagesMissingAlt: [{ src: "/hero.jpg" }],
      wordCount: 40,
      textSample: "Plans start soon.",
      indexable: true,
      viewport: false,
      htmlLang: null,
      openGraph: {},
      twitter: {},
      headers: {
        hsts: false,
        csp: false,
        xContentTypeOptions: false,
        xFrameOptions: false,
        referrerPolicy: false,
      },
    }),
    blankPage({
      url: "https://fixture.example/old",
      finalUrl: "https://fixture.example/pricing",
      status: 200,
      redirectChain: [
        { url: "http://fixture.example/old", status: 301 },
        { url: "https://fixture.example/legacy", status: 302 },
        { url: "https://fixture.example/pricing", status: 200 },
      ],
      title: "Pricing",
      titleCount: 1,
      wordCount: 80,
      textSample: "Short pricing copy.",
    }),
  ];
}

export function fixtureModel(mode: ReportModel["mode"]): ReportModel {
  const config = defaultConfig();
  const pages = fixturePages();
  const issues = analyze({
    pages,
    skipped: [],
    sitemap: { fetched: [], locs: [] },
    robotsStatus: 404,
    config,
    psi: null,
    brokenExternal: [],
    host: "fixture.example",
    localFlags: [],
  });
  const scores = computeScores({ issues, crawledPages: pages.length, psiScore: null });
  return {
    fixture: true,
    mode,
    targetUrl: "https://fixture.example/",
    host: "fixture.example",
    createdAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    config,
    scores,
    summary: "FIXTURE — not a live crawl. These findings were produced from a labeled sample page, not from the network and not from an SEO API.",
    issues,
    pages: pages.map((page) => ({
      url: page.finalUrl,
      status: page.status,
      title: page.title,
      words: page.wordCount,
      indexable: page.indexable,
    })),
    psi: null,
    external: { backlinks: [], visibility: [] },
    validation: [
      {
        id: "crawler",
        name: "Northline crawler",
        role: "required",
        status: "connected",
        auth: "No credentials",
        permission: "Fixture",
        quota: null,
        message: "Fixture data. No network request was made.",
        action: "None.",
        checkedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    limitations: ["This file is a fixture for the report layout. It is not an audit of fixture.example."],
  };
}

export function buildFixtureReport(mode: ReportModel["mode"]): string {
  return buildReport(fixtureModel(mode));
}
