import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createAuthenticator } from '../src/auth.ts';
import { openDatabase } from '../src/database.ts';
import { createAppServer } from '../src/http.ts';
import { Store } from '../src/store.ts';

test('user APIs isolate accounts, validate requests and never return push targets', async () => {
  const database = openDatabase(':memory:');
  const store = new Store(database);
  store.saveFacility({ id: 'test', provider: 'test', name: '테스트 시설', reservationUrl: 'https://example.com/',
    supportMode: 'open_only', reservationTypes: ['general'], checkedAt: null });
  const server = createAppServer(store, createAuthenticator({ APP_MODE: 'development' }), () => 1000);
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const call = (path: string, token: string | null = 'test-user', method = 'GET', body?: object | string) => fetch(base + path, {
      method, headers: { ...(token ? { Authorization: `Bearer dev:${token}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    assert.equal((await call('/healthz', null)).status, 200);
    assert.equal((await call('/v1/home', null)).status, 401);
    assert.equal((await call('/v1/me/preferences', 'not-allowed')).status, 401);
    assert.equal((await call('/v1/facilities')).status, 200);
    assert.equal((await call('/v1/me/preferences', 'test-user', 'PUT', '{')).status, 400);
    assert.equal((await call('/v1/me/preferences', 'test-user', 'PUT', { data: 'x'.repeat(33_000) })).status, 413);
    const body = { selections: [{ facilityId: 'test', types: ['general'] }],
      openAlerts: true, vacancyAlerts: false, rules: [], uid: 'other-user' };
    assert.equal((await call('/v1/me/preferences', 'test-user', 'PUT', body)).status, 200);
    assert.equal((await (await call('/v1/me/preferences?uid=other-user')).json()).openAlerts, true);
    assert.equal((await (await call('/v1/me/preferences', 'other-user')).json()).openAlerts, false);
    assert.equal((await (await call('/v1/home')).json()).facilityStates[0].status, 'open_only');
    assert.equal((await call('/v1/home?cursor=bad')).status, 400);
    assert.equal((await call('/v1/home', 'test-user', 'POST', {})).status, 405);
    assert.equal((await call('/v1/missing')).status, 404);
    const activate = (installationId: string, flag: boolean) => call('/v1/me/device', 'test-user', 'PUT', {
      installationId, pushTarget: `target-${installationId}`, activate: flag,
    });
    assert.equal((await activate('first', true)).status, 200);
    assert.equal((await activate('second', true)).status, 200);
    assert.equal((await (await activate('first', false)).json()).active, false);
    assert.deepEqual(await (await call('/v1/me/device')).json(), { installationId: 'second' });
    assert.equal((await call('/v1/me/device', 'test-user', 'DELETE', { installationId: 'first' })).status, 200);
    assert.deepEqual(await (await call('/v1/me/device')).json(), { installationId: 'second' });
    assert.deepEqual(await (await call('/v1/me/device', 'other-user')).json(), { installationId: null });
    database.close();
    assert.equal((await call('/healthz')).status, 503);
    const failure = await call('/v1/home');
    assert.equal(failure.status, 500);
    assert.deepEqual(await failure.json(), { error: 'internal_error' });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (database.isOpen) database.close();
  }
});
