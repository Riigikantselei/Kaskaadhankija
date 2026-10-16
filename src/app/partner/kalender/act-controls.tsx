'use client';

/**
 * [E-11] The partner's side of a workshop's acceptance act, in „Minu
 * kalender“: „Töö üle antud“, the buyer's half, a refusal's reason, and the
 * PDF once both halves are ticked. Any representative of the company may tick.
 */

import { ActionForm } from '@/components/action-form';
import { markActByPartnerAction } from '@/server/actions/rounds-partner';

export interface PartnerActView {
  trainingId: string;
  code: string;
  completed: boolean;
  due: boolean;
  dueText: string;
  partnerText: string | null;
  buyerText: string | null;
  rejectReason: string;
}

export function PartnerActControls({ act }: { act: PartnerActView }) {
  if (act.completed) {
    return (
      <span className="text-[13px]">
        <span style={{ color: 'var(--color-success)' }}>✓ Akt kinnitatud</span>{' '}
        <a href={`/partner/kalender/akt/${act.trainingId}`} className="text-[var(--color-brand)]">
          Akt (PDF)
        </a>
      </span>
    );
  }
  if (!act.due) {
    return <span className="text-[12px] text-[var(--color-muted)]">Toimumise akt avaneb {act.dueText}</span>;
  }
  return (
    <div className="w-full space-y-1 rounded-[8px] border border-[var(--color-border)] p-2 text-[12.5px]" data-testid="partner-act">
      <div className="font-semibold">Töötoa toimumise akt</div>
      <div>Töövõtja: {act.partnerText ? <span style={{ color: 'var(--color-success)' }}>✓ töö üle antud {act.partnerText}</span> : 'märkimata'}</div>
      <div>Tellija: {act.buyerText ? <span style={{ color: 'var(--color-success)' }}>✓ vastu võetud {act.buyerText}</span> : 'ootab'}</div>
      {act.rejectReason && (
        <div style={{ color: 'var(--color-danger)' }}>Tellija ei võtnud tööd vastu: {act.rejectReason}</div>
      )}
      {!act.partnerText && (
        <ActionForm
          action={markActByPartnerAction}
          submitLabel="Töö üle antud"
          variant="success"
          confirm={`Kinnitada, et koolituse ${act.code} töö on üle antud? Akt jõustub, kui ka tellija on vastuvõtu märkinud.`}
          hidden={{ trainingId: act.trainingId }}
          testId="act-handover"
        />
      )}
    </div>
  );
}
