import { ValidationError } from './settings.ts';
import type { ReservationType } from './settings.ts';
import type { OpeningSchedule, Store } from './store.ts';

export type Slot = {
  id: string; facilityId: string; court: string; reservationType: ReservationType;
  startsAt: number; endsAt: number; available: boolean; observedAt: number;
  price: number | null; restriction: string | null; reservationUrl: string | null;
};

export function home(store: Store, uid: string, now: number, cursor?: string) {
  const settings = store.settings(uid);
  const selections = new Map(settings.selections.map((entry) => [entry.facilityId, entry.types]));
  const facilities = store.facilities().filter((facility) => selections.has(facility.id));
  const selectedType = (facilityId: string, type: ReservationType) => selections.get(facilityId)?.includes(type);
  const openings = store.openingsFrom(now).filter((opening) => selectedType(opening.facilityId, opening.reservationType));
  const nextByFacility = new Map<string, OpeningSchedule>();
  for (const opening of openings) {
    if (!nextByFacility.has(opening.facilityId)) nextByFacility.set(opening.facilityId, opening);
  }
  const nextOpenings = [...nextByFacility.values()];
  const slots: Slot[] = [];
  const facilityStates = facilities.map((facility) => {
    const check = store.database.prepare('SELECT * FROM facility_checks WHERE facility_id = ?').get(facility.id);
    const checkedAt = check?.last_success_at as number | null | undefined;
    const fresh = checkedAt != null && facility.staleAfterMs != null && now - checkedAt <= facility.staleAfterMs;
    if (facility.supportMode !== 'open_only' && fresh) {
      const rows = store.database.prepare(`SELECT * FROM slots WHERE facility_id = ?
        AND available = 1 AND starts_at > ? AND observed_at = ?`).all(facility.id, now, checkedAt);
      for (const row of rows) {
        if (!selectedType(facility.id, row.reservation_type as ReservationType)) continue;
        slots.push({
          id: row.id as string, facilityId: facility.id, court: row.court as string,
          reservationType: row.reservation_type as ReservationType,
          startsAt: row.starts_at as number, endsAt: row.ends_at as number, available: true,
          observedAt: row.observed_at as number, price: row.price as number | null,
          restriction: row.restriction as string | null, reservationUrl: row.reservation_url as string | null,
        });
      }
    }
    return {
      facilityId: facility.id, checkedAt: checkedAt ?? null,
      status: facility.supportMode === 'open_only' ? 'open_only' : !fresh || check?.error ? 'delayed' : 'current',
      openingKnown: nextOpenings.some((opening) => opening.facilityId === facility.id),
    };
  });
  slots.sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
  let last: { time: number; id: string } | undefined;
  if (cursor !== undefined) {
    const match = /^(\d{1,15}):([a-f0-9]{64})$/.exec(cursor);
    if (!match) throw new ValidationError('invalid_cursor');
    last = { time: Number(match[1]), id: match[2] };
  }
  const page = slots.filter((slot) => !last || slot.startsAt > last.time || (slot.startsAt === last.time && slot.id > last.id)).slice(0, 11);
  const more = page.length > 10;
  if (more) page.pop();
  const final = page.at(-1);
  return { facilities, facilityStates, openings: nextOpenings, slots: page,
    nextCursor: more && final ? `${final.startsAt}:${final.id}` : null };
}
