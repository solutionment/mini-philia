#!/usr/bin/env node
// Builds the release report that the deploy workflow sends to SolutionIQ Studio.
// It lists every pull request merged since this environment's last successful deployment, takes each one's
// "## Delivery report" section, adds the user guide, and prints a JSON `release` object on stdout.
// Read only: uses the workflow's GITHUB_TOKEN to read deployments, commits and pull requests.
//
// Usage (in deploy-env.yml):
//   node scripts/release-notes.mjs --environment production --sha <sha> [--previous-sha <sha>] --url <app url or ""> --smoke passed > release.json
import { readFileSync } from 'node:fs';

const MAX_REPORT = 20000;
const MAX_NOTES = 60000;
const MAX_GUIDE = 30000;
const MAX_CHANGES = 100;

/** Text of a "## <title>" section, up to the next "## " heading. Null when absent or empty. */
export function extractSection(body, title = 'Delivery report') {
  if (typeof body !== 'string' || !body) return null;
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${title}`.toLowerCase());
  if (start === -1) return null;
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    out.push(line);
  }
  // Drop template comments so empty templates read as empty.
  let text = out.join('\n');
  let previous;
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  } while (text !== previous);
  text = text.trim();
  const meaningful = text.split('\n').some((l) => l.trim() && !/^###\s/.test(l.trim()));
  return meaningful ? text.slice(0, MAX_REPORT) : null;
}

/** Issue number from "Closes #12" style text. */
export function linkedIssue(body) {
  const m = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d{1,7})\b/i.exec(body ?? '');
  return m ? Number(m[1]) : null;
}

export function version(sha, date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '.');
  return `${d}-${sha.slice(0, 7)}`;
}

const label = (env) => (env === 'production' ? 'Live (production)' : 'Testing (staging)');

/** Plain language release report in Markdown. */
export function composeNotes({ environment, sha, url, smoke, changes, deployedAt = new Date() }) {
  const lines = [
    `# Release ${version(sha, deployedAt)}: ${label(environment)}`,
    '',
    `Deployed ${deployedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC from commit ${sha.slice(0, 7)}.`,
    `Health check: ${smoke === 'passed' ? 'passed' : smoke === 'failed' ? 'failed' : 'not run'}.`,
    '',
    '## How to access',
    url ? `- App address: ${url}` : '- App address: not available for this deployment (see the deployment status in Studio).',
    '- Sign in and day to day use are described in the user guide below.',
    '',
    "## What's new",
  ];
  if (!changes.length) lines.push('- No new changes since the previous release of this environment (a redeploy).');
  for (const c of changes) lines.push(`- ${c.title} (pull request #${c.pr}${c.issue ? `, work item #${c.issue}` : ''})`);
  for (const c of changes) {
    lines.push('', `## ${c.title}`, '', c.report_markdown ?? '_No delivery report was written for this change._');
  }
  const text = lines.join('\n');
  return text.length > MAX_NOTES ? `${text.slice(0, MAX_NOTES - 80)}\n\n_Report truncated. See the pull requests for full detail._` : text;
}

// ---------------------------------------------------------------- GitHub reads
async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.json();
}

/** The sha this environment last deployed successfully, other than the one being deployed now. */
async function previousSha(repo, environment, sha) {
  const deployments = await gh(`/repos/${repo}/deployments?environment=${environment}&per_page=20`);
  for (const d of deployments) {
    if (d.sha === sha) continue;
    const statuses = await gh(`/repos/${repo}/deployments/${d.id}/statuses?per_page=1`);
    if (statuses[0]?.state === 'success') return d.sha;
  }
  return null;
}

async function mergedPulls(repo, prev, sha) {
  const pulls = new Map();
  if (prev) {
    const cmp = await gh(`/repos/${repo}/compare/${prev}...${sha}`);
    for (const commit of (cmp.commits ?? []).slice(-250)) {
      for (const pr of await gh(`/repos/${repo}/commits/${commit.sha}/pulls`)) {
        if (pr.merged_at && pr.base?.ref === 'main') pulls.set(pr.number, pr);
      }
    }
  } else {
    // First deployment of this environment: the most recent merged pull requests.
    for (const pr of await gh(`/repos/${repo}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=30`)) {
      if (pr.merged_at) pulls.set(pr.number, pr);
    }
  }
  return [...pulls.values()]
    .sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at))
    .slice(-MAX_CHANGES)
    .map((pr) => ({ pr: pr.number, title: String(pr.title).slice(0, 300), issue: linkedIssue(pr.body), report_markdown: extractSection(pr.body) }));
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : process.argv[i + 1] ?? '';
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const environment = arg('environment');
  const sha = arg('sha');
  const url = arg('url') || null;
  const smoke = arg('smoke') || 'skipped';
  let prev = null;
  let changes = [];
  const given = arg('previous-sha');
  try {
    // Prefer what the environment itself reported running before this deploy; GitHub deployment records
    // carry the workflow's commit, which differs from the released commit on promote runs.
    prev = /^[0-9a-f]{40}$/.test(given) ? given : await previousSha(repo, environment, sha);
    // Same commit as before means a redeploy: nothing new to list.
    changes = prev === sha ? [] : await mergedPulls(repo, prev, sha);
  } catch (e) {
    console.error(`release-notes: could not list changes: ${e.message}`);
  }
  let guide = null;
  try { guide = readFileSync('docs/user/guide.md', 'utf8').slice(0, MAX_GUIDE); } catch { /* no guide yet */ }
  const release = {
    version: version(sha),
    previous_sha: prev,
    notes_markdown: composeNotes({ environment, sha, url, smoke, changes }),
    user_guide_markdown: guide,
    changes,
  };
  process.stdout.write(JSON.stringify(release));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
