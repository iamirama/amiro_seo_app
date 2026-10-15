import type { Category, Issue, Scores } from "./types.ts";

export const SCORING_RULES = [
  "The health score is a Northline diagnostic from 0 to 100. It is not an official Google ranking score and it does not predict traffic.",
  "Scored categories and weights: technical 34, on-page 28, content 22, performance 16.",
  "A category counts only when Northline actually collected data for it. Missing providers are not treated as failures.",
  "Coverage is the share of those weights that could be evaluated on this scan.",
  "Issue penalties inside technical, on-page, and content: critical 22, high 12, medium 6, low 2. Informational findings do not reduce the score.",
  "The same issue code keeps its full penalty for the first three URLs and 30% of the penalty after that, so one template problem cannot wipe the score by itself.",
  "Fixed and ignored issues are left out of the score. Marking an issue fixed is your status, not proof that the live site changed.",
  "When PageSpeed Insights returns a Lighthouse performance score, that lab score is the performance category. Field Core Web Vitals are shown beside it and are not averaged into the number.",
  "Backlink counts, authority metrics, and keyword tables stay outside the health score. They are source-labeled measurements, not pass/fail defects.",
  "A score of 100 means no scored defects were found in the data that was collected. It does not mean the site is fully optimized or that uncrawled URLs are clean.",
];

const WEIGHTS = { technical: 34, onpage: 28, content: 22, performance: 16 } as const;
const PENALTY = { critical: 22, high: 12, medium: 6, low: 2, info: 0 } as const;

export function scoreCategory(issues: Issue[], category: Category): number {
  const relevant = issues.filter(
    (issue) =>
      issue.category === category &&
      issue.status !== "ignored" &&
      issue.status !== "fixed" &&
      issue.severity !== "info",
  );
  const groups = new Map<string, Issue[]>();
  for (const issue of relevant) {
    const list = groups.get(issue.code) ?? [];
    list.push(issue);
    groups.set(issue.code, list);
  }
  let penalty = 0;
  for (const group of groups.values()) {
    group.forEach((issue, index) => {
      const amount = PENALTY[issue.severity];
      penalty += index < 3 ? amount : amount * 0.3;
    });
  }
  return Math.max(0, Math.round(100 - penalty));
}

export function computeScores(input: {
  issues: Issue[];
  crawledPages: number;
  psiScore: number | null;
}): Scores {
  const technical = input.crawledPages > 0 ? scoreCategory(input.issues, "technical") : null;
  const onpage = input.crawledPages > 0 ? scoreCategory(input.issues, "onpage") : null;
  const content = input.crawledPages > 0 ? scoreCategory(input.issues, "content") : null;
  const performance =
    input.psiScore == null ? null : Math.max(0, Math.min(100, Math.round(input.psiScore)));

  const categories: Scores["categories"] = [
    {
      id: "technical",
      label: "Technical",
      score: technical,
      weight: WEIGHTS.technical,
      reason: technical == null ? "No HTML pages were crawled." : "Penalties from crawled technical findings.",
    },
    {
      id: "onpage",
      label: "On-page",
      score: onpage,
      weight: WEIGHTS.onpage,
      reason: onpage == null ? "No HTML pages were crawled." : "Penalties from titles, meta, headings, and metadata.",
    },
    {
      id: "content",
      label: "Content",
      score: content,
      weight: WEIGHTS.content,
      reason: content == null ? "No HTML pages were crawled." : "Heuristic content checks on crawled pages only.",
    },
    {
      id: "performance",
      label: "Performance",
      score: performance,
      weight: WEIGHTS.performance,
      reason:
        performance == null
          ? "PageSpeed Insights did not return a lab score."
          : "Lighthouse lab performance score. Field data is not mixed in.",
    },
  ];

  const available = categories.filter((item) => item.score != null);
  const weightSum = available.reduce((sum, item) => sum + item.weight, 0);
  const overall =
    weightSum === 0
      ? null
      : Math.round(available.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) / weightSum);
  const allWeight = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
  const coverage = Math.round((weightSum / allWeight) * 100);

  return { overall, coverage, categories, rules: SCORING_RULES };
}
