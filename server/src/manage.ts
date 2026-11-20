import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseFacility, parseOpening } from './catalog.ts';
import { openDatabase } from './database.ts';
import { ValidationError } from './settings.ts';
import { Store } from './store.ts';

const [command, argument] = process.argv.slice(2);
const path = process.env.SQLITE_DB_PATH || fileURLToPath(new URL('../data/tennis-reservation.sqlite', import.meta.url));
const database = openDatabase(path);
const store = new Store(database);
try {
  if (command === 'facility' && argument) {
    store.saveFacility(parseFacility(JSON.parse(readFileSync(argument, 'utf8'))));
  } else if (command === 'opening' && argument) {
    store.saveOpening(parseOpening(JSON.parse(readFileSync(argument, 'utf8')), store.facilities()));
  } else if (command === 'cancel-opening' && argument) {
    if (!store.cancelOpening(argument)) throw new ValidationError('active_opening_not_found');
  } else if (command === 'sample') {
    if (process.env.APP_MODE !== 'development' || process.env.NODE_ENV === 'production') {
      throw new ValidationError('sample_requires_development');
    }
    const now = Date.now();
    const period = new Date(now + 36 * 60 * 60_000).toISOString().slice(0, 10);
    const startsAt = Date.parse(`${period}T10:00:00+09:00`);
    store.transaction(() => {
      store.saveFacility({ id: 'sample-facility', provider: 'sample', name: '개발용 샘플 테니스장',
        reservationUrl: 'https://example.com/', reservationTypes: ['general'],
        supportMode: 'public_page', staleAfterMs: 3_600_000, checkedAt: now });
      store.saveOpening({ id: 'sample-opening', facilityId: 'sample-facility', reservationType: 'general',
        periodStart: period, periodEnd: period, opensAt: now + 12 * 60_000,
        sourceUrl: 'https://example.com/notice', confirmedAt: now });
      database.prepare(`INSERT INTO facility_checks VALUES (?, ?, ?, ?)
        ON CONFLICT(facility_id) DO UPDATE SET last_success_at = excluded.last_success_at,
          last_attempt_at = excluded.last_attempt_at, error = NULL`).run('sample-facility', now, now, null);
      database.prepare('DELETE FROM slots WHERE facility_id = ?').run('sample-facility');
      const insert = database.prepare('INSERT INTO slots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (let index = 0; index < 12; index++) {
        const id = createHash('sha256').update(`sample-${index}-${period}`).digest('hex');
        insert.run(id, 'sample-facility', `샘플 ${index + 1}번 코트`, 'general', startsAt, startsAt + 7_200_000,
          1, now, null, '개발용 샘플', null);
      }
    });
  } else {
    throw new ValidationError('usage: facility <json> | opening <json> | cancel-opening <id> | sample');
  }
} catch (error) {
  console.error(error instanceof ValidationError ? error.message : 'management_command_failed');
  process.exitCode = 1;
} finally { database.close(); }
