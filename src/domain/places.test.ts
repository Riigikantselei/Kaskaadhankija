import { describe, expect, it } from 'vitest';
import { parseTrainingRows } from './import-rows';
import { placeParts, placeText, townOf } from './places';
import { rawTrainingRow } from '@/server/test-support';

describe('[L-20] the place as the buyer marked it', () => {
  it('knows a town and its county, case-insensitively', () => {
    expect(townOf('Tallinn')).toEqual({ town: 'Tallinn', county: 'Harju maakond' });
    expect(townOf(' pärnu ')).toEqual({ town: 'Pärnu', county: 'Pärnu maakond' });
    expect(townOf('Harju maakond')).toBeNull();
  });

  it('reads a town back as the town, and a county as before', () => {
    expect(placeText('Harju maakond', 'Tallinn')).toBe('Tallinn');
    expect(placeText('Harju maakond', 'Tallinn, Koolitaja ruumid')).toBe('Tallinn, Koolitaja ruumid');
    expect(placeText('Rapla maakond', '')).toBe('Rapla maakond');
    expect(placeText('Harju maakond', 'Koolitaja ruumid')).toBe('Harju maakond, Koolitaja ruumid');
    // a town of another county is just location text
    expect(placeText('Harju maakond', 'Tartu')).toBe('Harju maakond, Tartu');
    expect(placeParts('Harju maakond', 'Tallinn, Koolitaja ruumid')).toEqual({ main: 'Tallinn', detail: 'Koolitaja ruumid' });
    expect(placeParts('Rapla maakond', 'Kooli 1')).toEqual({ main: 'Rapla maakond', detail: 'Kooli 1' });
  });

  it('imports a town in the place column as its county, with the town leading the location', () => {
    const parse = (maakond: string, asukoht = '') =>
      parseTrainingRows([rawTrainingRow({ maakond, asukoht })], { knownLotCodes: ['OSA-1'] }).rows[0]!;
    expect(parse('Tallinn').value).toMatchObject({ county: 'Harju maakond', locationText: 'Tallinn' });
    expect(parse('Tartu', 'Raekoja plats 1').value).toMatchObject({ county: 'Tartu maakond', locationText: 'Tartu, Raekoja plats 1' });
    expect(parse('Tallinn', 'Tallinn').value).toMatchObject({ locationText: 'Tallinn' });
    expect(parse('Pärnu maakond').value).toMatchObject({ county: 'Pärnu maakond', locationText: '' });
    expect(parse('Pärnumaa').value).toMatchObject({ county: 'Pärnu maakond', locationText: '' });
    expect(parse('Atlantis').errors[0]?.field).toBe('maakond');
  });
});
