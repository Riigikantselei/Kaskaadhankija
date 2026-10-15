import { describe, expect, it } from 'vitest';
import { formatEventWhen } from './format';
import { parseEventTime, parseTrainingRows } from './import-rows';
import { fixedTrainingLine } from './training-lines';
import { rawTrainingRow } from '@/server/test-support';

describe('[V-03] an optional time of day for a workshop', () => {
  it('reads what a person types, and what Excel stores', () => {
    expect(parseEventTime('')).toEqual({ ok: true, value: '' });
    expect(parseEventTime('10:00')).toMatchObject({ ok: true, value: '10:00' });
    expect(parseEventTime('9.30')).toMatchObject({ ok: true, value: '09:30' });
    expect(parseEventTime('10')).toMatchObject({ ok: true, value: '10:00' });
    expect(parseEventTime('10:00-13:00')).toMatchObject({ ok: true, value: '10:00–13:00' });
    expect(parseEventTime('kell 10.00 – 13.30')).toMatchObject({ ok: true, value: '10:00–13:30' });
    expect(parseEventTime('0.4166666667')).toMatchObject({ ok: true, value: '10:00' });
  });

  it('refuses what is not a time', () => {
    expect(parseEventTime('hommikul').ok).toBe(false);
    expect(parseEventTime('25:00').ok).toBe(false);
    expect(parseEventTime('13:00-10:00').ok).toBe(false);
  });

  it('is optional on a dated row and refused on a cluster row', () => {
    const parse = (over: Record<string, string>) =>
      parseTrainingRows([rawTrainingRow(over)], { knownLotCodes: ['OSA-1'] }).rows[0]!;
    expect(parse({}).value?.eventTime).toBe('');
    expect(parse({ kellaaeg: '10:00–13:00' }).value?.eventTime).toBe('10:00–13:00');
    const cluster = parse({ kood: 'KL-2026-001', kuupaev: '', periood_algus: '01.11.2026', periood_lopp: '30.11.2026', osalejate_arv: '100', ruhmi: '2', kellaaeg: '10:00' });
    expect(cluster.errors.map((e) => e.field)).toContain('kellaaeg');
  });

  it('closes the date wherever the date is shown', () => {
    expect(formatEventWhen({ eventDate: '2026-10-29', eventTime: '10:00–13:00' })).toBe('29.10.2026 kell 10:00–13:00');
    expect(formatEventWhen({ eventDate: '2026-10-29' })).toBe('29.10.2026');
    const line = fixedTrainingLine({
      id: 't', code: 'KK-2026-050', title: 'AI finantsjuhtimises', dateKind: 'fixed', eventDate: '2026-10-29', eventEnd: null,
      eventTime: '10:00', clusterCode: null, groupIndex: null, workshopTypeLabel: 'Töötuba 1', county: 'Harju maakond',
      locationText: '', participantCount: 40,
    });
    expect(line).toContain('29.10.2026 kell 10:00 ·');
  });
});
