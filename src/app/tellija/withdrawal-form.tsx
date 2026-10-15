'use client';

/**
 * [E-07] „Partner loobus“ on a training allocated in a confirmed round.
 *
 * Behind a disclosure, because it is not undoable: the training goes back to
 * the round's leftover, off the partner's name, and the partner gets a formal
 * receipt. The note is required; the day of the partner's notice is optional.
 */

import { ActionForm, Disclosure } from '@/components/action-form';
import { recordAllocatedWithdrawalAction } from '@/server/actions/rounds-buyer';

export function WithdrawalForm({
  trainingId,
  trainingCode,
  partnerName,
  roundId,
}: {
  trainingId: string;
  trainingCode: string;
  partnerName: string;
  roundId?: string;
}) {
  return (
    <Disclosure summary="Partner loobus" tone="danger">
      <ActionForm
        action={recordAllocatedWithdrawalAction}
        submitLabel="Registreeri loobumine"
        variant="danger"
        confirm={`Registreerida, et ${partnerName} loobus koolitusest ${trainingCode}? Koolitus läheb jääki ja partner saab kviitungi. Seda ei saa tagasi võtta.`}
        hidden={{ trainingId, roundId }}
        className="space-y-2"
        testId="record-withdrawal"
      >
        <p className="text-[12px] text-[var(--color-muted)]">
          Koolitus läheb jääki ja selle saab sama koodiga uude vooru panna. Vooru protokoll jääb
          muutmata; loobumine kirjutatakse auditijälge lepingulise järelmenetluse märkega.
        </p>
        <textarea
          name="note"
          required
          rows={2}
          maxLength={400}
          placeholder="Märkus — nt „Partner teatas e-kirjaga, et ei saa koolitust läbi viia“"
          className="kh-input"
        />
        <label className="block">
          <span className="text-[12.5px] font-semibold">Teate kuupäev (vabatahtlik)</span>
          <input type="date" name="noticeDate" className="kh-input mt-1" />
        </label>
      </ActionForm>
    </Disclosure>
  );
}
