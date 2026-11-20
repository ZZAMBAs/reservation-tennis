import { fileURLToPath } from 'node:url';
import { createAuthenticator } from './auth.ts';
import { openDatabase } from './database.ts';
import { createAppServer } from './http.ts';
import { Store } from './store.ts';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535');
}
const authenticate = createAuthenticator(process.env);
const dbPath = process.env.SQLITE_DB_PATH || fileURLToPath(new URL('../data/tennis-reservation.sqlite', import.meta.url));
const database = openDatabase(dbPath);
const server = createAppServer(new Store(database), authenticate);

server.once('error', () => {
  console.error('HTTP server failed');
  database.close();
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (!server.listening) return;
    server.close((error) => {
      if (error) process.exitCode = 1;
      database.close();
    });
  });
}

server.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));
