import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { openDatabase } from '../src/database.ts';
import { home } from '../src/home.ts';
import { Store } from '../src/store.ts';

test('home uses selected facilities and types, with stable 10-item pages independent of push conditions', () => {
  const database = openDatabase(':memory:');
  try {
    const store = new Store(database);
    store.saveFacility({ id: 'test', provider: 'sample', name: '테스트', reservationUrl: 'https://example.com/',
      supportMode: 'public_page', reservationTypes: ['general', 'resident'], staleAfterMs: 5000, checkedAt: 1 });
    store.saveSettings('user', { selections: [{ facilityId: 'test', types: ['general'] }], openAlerts: false,
      vacancyAlerts: true, rules: [{ facilityId: 'test', weekdays: [1] }] }, 1);
    database.prepare('INSERT INTO facility_checks VALUES (?, ?, ?, ?)').run('test', 1000, 1000, null);
    const insert = database.prepare('INSERT INTO slots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < 13; i++) {
      insert.run(createHash('sha256').update(String(i)).digest('hex'), 'test', String(i), i === 12 ? 'resident' : 'general',
        100_000, 200_000, 1, 1000, null, null, null);
    }
    const first = home(store, 'user', 2000);
    const second = home(store, 'user', 2000, first.nextCursor!);
    assert.equal(first.slots.length, 10);
    assert.equal(second.slots.length, 2);
    assert.equal(new Set([...first.slots, ...second.slots].map((slot) => slot.id)).size, 12);
    assert.equal(second.nextCursor, null);
    assert.equal(home(store, 'other', 2000).slots.length, 0);
    assert.throws(() => home(store, 'user', 2000, 'invalid'));
    const stale = home(store, 'user', 6001);
    assert.equal(stale.slots.length, 0);
    assert.equal(stale.facilityStates[0].status, 'delayed');
    database.prepare('UPDATE facilities SET support_mode = ? WHERE id = ?').run('open_only', 'test');
    assert.equal(home(store, 'user', 2000).slots.length, 0);
    assert.equal(home(store, 'user', 2000).facilityStates[0].status, 'open_only');
  } finally { database.close(); }
});
