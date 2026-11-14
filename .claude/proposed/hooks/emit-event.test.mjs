import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEvent, categorize } from './emit-event.mjs';

const ctx = { repo: 'org/mini-philia', runId: '123', issue: 7, cwd: '/repo', now: '2026-11-14T00:00:00Z' };

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
