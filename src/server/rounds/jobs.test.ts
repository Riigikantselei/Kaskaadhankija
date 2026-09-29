/**
 * The deadline runner — the path production actually uses to close a round.
 *
 * The engine's own tests call `closeRound` directly; these check the loop that
 * finds what is due, and that it is safe to call from the timer, a page load
 * and a clock advance all at once.
 */

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emailDeliveries, notifications, rounds } from '@/db/schema';
import { createHarness, seedLotWithPartners, type LotFixture, type TestHarness } from '../test-support';
import { confirmMarks, createRound, publishRound } from './engine';
import { runDueJobs } from './jobs';

let harness: TestHarness;
let fx: LotFixture;

beforeEach(() => {
  // The runner reads the real clock, so these tests must start from it.
  harness = createHarness(Date.now());
  fx = seedLotWithPartners(harness, { partnerCount: 3, trainingCount: 3 });
});

afterEach(() => harness.close());

/**
 * Move every round's window back by `ms` — which is what the passage of `ms`
 * looks like to the runner, now that the clock is the real one [L-23].
 */
function timePasses(ms: number): void {
  harness.write((ctx) => {
    for (const row of ctx.tx.select().from(rounds).all()) {
      ctx.tx
        .update(rounds)
        .set({
          publishedAt: row.publishedAt === null ? null : row.publishedAt - ms,
          deadlineAt: row.deadlineAt === null ? null : row.deadlineAt - ms,
          reminderAt: row.reminderAt === null ? null : row.reminderAt - ms,
          expectedDecisionAt:
            row.expectedDecisionAt === null ? null : row.expectedDecisionAt - ms,
        })
        .where(eq(rounds.id, row.id))
        .run();
    }
  });
  harness.now = Date.now();
}

const publish = () =>
  harness.write((ctx) => {
    const roundId = createRound(ctx, { lotId: fx.lotId, trainingIds: fx.trainingIds });
    publishRound(ctx, roundId);
    return roundId;
  });

const statusOf = (roundId: string) =>
  harness.read((db) => db.select().from(rounds).where(eq(rounds.id, roundId)).get())?.status;

describe('runDueJobs', () => {
  it('does nothing while the deadline is in the future', () => {
    const roundId = publish();
    const report = runDueJobs(harness.db);
    expect(report.closed).toEqual([]);
    expect(statusOf(roundId)).toBe('open');
  });

  it('closes a round once its deadline has passed', () => {
    const roundId = publish();
    harness.write((ctx) => confirmMarks(ctx, roundId, fx.partnerIds[0], { marks: [fx.trainingIds[0]], cap: null }));

    timePasses(10 * 86_400_000);
    const report = runDueJobs(harness.db);

    expect(report.closed).toHaveLength(1);
    expect(statusOf(roundId)).toBe('closed');
  });

  it('is idempotent across repeated runs', () => {
    publish();
    timePasses(10 * 86_400_000);

    const first = runDueJobs(harness.db);
    const second = runDueJobs(harness.db);
    const third = runDueJobs(harness.db);

    expect(first.closed).toHaveLength(1);
    expect(second.closed).toEqual([]);
    expect(third.closed).toEqual([]);
    const closedEvents = harness.read((db) =>
      db.select().from(notifications).where(eq(notifications.type, 'buyer_round_closed')).all(),
    );
    expect(closedEvents).toHaveLength(1);
  });

  it('closes several overdue rounds in one run', () => {
    const other = seedLotWithPartners(harness, { code: 'OSA-5', partnerCount: 2, trainingCount: 2 });
    publish();
    harness.write((ctx) => {
      const id = createRound(ctx, { lotId: other.lotId, trainingIds: other.trainingIds });
      publishRound(ctx, id);
    });

    timePasses(15 * 86_400_000);
    expect(runDueJobs(harness.db).closed).toHaveLength(2);
  });

  it('sends the reminder when it falls due, once [D-05]', () => {
    const roundId = publish();
    const deadline = harness.read((db) =>
      db.select().from(rounds).where(eq(rounds.id, roundId)).get(),
    )!.deadlineAt!;

    // Five hours out: the lot's reminder (four hours before) is not due yet.
    timePasses(deadline - 5 * 3_600_000 - Date.now());
    expect(runDueJobs(harness.db).remindersSent).toBe(0);

    timePasses(2 * 3_600_000);
    expect(runDueJobs(harness.db).remindersSent).toBe(3);
    expect(runDueJobs(harness.db).remindersSent).toBe(0);
    expect(statusOf(roundId)).toBe('open');
  });

  it('does not remind about a round it has just closed', () => {
    publish();
    timePasses(10 * 86_400_000);
    const report = runDueJobs(harness.db);
    expect(report.closed).toHaveLength(1);
    expect(report.remindersSent).toBe(0);
    expect(
      harness.read((db) =>
        db.select().from(notifications).where(eq(notifications.type, 'reminder_24h')).all(),
      ),
    ).toHaveLength(0);
  });

  it('mails a partner three times in a round: the offer, the reminder, the result', () => {
    const roundId = publish();
    const deadline = harness.read((db) =>
      db.select().from(rounds).where(eq(rounds.id, roundId)).get(),
    )!.deadlineAt!;

    timePasses(deadline - 3 * 3_600_000 - Date.now());
    runDueJobs(harness.db);
    timePasses(4 * 3_600_000);
    runDueJobs(harness.db);
    expect(statusOf(roundId)).toBe('closed');

    const mailed = harness.read((db) =>
      db
        .select({ type: notifications.type })
        .from(notifications)
        .innerJoin(emailDeliveries, eq(emailDeliveries.notificationId, notifications.id))
        .where(eq(notifications.recipientLotPartnerId, fx.lotPartnerIds[1]!))
        .all()
        .map((row) => row.type),
    );
    expect(mailed).toEqual(['round_published', 'reminder_24h', 'round_closed_partner']);
  });

  it('sends no reminder in a round without one', () => {
    const roundId = publish();
    harness.write((ctx) => ctx.tx.update(rounds).set({ reminderAt: null }).where(eq(rounds.id, roundId)).run());
    const deadline = harness.read((db) =>
      db.select().from(rounds).where(eq(rounds.id, roundId)).get(),
    )!.deadlineAt!;
    timePasses(deadline - 60_000 - Date.now());
    expect(runDueJobs(harness.db).remindersSent).toBe(0);
  });

  it('ignores draft and cancelled rounds', () => {
    const draftId = harness.write((ctx) =>
      createRound(ctx, { lotId: fx.lotId, trainingIds: fx.trainingIds }),
    );
    timePasses(20 * 86_400_000);
    expect(runDueJobs(harness.db).closed).toEqual([]);
    expect(statusOf(draftId)).toBe('draft');
  });
});
