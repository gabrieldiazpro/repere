import Link from 'next/link';
import '@/components/app/agence/agence.css';
import { PageHeader } from '@/components/app/PageHeader';
import { Verdict, V4Empty } from '@/components/app/v4/Verdict';
import { ValidationList, type ProposalView } from '@/components/app/agence/ValidationList';
import { loadWorkspace } from '@/components/app/workspace';
import { loadEntitlements, loadRole } from '@/components/app/shell/server';
import { getSession } from '@/lib/auth';
import { canApprove, isClientApprover } from '@/lib/agency/clients';
import { listChangeSets } from '@/lib/publish';
import { loadAgent } from '@/components/app/agent/server';
import { summarizeChange } from '@/lib/publish/model';

export const metadata = { title: 'À valider' };

export default async function ValidationPage() {
  const ws = await loadWorkspace();
  const [role, ent, session] = await Promise.all([loadRole(), loadEntitlements(), ws.demo ? null : getSession()]);
  const approver = !ws.demo && (await isClientApprover(ws.business.id, session?.email).catch(() => false));
  const canDecide = ws.demo || canApprove(role, { clientApprover: approver, clientPortal: ent.agency.clientPortal });
  // Démo : les mêmes propositions que l'écran Agent (cohérentes avec le compte), pas les exemples génériques du module.
  const all = ws.demo ? (await loadAgent()).changeSets : await listChangeSets(ws.business.id).catch(() => []);
  const open = all.filter((c) => c.status === 'proposed');
  const decided = all.filter((c) => c.validation || c.rejection).slice(0, 8);
  const items: ProposalView[] = open.map((c) => ({
    id: c.id,
    title: c.title,
    site: c.site,
    risk: c.risk,
    proposedAt: c.proposedAt ?? null,
    changes: c.changes.filter((x) => x.status === 'pending').map((x) => {
      const s = summarizeChange(x, 600);
      return { id: s.id, kind: s.kind, url: s.target.url ?? '', before: s.before, after: s.after, rationale: s.rationale };
    }),
  }));
  const n = items.length;
  return (
    <>
      <PageHeader title="À valider" meta={<>{ws.business.name}{ws.demo ? ' · démo' : ''}</>} />
      <div className="rp-page flex flex-col gap-4">
        <Verdict
          tone={n ? 'brand' : 'good'}
          title={n ? `${n} correction${n > 1 ? 's attendent' : ' attend'} votre accord` : 'Rien à valider pour l’instant'}
          lead={
            canDecide
              ? 'Comparez l’existant et la proposition, puis validez ou refusez. Rien n’est modifié sur le site sans cet accord ; une fois validée, la correction est appliquée par votre agence et peut être annulée.'
              : 'Vous pouvez consulter ces propositions. La validation est réservée à la personne désignée par l’agence et aux administrateurs.'
          }
        />
        {n ? (
          <ValidationList businessId={ws.business.id} items={items} canDecide={canDecide} demo={ws.demo} />
        ) : (
          <V4Empty title="Aucune proposition en attente">
            Les nouvelles propositions de l’agent apparaîtront ici. <Link href="/app/agent" className="underline">Voir le journal de l’agent</Link>.
          </V4Empty>
        )}
        {decided.length > 0 && (
          <section aria-labelledby="dec-h" className="rp-panel p-5">
            <h2 id="dec-h" className="rp-display text-[17px]">
              Déjà décidées
            </h2>
            <ul className="mt-2 text-[14px]">
              {decided.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 border-t border-[var(--hair)] py-2 first:border-t-0">
                  <span>{c.title}</span>
                  <span className="text-[var(--muted)]">
                    {c.rejection ? 'Refusée' : 'Validée'}
                    {(c.validation?.by.role ?? c.rejection?.by.role) === 'client' ? ' par le client' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
