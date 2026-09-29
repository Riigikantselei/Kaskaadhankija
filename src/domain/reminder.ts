/**
 * When the one reminder of a round goes out [D-05].
 *
 * A round sends partners three mails: the offer at publication, one reminder,
 * and the result at the deadline. With a 24-hour answering window a fixed
 * „24 hours before“ reminder would land on top of the offer, so the buyer
 * chooses the moment instead — per lot as a default, per round as an override:
 *
 *  - `hours_before` — N whole hours before the deadline;
 *  - `local_time` — at HH:MM Tallinn time, the last such moment before the
 *    deadline (on the deadline day when the deadline is later in the day,
 *    otherwise the day before).
 *
 * Pure functions: the engine computes the instant at publication, stores it on
 * the round and recomputes it when the deadline is extended.
 */

import { tallinnParts, tallinnWallToUtc } from './working-days';

export type ReminderMode = 'hours_before' | 'local_time';

export interface ReminderRule {
  mode: ReminderMode;
  /** used when mode is `hours_before`; whole hours, 1…23 */
  hoursBefore: number;
  /** used when mode is `local_time`; 'HH:MM' Tallinn */
  localTime: string;
}

export const REMINDER_MODE_LABELS: Record<ReminderMode, string> = {
  hours_before: 'tundi enne tähtaega',
  local_time: 'kindlal kellaajal',
};

/**
 * In production a reminder closer than this to the publication would arrive
 * together with the offer — exactly the complaint that started this rule.
 */
export const MIN_REMINDER_GAP_MS = 2 * 3_600_000;

export const MAX_REMINDER_HOURS_BEFORE = 23;

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A reason the rule itself is malformed, or null. */
export function reminderRuleProblem(rule: ReminderRule): string | null {
  if (rule.mode === 'hours_before') {
    if (!Number.isInteger(rule.hoursBefore) || rule.hoursBefore < 1 || rule.hoursBefore > MAX_REMINDER_HOURS_BEFORE) {
      return `Meeldetuletuse aeg peab olema 1–${MAX_REMINDER_HOURS_BEFORE} tundi enne tähtaega.`;
    }
    return null;
  }
  if (rule.mode === 'local_time') {
    return LOCAL_TIME.test(rule.localTime) ? null : 'Meeldetuletuse kellaaeg peab olema kujul HH:MM.';
  }
  return 'Tundmatu meeldetuletuse viis.';
}

/** The instant the rule names for a given deadline. */
export function reminderInstant(rule: ReminderRule, deadlineAt: number): number {
  if (rule.mode === 'hours_before') return deadlineAt - rule.hoursBefore * 3_600_000;

  const [hour, minute] = rule.localTime.split(':').map(Number);
  const day = tallinnParts(new Date(deadlineAt));
  const sameDay = tallinnWallToUtc(day.year, day.month, day.day, hour, minute).getTime();
  if (sameDay < deadlineAt) return sameDay;
  const previous = new Date(Date.UTC(day.year, day.month - 1, day.day - 1));
  return tallinnWallToUtc(
    previous.getUTCFullYear(),
    previous.getUTCMonth() + 1,
    previous.getUTCDate(),
    hour,
    minute,
  ).getTime();
}

/**
 * Whether a reminder at `reminderAt` is worth sending for a round published at
 * `publishedAt` with this deadline: after the offer by at least `minGapMs`, and
 * before the deadline.
 */
export function reminderFits(
  reminderAt: number,
  publishedAt: number,
  deadlineAt: number,
  minGapMs: number,
): boolean {
  return reminderAt - publishedAt >= minGapMs && reminderAt < deadlineAt;
}

/** How the rule reads in a form, an audit row or the round page. */
export function describeReminderRule(rule: ReminderRule): string {
  return rule.mode === 'hours_before'
    ? `${rule.hoursBefore} ${rule.hoursBefore === 1 ? 'tund' : 'tundi'} enne tähtaega`
    : `kell ${rule.localTime} enne tähtaega`;
}

/**
 * A rule from form fields `reminderMode`, `reminderHoursBefore` and
 * `reminderLocalTime`; `{ problem }` when they do not make one.
 */
export function reminderRuleFromFields(
  get: (name: string) => string,
): { rule: ReminderRule; problem: null } | { rule: null; problem: string } {
  const mode = get('reminderMode');
  if (mode !== 'hours_before' && mode !== 'local_time') {
    return { rule: null, problem: 'Vali, millal meeldetuletus saadetakse.' };
  }
  const rule: ReminderRule = {
    mode,
    hoursBefore: Number(get('reminderHoursBefore') || '0'),
    localTime: get('reminderLocalTime').trim(),
  };
  const problem = reminderRuleProblem(rule);
  return problem ? { rule: null, problem } : { rule, problem: null };
}
