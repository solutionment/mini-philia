#!/usr/bin/env node
// Claude Code hook: sends one short, redacted activity event to SolutionIQ Studio (Build section).
// Proposed file: a human moves it to .claude/hooks/emit-event.mjs (agents cannot edit their own hooks).
//
// What leaves the machine: event kind, agent name, tool name, a repo relative file path,
// a command category (tests, git, ...), the issue number and the Actions run id.
// What never leaves: file contents, command text, tool output, prompts, issue text, env values.
//
// Never blocks or fails the agent: no output, always exit 0, 2 second timeout.
import { readFileSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

export const AGENTS = new Set([
  'chief-of-staff', 'architect', 'backend', 'ux-frontend', 'data-db', 'ai-ml', 'integration',
  'infra-devops', 'qa', 'security-compliance', 'challenger', 'story-analyst', 'release-manager',
]);

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const DELEGATE_TOOLS = new Set(['Task', 'Agent']);

export function agentName(input) {
  const a = input.agent_type || input.subagent_type || '';
  return AGENTS.has(a) ? a : 'main';
}

export function categorize(command) {
  const c = String(command || '').trim();
  if (/^(npm (run )?test|npx playwright test|node --test|pg_prove)\b/.test(c)) return 'tests';
  if (/^npm run typecheck\b|^npx tsc\b/.test(c)) return 'typecheck';
  if (/^npm run lint\b/.test(c)) return 'lint';
  if (/^npm (ci|install)\b/.test(c)) return 'install';
  if (/^npm run build\b|^docker build\b/.test(c)) return 'build';
  if (/^terraform (fmt|validate|init)\b/.test(c)) return 'terraform-check';
  if (/^gh pr create\b/.test(c)) return 'pr-open';
  if (/^gh issue comment\b/.test(c)) return 'issue-comment';
  if (/^git commit\b/.test(c)) return 'commit';
  if (/^git push\b/.test(c)) return 'push';
  if (/^git\b/.test(c)) return 'git';
  return null; // everything else is not reported
}

const CATEGORY_TEXT = {
  tests: 'Ran tests', typecheck: 'Ran type check', lint: 'Ran lint', install: 'Installed dependencies',
  build: 'Ran build', 'terraform-check': 'Checked Terraform', 'pr-open': 'Opened pull request',
  'issue-comment': 'Commented on the work item', commit: 'Committed changes', push: 'Pushed branch', git: 'Used git',
};

function safePath(p, cwd) {
  if (!p || typeof p !== 'string') return undefined;
  const rel = isAbsolute(p) ? relative(cwd, p) : p;
  if (rel.startsWith('..') || isAbsolute(rel)) return undefined; // outside the repo: drop
  return rel.slice(0, 200);
}

function bashStatus(resp) {
  if (!resp || typeof resp !== 'object') return undefined;
  if (typeof resp.exit_code === 'number') return resp.exit_code === 0 ? 'ok' : 'failed';
  if (typeof resp.exitCode === 'number') return resp.exitCode === 0 ? 'ok' : 'failed';
  if (resp.is_error === true || resp.isError === true || resp.interrupted === true) return 'failed';
  return undefined;
}

// Pure mapping from hook input to a Studio event (or null to send nothing).
export function toEvent(input, ctx) {
  const base = {
    v: 1, repo: ctx.repo, session_id: String(input.session_id || 'unknown').slice(0, 100),
    run_id: ctx.runId, issue: ctx.issue, agent: agentName(input), at: ctx.now,
  };
  switch (input.hook_event_name) {
    case 'SessionStart':
      return { ...base, event: 'session_start', summary: 'Session started' };
    case 'SessionEnd':
    case 'Stop':
      return { ...base, event: 'session_end', summary: 'Session finished' };
    case 'SubagentStop':
      return { ...base, event: 'agent_done', summary: 'Finished its task' };
    case 'PreToolUse': {
      if (!DELEGATE_TOOLS.has(input.tool_name)) return null;
      const to = input.tool_input?.subagent_type;
      if (!AGENTS.has(to)) return null;
      return { ...base, event: 'delegated', to_agent: to, summary: `Delegated to ${to}` };
    }
    case 'PostToolUse': {
      if (EDIT_TOOLS.has(input.tool_name)) {
        const path = safePath(input.tool_input?.file_path || input.tool_input?.notebook_path, ctx.cwd);
        if (!path) return null;
        return { ...base, event: 'tool_use', tool: input.tool_name, path, summary: `Edited ${path}` };
      }
      if (input.tool_name === 'Bash') {
        const category = categorize(input.tool_input?.command);
        if (!category) return null;
        const status = bashStatus(input.tool_response);
        const ev = category === 'tests' ? 'test_result' : 'tool_use';
        const suffix = status ? `: ${status === 'ok' ? 'passed' : 'failed'}` : '';
        return { ...base, event: ev, tool: 'Bash', category, ...(status && { status }), summary: `${CATEGORY_TEXT[category]}${suffix}` };
      }
      return null;
    }
    default:
      return null;
  }
}

function issueFromBranch(cwd) {
  try {
    const head = readFileSync(`${cwd}/.git/HEAD`, 'utf8');
    const m = head.match(/refs\/heads\/feature\/GH-(\d+)-/);
    return m ? Number(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const url = process.env.STUDIO_INGEST_URL;
  const token = process.env.STUDIO_INGEST_TOKEN;
  if (!url || !token) return;
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const cwd = input.cwd || process.cwd();
  const issueEnv = Number(process.env.STUDIO_ISSUE);
  const runEnv = process.env.STUDIO_RUN_ID || process.env.GITHUB_RUN_ID;
  const ev = toEvent(input, {
    repo: process.env.STUDIO_REPO || process.env.GITHUB_REPOSITORY || '',
    // Studio's schema requires a positive integer run id.
    runId: runEnv && /^\d+$/.test(runEnv) ? Number(runEnv) : undefined,
    issue: Number.isInteger(issueEnv) && issueEnv > 0 ? issueEnv : issueFromBranch(cwd),
    cwd,
    now: new Date().toISOString(),
  });
  if (!ev || !ev.repo) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [ev] }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Studio being down must never affect the agent.
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().finally(() => process.exit(0));
}
