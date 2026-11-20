import type { DatabaseSync } from 'node:sqlite';

// Append new migrations. Applied versions must keep their original SQL.
export const migrations: readonly string[] = [
  `
    CREATE TABLE accounts (
      uid TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL CHECK (created_at >= 0)
    ) STRICT;

    CREATE TABLE account_settings (
      uid TEXT PRIMARY KEY NOT NULL REFERENCES accounts(uid) ON DELETE CASCADE,
      document TEXT NOT NULL CHECK (json_valid(document) AND json_type(document) = 'object'),
      updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
    ) STRICT;

    CREATE TABLE devices (
      uid TEXT PRIMARY KEY NOT NULL REFERENCES accounts(uid) ON DELETE CASCADE,
      installation_id TEXT NOT NULL UNIQUE,
      push_target TEXT NOT NULL UNIQUE,
      updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
    ) STRICT;
  `,
  `
    CREATE TABLE facilities (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      reservation_url TEXT NOT NULL,
      support_mode TEXT NOT NULL DEFAULT 'open_only'
        CHECK (support_mode IN ('open_only', 'official_api', 'public_page')),
      reservation_types TEXT NOT NULL
        CHECK (json_valid(reservation_types) AND json_type(reservation_types) = 'array'),
      checked_at INTEGER CHECK (checked_at >= 0)
    ) STRICT;

    CREATE TABLE opening_schedules (
      id TEXT PRIMARY KEY NOT NULL,
      facility_id TEXT NOT NULL REFERENCES facilities(id),
      reservation_type TEXT NOT NULL CHECK (reservation_type IN ('general', 'resident')),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL CHECK (period_start <= period_end),
      opens_at INTEGER NOT NULL CHECK (opens_at >= 0),
      source_url TEXT NOT NULL,
      confirmed_at INTEGER NOT NULL CHECK (confirmed_at >= 0),
      revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
      cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1))
    ) STRICT;

    CREATE INDEX opening_schedules_by_facility_and_time ON opening_schedules(facility_id, opens_at);
  `,
];

export function migrate(database: DatabaseSync, steps: readonly string[] = migrations): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    const current = Number(database.prepare('PRAGMA user_version').get()!.user_version);
    if (current > steps.length) {
      throw new Error(`Database schema ${current} is newer than supported schema ${steps.length}`);
    }
    for (let index = current; index < steps.length; index++) {
      database.exec(steps[index]);
      database.exec(`PRAGMA user_version = ${index + 1}`);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
