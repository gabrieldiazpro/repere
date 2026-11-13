import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate, PROVIDER_LABEL } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { BAND_META, BAND_ORDER, copilotHref, mapPoints, mapQuota, summarize } from '@/components/app/metiers/logic';
import { MapRelaunch } from '@/components/app/metiers/MapRelaunch';
import { MapView } from '@/components/app/metiers/MapView';
import { KeyFigures, LOCAL_TABS, LoadError, NextSteps, ParcoursGate, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { buildLocalDemo, localTier, MAP_CAPS, MAP_DISCLAIMER, MAP_RUNS, planMap, type VisibilityMap } from '@/lib/local';
import { latestMap, mapsThisMonth } from '@/lib/local/repo';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Carte par quartier' };
export const dynamic = 'force-dynamic';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

export default async function CartePage() {
  const ctx = await loadMetier('local');
  const header = (
    <PageHeader
      title="Carte par quartier"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="local" demo={ctx.demo} /></>;

  const b = ctx.business;
  const tier = localTier(b);
  const caps = MAP_CAPS[tier];
  const plan = planMap({ city: b.city, district: b.district, trade: b.trade }, tier, { engines: ctx.ent.engines });
  let map: VisibilityMap | null = null;
  let used = 0;
  let failed = false;
  try {
    if (ctx.demo) map = (await buildLocalDemo(b.id))?.map ?? null;
    else [map, used] = await Promise.all([latestMap(b.id), mapsThisMonth(b.id)]);
  } catch (e) {
    console.error('[app/local/carte]', (e as Error).message);
    failed = true;
  }
  const quota = mapQuota(caps, used, ctx.demo);
  const s = map ? summarize(map.zones) : null;

  return (
    <>
      {header}
      <div className="rp-page" data-visite="local-carte">
        <SubNav tabs={LOCAL_TABS} current="/app/local/carte" label="Parcours local" />

        <aside className="flex flex-col items-start gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-[14px] sm:flex-row sm:gap-3 text-[var(--ink)]" aria-labelledby="simu-h">
          <span className="rp-chip rp-chip-warning h-fit flex-none">Simulation</span>
          <div>
            <p id="simu-h" className="font-semibold">
              Ce que cette carte mesure, et ce qu’elle ne mesure pas
            </p>
            <p className="mt-1">{MAP_DISCLAIMER}</p>
          </div>
        </aside>

        {failed ? (
          <LoadError what="la carte" />
        ) : !map || !s ? (
          <Empty title="Aucune carte pour l’instant" action={<MapRelaunch businessId={b.id} canRun={quota.canRun} reason={quota.reason} calls={plan.budget.calls} upgrade={tier === 'decouverte'} />}>
            Lancez une première carte : {plan.zones.length} zones autour de {b.district || b.city}, {plan.questions.length} question{plan.questions.length > 1 ? 's' : ''}, {plan.providers.map((p) => PROVIDER_LABEL[p]).join(', ')}.
          </Empty>
        ) : (
          <>
            <Verdict
              tone={s.worstZone && s.worstZone.mentionRate !== null && s.worstZone.mentionRate < 0.3 ? 'warn' : s.covered / Math.max(1, s.zones) >= 0.6 ? 'good' : 'bad'}
              title={
                s.worstZone && s.worstZone.mentionRate !== null && s.worstZone.mentionRate < 0.3
                  ? `${s.worstZone.label} est votre point faible : cité dans ${pct(s.worstZone.mentionRate)} des réponses`
                  : `Les IA vous citent dans ${s.covered} zones sur ${s.zones}`
              }
              lead={`Cité dans ${s.covered} zones sur ${s.zones} ; la même question est posée pour chaque zone autour de ${[b.city, b.district].filter(Boolean).join(' ')}.`}
              figure={{ value: s.covered, suffix: `/${s.zones}`, label: 'zones où vous êtes cité' }}
              action={s.worstZone ? { href: copilotHref(`Carte par quartier : je suis faible en ${s.worstZone.label} (${pct(s.worstZone.mentionRate)}). Que faire pour y être cité ?`), label: `Comment progresser à ${s.worstZone.label}`, icon: 'spark' } : undefined}
              details={<p>{MAP_DISCLAIMER}</p>}
              detailsLabel="Ce que cette carte mesure"
            />
            <KeyFigures
              items={[
                { k: 'Zones où vous êtes cité', v: `${s.covered}/${s.zones}` },
                { k: 'Votre zone', v: pct(map.zones.find((z) => z.home)?.mentionRate ?? null), extra: map.zones.find((z) => z.home)?.label },
                { k: 'Zone la plus faible', v: s.worstZone ? pct(s.worstZone.mentionRate) : '—', extra: s.worstZone?.label },
                { k: 'Concurrent le plus présent', v: s.rival ? s.rival.name : '—', extra: s.rival ? `domine ${s.rival.zones} zone${s.rival.zones > 1 ? 's' : ''}` : undefined },
              ]}
            />

            <Panel id="carte-h" title={map.label} aside={fmtDate(map.createdAt, { day: 'numeric', month: 'long' })}>
              <MapView points={mapPoints(map)} businessName={b.name} />
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[var(--muted)]" aria-label="Légende">
                {BAND_ORDER.map((band) => (
                  <li key={band} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_META[band].color }} aria-hidden="true" />
                    {map!.svg.legend.find((l) => l.band === band)?.label ?? BAND_META[band].label}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <SourceNote
                  label={map.demo ? 'Démo' : map.providers.map((p) => PROVIDER_LABEL[p]).join(', ')}
                  detail={map.demo ? 'Carte simulée de façon déterministe, sans appel aux IA.' : `${map.questions.length} question${map.questions.length > 1 ? 's' : ''} × ${map.zones.length} zones × ${MAP_RUNS} passages.`}
                  demo={map.demo}
                />
              </div>
            </Panel>

            <Panel id="zones-h" title="Zone par zone" pad={false}>
              <div className="rp-scroll px-2 pb-2 lg:px-3">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th scope="col">Zone</th>
                      <th scope="col" className="num">Taux de mention</th>
                      <th scope="col" className="num">Rang moyen</th>
                      <th scope="col">Concurrent dominant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...map.zones].sort((x, y) => (y.mentionRate ?? -1) - (x.mentionRate ?? -1)).map((z) => (
                      <tr key={z.zoneId}>
                        <td className="font-medium">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: BAND_META[z.band].color }} aria-hidden="true" />
                          {z.label}
                          {z.home && <span className="rp-chip rp-chip-primary ml-2">votre zone</span>}
                        </td>
                        <td className="num">{pct(z.mentionRate)}</td>
                        <td className="num">{z.avgRank === null ? '—' : z.avgRank.toLocaleString('fr-FR')}</td>
                        <td className="text-[13px]">{z.dominantCompetitor ? `${z.dominantCompetitor.name} (${z.dominantCompetitor.mentions})` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4 lg:px-5">
                <p className="mb-3 text-[13px] text-[var(--muted)]">
                  Questions posées : {map.questions.map((q) => `« ${q.template.replace('{zone}', '[zone]')} »`).join(' ; ')}
                </p>
                <NextSteps
                  steps={[
                    ...(s.worstZone ? [{ href: copilotHref(`Carte par quartier : je suis faible en ${s.worstZone.label} (${pct(s.worstZone.mentionRate)}). Que faire pour y être cité ?`), label: `Comment progresser en ${s.worstZone.label}` }] : []),
                    { href: '/app/local/fiche-google', label: 'Indiquer vos zones d’intervention sur la fiche' },
                    { href: '/app/taches', label: 'Voir les tâches' },
                  ]}
                />
              </div>
            </Panel>
          </>
        )}

        <Panel id="budget-h" title="Relance et budget" aside={`Offre ${ctx.tierName}`}>
          <dl className="grid gap-3 text-[14px] sm:grid-cols-4">
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Cartes par mois</dt>
              <dd className="rp-num font-semibold">{ctx.demo ? 'démo' : `${used} utilisée${used > 1 ? 's' : ''} sur ${caps.perMonth}`}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Zones</dt>
              <dd className="rp-num font-semibold">jusqu’à {caps.zones}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Questions × IA</dt>
              <dd className="rp-num font-semibold">
                {caps.questions} × {caps.providers}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Appels par carte</dt>
              <dd className="rp-num font-semibold">
                {plan.budget.calls} (plafond {plan.budget.maxCalls})
              </dd>
            </div>
          </dl>
          {map && (
            <div className="mt-4">
              <MapRelaunch businessId={b.id} canRun={quota.canRun} reason={quota.reason} calls={plan.budget.calls} upgrade={tier === 'decouverte'} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
