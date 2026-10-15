import { getSql } from "@/lib/db";
import { compareIssues } from "./compare.ts";
import { computeScores } from "./score.ts";
import type {
  ExternalBundle,
  Issue,
  IssueStatus,
  PageRecord,
  Progress,
  PsiResult,
  RobotsSnapshot,
  ScanConfig,
  ScanDetail,
  ScanSummary,
  Scores,
  SitemapSnapshot,
  ValidationRow,
} from "./types.ts";

type ScanRow = {
  id: string;
  target_url: string;
  host: string;
  status: string;
  config_json: string;
  progress_json: string;
  queue_json: string;
  seen_json: string;
  skipped_json: string;
  robots_json: string | null;
  sitemap_json: string | null;
  scores_json: string | null;
  coverage: number;
  summary: string | null;
  validation_json: string | null;
  external_json: string | null;
  psi_json: string | null;
  ai_summary: string | null;
  error: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

function parse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const emptyExternal = (): ExternalBundle => ({ backlinks: [], visibility: [] });

export type QueueItem = { url: string; depth: number };

export type StoredPage = PageRecord & { localFound?: boolean; localIncomplete?: boolean };

function countsFrom(issues: Pick<Issue, "severity" | "status">[]) {
  const issueCounts: Record<string, number> = {};
  let openCritical = 0;
  let openHigh = 0;
  for (const issue of issues) {
    issueCounts[issue.severity] = (issueCounts[issue.severity] ?? 0) + 1;
    if (issue.status === "open" || issue.status === "in_progress") {
      if (issue.severity === "critical") openCritical += 1;
      if (issue.severity === "high") openHigh += 1;
    }
  }
  return { issueCounts, openCritical, openHigh };
}

function toSummary(row: ScanRow, issues: Pick<Issue, "severity" | "status">[]): ScanSummary {
  const scores = parse<Scores | null>(row.scores_json, null);
  const tally = countsFrom(issues);
  return {
    id: row.id,
    targetUrl: row.target_url,
    host: row.host,
    status: row.status,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    scores,
    coverage: scores?.coverage ?? row.coverage,
    pageCount: row.page_count,
    ...tally,
  };
}

async function issuesFor(scanId: string): Promise<Issue[]> {
  const sql = await getSql();
  const rows = await sql<{ id: string; data_json: string; status: string }>`
    select id, data_json, status from scan_issues where scan_id = ${scanId} order by priority desc
  `;
  return rows.map((row) => {
    const issue = parse<Issue>(row.data_json, null as unknown as Issue);
    return { ...issue, id: row.id, status: (row.status as Issue["status"]) || issue.status };
  });
}

export async function listScans(limit: number): Promise<ScanSummary[]> {
  const sql = await getSql();
  const scans = await sql<ScanRow>`select * from scans order by created_at desc limit ${limit}`;
  const summaries: ScanSummary[] = [];
  for (const scan of scans) {
    const issues = await sql<{ severity: string; status: string }>`
      select severity, status from scan_issues where scan_id = ${scan.id}
    `;
    summaries.push(toSummary(scan, issues as Pick<Issue, "severity" | "status">[]));
  }
  return summaries;
}

export async function getScan(scanId: string): Promise<ScanDetail | null> {
  const sql = await getSql();
  const rows = await sql<ScanRow>`select * from scans where id = ${scanId} limit 1`;
  const scan = rows[0];
  if (!scan) return null;
  const issues = await issuesFor(scanId);
  const pageRows = await sql<{ data_json: string }>`select data_json from scan_pages where scan_id = ${scanId} order by id asc`;
  const pages = pageRows.map((row) => parse<StoredPage>(row.data_json, null as unknown as StoredPage));
  return {
    ...toSummary(scan, issues),
    config: parse<ScanConfig>(scan.config_json, {} as ScanConfig),
    progress: parse<Progress>(scan.progress_json, {
      stage: scan.status,
      discovered: 0,
      crawled: 0,
      remaining: 0,
      errors: 0,
      currentUrl: null,
      notes: [],
    }),
    summary: scan.summary,
    validation: parse<ValidationRow[]>(scan.validation_json, []),
    external: parse<ExternalBundle>(scan.external_json, emptyExternal()),
    psi: parse<PsiResult | null>(scan.psi_json, null),
    aiSummary: scan.ai_summary,
    error: scan.error,
    issues,
    pages,
    robots: parse<RobotsSnapshot | null>(scan.robots_json, null),
    sitemap: parse<SitemapSnapshot | null>(scan.sitemap_json, null),
    skipped: parse<{ url: string; reason: string }[]>(scan.skipped_json, []),
  };
}

export async function createScan(input: {
  id: string;
  targetUrl: string;
  host: string;
  config: ScanConfig;
  progress: Progress;
  queue: QueueItem[];
  seen: string[];
  skipped: { url: string; reason: string }[];
  robots: RobotsSnapshot | null;
  sitemap: SitemapSnapshot | null;
  validation: ValidationRow[];
  status: string;
}) {
  const sql = await getSql();
  const now = new Date().toISOString();
  await sql`
    insert into scans (
      id, target_url, host, status, config_json, progress_json, queue_json, seen_json, skipped_json,
      robots_json, sitemap_json, validation_json, page_count, created_at, updated_at
    ) values (
      ${input.id}, ${input.targetUrl}, ${input.host}, ${input.status}, ${JSON.stringify(input.config)},
      ${JSON.stringify(input.progress)}, ${JSON.stringify(input.queue)}, ${JSON.stringify(input.seen)},
      ${JSON.stringify(input.skipped)}, ${JSON.stringify(input.robots)}, ${JSON.stringify(input.sitemap)},
      ${JSON.stringify(input.validation)}, 0, ${now}, ${now}
    )
  `;
}

export async function saveCrawlState(input: {
  id: string;
  status: string;
  progress: Progress;
  queue: QueueItem[];
  seen: string[];
  skipped: { url: string; reason: string }[];
  pageCount: number;
  error?: string | null;
}) {
  const sql = await getSql();
  await sql`
    update scans set
      status = ${input.status},
      progress_json = ${JSON.stringify(input.progress)},
      queue_json = ${JSON.stringify(input.queue)},
      seen_json = ${JSON.stringify(input.seen)},
      skipped_json = ${JSON.stringify(input.skipped)},
      page_count = ${input.pageCount},
      error = ${input.error ?? null},
      updated_at = ${new Date().toISOString()}
    where id = ${input.id}
  `;
}

export async function insertPage(scanId: string, page: StoredPage) {
  const sql = await getSql();
  await sql`
    insert into scan_pages (scan_id, url, data_json)
    values (${scanId}, ${page.finalUrl || page.url}, ${JSON.stringify(page)})
    on conflict (scan_id, url) do nothing
  `;
}

export async function countPages(scanId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ count: number }>`select count(*) as count from scan_pages where scan_id = ${scanId}`;
  return rows[0]?.count ?? 0;
}

export async function loadCrawl(scanId: string) {
  const sql = await getSql();
  const rows = await sql<ScanRow>`select * from scans where id = ${scanId} limit 1`;
  const scan = rows[0];
  if (!scan) return null;
  const pageCount = await sql<{ count: number }>`select count(*) from scan_pages where scan_id = ${scanId}`;
  return {
    row: scan,
    config: parse<ScanConfig>(scan.config_json, {} as ScanConfig),
    progress: parse<Progress>(scan.progress_json, {
      stage: scan.status,
      discovered: 0,
      crawled: 0,
      remaining: 0,
      errors: 0,
      currentUrl: null,
      notes: [],
    }),
    queue: parse<QueueItem[]>(scan.queue_json, []),
    seen: parse<string[]>(scan.seen_json, []),
    skipped: parse<{ url: string; reason: string }[]>(scan.skipped_json, []),
    robots: parse<RobotsSnapshot | null>(scan.robots_json, null),
    sitemap: parse<SitemapSnapshot | null>(scan.sitemap_json, null),
    pageCount: pageCount[0]?.count ?? 0,
  };
}

export async function loadPages(scanId: string): Promise<StoredPage[]> {
  const sql = await getSql();
  const rows = await sql<{ data_json: string }>`select data_json from scan_pages where scan_id = ${scanId} order by id asc`;
  return rows.map((row) => parse<StoredPage>(row.data_json, null as unknown as StoredPage));
}

export async function replaceIssues(scanId: string, issues: Issue[], scores: Scores, summary: string, psi: PsiResult | null, external: ExternalBundle, pageCount: number) {
  const sql = await getSql();
  await sql`delete from scan_issues where scan_id = ${scanId}`;
  for (const [index, issue] of issues.entries()) {
    await sql`
      insert into scan_issues (id, scan_id, severity, category, status, priority, data_json)
      values (${`${scanId}:${index}:${issue.id}`}, ${scanId}, ${issue.severity}, ${issue.category}, ${issue.status}, ${issue.priority}, ${JSON.stringify(issue)})
    `;
  }
  const now = new Date().toISOString();
  await sql`
    update scans set
      status = 'complete',
      scores_json = ${JSON.stringify(scores)},
      coverage = ${scores.coverage},
      summary = ${summary},
      psi_json = ${JSON.stringify(psi)},
      external_json = ${JSON.stringify(external)},
      finished_at = ${now},
      updated_at = ${now},
      progress_json = ${JSON.stringify({
        stage: "complete",
        discovered: pageCount,
        crawled: pageCount,
        remaining: 0,
        errors: 0,
        currentUrl: null,
        notes: ["Analysis finished."],
      })}
    where id = ${scanId}
  `;
}

export async function setIssueStatus(scanId: string, issueId: string, status: IssueStatus): Promise<Scores | null> {
  const sql = await getSql();
  const rows = await sql<{ data_json: string }>`
    select data_json from scan_issues where scan_id = ${scanId} and id = ${issueId} limit 1
  `;
  const current = rows[0];
  if (!current) return null;
  const issue = parse<Issue>(current.data_json, null as unknown as Issue);
  issue.status = status;
  await sql`update scan_issues set status = ${status}, data_json = ${JSON.stringify(issue)} where scan_id = ${scanId} and id = ${issueId}`;
  const scanRows = await sql<ScanRow>`select * from scans where id = ${scanId} limit 1`;
  const scan = scanRows[0];
  if (!scan) return null;
  const issues = await issuesFor(scanId);
  const psi = parse<PsiResult | null>(scan.psi_json, null);
  const pages = await sql<{ count: number }>`select count(*) from scan_pages where scan_id = ${scanId}`;
  const scores = computeScores({
    issues,
    crawledPages: pages[0]?.count ?? 0,
    psiScore: psi?.lab?.performance ?? null,
  });
  await sql`
    update scans set scores_json = ${JSON.stringify(scores)}, coverage = ${scores.coverage}, updated_at = ${new Date().toISOString()}
    where id = ${scanId}
  `;
  return scores;
}

export async function markFailed(scanId: string, error: string) {
  const sql = await getSql();
  await sql`
    update scans set status = 'failed', error = ${error}, updated_at = ${new Date().toISOString()}, finished_at = ${new Date().toISOString()}
    where id = ${scanId}
  `;
}

export async function markCancelled(scanId: string) {
  const sql = await getSql();
  await sql`
    update scans set status = 'cancelled', updated_at = ${new Date().toISOString()}
    where id = ${scanId} and status in ('crawling', 'analyzing_pending', 'analyzing')
  `;
}

export async function deleteScan(scanId: string) {
  const sql = await getSql();
  await sql`delete from scans where id = ${scanId}`;
}

export async function saveAiSummary(scanId: string, text: string) {
  const sql = await getSql();
  await sql`update scans set ai_summary = ${text}, updated_at = ${new Date().toISOString()} where id = ${scanId}`;
}

export async function compareScans(olderId: string, newerId: string) {
  const older = await getScan(olderId);
  const newer = await getScan(newerId);
  if (!older || !newer) return null;
  if (older.host !== newer.host) {
    return { error: "Compare two scans of the same host. www and the apex host count as the same site only when the saved host matches." };
  }
  const diff = compareIssues(older.issues, newer.issues);
  return {
    older: { id: older.id, createdAt: older.createdAt, scores: older.scores, pageCount: older.pageCount, status: older.status },
    newer: { id: newer.id, createdAt: newer.createdAt, scores: newer.scores, pageCount: newer.pageCount, status: newer.status },
    added: diff.added,
    resolved: diff.resolved,
    persistent: diff.persistent,
    note: "Resolved means the issue key was absent from the later scan. A smaller crawl, a skipped provider, or a changed URL can hide an issue without it being fixed.",
  };
}
