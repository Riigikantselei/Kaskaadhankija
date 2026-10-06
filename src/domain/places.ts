/**
 * A training's place as the buyer marked it [L-20].
 *
 * The plan may name a county („Rapla maakond“) or a town („Tallinn“). The
 * county is always stored — filters, the online-lot check and the protocol's
 * „maakond“ column need it — and a town is kept at the front of the location
 * text, so the place reads back exactly as marked: „Tallinn“, not
 * „Harju maakond, Tallinn“. No column of its own: a town is recognised by name
 * against its county, so rows imported before this read as they always did.
 */

import type { County } from './statuses';

/** Estonia's towns (linnad), by county. */
const TOWNS: Record<Exclude<County, 'Veebipõhine'>, readonly string[]> = {
  'Harju maakond': ['Tallinn', 'Keila', 'Maardu', 'Paldiski', 'Saue', 'Loksa'],
  'Hiiu maakond': ['Kärdla'],
  'Ida-Viru maakond': ['Narva', 'Kohtla-Järve', 'Jõhvi', 'Sillamäe', 'Narva-Jõesuu', 'Kiviõli', 'Püssi'],
  'Jõgeva maakond': ['Jõgeva', 'Põltsamaa', 'Mustvee'],
  'Järva maakond': ['Paide', 'Türi'],
  'Lääne maakond': ['Haapsalu'],
  'Lääne-Viru maakond': ['Rakvere', 'Tapa', 'Kunda', 'Tamsalu'],
  'Põlva maakond': ['Põlva'],
  'Pärnu maakond': ['Pärnu', 'Sindi', 'Kilingi-Nõmme', 'Lihula'],
  'Rapla maakond': ['Rapla'],
  'Saare maakond': ['Kuressaare'],
  'Tartu maakond': ['Tartu', 'Elva', 'Kallaste'],
  'Valga maakond': ['Valga', 'Tõrva', 'Otepää'],
  'Viljandi maakond': ['Viljandi', 'Abja-Paluoja', 'Mõisaküla', 'Võhma', 'Karksi-Nuia'],
  'Võru maakond': ['Võru', 'Antsla'],
};

const fold = (s: string) => s.trim().toLocaleLowerCase('et');

const TOWN_INDEX: ReadonlyMap<string, { town: string; county: County }> = new Map(
  Object.entries(TOWNS).flatMap(([county, towns]) => towns.map((town) => [fold(town), { town, county: county as County }] as const)),
);

/** „tallinn“ → { town: 'Tallinn', county: 'Harju maakond' }, or null for anything else. */
export function townOf(input: string): { town: string; county: County } | null {
  return TOWN_INDEX.get(fold(input)) ?? null;
}

/** The location text to store for a row marked with a town: the town first, then any further detail. */
export function locationWithTown(town: string, locationText: string): string {
  const rest = locationText.trim();
  if (!rest || fold(rest) === fold(town) || fold(rest).startsWith(`${fold(town)},`)) return rest || town;
  return `${town}, ${rest}`;
}

/** The town a stored location starts with, when that town is in the training's county. */
function leadingTown(county: string, locationText: string): string | null {
  const head = locationText.split(',')[0] ?? '';
  const found = townOf(head);
  return found && found.county === county ? found.town : null;
}

/** The place in one phrase: „Tallinn“, „Tallinn, Koolitaja ruumid“, „Rapla maakond“, „Harju maakond, Kesklinn“. */
export function placeText(county: string, locationText: string): string {
  if (leadingTown(county, locationText)) return locationText;
  return `${county}${locationText ? `, ${locationText}` : ''}`;
}

/** The place split for a two-line cell: the town or county on top, the rest of the location below. */
export function placeParts(county: string, locationText: string): { main: string; detail: string } {
  const town = leadingTown(county, locationText);
  if (!town) return { main: county, detail: locationText };
  return { main: town, detail: locationText.slice(town.length).replace(/^\s*,\s*/, '') };
}
