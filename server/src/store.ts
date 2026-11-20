import type { DatabaseSync } from 'node:sqlite';
import { defaultSettings, validateSettings } from './settings.ts';
import type { Facility, Settings } from './settings.ts';

export class Store {
  readonly database: DatabaseSync;

  constructor(database: DatabaseSync) { this.database = database; }

  transaction<T>(work: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  facilities(): Facility[] {
    return this.database.prepare('SELECT * FROM facilities ORDER BY name, id').all().map((row) => ({
      id: row.id as string, provider: row.provider as string, name: row.name as string,
      reservationUrl: row.reservation_url as string, supportMode: row.support_mode as Facility['supportMode'],
      reservationTypes: JSON.parse(row.reservation_types as string), checkedAt: row.checked_at as number | null,
    }));
  }

  settings(uid: string): Settings {
    const row = this.database.prepare('SELECT document FROM account_settings WHERE uid = ?').get(uid);
    return row ? JSON.parse(row.document as string) : defaultSettings();
  }

  saveSettings(uid: string, input: unknown, now: number): Settings {
    const settings = validateSettings(input, this.facilities());
    this.transaction(() => {
      this.ensureAccount(uid, now);
      this.database.prepare(`INSERT INTO account_settings VALUES (?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`)
        .run(uid, JSON.stringify(settings), now);
    });
    return settings;
  }

  device(uid: string): { installationId: string; pushTarget: string } | undefined {
    const row = this.database.prepare('SELECT installation_id, push_target FROM devices WHERE uid = ?').get(uid);
    return row && { installationId: row.installation_id as string, pushTarget: row.push_target as string };
  }

  saveDevice(uid: string, installationId: string, pushTarget: string, activate: boolean, now: number): boolean {
    return this.transaction(() => {
      if (!activate && this.device(uid)?.installationId !== installationId) return false;
      this.ensureAccount(uid, now);
      // Explicit activation may transfer this installation from a previously signed-in account.
      this.database.prepare('DELETE FROM devices WHERE uid <> ? AND (installation_id = ? OR push_target = ?)')
        .run(uid, installationId, pushTarget);
      this.database.prepare(`INSERT INTO devices VALUES (?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET installation_id = excluded.installation_id,
          push_target = excluded.push_target, updated_at = excluded.updated_at`)
        .run(uid, installationId, pushTarget, now);
      return true;
    });
  }

  removeDevice(uid: string, installationId: string): void {
    this.database.prepare('DELETE FROM devices WHERE uid = ? AND installation_id = ?').run(uid, installationId);
  }

  private ensureAccount(uid: string, now: number): void {
    this.database.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?)').run(uid, now);
  }
}
