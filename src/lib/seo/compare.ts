import type { Issue } from "./types.ts";

export function issueKey(issue: Pick<Issue, "code" | "url">): string {
  return `${issue.code}|${issue.url ?? ""}`;
}

export function compareIssues(older: Issue[], newer: Issue[]) {
  const previous = new Map(older.map((issue) => [issueKey(issue), issue]));
  const next = new Map(newer.map((issue) => [issueKey(issue), issue]));
  const added: Issue[] = [];
  const resolved: Issue[] = [];
  const persistent: Issue[] = [];
  for (const [key, issue] of next) {
    if (previous.has(key)) persistent.push(issue);
    else added.push(issue);
  }
  for (const [key, issue] of previous) {
    if (!next.has(key)) resolved.push(issue);
  }
  return { added, resolved, persistent };
}
