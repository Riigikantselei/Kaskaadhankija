/**
 * `/partner/ettevote` — which company to act for [L-08].
 *
 * One address may represent several companies (one person, two firms). The
 * sign-in lands here when it does, and the partner menu links here to switch;
 * the session moves to the chosen company without a new code.
 */

import { getDb } from '@/db';
import { requirePartner } from '@/server/auth/actor';
import { activeCompaniesForEmail } from '@/server/auth/codes';
import { switchCompanyAction } from '@/server/actions/auth';

export const dynamic = 'force-dynamic';

export default async function ChooseCompanyPage() {
  const actor = await requirePartner();
  const companies = actor.representativeId ? activeCompaniesForEmail(getDb(), actor.contactEmail) : [];

  return (
    <div className="max-w-[640px] space-y-4">
      <div>
        <h1>Vali ettevõte</h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Teie aadress {actor.contactEmail} on mitme ettevõtte esindaja. Voorud, kinnitused ja teated
          on iga ettevõtte kohta eraldi — valige, kelle nimel praegu tegutsete. Vahetada saab igal ajal
          menüüst „Vaheta ettevõtet“, uut koodi selleks vaja ei ole.
        </p>
      </div>

      {companies.length === 0 ? (
        <p className="kh-card p-4 text-[var(--color-muted)]">
          Ettevõtte valik on isiklik ja kehtib ainult sisse logitud esindajale.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="company-choices">
          {companies.map((company) => {
            const current = company.representativeId === actor.representativeId;
            return (
              <li key={company.representativeId} className="kh-card flex flex-wrap items-center gap-3 p-3">
                <span className="font-semibold">{company.partnerName}</span>
                <form action={switchCompanyAction} className="ml-auto">
                  <input type="hidden" name="representativeId" value={company.representativeId} />
                  <button
                    type="submit"
                    className={current ? 'kh-btn' : 'kh-btn kh-btn-primary'}
                    data-testid="choose-company"
                  >
                    {current ? 'Jätka selle ettevõttena' : 'Tegutse selle ettevõttena'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
