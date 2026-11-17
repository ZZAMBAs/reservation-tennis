import { createServer, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.ts';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535');
}

const dbPath = process.env.SQLITE_DB_PATH || fileURLToPath(
  new URL('../data/tennis-reservation.sqlite', import.meta.url),
);
const database = openDatabase(dbPath);

function sendJson(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.url?.split('?', 1)[0] !== '/healthz') {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    database.prepare('PRAGMA schema_version').get();
    sendJson(response, 200, { status: 'ok' });
  } catch (error) {
    console.error('SQLite readiness check failed', error);
    sendJson(response, 503, { status: 'unavailable' });
  }
});

server.once('error', (error) => {
  console.error('HTTP server failed', error);
  database.close();
  process.exitCode = 1;
});

function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error('HTTP shutdown failed', error);
      process.exitCode = 1;
    }
    database.close();
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (server.listening) shutdown();
  });
}

server.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));
