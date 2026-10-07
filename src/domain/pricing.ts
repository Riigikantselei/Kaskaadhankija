/**
 * Money, as the framework agreement defines it [T-08].
 *
 * The partner's framework price (`uhikuhind`, `lot_partners.unit_price_eur`) is
 * a price **per participant**, constant per (lot, partner) and different
 * between partners and lots. A training's participant count is the **expected**
 * (optimal) number, not an upper limit. So the only figures the application
 * ever derives are:
 *
 *  - a training's *hind oodatava osalejate arvu korral* — expected participants
 *    × the partner's price per participant;
 *  - an allocation's *hind kokku oodatava osalejate arvu korral* — the sum of those.
 *
 * The application never computes or shows „maksumus“: what a partner is
 * finally paid follows the framework's terms and actual attendance, outside
 * this system. The buyer's own `hinnanguline_maksumus` on a calendar row is a
 * planning figure („Tellija hinnang“) that never reaches a partner [L-26].
 *
 * Labels live here so that screens, PDF, mail and the guide import them rather
 * than retype them — the guide quotes UI strings verbatim and its tests catch
 * drift, which only works if there is one place to drift from.
 */

import { formatEurCents } from './format';

export const HIND = {
  osalejaKohta: 'Hind osaleja kohta',
  osalejateArv: 'Oodatav osalejate arv',
  hindOodatavaArvuga: 'Hind oodatava osalejate arvu korral',
  hindKokku: 'Hind kokku oodatava osalejate arvu korral',
  tellijaHinnang: 'Tellija hinnang',
} as const;

/** Round to cents, so 3 × 60,50 does not accumulate float noise into frozen JSON. */
function cents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Expected participants × the partner's price per participant. */
export function trainingMaxPriceEur(participantCount: number, unitPriceEur: number): number {
  return cents(participantCount * unitPriceEur);
}

/** Σ over trainings of (expected participants × price per participant). */
export function allocationMaxPriceEur(
  lines: ReadonlyArray<{ participantCount: number; unitPriceEur: number }>,
): number {
  return cents(lines.reduce((sum, line) => sum + line.participantCount * line.unitPriceEur, 0));
}

/** The one sentence a notice or a document says about money. */
export function priceLine(totalEur: number, unitPriceEur: number): string {
  return `${HIND.hindKokku}: ${formatEurCents(totalEur)} (${HIND.osalejaKohta.toLowerCase()} ${formatEurCents(unitPriceEur)}; osalejate arv on oodatav, mitte ülempiir).`;
}
