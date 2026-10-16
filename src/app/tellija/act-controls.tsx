'use client';

/**
 * [E-11] The buyer's side of a workshop's acceptance act, in the trainings
 * list: who has ticked what, „Vastu võetud“, a reasoned refusal, and the PDF
 * once both halves are ticked.
 */

import { ActionForm, Disclosure } from '@/components/action-form';
import { markActByBuyerAction, rejectActAction } from '@/server/actions/rounds-buyer';

export interface ActView {
  trainingId: string;
  code: string;
  completed: boolean;
  /** the workshop day has come — before it the act is closed */
  due: boolean;
  dueText: string;
  partnerText: string | null;
  buyerText: string | null;
  rejectReason: string;
}

export function BuyerActControls({ act, canWrite }: { act: ActView; canWrite: boolean }) {
  if (act.completed) {
    return (
      <div className="text-[13px]">
        <span style={{ color: 'var(--color-success)' }}>✓ Akt kinnitatud</span>{' '}
        <a href={`/tellija/koolitused/${act.trainingId}/akt`} className="text-[var(--color-brand)]">
          PDF
        </a>
      </div>
    );
  }
  if (!act.due) {
    return <span className="text-[12px] text-[var(--color-muted)]">Akt avaneb {act.dueText}</span>;
  }
  return (
    <div className="min-w-[14rem] space-y-1 text-[12.5px]" data-testid="buyer-act">
      <div>Töövõtja: {act.partnerText ? <span style={{ color: 'var(--color-success)' }}>✓ {act.partnerText}</span> : 'ootab'}</div>
      <div>Tellija: {act.buyerText ? <span style={{ color: 'var(--color-success)' }}>✓ {act.buyerText}</span> : 'ootab'}</div>
      {act.rejectReason && (
        <div style={{ color: 'var(--color-danger)' }}>Tagasi lükatud: {act.rejectReason}</div>
      )}
      {canWrite && !act.buyerText && (
        <ActionForm
          action={markActByBuyerAction}
          submitLabel="Vastu võetud"
          variant="success"
          confirm={`Kinnitada koolituse ${act.code} aktis: „Töövõtja on töö üle andnud ja tellija vastu võtnud.“?`}
          hidden={{ trainingId: act.trainingId }}
          testId="act-accept"
        />
      )}
      {canWrite && act.partnerText && (
        <Disclosure summary="Ei võta vastu" tone="danger">
          <ActionForm
            action={rejectActAction}
            submitLabel="Lükka akt tagasi"
            variant="danger"
            hidden={{ trainingId: act.trainingId }}
            className="space-y-2"
          >
            <textarea
              name="reason"
              required
              rows={2}
              maxLength={400}
              placeholder="Põhjus partnerile — nt „Osalejate nimekiri on esitamata“"
              className="kh-input"
            />
          </ActionForm>
        </Disclosure>
      )}
    </div>
  );
}
