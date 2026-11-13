import Link from 'next/link';
import { adaptTasks } from '@/components/app/adapters';
import { ActionCenter } from '@/components/app/action/ActionCenter';
import { copilotHref, loadActionContext } from '@/components/app/action/context';
import { proofFor, type ActionProof } from '@/components/app/action/model';
import { Icon } from '@/components/app/icons';
import { PageHeader } from '@/components/app/PageHeader';
import { V4Empty } from '@/components/app/v4/Verdict';
import { fmtDate } from '@/components/app/tokens';
import { auditDate } from '@/components/app/workspace';
import { listActionImpacts, type ActionImpact } from '@/lib/measure';

export const metadata = { title: 'Centre d’actions' };

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams;
  const { ws, ent } = await loadActionContext();
  const tasks = await adaptTasks(ws.business.id, ws.fb);
  let impacts: ActionImpact[] = [];
  let impactError = false;
  try {
    impacts = await listActionImpacts(ws.business.id);
  } catch {
    impactError = true;
  }
  const used = new Set<string>();
  const proofs: Record<string, ActionProof> = {};
  for (const t of tasks) proofs[t.id] = proofFor(t, ws.latest, used);

  return (
    <>
      <PageHeader
        title="Centre d’actions"
        meta={
          <>
            {/* Le compteur « faites » vit dans la liste (client), qui se met à jour au clic sur « C'est fait ». */}
            {`${tasks.length} actions`}
            {ws.latest ? ` · d’après la mesure du ${fmtDate(auditDate(ws.latest), { day: 'numeric', month: 'long' })}` : ''}
            {ws.demo ? ' · démo' : ''}
          </>
        }
        actions={
          <Link href={copilotHref('actions', 'Quelle action faire en premier cette semaine ?')} className="rp-btn rp-btn-sm">
            <Icon name="spark" size={15} /> Demander au copilote
          </Link>
        }
      />
      <div className="rp-page">
        {impactError && (
          <p role="status" className="mb-3 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
            Le suivi avant / après n’a pas pu être chargé. Les actions restent utilisables ; rechargez la page pour réessayer.
          </p>
        )}
        {tasks.length ? (
          <ActionCenter initial={tasks} proofs={proofs} impacts={impacts} businessId={ws.business.id} demo={ws.demo} ent={ent} initialSelected={sp.t} />
        ) : (
          <V4Empty title="Aucune action pour l’instant" icon="list" action={<Link href="/app" className="rp-btn rp-btn-primary">Retour à l’accueil</Link>}>
            Vos premières actions arrivent après la première mesure, avec leurs livrables prêts à copier.
          </V4Empty>
        )}
      </div>
    </>
  );
}
