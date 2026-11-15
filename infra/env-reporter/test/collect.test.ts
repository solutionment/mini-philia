import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectEnvironment, scalar, parseTargets, monitoringUrl, metricQueries, type Requester } from '../src/collect.ts';

const t = { environment: 'staging' as const, project: 'sm-pilot-staging-x' };
const point = (v: object) => ({ timeSeries: [{ points: [{ value: v }] }] });

test('scalar reads int64 strings and doubles, null otherwise', () => {
  assert.equal(scalar(point({ int64Value: '42' })), 42);
  assert.equal(scalar(point({ doubleValue: 0.25 })), 0.25);
  assert.equal(scalar({}), null);
  assert.equal(scalar(point({ int64Value: 'x' })), null);
});

test('parseTargets accepts only staging and production', () => {
  assert.deepEqual(parseTargets('staging:a, production:b'), [{ environment: 'staging', project: 'a' }, { environment: 'production', project: 'b' }]);
  assert.throws(() => parseTargets('dev:a'));
});

test('monitoring queries target the right resources', () => {
  const url = monitoringUrl(t.project, metricQueries(t).diskUsed, new Date('2026-11-15T00:00:00Z'));
  const f = new URL(url).searchParams.get('filter') ?? '';
  assert.match(f, /database_id="sm-pilot-staging-x:mini-philia-staging"/);
  assert.match(url, /^https:\/\/monitoring\.googleapis\.com\/v3\/projects\/sm-pilot-staging-x\/timeSeries\?/);
});

test('collects a deployed environment', async () => {
  const request: Requester = async (url) => {
    if (url.includes('run.googleapis.com/v2')) return {
      name: 'projects/p/locations/r/services/api', uri: 'https://api-xyz.a.run.app',
      latestReadyRevision: 'projects/p/locations/r/services/api/revisions/api-00003-abc',
      template: { containers: [{ image: 'us-central1-docker.pkg.dev/p/apps/api@sha256:1' }], scaling: { maxInstanceCount: 2 } },
      terminalCondition: { state: 'CONDITION_SUCCEEDED' }, updateTime: '2026-11-15T10:00:00Z',
    };
    if (url.includes('sqladmin')) return { name: 'mini-philia-staging', state: 'RUNNABLE', databaseVersion: 'POSTGRES_16', settings: { tier: 'db-f1-micro', activationPolicy: 'ALWAYS', dataDiskSizeGb: '10' } };
    const f = new URL(url).searchParams.get('filter') ?? '';
    if (f.includes('5xx')) return point({ int64Value: '3' });
    if (f.includes('request_count')) return point({ int64Value: '120' });
    if (f.includes('request_latencies')) return point({ doubleValue: 87.456 });
    if (f.includes('instance_count')) return point({ int64Value: '1' });
    if (f.includes('bytes_used')) return point({ doubleValue: 52428800 });
    if (f.includes('cpu/utilization')) return point({ doubleValue: 0.034 });
    if (f.includes('total_bytes')) return point({ doubleValue: 2048 });
    if (f.includes('total_count')) return point({ doubleValue: 4 });
    if (f.includes('token_count')) return {};
    throw new Error('unexpected ' + url);
  };
  const s = await collectEnvironment(t, 'us-central1', request);
  assert.equal(s.service?.latest_revision, 'api-00003-abc');
  assert.equal(s.service?.ready, true);
  assert.equal(s.service?.requests_24h, 120);
  assert.equal(s.service?.errors_5xx_24h, 3);
  assert.equal(s.service?.latency_p95_ms, 87.5);
  assert.equal(s.database?.disk_bytes_total, 10 * 1024 ** 3);
  assert.equal(s.database?.cpu_util_pct, 3.4);
  assert.deepEqual(s.storage, { bucket: 'sm-pilot-staging-x-uploads', total_bytes: 2048, object_count: 4 });
  assert.equal(s.ai.tokens_24h, null);
});

test('an environment not deployed yet reports nulls instead of failing', async () => {
  const request: Requester = async () => { throw Object.assign(new Error('404'), { status: 404 }); };
  const s = await collectEnvironment(t, 'us-central1', request);
  assert.equal(s.service, null);
  assert.equal(s.database, null);
  assert.equal(s.storage.total_bytes, null);
});
