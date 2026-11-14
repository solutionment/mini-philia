import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotification, shouldShutDown, shutDown, type Requester } from '../src/guard.ts';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');

test('parses a budget message and ignores junk', () => {
  assert.deepEqual(parseNotification(b64({ costAmount: 5, budgetAmount: 100 }))?.costAmount, 5);
  assert.equal(parseNotification(undefined), null);
  assert.equal(parseNotification(b64({ hello: 1 })), null);
  assert.equal(parseNotification('not base64 json'), null);
});

test('shuts down only at or over actual budget', () => {
  assert.equal(shouldShutDown({ costAmount: 99.99, budgetAmount: 100 }), false);
  assert.equal(shouldShutDown({ costAmount: 100, budgetAmount: 100 }), true);
  assert.equal(shouldShutDown({ costAmount: 5, budgetAmount: 0 }), false);
});

test('stops running sql and closes public run services, skips ones already done', async () => {
  const calls: string[] = [];
  const request: Requester = async ({ method, url, body }) => {
    calls.push(`${method} ${url} ${body ? JSON.stringify(body) : ''}`.trim());
    if (url.endsWith('/instances')) {
      return { items: [{ name: 'db', settings: { activationPolicy: 'ALWAYS' } }, { name: 'off', settings: { activationPolicy: 'NEVER' } }] };
    }
    if (url.endsWith('/services')) {
      return { services: [{ name: 'projects/p/locations/r/services/api', ingress: 'INGRESS_TRAFFIC_ALL' }, { name: 'projects/p/locations/r/services/x', ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY' }] };
    }
    return {};
  };
  const actions = await shutDown(['p'], 'r', request);
  assert.deepEqual(actions, ['stopped sql p/db', 'closed run projects/p/locations/r/services/api']);
  assert.equal(calls.filter((c) => c.startsWith('PATCH')).length, 2);
});
