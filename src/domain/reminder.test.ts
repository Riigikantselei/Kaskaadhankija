import { describe, expect, it } from 'vitest';
import {
  MIN_REMINDER_GAP_MS,
  describeReminderRule,
  reminderFits,
  reminderInstant,
  reminderRuleProblem,
} from './reminder';
import { responseDeadline, tallinnParts, tallinnWallToUtc } from './working-days';

const H = 3_600_000;

function wall(ms: number) {
  const p = tallinnParts(new Date(ms));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

// Tue 6 Oct 2026 17:00 Tallinn
const DEADLINE = tallinnWallToUtc(2026, 10, 6, 17, 0).getTime();

describe('reminderInstant', () => {
  it('counts whole hours back from the deadline', () => {
    expect(wall(reminderInstant({ mode: 'hours_before', hoursBefore: 4, localTime: '10:00' }, DEADLINE))).toBe(
      '2026-10-06 13:00',
    );
  });

  it('uses the deadline day when the time of day is earlier than the deadline', () => {
    expect(wall(reminderInstant({ mode: 'local_time', hoursBefore: 4, localTime: '10:00' }, DEADLINE))).toBe(
      '2026-10-06 10:00',
    );
  });

  it('uses the day before when the time of day is not before the deadline', () => {
    expect(wall(reminderInstant({ mode: 'local_time', hoursBefore: 4, localTime: '18:00' }, DEADLINE))).toBe(
      '2026-10-05 18:00',
    );
    expect(wall(reminderInstant({ mode: 'local_time', hoursBefore: 4, localTime: '17:00' }, DEADLINE))).toBe(
      '2026-10-05 17:00',
    );
  });
});

describe('reminderFits', () => {
  it('needs the gap after publication and must come before the deadline', () => {
    const published = DEADLINE - 24 * H;
    expect(reminderFits(DEADLINE - 4 * H, published, DEADLINE, MIN_REMINDER_GAP_MS)).toBe(true);
    expect(reminderFits(published + H, published, DEADLINE, MIN_REMINDER_GAP_MS)).toBe(false);
    expect(reminderFits(DEADLINE, published, DEADLINE, MIN_REMINDER_GAP_MS)).toBe(false);
    expect(reminderFits(published + 60_000, published, DEADLINE, 1)).toBe(true);
  });
});

describe('reminderRuleProblem', () => {
  it('accepts sensible rules and refuses the rest', () => {
    expect(reminderRuleProblem({ mode: 'hours_before', hoursBefore: 4, localTime: '' })).toBeNull();
    expect(reminderRuleProblem({ mode: 'hours_before', hoursBefore: 0, localTime: '' })).not.toBeNull();
    expect(reminderRuleProblem({ mode: 'hours_before', hoursBefore: 24, localTime: '' })).not.toBeNull();
    expect(reminderRuleProblem({ mode: 'local_time', hoursBefore: 4, localTime: '09:30' })).toBeNull();
    expect(reminderRuleProblem({ mode: 'local_time', hoursBefore: 4, localTime: '9:30' })).not.toBeNull();
  });

  it('describes itself in Estonian', () => {
    expect(describeReminderRule({ mode: 'hours_before', hoursBefore: 1, localTime: '' })).toBe('1 tund enne tähtaega');
    expect(describeReminderRule({ mode: 'local_time', hoursBefore: 1, localTime: '10:00' })).toBe('kell 10:00 enne tähtaega');
  });
});

describe('responseDeadline', () => {
  it('gives one working day at the fixed time when that is at least 24 hours', () => {
    // Mon 5 Oct 2026 15:00 → Tue 17:00
    const from = tallinnWallToUtc(2026, 10, 5, 15, 0);
    expect(wall(responseDeadline(from, 1, '17:00').getTime())).toBe('2026-10-06 17:00');
  });

  it('rolls a day further when the fixed time would leave less than 24 hours', () => {
    // Mon 18:00 → Tue 17:00 is 23 h, so Wed 17:00
    const from = tallinnWallToUtc(2026, 10, 5, 18, 0);
    expect(wall(responseDeadline(from, 1, '17:00').getTime())).toBe('2026-10-07 17:00');
  });

  it('skips the weekend', () => {
    // Fri 9 Oct 15:00 → Mon 12 Oct 17:00
    const from = tallinnWallToUtc(2026, 10, 9, 15, 0);
    expect(wall(responseDeadline(from, 1, '17:00').getTime())).toBe('2026-10-12 17:00');
  });
});
