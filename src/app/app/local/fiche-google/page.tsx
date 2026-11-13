import { Verdict } from '@/components/app/v4/Verdict';
import Link from 'next/link';
import { ScoreRing } from '@/components/app/Charts';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { GbpForm } from '@/components/app/metiers/GbpForm';
import { copilotHref, GBP_SOURCE_LABEL, groupCriteria, taskHref } from '@/components/app/metiers/logic';
import { LOCAL_TABS, LoadError, Meter, NextSteps, ParcoursGate, SourceNote, StatusChip, SubNav, Trend } from '@/components/app/metiers/ui';
import { buildLocalDemo, DEMO_MANUAL, GBP_GROUP_LABEL, gbpPriorities, placesEnabled, type GbpAudit, type ManualGbpInput } from '@/lib/local';
import { gbpHistory, getLocalSettings, latestGbpAudit } from '@/lib/local/repo';

export const metadata = { title: 'Fiche Google' };
export const dynamic = 'force-dynamic';

interface Data {
  audit: GbpAudit | null;
  history: { createdAt: string; score: number }[];
  manual: ManualGbpInput | null;
  placeId: string | null;
}

async function load(id: string, demo: boolean): Promise<Data | null> {
  try {
    if (demo) {
      const d = await buildLocalDemo(id);
      return { audit: d?.gbp ?? null, history: [], manual: DEMO_MANUAL, placeId: null };
    }
    const [audit, history, settings] = await Promise.all([latestGbpAudit(id), gbpHistory(id), getLocalSettings(id)]);
    return { audit, history, manual: settings.manual ?? null, placeId: settings.placeId ?? null };
  } catch (e) {
    console.error('[app/local/fiche-google]', (e as Error).message);
    return null;
  }
}

export default async function FicheGooglePage() {
  const ctx = await loadMetier('local');
  const header = (
    <PageHeader
      title="Fiche Google"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="local" demo={ctx.demo} /></>;

  const id = ctx.business.id;
  const data = await load(id, ctx.demo);
  const places = placesEnabled();

  return (
    <>
      {header}
      <div className="rp-page" data-visite="local-fiche">
        <SubNav tabs={LOCAL_TABS} current="/app/local/fiche-google" label="Parcours local" />
        {!data ? (
          <LoadError what="l’audit de votre fiche" />
        ) : !data.audit ? (
          <Empty title="Votre fiche n’a pas encore été auditée">Remplissez le formulaire ci-dessous en regardant votre fiche sur Google Maps : le score se calcule tout de suite.</Empty>
        ) : (
          <>
            <FicheVerdict audit={data.audit} />
            <AuditView audit={data.audit} history={data.history} demo={ctx.demo} name={ctx.ws.business.name} />
          </>
        )}

        {data && (
          <Panel id="saisie-h" title={data.audit ? 'Mettre à jour la saisie guidée' : 'Saisie guidée de votre fiche'} aside={ctx.demo ? 'démo' : undefined}>
            <GbpForm businessId={id} demo={ctx.demo} initial={data.manual} initialPlaceId={data.placeId} placesEnabled={places && !ctx.demo} />
          </Panel>
        )}
      </div>
    </>
  );
}

function FicheVerdict({ audit }: { audit: GbpAudit }) {
  const priorities = gbpPriorities(audit, 3);
  const lost = priorities.reduce((n, c) => n + (c.max - c.points), 0);
  return (
    <Verdict
      tone={priorities.length === 0 ? 'good' : audit.score < 50 ? 'bad' : 'warn'}
      title={
        priorities.length === 0
          ? 'Votre fiche Google est complète'
          : `${priorities.length === 1 ? 'Une correction' : `${priorities.length} corrections`} sur votre fiche rapporteraient jusqu’à ${lost} points`
      }
      lead={`Score de la fiche : ${audit.score}/100. C’est la première source que les IA lisent pour un commerce de proximité.`}
      action={priorities.length ? { href: '#fiche-score', label: 'Voir les corrections', icon: 'check' } : undefined}
    />
  );
}

function AuditView({ audit, history, demo, name }: { audit: GbpAudit; history: { createdAt: string; score: number }[]; demo: boolean; name: string }) {
  const groups = groupCriteria(audit, GBP_GROUP_LABEL);
  const priorities = gbpPriorities(audit, 3);
  const src = GBP_SOURCE_LABEL[audit.source];
  const lost = priorities.reduce((n, c) => n + (c.max - c.points), 0);
  return (
    <>
      <section id="fiche-score" className="rp-panel scroll-mt-24" aria-labelledby="score-h" data-visite="local">
        <div className="rp-panel-body grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col items-center gap-2 lg:pr-4">
            <h2 id="score-h" className="sr-only">
              Score de la fiche
            </h2>
            <ScoreRing score={audit.score} size={148} />
            <p className="text-center text-[12px] text-[var(--muted)]">
              Grille lue à {audit.coverage}&nbsp;%
              <br />
              {fmtDate(audit.createdAt, { day: 'numeric', month: 'long' })}
            </p>
            {history.length > 1 && (
              <div className="flex flex-col items-center">
                <Trend values={history.map((h) => h.score)} label={`Évolution du score : ${history.map((h) => h.score).join(', ')}`} />
                <span className="text-[11px] text-[var(--muted)]">{history.length} mesures</span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <SourceNote label={src.label} detail={src.detail} demo={demo || audit.source === 'demo'} />
            {priorities.length ? (
              <div>
                <p className="text-[15px] font-semibold">
                  Par ordre d’impact ({lost} points en jeu)
                </p>
                <ol className="mt-3 flex flex-col gap-3">
                  {priorities.map((c, i) => (
                    <li key={c.id} className="flex gap-3">
                      <span className="rp-num mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--primary-bg)] text-[12px] font-semibold text-[var(--primary)]" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px]">
                          <strong>{c.label}</strong> <span className="text-[var(--muted)]">· {c.max - c.points} pts</span>
                        </p>
                        <p className="text-[14px] text-[var(--muted)]">{c.fix}</p>
                        {c.task && (
                          <Link href={taskHref(c.task)} className="rp-link text-[13px]">
                            Faire la tâche
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="rp-display text-[19px]">Rien d’urgent sur les critères évalués. Gardez le rythme : un post et une photo par mois.</p>
            )}
            <NextSteps
              steps={[
                { href: '/app/taches', label: 'Voir toutes les tâches', primary: true },
                { href: copilotHref(`Fiche Google de ${name} : score ${audit.score}/100. Priorités : ${priorities.map((p) => p.label).join(', ') || 'aucune'}.`), label: 'Demander au copilote' },
                { href: '/app/local/avis', label: 'Obtenir plus d’avis' },
              ]}
            />
          </div>
        </div>
      </section>

      <Panel id="criteres-h" title="Critère par critère" aside={`${audit.criteria.filter((c) => c.status === 'fail' || c.status === 'warn').length} à traiter`} pad={false}>
        <div className="divide-y divide-[var(--hair)]">
          {groups.map((g) => (
            <details key={g.group} className="group px-4 py-3 lg:px-5" open={g.todo > 0}>
              <summary className="flex cursor-pointer list-none items-center gap-3 py-1">
                <span className="min-w-0 flex-1 font-semibold">{g.label}</span>
                <span className="rp-num w-16 text-right text-[13px] text-[var(--muted)]">
                  {g.points}/{g.max}
                </span>
                <span className="hidden w-32 sm:block">
                  <Meter value={g.points} max={g.max} height={6} />
                </span>
                <span className="text-[var(--muted)] transition-transform group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
              </summary>
              <ul className="mt-2 flex flex-col gap-3 pb-1">
                {g.criteria.map((c) => (
                  <li key={c.id} className="grid gap-1 rounded-lg border border-[var(--hair)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.label}</span>
                        <StatusChip status={c.status} />
                      </p>
                      <p className="mt-1 text-[14px]">{c.detail}</p>
                      {c.status !== 'ok' && <p className="mt-1 text-[14px] text-[var(--muted)]">Correctif : {c.fix}</p>}
                    </div>
                    <div className="flex items-start gap-2 sm:flex-col sm:items-end">
                      <span className="rp-num text-[13px] text-[var(--muted)]">
                        {c.status === 'unknown' ? 'non évalué' : `${c.points}/${c.max} pts`}
                      </span>
                      {c.task && c.status !== 'ok' && (
                        <Link href={taskHref(c.task)} className="rp-btn rp-btn-sm">
                          Faire la tâche
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-[var(--hair)] px-4 py-3 text-[12px] text-[var(--muted)] lg:px-5">
          {audit.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      </Panel>
    </>
  );
}
