import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEvent, categorize } from './emit-event.mjs';

const ctx = { repo: 'org/mini-philia', runId: 123, issue: 7, cwd: '/repo', now: '2026-11-14T00:00:00Z' };

// Mirrors the field rules of Studio's AgentEvent schema (src/features/build/events.ts in SolutionIQ Studio).
function matchesStudioSchema(e) {
  const kinds = ['session_start', 'tool_use', 'delegated', 'agent_done', 'session_end', 'test_result', 'verdict'];
  return e.v === 1 && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(e.repo)
    && typeof e.session_id === 'string' && e.session_id.length >= 1 && e.session_id.length <= 100
    && (e.run_id === undefined || (Number.isInteger(e.run_id) && e.run_id > 0))
    && (e.issue === undefined || (Number.isInteger(e.issue) && e.issue > 0))
    && kinds.includes(e.event) && !Number.isNaN(Date.parse(e.at))
    && (e.path === undefined || (!e.path.startsWith('/') && !e.path.includes('..') && !/\s/.test(e.path)))
    && (e.summary === undefined || e.summary.length <= 300);
}

test('every emitted event passes the Studio schema rules', () => {
  const inputs = [
    { hook_event_name: 'SessionStart' },
    { hook_event_name: 'Stop', session_id: 's' },
    { hook_event_name: 'SubagentStop', agent_type: 'qa', session_id: 's' },
    { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'qa' }, session_id: 's' },
    { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: '/repo/a/b.ts' }, session_id: 's' },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { exit_code: 0 }, session_id: 's' },
  ];
  for (const i of inputs) {
    const ev = toEvent(i, ctx);
    assert.ok(ev, `no event for ${i.hook_event_name}`);
    assert.ok(matchesStudioSchema(ev), `schema mismatch: ${JSON.stringify(ev)}`);
  }
});

test('edits report a repo relative path and never content', () => {
  const ev = toEvent({ hook_event_name: 'PostToolUse', tool_name: 'Edit', agent_type: 'backend', session_id: 's',
    tool_input: { file_path: '/repo/apps/api/src/app.ts', old_string: 'SECRET', new_string: 'SECRET2' } }, ctx);
  assert.equal(ev.path, 'apps/api/src/app.ts');
  assert.equal(ev.agent, 'backend');
  assert.ok(!JSON.stringify(ev).includes('SECRET'));
});

test('paths outside the repo are dropped', () => {
  assert.equal(toEvent({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: '/etc/passwd' } }, ctx), null);
});

test('bash sends a category, never the command', () => {
  const ev = toEvent({ hook_event_name: 'PostToolUse', tool_name: 'Bash',
    tool_input: { command: 'npm test -- --token=abc' }, tool_response: { exit_code: 1 } }, ctx);
  assert.equal(ev.event, 'test_result');
  assert.equal(ev.status, 'failed');
  assert.ok(!JSON.stringify(ev).includes('abc'));
  assert.equal(toEvent({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'cat .env' } }, ctx), null);
});

test('delegation names a known agent only', () => {
  const ok = toEvent({ hook_event_name: 'PreToolUse', tool_name: 'Agent', agent_type: 'chief-of-staff', tool_input: { subagent_type: 'qa', prompt: 'x' } }, ctx);
  assert.equal(ok.to_agent, 'qa');
  assert.equal(ok.agent, 'chief-of-staff');
  assert.equal(toEvent({ hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: 'evil' } }, ctx), null);
});

test('unknown agent types become main, and reads are not reported', () => {
  assert.equal(toEvent({ hook_event_name: 'SubagentStop', agent_type: 'whatever' }, ctx).agent, 'main');
  assert.equal(toEvent({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: '/repo/x' } }, ctx), null);
  assert.equal(categorize('rm -rf /'), null);
});
