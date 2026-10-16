/**
 * [E-11] The workshop's acceptance act: two halves, either order, completion
 * with both, and the buyer's reasoned refusal.
 */

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditEvents, notifications, trainings } from '@/db/schema';
import { closeRound, confirmAllocation, confirmMarks, createRound, publishRound } from './engine';
import { markActByBuyer, markActByPartner, partnerHoldsTraining, rejectAct } from './act';
import { actDocument, renderActPdf } from '../documents/act-pdf';
import { completedFor, workloadFor } from './views';
import { createHarness, seedLotWithPartners, type LotFixture, type TestHarness } from '../test-support';

let harness: TestHarness;
let fx: LotFixture;

beforeEach(() => {
  harness = createHarness(Date.UTC(2026, 8, 30, 7, 0));
  fx = seedLotWithPartners(harness, { partnerCount: 2, trainingCount: 3 });
  const roundId = harness.write((ctx) => {
    const id = createRound(ctx, { lotId: fx.lotId, trainingIds: fx.trainingIds });
    publishRound(ctx, id);
    return id;
  });
  harness.write((ctx) => confirmMarks(ctx, roundId, fx.partnerIds[0], { marks: fx.trainingIds, cap: null }));
  harness.advance(6 * 86_400_000);
  harness.write((ctx) => closeRound(ctx, roundId));
  harness.write((ctx) => confirmAllocation(ctx, roundId));
});

afterEach(() => harness.close());

const training = (id: string) => harness.read((db) => db.select().from(trainings).where(eq(trainings.id, id)).get())!;
const noticeTypes = () => harness.read((db) => db.select({ type: notifications.type }).from(notifications).all().map((n) => n.type));
const afterEvent = (id: string) => {
  harness.now = Date.parse(`${training(id).eventDate}T12:00:00Z`) + 86_400_000;
};

describe('[E-11] the workshop acceptance act', () => {
  it('opens on the workshop day, not before', () => {
    const id = fx.trainingIds[2]!;
    harness.now = Date.parse(`${training(id).eventDate}T00:00:00Z`) - 2 * 86_400_000;
    expect(() => harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!))).toThrow(/alates toimumispäevast/);
  });

  it('partner first, then buyer: completed with both, each side told', () => {
    const id = fx.trainingIds[0]!;
    afterEvent(id);
    expect(harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!))).toEqual({ completed: false });
    expect(training(id)).toMatchObject({ status: 'allocated', actBuyerAt: null });
    expect(training(id).actPartnerAt).not.toBeNull();
    expect(noticeTypes()).toContain('act_partner_marked');

    expect(harness.write((ctx) => markActByBuyer(ctx, id))).toEqual({ completed: true });
    expect(training(id)).toMatchObject({ status: 'completed' });
    expect(noticeTypes()).toContain('act_completed');
    const audit = harness.read((db) => db.select().from(auditEvents).where(eq(auditEvents.trainingId, id)).all().map((a) => a.eventType));
    expect(audit).toEqual(expect.arrayContaining(['training.act_partner_marked', 'training.act_buyer_marked', 'training.completed']));
  });

  it('buyer first is fine too — the partner is asked to tick its half', () => {
    const id = fx.trainingIds[0]!;
    afterEvent(id);
    expect(harness.write((ctx) => markActByBuyer(ctx, id))).toEqual({ completed: false });
    expect(noticeTypes()).toContain('act_buyer_marked');
    expect(harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!))).toEqual({ completed: true });
    expect(training(id).status).toBe('completed');
  });

  it('[L-07] a completed training leaves the current workload and counts as läbi viidud', () => {
    const id = fx.trainingIds[0]!;
    const lotPartnerId = training(id).allocatedLotPartnerId!;
    expect(harness.read((db) => [workloadFor(db, lotPartnerId), completedFor(db, lotPartnerId)])).toEqual([3, 0]);
    afterEvent(id);
    harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!));
    harness.write((ctx) => markActByBuyer(ctx, id));
    expect(harness.read((db) => [workloadFor(db, lotPartnerId), completedFor(db, lotPartnerId)])).toEqual([2, 1]);
  });

  it('only the company that holds the training can tick the partner half, once', () => {
    const id = fx.trainingIds[0]!;
    afterEvent(id);
    expect(() => harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[1]!))).toThrow(/ei ole teie ettevõttele/);
    harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!));
    expect(() => harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!))).toThrow(/juba märkinud/);
  });

  it('a refusal needs a reason, clears both halves, and the partner can tick again', () => {
    const id = fx.trainingIds[0]!;
    afterEvent(id);
    expect(() => harness.write((ctx) => rejectAct(ctx, id, 'Põhjus'))).toThrow(/ei ole töö üleandmist veel märkinud/);
    harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!));
    expect(() => harness.write((ctx) => rejectAct(ctx, id, '  '))).toThrow(/põhjendust/);
    harness.write((ctx) => rejectAct(ctx, id, 'Osalejate nimekiri on esitamata'));
    expect(training(id)).toMatchObject({ actPartnerAt: null, actBuyerAt: null, actRejectReason: 'Osalejate nimekiri on esitamata', status: 'allocated' });
    expect(noticeTypes()).toContain('act_rejected');
    harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!));
    expect(training(id)).toMatchObject({ actRejectReason: '' });
    harness.write((ctx) => markActByBuyer(ctx, id));
    expect(training(id).status).toBe('completed');
    expect(() => harness.write((ctx) => markActByBuyer(ctx, id))).toThrow(/juba kinnitatud/);
  });

  it('has a PDF only once both halves are ticked, for the holder only', async () => {
    const id = fx.trainingIds[0]!;
    afterEvent(id);
    harness.write((ctx) => markActByPartner(ctx, id, fx.partnerIds[0]!));
    expect(harness.read((db) => actDocument(db, id))).toBeNull();
    harness.write((ctx) => markActByBuyer(ctx, id));
    const doc = harness.read((db) => actDocument(db, id))!;
    expect(doc.fileName).toBe(`toimumise-akt-${training(id).code}.pdf`);
    const pdf = await renderActPdf(doc);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(harness.read((db) => partnerHoldsTraining(db, fx.partnerIds[0]!, id))).toBe(true);
    expect(harness.read((db) => partnerHoldsTraining(db, fx.partnerIds[1]!, id))).toBe(false);
  });
});
