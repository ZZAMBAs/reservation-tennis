import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/database.ts';
import { parseFacility, parseOpening } from '../src/catalog.ts';

const facility = parseFacility({ id: 'test', provider: 'test', name: '테스트 시설',
  reservationUrl: 'https://example.com/', reservationTypes: ['general'], checkedAt: '2026-11-20T09:00:00+09:00' });
const opening = {
  id: 'test-opening', facilityId: facility.id, reservationType: 'general', periodStart: '2026-12-01', periodEnd: '2026-12-31',
  opensAt: '2026-11-28T09:00:00+09:00', sourceUrl: 'https://example.com/notice', confirmedAt: '2026-11-20T09:00:00+09:00',
};

test('catalog validation requires an explicit timezone, known type, real dates and HTTPS', () => {
  assert.equal(facility.supportMode, 'open_only');
  assert.equal(parseOpening(opening, [facility]).opensAt, Date.parse('2026-11-28T00:00:00Z'));
  for (const invalid of [
    { ...opening, opensAt: '2026-11-28T09:00:00' },
    { ...opening, periodStart: '2026-02-30' },
    { ...opening, periodEnd: '2026-11-30' },
    { ...opening, reservationType: 'resident' },
    { ...opening, sourceUrl: 'http://example.com/' },
    { ...opening, sourceUrl: 'https://user:secret@example.com/' },
  ]) assert.throws(() => parseOpening(invalid, [facility]));
});

test('sample CLI refuses production and repeated development setup keeps twelve sample slots', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tennis-cli-'));
  const path = join(directory, 'sample.sqlite');
  const entry = fileURLToPath(new URL('../src/manage.ts', import.meta.url));
  const run = (mode: string) => spawnSync(process.execPath, [entry, 'sample'], {
    env: { ...process.env, SQLITE_DB_PATH: path, APP_MODE: mode, NODE_ENV: mode }, encoding: 'utf8', timeout: 10_000,
  });
  try {
    assert.equal(run('production').status, 1);
    const empty = openDatabase(path);
    try { assert.equal(empty.prepare('SELECT count(*) AS total FROM slots').get()?.total, 0); }
    finally { empty.close(); }
    assert.equal(run('development').status, 0);
    assert.equal(run('development').status, 0);
    const database = openDatabase(path);
    try { assert.equal(database.prepare('SELECT count(*) AS total FROM slots').get()?.total, 12); }
    finally { database.close(); }
  } finally {
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});
