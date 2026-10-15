export type RobotsGroup = {
  agents: string[];
  allows: string[];
  disallows: string[];
};

export type RobotsRules = {
  groups: RobotsGroup[];
  sitemaps: string[];
  crawlDelayMs: number | null;
};

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let crawlDelayMs: number | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      const agent = value.toLowerCase();
      if (current && current.allows.length === 0 && current.disallows.length === 0) {
        current.agents.push(agent);
      } else {
        current = { agents: [agent], allows: [], disallows: [] };
        groups.push(current);
      }
    } else if (key === "allow" && current) {
      current.allows.push(value);
    } else if (key === "disallow" && current) {
      current.disallows.push(value);
    } else if (key === "sitemap" && value) {
      sitemaps.push(value);
    } else if (key === "crawl-delay" && current) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        crawlDelayMs = Math.min(2000, Math.round(seconds * 1000));
      }
    }
  }

  return { groups, sitemaps, crawlDelayMs };
}

function selectGroups(rules: RobotsRules, agent: string): RobotsGroup[] {
  const token = agent.toLowerCase();
  const specific = rules.groups.filter((group) =>
    group.agents.some((name) => name !== "*" && (token.includes(name) || name.includes(token))),
  );
  if (specific.length) return specific;
  const wildcard = rules.groups.filter((group) => group.agents.includes("*"));
  return wildcard;
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return "/";
  }
}

export function robotsAllows(rules: RobotsRules, url: string, agent = "northlineaudit"): boolean {
  const groups = selectGroups(rules, agent);
  if (!groups.length) return true;
  const path = pathOf(url);
  let best = -1;
  let allowed = true;
  for (const group of groups) {
    for (const rule of group.disallows) {
      if (!rule) continue;
      if (path.startsWith(rule) && rule.length > best) {
        best = rule.length;
        allowed = false;
      }
    }
    for (const rule of group.allows) {
      if (!rule) continue;
      if (path.startsWith(rule) && rule.length >= best) {
        best = rule.length;
        allowed = true;
      }
    }
  }
  return allowed;
}
