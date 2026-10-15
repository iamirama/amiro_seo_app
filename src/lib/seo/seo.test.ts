import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze } from "./analyze.ts";
import { compareIssues } from "./compare.ts";
import { buildFixtureReport, fixturePages } from "./fixture.ts";
import { isPrivateAddress, precheckUrl, BlockedUrlError, normalizeUrl } from "./net.ts";
import { parseRobots, robotsAllows } from "./robots.ts";
import { computeScores, scoreCategory } from "./score.ts";
import { defaultConfig } from "./types.ts";
import { makeIssue } from "./remedies.ts";

describe("SSRF precheck", () => {
  it("blocks loopback, private, metadata, and non-http URLs", () => {
    for (const input of [
      "http://127.0.0.1/",
      "http://localhost/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://10.1.2.3/",
      "http://192.168.0.5/",
      "http://172.16.0.4/",
      "http://[::1]/",
      "http://2130706433/",
      "file:///etc/passwd",
      "http://user:pass@example.com/",
      "http://metadata.google.internal/",
    ]) {
      assert.throws(() => precheckUrl(input), BlockedUrlError, input);
    }
  });

  it("allows a public hostname and a public IP literal", () => {
    assert.equal(precheckUrl("https://example.com/path").hostname, "example.com");
    assert.equal(precheckUrl("https://8.8.8.8/").hostname, "8.8.8.8");
  });

  it("classifies private addresses", () => {
    assert.equal(isPrivateAddress("127.0.0.1"), true);
    assert.equal(isPrivateAddress("8.8.8.8"), false);
    assert.equal(isPrivateAddress("::1"), true);
    assert.equal(isPrivateAddress("10.0.0.1"), true);
  });
});

describe("URL normalize and robots", () => {
  it("strips fragments, default ports, and tracking params", () => {
    const url = normalizeUrl("https://Example.com:443/docs/?utm_source=x&b=2&a=1#top", "https://example.com", {
      includeQuery: true,
    });
    assert.equal(url, "https://example.com/docs?a=1&b=2");
  });

  it("honors the longest robots match", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: https://example.com/sitemap.xml");
    assert.equal(robotsAllows(rules, "https://example.com/private/secret"), false);
    assert.equal(robotsAllows(rules, "https://example.com/private/public/page"), true);
    assert.equal(rules.sitemaps[0], "https://example.com/sitemap.xml");
  });
});

describe("scoring and findings", () => {
  it("does not let missing PageSpeed data lower the score", () => {
    const scores = computeScores({ issues: [], crawledPages: 2, psiScore: null });
    assert.equal(scores.overall, 100);
    assert.equal(scores.categories.find((item) => item.id === "performance")?.score, null);
    assert.ok((scores.coverage ?? 0) < 100);
  });

  it("uses the lab score for performance instead of adding issue penalties", () => {
    const issue = makeIssue("psi_opportunity", "https://example.com", "evidence", "description");
    const scores = computeScores({ issues: [issue], crawledPages: 0, psiScore: 80 });
    assert.equal(scores.categories.find((item) => item.id === "performance")?.score, 80);
    assert.equal(scores.overall, 80);
  });

  it("diminishes repeated penalties", () => {
    const issues = Array.from({ length: 6 }, (_, index) =>
      makeIssue("title_missing", `https://example.com/${index}`, `missing ${index}`, "No title."),
    );
    const once = scoreCategory(issues.slice(0, 1), "onpage");
    const many = scoreCategory(issues, "onpage");
    assert.ok(many < once);
    assert.ok(many > 0);
  });

  it("finds a missing title in the fixture and labels the report", () => {
    const pages = fixturePages();
    const issues = analyze({
      pages,
      skipped: [],
      sitemap: { fetched: [], locs: [] },
      robotsStatus: 404,
      config: defaultConfig(),
      psi: null,
      brokenExternal: [],
      host: "fixture.example",
      localFlags: [],
    });
    assert.ok(issues.some((issue) => issue.code === "title_missing"));
    assert.ok(issues.some((issue) => issue.code === "alt_missing"));
    const html = buildFixtureReport("technical");
    assert.match(html, /FIXTURE/);
    assert.match(html, /not an official Google ranking score/i);
    assert.equal(html.includes("SECRET_KEY_SENTINEL"), false);
    assert.equal(html.includes("AIza"), false);
  });

  it("compares issue keys without treating a missing provider row as a fix by itself", () => {
    const older = [makeIssue("title_missing", "https://example.com/a", "a", "missing")];
    const newer = [makeIssue("title_missing", "https://example.com/b", "b", "missing")];
    const diff = compareIssues(older, newer);
    assert.equal(diff.resolved.length, 1);
    assert.equal(diff.added.length, 1);
    assert.equal(diff.persistent.length, 0);
  });
});
