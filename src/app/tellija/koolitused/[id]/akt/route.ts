/**
 * [E-11] The workshop's acceptance act as a PDF, for the buyer side.
 * Exists only once both halves are ticked.
 */

import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { requireBuyer } from '@/server/auth/actor';
import { actDocument, renderActPdf } from '@/server/documents/act-pdf';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireBuyer();
  const { id } = await params;
  const doc = actDocument(getDb(), id);
  if (!doc) notFound();
  return new Response(new Uint8Array(await renderActPdf(doc)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
