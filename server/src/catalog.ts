import { date, nonemptyText, object, ValidationError } from './settings.ts';
import type { Facility, ReservationType } from './settings.ts';
import type { OpeningSchedule } from './store.ts';

export function httpsUrl(input: unknown): string {
  const value = nonemptyText(input, 2048);
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Report a validation code without echoing the input. */ }
  throw new ValidationError('invalid_url');
}

export function instant(input: unknown): number {
  const value = nonemptyText(input, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new ValidationError('timestamp_requires_timezone');
  }
  date(value.slice(0, 10));
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new ValidationError('invalid_timestamp');
  return result;
}

function identifier(input: unknown): string {
  const value = nonemptyText(input, 100);
  if (!/^[a-zA-Z0-9-]+$/.test(value)) throw new ValidationError('invalid_identifier');
  return value;
}

export function parseFacility(input: unknown): Facility {
  const value = object(input);
  if (!Array.isArray(value.reservationTypes) || !value.reservationTypes.length || value.reservationTypes.length > 2 ||
      value.reservationTypes.some((type) => type !== 'general' && type !== 'resident')) {
    throw new ValidationError('invalid_reservation_types');
  }
  return {
    id: identifier(value.id), provider: identifier(value.provider), name: nonemptyText(value.name),
    reservationUrl: httpsUrl(value.reservationUrl), reservationTypes: [...new Set(value.reservationTypes as ReservationType[])],
    supportMode: 'open_only', checkedAt: value.checkedAt == null ? null : instant(value.checkedAt), staleAfterMs: null,
  };
}

export function parseOpening(input: unknown, facilities: Facility[]): Omit<OpeningSchedule, 'revision' | 'cancelled'> {
  const value = object(input);
  const facilityId = nonemptyText(value.facilityId);
  const facility = facilities.find((item) => item.id === facilityId);
  const reservationType = value.reservationType as ReservationType;
  if (!facility?.reservationTypes.includes(reservationType)) throw new ValidationError('invalid_facility_or_type');
  const periodStart = date(value.periodStart);
  const periodEnd = date(value.periodEnd);
  if (periodStart > periodEnd) throw new ValidationError('invalid_period');
  return {
    id: identifier(value.id), facilityId, reservationType, periodStart, periodEnd,
    opensAt: instant(value.opensAt), confirmedAt: instant(value.confirmedAt), sourceUrl: httpsUrl(value.sourceUrl),
  };
}
