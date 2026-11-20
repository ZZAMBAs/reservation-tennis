export type ReservationType = 'general' | 'resident';
export type Facility = {
  id: string; provider: string; name: string; reservationUrl: string;
  supportMode: 'open_only' | 'official_api' | 'public_page';
  reservationTypes: ReservationType[]; checkedAt: number | null;
  staleAfterMs?: number | null;
};
export type AlertRule = {
  facilityId: string; weekdays?: number[];
  fromTime?: string; toTime?: string; fromDate?: string; toDate?: string;
};
export type Settings = {
  selections: { facilityId: string; types: ReservationType[] }[];
  openAlerts: boolean; vacancyAlerts: boolean; rules: AlertRule[];
};

export class ValidationError extends Error {}

export function object(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('invalid_object');
  return input as Record<string, unknown>;
}

export function nonemptyText(input: unknown, max = 128): string {
  if (typeof input !== 'string' || !input.trim() || input.length > max) throw new ValidationError('invalid_text');
  return input;
}

function list(input: unknown, max: number): unknown[] {
  if (!Array.isArray(input) || input.length > max) throw new ValidationError('invalid_list');
  return input;
}

function boolean(input: unknown): boolean {
  if (typeof input !== 'boolean') throw new ValidationError('invalid_boolean');
  return input;
}

export function date(input: unknown): string {
  const value = nonemptyText(input, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) throw new ValidationError('invalid_date');
  return value;
}

function time(input: unknown): string {
  const value = nonemptyText(input, 5);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new ValidationError('invalid_time');
  return value;
}

export function validateSettings(input: unknown, facilities: Facility[]): Settings {
  const value = object(input);
  const selections = list(value.selections, 50).map((entry) => {
    const selection = object(entry);
    const facilityId = nonemptyText(selection.facilityId);
    const facility = facilities.find((item) => item.id === facilityId);
    const types = list(selection.types, 2);
    if (!facility || !types.length || types.some((type) => !facility.reservationTypes.includes(type as ReservationType))) {
      throw new ValidationError('invalid_facility_selection');
    }
    return { facilityId, types: [...new Set(types as ReservationType[])] };
  });
  const selected = new Set(selections.map((selection) => selection.facilityId));
  if (selected.size !== selections.length) throw new ValidationError('duplicate_facility');
  const rules = list(value.rules, 50).map((entry) => {
    const condition = object(entry);
    const rule: AlertRule = { facilityId: nonemptyText(condition.facilityId) };
    if (!selected.has(rule.facilityId)) throw new ValidationError('rule_for_unselected_facility');
    if (condition.weekdays !== undefined) {
      const days = list(condition.weekdays, 7);
      if (days.some((day) => typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7)) {
        throw new ValidationError('invalid_weekdays');
      }
      if (days.length) rule.weekdays = [...new Set(days as number[])].sort();
    }
    if (condition.fromTime !== undefined || condition.toTime !== undefined) {
      rule.fromTime = time(condition.fromTime);
      rule.toTime = time(condition.toTime);
      if (rule.fromTime >= rule.toTime) throw new ValidationError('invalid_time_range');
    }
    if (condition.fromDate !== undefined || condition.toDate !== undefined) {
      rule.fromDate = date(condition.fromDate);
      rule.toDate = date(condition.toDate);
      if (rule.fromDate > rule.toDate) throw new ValidationError('invalid_date_range');
    }
    return rule;
  });
  return {
    selections, rules, openAlerts: boolean(value.openAlerts), vacancyAlerts: boolean(value.vacancyAlerts),
  };
}

export function defaultSettings(): Settings {
  return { selections: [], rules: [], openAlerts: false, vacancyAlerts: false };
}
