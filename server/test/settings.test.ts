import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSettings, validateSettings, ValidationError } from '../src/settings.ts';
import type { Facility } from '../src/settings.ts';

const facilities: Facility[] = [{
  id: 'test', provider: 'test', name: '테스트 시설', reservationUrl: 'https://example.com/',
  supportMode: 'open_only', reservationTypes: ['general'], checkedAt: null,
}];
const settings = {
  selections: [{ facilityId: 'test', types: ['general'] }],
  openAlerts: true, vacancyAlerts: true, rules: [],
};

test('conditions accept optional fields and a single date as an inclusive range', () => {
  const conditions = { ...settings, rules: [{
    facilityId: 'test', weekdays: [7, 6, 6], fromTime: '09:00', toTime: '12:00',
    fromDate: '2028-02-29', toDate: '2028-02-29',
  }, { facilityId: 'test' }] };
  const parsed = validateSettings(conditions, facilities);
  assert.deepEqual(parsed.rules[0].weekdays, [6, 7]);
  assert.equal(parsed.rules[0].fromDate, parsed.rules[0].toDate);
  assert.deepEqual(parsed.rules[1], { facilityId: 'test' });
  const first = defaultSettings();
  first.rules.push({ facilityId: 'test' });
  assert.equal(defaultSettings().rules.length, 0);
});

test('invalid dates, half ranges, reversed ranges, days, facilities and reservation types are rejected', () => {
  for (const rule of [
    { facilityId: 'unknown' }, { facilityId: 'test', weekdays: [0] },
    { facilityId: 'test', weekdays: [8] }, { facilityId: 'test', weekdays: ['6'] },
    { facilityId: 'test', fromTime: '09:00' },
    { facilityId: 'test', fromTime: '24:00', toTime: '25:00' },
    { facilityId: 'test', fromTime: '12:00', toTime: '09:00' },
    { facilityId: 'test', fromDate: '2026-02-30', toDate: '2026-03-01' },
    { facilityId: 'test', fromDate: '2026-12-02', toDate: '2026-12-01' },
  ]) assert.throws(() => validateSettings({ ...settings, rules: [rule] }, facilities), ValidationError);
  assert.throws(() => validateSettings({ ...settings, selections: [{ facilityId: 'test', types: ['resident'] }] }, facilities));
  assert.throws(() => validateSettings({ ...settings, openAlerts: 'true' }, facilities));
  assert.throws(() => validateSettings({ ...settings, selections: [...settings.selections, ...settings.selections] }, facilities));
});
