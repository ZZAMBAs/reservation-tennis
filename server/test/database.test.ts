import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { openDatabase } from '../src/database.ts';
import { migrate, migrations } from '../src/migrations.ts';

test('new databases and existing version-zero databases migrate without losing data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tennis-migrations-'));
  const path = join(directory, 'database.sqlite');
  try {
    const baseline = new DatabaseSync(path);
    baseline.exec("CREATE TABLE original (value TEXT); INSERT INTO original VALUES ('retained')");
    baseline.close();

    const database = openDatabase(path);
    try {
      assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, migrations.length);
      assert.equal(database.prepare('SELECT value FROM original').get()?.value, 'retained');
      database.prepare('INSERT INTO accounts VALUES (?, ?)').run('first', 1);
      database.prepare('INSERT INTO account_settings VALUES (?, ?, ?)').run('first', '{"openAlerts":true}', 1);
    } finally { database.close(); }

    const reopened = openDatabase(path);
    try {
      assert.equal(reopened.prepare('PRAGMA user_version').get()?.user_version, migrations.length);
      assert.equal(reopened.prepare('SELECT document FROM account_settings WHERE uid = ?').get('first')?.document,
        '{"openAlerts":true}');
      assert.equal(reopened.prepare('PRAGMA quick_check').get()?.quick_check, 'ok');
    } finally { reopened.close(); }

    const fresh = openDatabase(':memory:');
    try { assert.equal(fresh.prepare('PRAGMA user_version').get()?.user_version, migrations.length); }
    finally { fresh.close(); }
  } finally {
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});

test('failed migrations roll back both schema edits and version changes', () => {
  const database = new DatabaseSync(':memory:');
  try {
    assert.throws(() => migrate(database, ['CREATE TABLE first (id TEXT);', 'CREATE TABLE invalid syntax;']));
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, 0);
    assert.equal(database.prepare("SELECT name FROM sqlite_schema WHERE name = 'first'").get(), undefined);
    migrate(database);
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, migrations.length);
  } finally { database.close(); }
});

test('older code refuses a future schema version without changing its contents', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`CREATE TABLE future (id TEXT); PRAGMA user_version = ${migrations.length + 1}`);
    assert.throws(() => migrate(database), /newer than supported/);
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, migrations.length + 1);
    assert.equal(database.prepare("SELECT name FROM sqlite_schema WHERE name = 'future'").get()?.name, 'future');
    assert.equal(database.prepare('PRAGMA quick_check').get()?.quick_check, 'ok');
  } finally { database.close(); }
});

test('settings require an account and deleting an account removes its settings and device', () => {
  const database = openDatabase(':memory:');
  try {
    const settings = database.prepare('INSERT INTO account_settings VALUES (?, ?, ?)');
    assert.throws(() => settings.run('unknown', '{}', 1), /FOREIGN KEY/);
    database.prepare('INSERT INTO accounts VALUES (?, ?)').run('first', 1);
    database.prepare('INSERT INTO accounts VALUES (?, ?)').run('second', 2);
    settings.run('first', '{"openAlerts":true}', 1);
    settings.run('second', '{"openAlerts":false}', 2);
    const device = database.prepare('INSERT INTO devices VALUES (?, ?, ?, ?)');
    device.run('first', 'installation-first', 'target-first', 1);
    assert.throws(() => device.run('first', 'other-installation', 'target-second', 2), /UNIQUE/);
    assert.throws(() => device.run('second', 'installation-first', 'target-other', 2), /UNIQUE/);
    assert.throws(() => database.prepare('UPDATE account_settings SET document = ? WHERE uid = ?').run('[]', 'first'), /CHECK/);
    database.prepare('DELETE FROM accounts WHERE uid = ?').run('first');
    assert.equal(database.prepare('SELECT uid FROM account_settings WHERE uid = ?').get('first'), undefined);
    assert.equal(database.prepare('SELECT uid FROM devices WHERE uid = ?').get('first'), undefined);
    assert.equal(database.prepare('SELECT document FROM account_settings WHERE uid = ?').get('second')?.document,
      '{"openAlerts":false}');
  } finally { database.close(); }
});

test('catalog migration upgrades version one and keeps account settings intact', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    migrate(database, migrations.slice(0, 1));
    database.prepare('INSERT INTO accounts VALUES (?, ?)').run('first', 1);
    database.prepare('INSERT INTO account_settings VALUES (?, ?, ?)').run('first', '{}', 1);
    migrate(database);
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, migrations.length);
    assert.equal(database.prepare('SELECT document FROM account_settings WHERE uid = ?').get('first')?.document, '{}');

    const schedule = database.prepare(`INSERT INTO opening_schedules
      (id, facility_id, reservation_type, period_start, period_end, opens_at, source_url, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const valid = ['opening-first', 'facility-first', 'general', '2026-12-01', '2026-12-31', 1000, 'https://example.com/notice', 1] as const;
    assert.throws(() => schedule.run(...valid), /FOREIGN KEY/);
    database.prepare(`INSERT INTO facilities (id, provider, name, reservation_url, reservation_types)
      VALUES (?, ?, ?, ?, ?)`).run('facility-first', 'provider-first', '테스트 시설', 'https://example.com/', '["general"]');
    schedule.run(...valid);
    assert.equal(database.prepare('SELECT support_mode FROM facilities').get()?.support_mode, 'open_only');
    database.prepare('UPDATE opening_schedules SET cancelled = ?, revision = revision + 1 WHERE id = ?')
      .run(1, 'opening-first');
    assert.equal(database.prepare('SELECT revision FROM opening_schedules').get()?.revision, 2);
    assert.throws(() => database.prepare('DELETE FROM facilities WHERE id = ?').run('facility-first'), /FOREIGN KEY/);
    assert.throws(() => database.prepare('UPDATE opening_schedules SET cancelled = 2').run(), /CHECK/);
    assert.throws(() => database.prepare('UPDATE opening_schedules SET period_end = ?').run('2026-11-01'), /CHECK/);
    assert.equal(database.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally { database.close(); }
});
