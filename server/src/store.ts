import type { DatabaseSync } from 'node:sqlite';
import { defaultSettings, validateSettings } from './settings.ts';
import type { Facility, ReservationType, Settings } from './settings.ts';

export type OpeningSchedule = {
  id: string; facilityId: string; reservationType: ReservationType;
  periodStart: string; periodEnd: string; opensAt: number; sourceUrl: string;
  confirmedAt: number; revision: number; cancelled: boolean;
};

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

  saveFacility(facility: Facility): void {
    this.database.prepare(`INSERT INTO facilities VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET provider = excluded.provider, name = excluded.name,
        reservation_url = excluded.reservation_url, support_mode = excluded.support_mode,
        reservation_types = excluded.reservation_types, checked_at = excluded.checked_at`)
      .run(facility.id, facility.provider, facility.name, facility.reservationUrl, facility.supportMode,
        JSON.stringify(facility.reservationTypes), facility.checkedAt);
  }

  saveOpening(schedule: Omit<OpeningSchedule, 'revision' | 'cancelled'>): void {
    this.database.prepare(`INSERT INTO opening_schedules
      (id, facility_id, reservation_type, period_start, period_end, opens_at, source_url, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET facility_id = excluded.facility_id,
        reservation_type = excluded.reservation_type, period_start = excluded.period_start,
        period_end = excluded.period_end, opens_at = excluded.opens_at, source_url = excluded.source_url,
        confirmed_at = excluded.confirmed_at, revision = revision + 1, cancelled = 0`)
      .run(schedule.id, schedule.facilityId, schedule.reservationType, schedule.periodStart, schedule.periodEnd,
        schedule.opensAt, schedule.sourceUrl, schedule.confirmedAt);
  }

  cancelOpening(id: string): boolean {
    return this.database.prepare('UPDATE opening_schedules SET cancelled = 1, revision = revision + 1 WHERE id = ? AND cancelled = 0')
      .run(id).changes > 0;
  }

  openingsFrom(from: number, to = Number.MAX_SAFE_INTEGER): OpeningSchedule[] {
    return this.database.prepare(`SELECT * FROM opening_schedules
      WHERE cancelled = 0 AND opens_at BETWEEN ? AND ? ORDER BY opens_at, id`).all(from, to).map((row) => ({
        id: row.id as string, facilityId: row.facility_id as string,
        reservationType: row.reservation_type as ReservationType,
        periodStart: row.period_start as string, periodEnd: row.period_end as string,
        opensAt: row.opens_at as number, sourceUrl: row.source_url as string,
        confirmedAt: row.confirmed_at as number, revision: row.revision as number, cancelled: Boolean(row.cancelled),
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
