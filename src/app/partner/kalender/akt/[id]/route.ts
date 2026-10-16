/**
 * [E-11] The workshop's acceptance act as a PDF, for the company that ran it —
 * and only that company.
 */

import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { requirePartner } from '@/server/auth/actor';
import { actDocument, renderActPdf } from '@/server/documents/act-pdf';
import { partnerHoldsTraining } from '@/server/rounds/act';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePartner();
  const { id } = await params;
  const db = getDb();
  if (!partnerHoldsTraining(db, actor.partnerId, id)) notFound();
  const doc = actDocument(db, id);
  if (!doc) notFound();
  return new Response(new Uint8Array(await renderActPdf(doc)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
