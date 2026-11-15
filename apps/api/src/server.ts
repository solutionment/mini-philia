import { createServer } from 'node:http';
import { createHandler } from './app.ts';
import { withRequestLogging } from './logging.ts';

const port = Number(process.env.PORT ?? 8080);
const server = createServer(
  withRequestLogging(
    createHandler({
      version: process.env.APP_VERSION ?? 'dev',
      environment: process.env.APP_ENV ?? 'local',
    }),
  ),
);
server.listen(port, () => console.log(JSON.stringify({ severity: 'INFO', message: `api listening on ${port}` })));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
