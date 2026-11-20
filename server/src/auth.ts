import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

export class AuthenticationError extends Error {
  readonly status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}

export type Authenticate = (authorization: string | undefined) => Promise<string>;
type VerifyToken = (token: string, checkRevoked: boolean) => Promise<DecodedIdToken>;

export function createAuthenticator(env: NodeJS.ProcessEnv, verifier?: VerifyToken): Authenticate {
  const mode = env.APP_MODE ?? 'production';
  if (mode !== 'production' && mode !== 'development') throw new Error('Invalid APP_MODE');
  if (mode === 'development') {
    if (env.NODE_ENV === 'production') throw new Error('Development authentication is disabled in production');
    return async (header) => {
      const match = /^Bearer dev:(test-user|other-user)$/.exec(header ?? '');
      if (!match) throw new AuthenticationError(401, 'authentication_required');
      return match[1];
    };
  }
  if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Firebase Auth emulator is disabled in production');
  const emails = new Set((env.ALLOWED_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!env.FIREBASE_PROJECT_ID?.trim() || !emails.size) throw new Error('FIREBASE_PROJECT_ID and ALLOWED_EMAILS are required');
  let verify = verifier;
  if (!verify) {
    const firebaseAuth = getAuth(initializeApp({ projectId: env.FIREBASE_PROJECT_ID, credential: applicationDefault() }));
    verify = (token, checkRevoked) => firebaseAuth.verifyIdToken(token, checkRevoked);
  }
  const verifyToken = verify;

  return async (header) => {
    const match = /^Bearer (\S+)$/.exec(header ?? '');
    if (!match) throw new AuthenticationError(401, 'authentication_required');
    let identity: DecodedIdToken;
    try { identity = await verifyToken(match[1], true); }
    catch { throw new AuthenticationError(401, 'invalid_identity'); }
    if (identity.firebase?.sign_in_provider !== 'google.com' || !identity.email_verified || !identity.email ||
        !emails.has(identity.email.toLowerCase())) throw new AuthenticationError(403, 'account_not_allowed');
    return identity.uid;
  };
}
