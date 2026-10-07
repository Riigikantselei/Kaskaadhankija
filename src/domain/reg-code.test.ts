import { describe, expect, it } from 'vitest';
import { parseRegCode } from './import-rows';

describe('a partner registry code', () => {
  it('takes an Estonian code and a foreign member’s own code', () => {
    expect(parseRegCode('10723047')).toEqual({ ok: true, value: '10723047' });
    expect(parseRegCode('0839665-2')).toMatchObject({ ok: true, value: '0839665-2' });
    expect(parseRegCode('FI 0839665-2')).toMatchObject({ ok: true, value: 'FI0839665-2' });
    expect(parseRegCode('lv40103978328')).toMatchObject({ ok: true, value: 'LV40103978328' });
  });

  it('refuses a mistyped Estonian code and a cell with several codes', () => {
    expect(parseRegCode('1072304').ok).toBe(false);
    expect(parseRegCode('40103978328').ok).toBe(false);
    expect(parseRegCode('17133416; 11357277').ok).toBe(false);
    expect(parseRegCode('').ok).toBe(false);
  });
});
