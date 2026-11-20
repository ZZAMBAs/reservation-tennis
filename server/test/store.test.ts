import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from '../src/database.ts';
import { Store } from '../src/store.ts';

test('account settings are isolated and a failed update keeps the saved value', () => {
  const database = openDatabase(':memory:');
  try {
    const store = new Store(database);
    assert.equal(store.settings('first').openAlerts, false);
    store.saveSettings('first', { selections: [], rules: [], openAlerts: true, vacancyAlerts: false }, 1);
    store.saveSettings('second', { selections: [], rules: [], openAlerts: false, vacancyAlerts: true }, 2);
    assert.equal(store.settings('first').openAlerts, true);
    assert.equal(store.settings('second').openAlerts, false);
    assert.equal(store.settings('second').vacancyAlerts, true);
    assert.throws(() => store.saveSettings('first', { rules: [] }, 3));
    assert.equal(store.settings('first').openAlerts, true);
  } finally { database.close(); }
});

test('new activation replaces the old device and old refresh or logout cannot take it back', () => {
  const database = openDatabase(':memory:');
  try {
    const store = new Store(database);
    assert.equal(store.saveDevice('user', 'old', 'target-old', true, 1), true);
    assert.equal(store.saveDevice('user', 'new', 'target-new', true, 2), true);
    assert.equal(store.saveDevice('user', 'old', 'target-old-refreshed', false, 3), false);
    store.removeDevice('user', 'old');
    assert.equal(store.device('user')?.installationId, 'new');
    assert.equal(store.saveDevice('user', 'new', 'target-new-refreshed', false, 4), true);
    assert.equal(store.device('user')?.pushTarget, 'target-new-refreshed');
    assert.equal(store.saveDevice('other', 'new', 'target-new-refreshed', true, 5), true);
    assert.equal(store.device('user'), undefined);
    store.removeDevice('user', 'new');
    assert.equal(store.device('other')?.installationId, 'new');
  } finally { database.close(); }
});

test('facility and opening updates keep their IDs and cancellation removes upcoming results', () => {
  const database = openDatabase(':memory:');
  try {
    const store = new Store(database);
    store.saveFacility({ id: 'test', provider: 'test', name: '테스트 시설', reservationUrl: 'https://example.com/',
      supportMode: 'open_only', reservationTypes: ['general'], checkedAt: 1 });
    assert.equal(store.facilities()[0].checkedAt, 1);
    const opening = { id: 'schedule', facilityId: 'test', reservationType: 'general' as const,
      periodStart: '2026-12-01', periodEnd: '2026-12-31', opensAt: 1000, sourceUrl: 'https://example.com/notice', confirmedAt: 1 };
    store.saveOpening(opening);
    assert.equal(store.openingsFrom(1000)[0].revision, 1);
    store.saveOpening({ ...opening, opensAt: 2000 });
    assert.equal(store.openingsFrom(1000, 1500).length, 0);
    assert.equal(store.openingsFrom(1000)[0].revision, 2);
    assert.equal(store.cancelOpening('schedule'), true);
    assert.equal(store.cancelOpening('schedule'), false);
    assert.equal(store.openingsFrom(0).length, 0);
    assert.equal(store.cancelOpening('unknown'), false);
    store.saveOpening({ ...opening, opensAt: 3000 });
    assert.equal(store.openingsFrom(0)[0].cancelled, false);
    assert.equal(store.openingsFrom(0)[0].revision, 4);
    assert.equal(database.prepare('SELECT count(*) AS total FROM opening_schedules').get()?.total, 1);
  } finally { database.close(); }
});
