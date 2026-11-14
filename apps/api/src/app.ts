import type { IncomingMessage, ServerResponse } from 'node:http';

export interface AppConfig {
  version: string;
  environment: string;
}

// Walking skeleton: proves build, deploy and promotion. Real routes arrive through work items.
export function createHandler(config: AppConfig) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/healthz') {
      return send(res, 200, { status: 'ok', version: config.version, environment: config.environment });
    }
    return send(res, 404, { error: 'not_found' });
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
