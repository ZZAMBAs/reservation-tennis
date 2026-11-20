import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuthenticationError } from './auth.ts';
import type { Authenticate } from './auth.ts';
import { home } from './home.ts';
import { nonemptyText, object, ValidationError } from './settings.ts';
import type { Store } from './store.ts';

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}

function send(response: ServerResponse, status: number, payload: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function method(request: IncomingMessage, response: ServerResponse, allowed: string[]): string {
  if (!request.method || !allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
    throw new HttpError(405, 'method_not_allowed');
  }
  return request.method;
}

async function readBody(request: IncomingMessage) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'json_content_type_required');
  }
  const buffers: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length <= 32_768) buffers.push(chunk);
  }
  if (length > 32_768) throw new HttpError(413, 'body_too_large');
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(buffers).toString('utf8')); }
  catch { throw new ValidationError('invalid_json'); }
  return object(value);
}

export function createAppServer(store: Store, authenticate: Authenticate, clock = Date.now) {
  return createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/healthz') {
        method(request, response, ['GET']);
        try { store.database.prepare('PRAGMA schema_version').get(); }
        catch { return send(response, 503, { status: 'unavailable' }); }
        return send(response, 200, { status: 'ok' });
      }
      if (!url.pathname.startsWith('/v1/')) throw new HttpError(404, 'not_found');
      const uid = await authenticate(request.headers.authorization);
      switch (url.pathname) {
        case '/v1/facilities':
          method(request, response, ['GET']);
          return send(response, 200, { facilities: store.facilities() });
        case '/v1/home':
          method(request, response, ['GET']);
          return send(response, 200, home(store, uid, clock(), url.searchParams.get('cursor') ?? undefined));
        case '/v1/me/preferences':
          if (method(request, response, ['GET', 'PUT']) === 'PUT') {
            const settings = store.saveSettings(uid, await readBody(request), clock());
            return send(response, 200, settings);
          }
          return send(response, 200, store.settings(uid));
        case '/v1/me/device': {
          const operation = method(request, response, ['GET', 'PUT', 'DELETE']);
          if (operation === 'GET') return send(response, 200, { installationId: store.device(uid)?.installationId ?? null });
          const body = await readBody(request);
          const installationId = nonemptyText(body.installationId);
          if (operation === 'DELETE') {
            store.removeDevice(uid, installationId);
            return send(response, 200, { active: false });
          }
          if (typeof body.activate !== 'boolean') throw new ValidationError('invalid_activation');
          const active = store.saveDevice(uid, installationId, nonemptyText(body.pushTarget, 4096), body.activate, clock());
          return send(response, 200, { active });
        }
        default:
          throw new HttpError(404, 'not_found');
      }
    } catch (error) {
      if (error instanceof HttpError || error instanceof AuthenticationError) return send(response, error.status, { error: error.message });
      if (error instanceof ValidationError) return send(response, 400, { error: error.message });
      console.error('API request failed');
      send(response, 500, { error: 'internal_error' });
    }
  });
}
