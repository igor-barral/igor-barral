// Pulls profile stats from the GitHub GraphQL API.
// Token: GH_TOKEN (CI secret) or the local `gh auth token`. It needs read access
// to private repos, otherwise private counts and languages come back empty.

import { execSync } from 'node:child_process';

const token = process.env.GH_TOKEN || execSync('gh auth token', { encoding: 'utf8' }).trim();

async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const REPOS = `query($after: String) { viewer { repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
  pageInfo { hasNextPage endCursor }
  nodes { name url description isPrivate isArchived stargazerCount pushedAt primaryLanguage { name } languages(first: 20) { edges { size node { name } } } }
} } }`;

const PROFILE = `{ viewer { login createdAt
  contributionsCollection { totalCommitContributions restrictedContributionsCount totalPullRequestContributions
    contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
} }`;

export async function loadStats() {
  const repos = [];
  let after = null;
  do {
    const page = (await gql(REPOS, { after })).viewer.repositories;
    repos.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  const { viewer } = await gql(PROFILE);
  const cc = viewer.contributionsCollection;

  const languages = {};
  for (const r of repos) for (const e of r.languages.edges) languages[e.node.name] = (languages[e.node.name] ?? 0) + e.size;

  const months = {};
  for (const w of cc.contributionCalendar.weeks) for (const d of w.contributionDays) {
    const key = d.date.slice(0, 7);
    months[key] = (months[key] ?? 0) + d.contributionCount;
  }

  return {
    login: viewer.login,
    createdAt: viewer.createdAt,
    repos,
    languages,
    // The calendar spans a year plus the current partial week, so keep the last 12 months.
    months: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12),
    contributions: cc.contributionCalendar.totalContributions,
    privateContributions: cc.restrictedContributionsCount,
  };
}
