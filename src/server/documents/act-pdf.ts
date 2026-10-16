/**
 * [E-11] The workshop's acceptance act as a PDF — the training, the parties,
 * the sentence both sides ticked, and who ticked it when.
 *
 * Built on demand from the training row, only once both halves are ticked.
 * Same renderer and the same standard-font, nothing-external rules as the
 * round protocol (importing it configures the pdfmake singleton).
 */

import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { eq } from 'drizzle-orm';
import { lotPartners, lots, partners, trainings } from '@/db/schema';
import { formatDateTime, formatEventWhen } from '@/domain/format';
import { frameworkTitleLine } from '@/domain/framework';
import { placeText } from '@/domain/places';
import { HIND } from '@/domain/pricing';
import { ACT_SENTENCE } from '@/domain/round-templates';
import { WORKSHOP_TYPE_LABELS } from '@/domain/statuses';
import type { Db, Tx } from '@/server/context';

type Reader = Tx | Db;
import { frameworkIdentity } from '@/server/framework';
import { safeTree } from './protocol-pdf';

export interface ActDocument {
  code: string;
  fileName: string;
  definition: TDocumentDefinitions;
}

/** The act of a completed training, or null when it is not (yet) complete. */
export function actDocument(tx: Reader, trainingId: string): ActDocument | null {
  const row = tx
    .select({ training: trainings, lotCode: lots.code, lotName: lots.name, partnerName: partners.name, regCode: partners.regCode })
    .from(trainings)
    .innerJoin(lots, eq(lots.id, trainings.lotId))
    .leftJoin(lotPartners, eq(lotPartners.id, trainings.allocatedLotPartnerId))
    .leftJoin(partners, eq(partners.id, lotPartners.partnerId))
    .where(eq(trainings.id, trainingId))
    .get();
  if (!row) return null;
  const t = row.training;
  if (t.status !== 'completed' || t.actPartnerAt === null || t.actBuyerAt === null) return null;

  const framework = frameworkIdentity(tx);
  const fact = (label: string, value: string): Content[] => [
    { text: label, bold: true, color: '#3d4854' },
    { text: value || '—' },
  ];
  const content: Content[] = [
    { text: 'Töötoa toimumise akt', fontSize: 17, bold: true, margin: [0, 0, 0, 2] },
    { text: `${t.code} — ${t.title}`, fontSize: 11, bold: true, margin: [0, 0, 0, 3] },
    { text: frameworkTitleLine(framework), fontSize: 8, color: '#5a6673', margin: [0, 0, 0, 12] },
    {
      table: {
        widths: [130, '*'],
        body: [
          fact('Tellija', framework.buyerName),
          fact('Töövõtja', `${row.partnerName ?? '—'}${row.regCode ? ` (reg. kood ${row.regCode})` : ''}`),
          fact('Hankeosa', `${row.lotCode} — ${row.lotName}`),
          fact('Koolitus', `${t.code} — ${t.title}`),
          fact('Formaat', WORKSHOP_TYPE_LABELS[t.workshopType]),
          fact('Toimumine', formatEventWhen(t)),
          fact('Koht', placeText(t.county, t.locationText)),
          fact(HIND.osalejateArv, String(t.participantCount)),
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 16],
    },
    { text: ACT_SENTENCE, fontSize: 12, bold: true, margin: [0, 0, 0, 14] },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: '[x] Töö üle antud — töövõtja', bold: true },
            { text: '[x] Vastu võetud — tellija', bold: true },
          ],
          [
            { text: `${t.actPartnerBy}\n${formatDateTime(t.actPartnerAt)}` },
            { text: `${t.actBuyerBy}\n${formatDateTime(t.actBuyerAt)}` },
          ],
        ],
      },
      margin: [0, 0, 0, 16],
    },
    {
      text: 'Akt on kinnitatud mõlema poole märkega Kaskaadhankija keskkonnas; märked ja nende tegijad on auditijäljes.',
      fontSize: 8,
      color: '#5a6673',
    },
  ];

  return {
    code: t.code,
    fileName: `toimumise-akt-${t.code}.pdf`,
    definition: safeTree({
      pageSize: 'A4',
      pageMargins: [48, 44, 48, 46],
      info: { title: `Töötoa toimumise akt ${t.code}`, creator: 'Kaskaadhankija' },
      defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.2 },
      content,
    }),
  };
}

export async function renderActPdf(doc: ActDocument): Promise<Buffer> {
  return Buffer.from(await pdfmake.createPdf(doc.definition).getBuffer());
}
