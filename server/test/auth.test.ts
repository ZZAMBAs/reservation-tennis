import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createAuthenticator, AuthenticationError } from '../src/auth.ts';

const env = { APP_MODE: 'production', FIREBASE_PROJECT_ID: 'test-project', ALLOWED_EMAILS: 'allowed@example.com' };
const identity = { uid: 'verified-uid', email: 'allowed@example.com', email_verified: true,
  firebase: { identities: {}, sign_in_provider: 'google.com' } } as DecodedIdToken;

test('development identity is explicit and cannot be enabled in production', async () => {
  const authenticate = createAuthenticator({ APP_MODE: 'development' });
  assert.equal(await authenticate('Bearer dev:test-user'), 'test-user');
  await assert.rejects(authenticate('Bearer dev:unlisted'), AuthenticationError);
  assert.throws(() => createAuthenticator({ APP_MODE: 'development', NODE_ENV: 'production' }));
  assert.throws(() => createAuthenticator({}));
  assert.throws(() => createAuthenticator({ ...env, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }));
});

test('production delegates signature and revocation verification to Firebase and enforces verified Google accounts', async () => {
  const authenticate = createAuthenticator(env, async (token, checkRevoked) => {
    assert.equal(token, 'test-token');
    assert.equal(checkRevoked, true);
    return identity;
  });
  assert.equal(await authenticate('Bearer test-token'), 'verified-uid');
  await assert.rejects(authenticate(undefined), (error) => error instanceof AuthenticationError && error.status === 401);
  for (const bad of [
    { ...identity, email: 'other@example.com' }, { ...identity, email_verified: false },
    { ...identity, firebase: { identities: {}, sign_in_provider: 'password' } },
  ]) {
    const blocked = createAuthenticator(env, async () => bad);
    await assert.rejects(blocked('Bearer anything'), (error) => error instanceof AuthenticationError && error.status === 403);
  }
  const invalid = createAuthenticator(env, async () => { throw new Error('sensitive internal information'); });
  await assert.rejects(invalid('Bearer anything'), (error) => error instanceof AuthenticationError && error.message === 'invalid_identity');
});
