import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSection, linkedIssue, version, composeNotes } from './release-notes.mjs';

const body = `## Summary
Closes #12

## Delivery report
<!-- guidance -->
### What was built
Request logging.

### How to use
1. Open the app.

## Evidence
- Tests: pass`;

test('extracts the delivery report up to the next section, without template comments', () => {
  const r = extractSection(body);
  assert.match(r, /^### What was built\nRequest logging\./);
  assert.match(r, /1\. Open the app\./);
  assert.doesNotMatch(r, /Evidence|guidance/);
});

test('missing, empty template or last-section reports are handled', () => {
  assert.equal(extractSection('## Summary\nx'), null);
  assert.equal(extractSection('## Delivery report\n<!-- c -->\n### What was built\n\n### How to use\n'), null);
  assert.equal(extractSection('## Delivery report\n### Issues fixed\nTypo.'), '### Issues fixed\nTypo.');
  assert.equal(extractSection(undefined), null);
  assert.equal(extractSection(`## Delivery report\n${'a'.repeat(30000)}`).length, 20000);
});

test('linked issue and version', () => {
  assert.equal(linkedIssue(body), 12);
  assert.equal(linkedIssue('no link'), null);
  assert.equal(version('abcdef1234567890', new Date('2026-11-15T03:00:00Z')), '2026.11.15-abcdef1');
});

test('release notes name the environment, address and each change', () => {
  const notes = composeNotes({
    environment: 'production', sha: 'abcdef1234567890', url: 'https://api-x.a.run.app', smoke: 'passed',
    deployedAt: new Date('2026-11-15T03:00:00Z'),
    changes: [{ pr: 4, title: 'Structured request logging', issue: 1, report_markdown: '### What was built\nLogging.' }, { pr: 5, title: 'Docs', issue: null, report_markdown: null }],
  });
  assert.match(notes, /^# Release 2026\.11\.15-abcdef1: Live \(production\)/);
  assert.match(notes, /App address: https:\/\/api-x\.a\.run\.app/);
  assert.match(notes, /Health check: passed/);
  assert.match(notes, /- Structured request logging \(pull request #4, work item #1\)/);
  assert.match(notes, /_No delivery report was written for this change\._/);
});

test('a redeploy with no changes says so', () => {
  const notes = composeNotes({ environment: 'staging', sha: 'a'.repeat(40), url: null, smoke: 'skipped', changes: [] });
  assert.match(notes, /Testing \(staging\)/);
  assert.match(notes, /No new changes/);
  assert.match(notes, /not available for this deployment/);
});
