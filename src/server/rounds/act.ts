/**
 * [E-11] The workshop's acceptance act — „Töövõtja on töö üle andnud ja
 * tellija vastu võtnud.“
 *
 * Two halves on an allocated training: the partner ticks „töö üle antud“ (any
 * representative of the company, in its calendar) and the buyer ticks „vastu
 * võetud“ (on the trainings list), in either order, from the day the workshop
 * takes place. With both the training is completed and the act can be
 * downloaded as a PDF. The buyer may refuse with a reason instead: both halves
 * clear, the partner is told why, and can tick again.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { lotPartners, partners, trainings } from '@/db/schema';
import { tallinnIsoDay } from '@/domain/format';
import { WORKSHOP_TYPE_LABELS } from '@/domain/statuses';
import { trainingLines as describeTrainingLines } from '@/domain/training-lines';
import {
  renderActBuyerMarked,
  renderActCompleted,
  renderActPartnerMarked,
  renderActRejected,
} from '@/domain/round-templates';
import { env } from '@/lib/env';
import { logAudit } from '../audit';
import type { Ctx, Db, Tx } from '../context';
import { frameworkIdentity } from '../framework';
import { notify } from '../notify';
import { partnerRecipients, teamRecipients } from '../recipients';

type Training = typeof trainings.$inferSelect;

function load(ctx: Ctx, trainingId: string): Training {
  const training = ctx.tx.select().from(trainings).where(eq(trainings.id, trainingId)).get();
  if (!training) throw new Error('Koolitust ei leitud.');
  return training;
}

/** The act opens on the day the workshop takes place. */
function assertOpen(ctx: Ctx, training: Training): void {
  if (training.status === 'completed') throw new Error(`Koolituse ${training.code} akt on juba kinnitatud.`);
  if (training.status !== 'allocated' || !training.allocatedLotPartnerId) {
    throw new Error(`Koolitus ${training.code} ei ole partnerile määratud — akti ei saa märkida.`);
  }
  if (training.eventDate > tallinnIsoDay(ctx.at)) {
    throw new Error(`Akti saab märkida alates toimumispäevast (${training.eventDate.split('-').reverse().join('.')}).`);
  }
}

function lines(training: Training): string[] {
  return describeTrainingLines([
    {
      id: training.id,
      code: training.code,
      title: training.title,
      dateKind: training.dateKind,
      eventDate: training.eventDate,
      eventEnd: training.eventEnd,
      eventTime: training.eventTime,
      clusterCode: training.clusterCode,
      groupIndex: training.groupIndex,
      workshopTypeLabel: WORKSHOP_TYPE_LABELS[training.workshopType],
      county: training.county,
      locationText: training.locationText,
      participantCount: training.participantCount,
    },
  ]);
}

function holder(ctx: Ctx, lotPartnerId: string) {
  return ctx.tx
    .select({ contactName: lotPartners.contactName, partnerName: partners.name })
    .from(lotPartners)
    .innerJoin(partners, eq(partners.id, lotPartners.partnerId))
    .where(eq(lotPartners.id, lotPartnerId))
    .get();
}

const partnerCalendarUrl = () => `${env.APP_BASE_URL}/partner/kalender`;
const buyerTrainingsUrl = () => `${env.APP_BASE_URL}/tellija/koolitused?olek=allocated`;

/** Both halves ticked: the training is done, and the partner holds the act. */
function completeIfBoth(ctx: Ctx, trainingId: string): boolean {
  const training = load(ctx, trainingId);
  if (training.actPartnerAt === null || training.actBuyerAt === null) return false;
  ctx.tx
    .update(trainings)
    .set({ status: 'completed', completedAt: ctx.at, updatedAt: ctx.at })
    .where(eq(trainings.id, trainingId))
    .run();
  logAudit(ctx, {
    eventType: 'training.completed',
    summary: `Koolituse ${training.code} toimumise akt kinnitatud mõlema poole märkega — koolitus on lõpetatud`,
    trainingId,
    lotId: training.lotId,
    lotPartnerId: training.allocatedLotPartnerId ?? undefined,
  });
  const lotPartnerId = training.allocatedLotPartnerId!;
  notify(ctx, {
    recipientKind: 'partner',
    recipientLotPartnerId: lotPartnerId,
    type: 'act_completed',
    emailTo: partnerRecipients(ctx.tx, lotPartnerId),
    notice: renderActCompleted({
      framework: frameworkIdentity(ctx.tx),
      url: partnerCalendarUrl(),
      trainingLines: lines(training),
      contactName: holder(ctx, lotPartnerId)?.contactName ?? '',
    }),
  });
  return true;
}

/** The partner's half — any representative of the company that holds the training. */
export function markActByPartner(ctx: Ctx, trainingId: string, partnerId: string): { completed: boolean } {
  const training = load(ctx, trainingId);
  const memberships = ctx.tx
    .select({ id: lotPartners.id })
    .from(lotPartners)
    .where(eq(lotPartners.partnerId, partnerId))
    .all()
    .map((m) => m.id);
  if (!training.allocatedLotPartnerId || !memberships.includes(training.allocatedLotPartnerId)) {
    throw new Error('See koolitus ei ole teie ettevõttele määratud.');
  }
  assertOpen(ctx, training);
  if (training.actPartnerAt !== null) throw new Error('Olete töö üleandmise juba märkinud.');

  ctx.tx
    .update(trainings)
    .set({ actPartnerAt: ctx.at, actPartnerBy: ctx.actor.label, actRejectedAt: null, actRejectReason: '', updatedAt: ctx.at })
    .where(eq(trainings.id, trainingId))
    .run();

  const lotPartnerId = training.allocatedLotPartnerId;
  const partner = holder(ctx, lotPartnerId);
  logAudit(ctx, {
    eventType: 'training.act_partner_marked',
    summary: `${partner?.partnerName ?? 'Partner'} märkis koolituse ${training.code} aktis: töö on üle antud`,
    trainingId,
    lotId: training.lotId,
    lotPartnerId,
  });

  const completed = completeIfBoth(ctx, trainingId);
  if (!completed) {
    notify(ctx, {
      recipientKind: 'buyer',
      type: 'act_partner_marked',
      emailTo: teamRecipients(ctx.tx),
      notice: renderActPartnerMarked({
        framework: frameworkIdentity(ctx.tx),
        url: buyerTrainingsUrl(),
        trainingLines: lines(training),
        partnerName: partner?.partnerName ?? 'Partner',
        markedBy: ctx.actor.label,
      }),
    });
  }
  return { completed };
}

/** The buyer's half. */
export function markActByBuyer(ctx: Ctx, trainingId: string): { completed: boolean } {
  const training = load(ctx, trainingId);
  assertOpen(ctx, training);
  if (training.actBuyerAt !== null) throw new Error('Vastuvõtt on juba märgitud.');

  ctx.tx
    .update(trainings)
    .set({ actBuyerAt: ctx.at, actBuyerBy: ctx.actor.label, updatedAt: ctx.at })
    .where(eq(trainings.id, trainingId))
    .run();
  logAudit(ctx, {
    eventType: 'training.act_buyer_marked',
    summary: `Tellija märkis koolituse ${training.code} aktis: töö on vastu võetud`,
    trainingId,
    lotId: training.lotId,
    lotPartnerId: training.allocatedLotPartnerId ?? undefined,
  });

  const completed = completeIfBoth(ctx, trainingId);
  if (!completed) {
    const lotPartnerId = training.allocatedLotPartnerId!;
    notify(ctx, {
      recipientKind: 'partner',
      recipientLotPartnerId: lotPartnerId,
      type: 'act_buyer_marked',
      emailTo: partnerRecipients(ctx.tx, lotPartnerId),
      notice: renderActBuyerMarked({
        framework: frameworkIdentity(ctx.tx),
        url: partnerCalendarUrl(),
        trainingLines: lines(training),
        contactName: holder(ctx, lotPartnerId)?.contactName ?? '',
      }),
    });
  }
  return { completed };
}

/** The buyer does not accept: both halves clear, and the partner learns why. */
export function rejectAct(ctx: Ctx, trainingId: string, reason: string): void {
  const text = reason.trim();
  if (!text) throw new Error('Tagasilükkamine nõuab põhjendust.');
  const training = load(ctx, trainingId);
  assertOpen(ctx, training);
  if (training.actPartnerAt === null) {
    throw new Error('Partner ei ole töö üleandmist veel märkinud — tagasi lükata ei ole midagi.');
  }

  ctx.tx
    .update(trainings)
    .set({
      actPartnerAt: null,
      actPartnerBy: '',
      actBuyerAt: null,
      actBuyerBy: '',
      actRejectedAt: ctx.at,
      actRejectReason: text,
      updatedAt: ctx.at,
    })
    .where(eq(trainings.id, trainingId))
    .run();

  const lotPartnerId = training.allocatedLotPartnerId!;
  logAudit(ctx, {
    eventType: 'training.act_rejected',
    summary: `Tellija lükkas koolituse ${training.code} akti tagasi: ${text}`,
    trainingId,
    lotId: training.lotId,
    lotPartnerId,
    after: { reason: text, partnerMarkedBy: training.actPartnerBy },
  });
  notify(ctx, {
    recipientKind: 'partner',
    recipientLotPartnerId: lotPartnerId,
    type: 'act_rejected',
    emailTo: partnerRecipients(ctx.tx, lotPartnerId),
    notice: renderActRejected({
      framework: frameworkIdentity(ctx.tx),
      url: partnerCalendarUrl(),
      trainingLines: lines(training),
      contactName: holder(ctx, lotPartnerId)?.contactName ?? '',
      reason: text,
    }),
  });
}

/** The trainings of a company whose act it may see — for the partner's PDF route. */
export function partnerHoldsTraining(tx: Tx | Db, partnerId: string, trainingId: string): boolean {
  const memberships = tx
    .select({ id: lotPartners.id })
    .from(lotPartners)
    .where(eq(lotPartners.partnerId, partnerId))
    .all()
    .map((m) => m.id);
  if (memberships.length === 0) return false;
  return Boolean(
    tx
      .select({ id: trainings.id })
      .from(trainings)
      .where(and(eq(trainings.id, trainingId), inArray(trainings.allocatedLotPartnerId, memberships)))
      .get(),
  );
}
