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
