import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
export type LogSink = (line: string) => void;

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function resolveRequestId(header: string | string[] | undefined): string {
  return typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : randomUUID();
}

function severityFor(status: number): string {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARNING';
  return 'INFO';
}

// One JSON line per request in the Cloud Logging shape. Never reads bodies or logs query strings.
// Logs on 'close' so requests aborted by the client are also logged (status 499).
export function withRequestLogging(handler: Handler, sink: LogSink = (l) => console.log(l)): Handler {
  return (req, res) => {
    const start = process.hrtime.bigint();
    const requestId = resolveRequestId(req.headers['x-request-id']);
    const path = (req.url ?? '/').split(/[?#]/)[0] || '/';
    res.setHeader('x-request-id', requestId);
    res.once('close', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const status = res.writableFinished ? res.statusCode : 499;
      sink(
        JSON.stringify({
          severity: severityFor(status),
          httpRequest: {
            requestMethod: req.method,
            requestUrl: path,
            status,
            latency: `${seconds.toFixed(3)}s`,
          },
          requestId,
        }),
      );
    });
    try {
      handler(req, res);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      }
      res.end(JSON.stringify({ error: 'internal_error' }));
    }
  };
}
