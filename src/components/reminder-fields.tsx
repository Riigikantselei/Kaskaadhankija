'use client';

/**
 * [D-05] When the round's one reminder goes out: whole hours before the
 * deadline, or a Tallinn time of day. Used by the lot settings (the default)
 * and the publish form (this round's choice); the fields are read on the server
 * by `reminderRuleFromFields`.
 */

import { useState } from 'react';
import { MAX_REMINDER_HOURS_BEFORE, type ReminderRule } from '@/domain/reminder';

export function ReminderFields({ initial, hint }: { initial: ReminderRule; hint?: string }) {
  const [mode, setMode] = useState(initial.mode);
  return (
    <fieldset className="block" data-testid="reminder-fields">
      <legend className="text-[12.5px] font-semibold">Meeldetuletus partneritele</legend>
      <div className="mt-1 space-y-2 text-[13.5px]">
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="radio"
            name="reminderMode"
            value="hours_before"
            checked={mode === 'hours_before'}
            onChange={() => setMode('hours_before')}
          />
          <input
            type="number"
            name="reminderHoursBefore"
            min={1}
            max={MAX_REMINDER_HOURS_BEFORE}
            defaultValue={initial.hoursBefore}
            disabled={mode !== 'hours_before'}
            className="kh-input w-20"
            aria-label="Tundi enne tähtaega"
          />
          <span>tundi enne tähtaega</span>
        </label>
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="radio"
            name="reminderMode"
            value="local_time"
            checked={mode === 'local_time'}
            onChange={() => setMode('local_time')}
          />
          <span>kell</span>
          <input
            type="time"
            name="reminderLocalTime"
            defaultValue={initial.localTime}
            disabled={mode !== 'local_time'}
            className="kh-input w-32"
            aria-label="Meeldetuletuse kellaaeg"
          />
          <span>(viimane selline aeg enne tähtaega)</span>
        </label>
      </div>
      <span className="mt-1 block text-[12px] text-[var(--color-muted)]">
        {hint ??
          'Voor saadab partnerile kolm kirja: pakkumise, selle meeldetuletuse ja tulemuse tähtajal. Meeldetuletus peab jääma vähemalt kaks tundi pärast avaldamist.'}
      </span>
    </fieldset>
  );
}
