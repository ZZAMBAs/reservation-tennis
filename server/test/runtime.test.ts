import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

async function unusedPort(): Promise<number> {
  const socket = createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert(address && typeof address === 'object');
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function start(path: string, port: number) {
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, APP_MODE: 'development', NODE_ENV: 'test',
      HOST: '127.0.0.1', PORT: String(port), SQLITE_DB_PATH: path },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  // Consume spawn errors even if they occur while probing the HTTP endpoint.
  let spawnError: Error | undefined;
  child.on('error', (error) => { spawnError = error; });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await closed;
  };
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Server exited before readiness: ${output}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(250) });
        if (response.status === 200) return { stop, base: `http://127.0.0.1:${port}` };
      } catch { /* Retry while the new process initializes. */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Server did not become ready: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

test('HTTP readiness and SQLite data survive a server restart', { timeout: 20_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tennis-runtime-'));
  const path = join(directory, 'reservation.sqlite');
  let running: Awaited<ReturnType<typeof start>> | undefined;
  try {
    running = await start(path, await unusedPort());
    const health = await fetch(`${running.base}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.match(health.headers.get('content-type') ?? '', /application\/json/);
    const missing = await fetch(`${running.base}/missing`);
    assert.equal(missing.status, 404);
    const method = await fetch(`${running.base}/healthz`, { method: 'POST' });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'GET');
    await running.stop();
    running = undefined;

    assert.equal(existsSync(path), true);
    const database = new DatabaseSync(path);
    try {
      assert.equal(database.prepare('PRAGMA journal_mode').get()?.journal_mode, 'wal');
      database.exec("CREATE TABLE runtime_probe (value TEXT NOT NULL); INSERT INTO runtime_probe VALUES ('preserved');");
    } finally { database.close(); }

    running = await start(path, await unusedPort());
    assert.equal((await fetch(`${running.base}/healthz`)).status, 200);
    await running.stop();
    running = undefined;
    const reopened = new DatabaseSync(path);
    try {
      assert.equal(reopened.prepare('SELECT value FROM runtime_probe').get()?.value, 'preserved');
      assert.equal(reopened.prepare('PRAGMA quick_check').get()?.quick_check, 'ok');
    } finally { reopened.close(); }
  } finally {
    await running?.stop();
    // Only this test's explicitly created files and empty directory are removed.
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});
