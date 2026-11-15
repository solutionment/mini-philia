import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHandler } from '../src/app.ts';
import { withRequestLogging } from '../src/logging.ts';

type H = (req: IncomingMessage, res: ServerResponse) => void;

// Collects log lines and lets tests wait for the Nth line instead of sleeping.
async function run(inner: H | undefined, fn: (base: string, next: (n: number) => Promise<string[]>) => Promise<void>) {
  const lines: string[] = [];
  const waiters: Array<() => void> = [];
  const sink = (l: string) => {
    lines.push(l);
    waiters.splice(0).forEach((w) => w());
  };
  const next = async (n: number) => {
    while (lines.length < n) await new Promise<void>((r) => waiters.push(r));
    return lines;
  };
  const server = createServer(withRequestLogging(inner ?? createHandler({ version: 't', environment: 't' }), sink));
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, next);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

test('logs one Cloud Logging shaped JSON line per request', async () => {
  await run(undefined, async (base, next) => {
    const res = await fetch(`${base}/health`);
    await res.text();
    const lines = await next(1);
    assert.equal(lines.length, 1);
    const l = JSON.parse(lines[0]!);
    assert.equal(l.severity, 'INFO');
    assert.equal(l.httpRequest.requestMethod, 'GET');
    assert.equal(l.httpRequest.requestUrl, '/health');
    assert.equal(l.httpRequest.status, 200);
    assert.match(l.httpRequest.latency, /^\d+\.\d{3}s$/);
    assert.equal(l.requestId, res.headers.get('x-request-id'));
  });
});

test('never logs the query string', async () => {
  await run(undefined, async (base, next) => {
    await (await fetch(`${base}/health?token=secret&email=a@b.c`)).text();
    const lines = await next(1);
    assert.equal(JSON.parse(lines[0]!).httpRequest.requestUrl, '/health');
    assert.ok(!lines[0]!.includes('secret'));
  });
});

test('does not log request bodies even when the handler reads them', async () => {
  const reading: H = (req, res) => {
    req.on('data', () => {});
    req.on('end', () => res.end('ok'));
  };
  await run(reading, async (base, next) => {
    await (await fetch(`${base}/x`, { method: 'POST', body: 'donor-secret-body' })).text();
    const lines = await next(1);
    assert.ok(!lines[0]!.includes('donor-secret-body'));
  });
});

test('accepts a valid x-request-id and echoes it', async () => {
  await run(undefined, async (base, next) => {
    const res = await fetch(`${base}/health`, { headers: { 'x-request-id': 'abc-123.X_y' } });
    await res.text();
    const lines = await next(1);
    assert.equal(res.headers.get('x-request-id'), 'abc-123.X_y');
    assert.equal(JSON.parse(lines[0]!).requestId, 'abc-123.X_y');
  });
});

test('generates an id when absent and replaces an invalid one, logging the same id', async () => {
  await run(undefined, async (base, next) => {
    const a = await fetch(`${base}/health`);
    await a.text();
    assert.match(a.headers.get('x-request-id')!, /^[0-9a-f-]{36}$/);
    const b = await fetch(`${base}/health`, { headers: { 'x-request-id': 'bad id!' } });
    await b.text();
    const lines = await next(2);
    const idB = b.headers.get('x-request-id')!;
    assert.match(idB, /^[0-9a-f-]{36}$/);
    assert.equal(JSON.parse(lines[1]!).requestId, idB);
    assert.ok(!lines[1]!.includes('bad id!'));
  });
});

test('request id length limit: 128 accepted, 129 replaced', async () => {
  await run(undefined, async (base) => {
    const ok = 'a'.repeat(128);
    const r1 = await fetch(`${base}/health`, { headers: { 'x-request-id': ok } });
    await r1.text();
    assert.equal(r1.headers.get('x-request-id'), ok);
    const r2 = await fetch(`${base}/health`, { headers: { 'x-request-id': 'a'.repeat(129) } });
    await r2.text();
    assert.notEqual(r2.headers.get('x-request-id'), 'a'.repeat(129));
  });
});

test('severity: 404 is WARNING, 500 is ERROR', async () => {
  const h: H = (req, res) => {
    res.statusCode = req.url === '/boom' ? 500 : 404;
    res.end();
  };
  await run(h, async (base, next) => {
    await (await fetch(`${base}/nope`)).text();
    await (await fetch(`${base}/boom`)).text();
    const lines = await next(2);
    assert.equal(JSON.parse(lines[0]!).severity, 'WARNING');
    assert.equal(JSON.parse(lines[1]!).severity, 'ERROR');
  });
});

test('a throwing handler yields a 500 response and one ERROR line', async () => {
  const h: H = () => {
    throw new Error('boom');
  };
  await run(h, async (base, next) => {
    const res = await fetch(`${base}/x`);
    await res.text();
    assert.equal(res.status, 500);
    const lines = await next(1);
    const l = JSON.parse(lines[0]!);
    assert.equal(l.severity, 'ERROR');
    assert.equal(l.httpRequest.status, 500);
  });
});

test('a client abort is logged once with status 499', async () => {
  const slow: H = (_req, res) => {
    setTimeout(() => res.end('late'), 300);
  };
  await run(slow, async (base, next) => {
    const ac = new AbortController();
    const p = fetch(`${base}/slow`, { signal: ac.signal }).catch(() => {});
    setTimeout(() => ac.abort(), 50);
    await p;
    const lines = await next(1);
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]!).httpRequest.status, 499);
  });
});
