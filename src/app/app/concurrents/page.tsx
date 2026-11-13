import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { Delta } from '@/components/app/Charts';
import type { Series } from '@/components/app/ChartsClient';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate, fmtMonth, ordinal, pct, PROVIDER_LABEL, PROVIDER_ORDER } from '@/components/app/tokens';
import { auditDate, ranking } from '@/components/app/workspace';
import { auditStats, newEntrants, rankMove } from '@/lib/digest/stats';
import { explainChange } from '@/lib/engine';
import { heat, marginText, proportionMargin } from '@/components/app/mesure/derive';
import { loadAnnotations, loadMesure } from '@/components/app/mesure/server';
import { crossLink, type RawSearch } from '@/components/app/mesure/params';
import { AskCopilot, DeltaPts, ExplainChange, ExportLink, Kpi, MesureBar, PeriodNote } from '@/components/app/mesure/ui';
import { AnnotatedChart, type ChartNote } from '@/components/app/mesure/AnnotatedChart';
import { Verdict, V4Empty } from '@/components/app/v4/Verdict';
import { FillBar, InView } from '@/components/app/v4/motion';

export const metadata = { title: 'Concurrents' };

// Teintes de séries : variables de l'app (claires et sombres), toujours doublées d'un libellé.
const COMP_COLORS = ['var(--success)', 'var(--warning)', 'var(--danger)', 'var(--muted)'];

export default async function ConcurrentsPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, ent, period, params, sp } = m;
  const { business } = ws;
  const a = period.current;
  if (!a) {
    return (
      <>
        <PageHeader title="Concurrents" />
        <div className="rp-page">
          <V4Empty title="Pas encore de classement" icon="podium" action={<Link href="/app/questions" className="rp-btn rp-btn-primary">Voir mes questions suivies</Link>}>
            Il apparaît après votre première mesure : vos concurrents sont ceux que les IA citent sur vos questions.
          </V4Empty>
        </div>
      </>
    );
  }
  const ref = period.reference;
  const stats = auditStats(a);
  const refStats = ref ? auditStats(ref) : null;
  const rows = ranking(a);
  const refRows = ref ? ranking(ref) : [];
  const me = rows.find((r) => r.isMe)!;
  const move = rankMove(ws.audits, 'month');
  const entrants = new Set(newEntrants(ws.audits, 2));
  const mg = a.margins;
  const ex = ref ? explainChange(ref, a) : null;

  // Matrice thème × IA du moteur
  const v = a.voice;
  const providers = PROVIDER_ORDER.filter((p) => (v?.providers ?? a.providersUsed).includes(p) && (!params.ia || p === params.ia));
  const refCell = (theme: string, p: string) => {
    const rv = ref?.voice;
    if (!rv) return null;
    const i = rv.themes.indexOf(theme);
    const j = rv.providers.indexOf(p as never);
    return i >= 0 && j >= 0 ? rv.cells[i]?.[j] ?? null : null;
  };

  // Évolution sur la période + repères
  const audits = period.audits;
  const leaders = rows.filter((r) => !r.isMe).slice(0, 4).map((r) => r.name);
  const series: Series[] = [
    { name: business.name, color: 'var(--primary)', emphasis: true, values: audits.map((x) => ranking(x).find((r) => r.isMe)?.share ?? 0) },
    ...leaders.map((n, i) => ({ name: n, color: COMP_COLORS[i % COMP_COLORS.length], values: audits.map((x) => ranking(x).find((r) => r.name === n)?.share ?? null) })),
  ];
  const notes: ChartNote[] = (await loadAnnotations(business.id, period.from, period.to))
    .filter((n) => n.series === 'all' || n.series === 'sov')
    .map((n) => ({ id: n.id, date: n.date, label: n.label, kind: n.kind }));

  // Pourquoi ils passent devant : seuls ceux qui passent VRAIMENT devant, comptés sur la même base que le classement.
  const gaps = (a.gaps ?? [])
    .map((g) => ({ ...g, mentions: rows.find((r) => r.name === g.competitor)?.mentions ?? g.mentions }))
    .filter((g) => g.mentions > me.mentions)
    .slice(0, 4);
  const top = (v?.topCompetitors ?? []).slice(0, 10);
  const ahead = rows.filter((r) => !r.isMe && r.share > me.share);
  const maxShare = Math.max(0.01, ...rows.map((r) => r.share));
  const verdictTitle =
    stats.rank === 1
      ? `Vous êtes le plus cité de vos ${stats.of} ${business.cohort}`
      : ahead.length === 1
        ? `${ahead[0].name} est le seul à passer devant vous`
        : ahead.length === 2
          ? `${ahead[0].name} et ${ahead[1].name} passent devant vous`
          : `${ahead.length} concurrents passent devant vous, ${ahead[0]?.name ?? ''} en tête`;

  return (
    <>
      <PageHeader
        title="Concurrents"
        meta={
          <>
            Mesure du {fmtDate(auditDate(a), { day: 'numeric', month: 'long' })} · {stats.methodLabel}
            {a.demo ? ' · démo' : ''}
          </>
        }
        dataDate={auditDate(a)}
        actions={<ExportLink ent={ent} businessId={business.id} kind="competitors" from={period.from} to={period.to} label="Exporter" />}
      />
      <div className="rp-page">
        <Verdict
          tone={stats.rank === 1 ? 'good' : stats.rank <= 3 ? 'warn' : 'bad'}
          title={verdictTitle}
          lead={`Part de voix ${pct(stats.shareOfVoice)} contre ${pct(rows[0]?.share ?? 0)} pour le premier. Mesure du ${fmtDate(auditDate(a), { day: 'numeric', month: 'long' })}.`}
          figure={{ value: stats.rank, suffix: stats.rank === 1 ? 'ᵉʳ' : 'ᵉ', label: `sur ${stats.of} ${business.cohort}` }}
          delta={move && move.places !== 0 ? <Delta value={move.places} label={` ${move.label}`} /> : undefined}
          action={gaps.length ? { href: '#why-h', label: `Voir pourquoi ${gaps[0].competitor} passe devant`, icon: 'eye' } : undefined}
          secondary={<AskCopilot context="concurrents" question={ahead[0] ? `Pourquoi ${ahead[0].name} passe devant moi ?` : undefined} />}
          details={
            <p>
              Vos concurrents sont ceux que les IA citent sur les mêmes questions que vous, pas une liste déclarée. {stats.methodLabel}. Chaque chiffre porte sa marge d’erreur : les IA ne répondent jamais deux fois exactement pareil.
            </p>
          }
        />
        <MesureBar path="/app/concurrents" sp={sp} params={params} providers={a.providersUsed} />
        <PeriodNote from={period.from} to={period.to} refDate={ref ? auditDate(ref) : null} limitedByPlan={period.limitedByPlan} historyMonths={ent.historyMonths} />

        <dl className="rp-panel rp-kpis">
          <Kpi
            label="Votre rang"
            value={ordinal(stats.rank)}
            sub={
              <>
                sur {stats.of} {business.cohort}
                {move && move.places !== 0 ? ` · ${move.label}` : ''}
              </>
            }
          />
          <Kpi
            label="Part de voix"
            value={pct(stats.shareOfVoice)}
            margin={marginText(mg?.shareOfVoice, 'rate')}
            delta={refStats ? <DeltaPts delta={(stats.shareOfVoice - refStats.shareOfVoice) * 100} margin={mg ? mg.shareOfVoice.margin * 100 : null} /> : undefined}
            sub="des citations, vous compris"
          />
          <Kpi
            label="Réponses qui vous citent"
            value={pct(stats.mentionRate)}
            margin={marginText(mg?.mentionRate, 'rate')}
            delta={ref ? <DeltaPts delta={(a.mentionRate - ref.mentionRate) * 100} margin={mg ? mg.mentionRate.margin * 100 : null} /> : undefined}
            sub={`${stats.citations} sur ${stats.answers} réponses`}
          />
          <Kpi
            label="Score de visibilité"
            value={`${Math.round(a.score)}/100`}
            margin={marginText(mg?.score, 'score')}
            delta={ref ? <DeltaPts delta={a.score - ref.score} margin={mg?.score.margin ?? null} unit="" /> : undefined}
          />
        </dl>

        <ExplainChange ex={ex} context="concurrents" />

        <section aria-labelledby="why-h" className="scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="why-h" className="rp-display text-[20px] lg:text-[22px]">
              Pourquoi ils passent devant
            </h2>
            <Link href={crossLink('/app/citations', sp, { absent: '1' })} className="rp-link text-[13px]">
              Pages où ils sont et pas vous
            </Link>
          </div>
          {gaps.length ? (
            <InView as="ul" className="v4-cascade grid gap-3 md:grid-cols-2 lg:gap-4">
              {gaps.map((g) => {
                const pos = rows.findIndex((r) => r.name === g.competitor) + 1;
                return (
                  <li key={g.competitor} className="rp-panel flex flex-col p-4 lg:p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[15px] font-semibold">
                        <span className="rp-num mr-1.5 text-[var(--muted)]">{ordinal(pos)}</span>
                        {g.competitor}
                      </h3>
                      <span className="rp-num text-[13px] text-[var(--muted)]">
                        {pct(rows.find((r) => r.name === g.competitor)?.share ?? g.share)} · {g.mentions} citations
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      {g.mentions - me.mentions} citation{g.mentions - me.mentions > 1 ? 's' : ''} de plus que vous ({g.mentions} contre {me.mentions}), sur les mêmes réponses.
                    </p>
                    <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                      {g.reasons
                        .filter((r) => !/^Cité (dans )?\d+ (fois|réponses?)/.test(r))
                        .map((r) => (
                          <li key={r} className="flex gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--primary)]" aria-hidden="true" />
                            {r}
                          </li>
                        ))}
                    </ul>
                    {g.presentOn.length > 0 && (
                      <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--hair)] pt-3 text-[12px] text-[var(--muted)]">
                        Cité sur, pas vous :
                        {g.presentOn.slice(0, 4).map((d) => (
                          <span key={d} className="rp-chip">
                            {d}
                          </span>
                        ))}
                        {g.presentOn.length > 4 && <span className="rp-chip">+{g.presentOn.length - 4}</span>}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                      <AskCopilot context="concurrents" question={`Pourquoi ${g.competitor} passe devant moi ?`} label="Demander au copilote" />
                      <Link href={crossLink('/app/citations', sp, { concurrent: g.competitor, absent: '1' })} className="rp-btn rp-btn-sm">
                        Ses pages
                      </Link>
                    </div>
                  </li>
                );
              })}
            </InView>
          ) : (
            <Empty title="Personne ne passe devant vous">Vous êtes le plus cité sur vos questions. Le suivi vous préviendra si cela change.</Empty>
          )}
        </section>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-5">
          <Panel id="top-h" title={`Les ${top.length || rows.length - 1} acteurs les plus cités`} pad={false}>
            <ol className="rp-rows mt-2 flex flex-col">
              {(top.length ? top.map((t) => ({ name: t.name, share: rows.find((r) => r.name === t.name)?.share ?? t.share, mentions: rows.find((r) => r.name === t.name)?.mentions ?? t.mentions, byProvider: t.byProvider as Record<string, number | undefined> })) : rows.filter((r) => !r.isMe).slice(0, 10).map((r) => ({ name: r.name, share: r.share, mentions: r.mentions, byProvider: {} as Record<string, number | undefined> }))).map((t) => {
                const pos = rows.findIndex((r) => r.name === t.name) + 1;
                const before = refRows.findIndex((r) => r.name === t.name);
                const moveBy = ref && before >= 0 && pos > 0 ? before + 1 - pos : null;
                const ahead = pos > 0 && pos < rows.findIndex((r) => r.isMe) + 1;
                return (
                  <li key={t.name} className="rp-row flex flex-wrap items-center gap-x-3 gap-y-1.5" style={{ order: pos > 0 ? pos : 99 }}>
                    <span className="rp-num w-8 flex-none text-[13px] font-semibold text-[var(--muted)]">{pos > 0 ? ordinal(pos) : '—'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {t.name}
                        {entrants.has(t.name) && <span className="rp-chip rp-chip-warning ml-2">Nouveau</span>}
                        {ahead && <span className="sr-only"> (devant vous)</span>}
                      </p>
                      <p className="text-[12px] text-[var(--muted)]">
                        {params.ia ? `${t.byProvider[params.ia] ?? 0} citations sur ${PROVIDER_LABEL[params.ia]}` : `${t.mentions} citations`} ·{' '}
                        <Link href={crossLink('/app/citations', sp, { concurrent: t.name, absent: '1' })} className="rp-link font-normal">
                          ses pages où vous n’êtes pas
                        </Link>
                      </p>
                    </div>
                    <span className="rp-num text-[14px] font-semibold">{pct(t.share)}</span>
                    {moveBy !== null && <Delta value={moveBy} label={moveBy ? ` ${Math.abs(moveBy)} place${Math.abs(moveBy) > 1 ? 's' : ''}` : ' stable'} />}
                    <FillBar value={t.share / maxShare} tone="neutral" className="ml-11 basis-full" />
                  </li>
                );
              })}
              <li className="rp-row flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-[var(--surface-me)]" style={{ order: stats.rank }} aria-label="Vous">
                <span className="rp-num w-8 flex-none text-[13px] font-semibold text-[var(--primary)]">{ordinal(stats.rank)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{business.name} <span className="rp-chip rp-chip-primary ml-1">Vous</span></p>
                  <p className="text-[12px] text-[var(--muted)]">{me.mentions} citations {mg && <span className="rp-margin">{marginText(mg.shareOfVoice, 'rate')}</span>}</p>
                </div>
                <span className="rp-num text-[14px] font-semibold">{pct(stats.shareOfVoice)}</span>
                <FillBar value={me.share / maxShare} tone="brand" className="ml-11 basis-full" />
              </li>
            </ol>
          </Panel>

          <Panel id="sov-h" title="Part de voix dans le temps" aside={<span className="hidden sm:inline">Vous et les 4 plus cités</span>}>
            <AnnotatedChart
              title="Part de voix de votre entreprise et des 4 concurrents les plus cités, mesure par mesure"
              series={series}
              labels={audits.map((x) => fmtMonth(auditDate(x)))}
              dates={audits.map((x) => auditDate(x))}
              notes={notes}
              businessId={business.id}
              demo={ws.demo}
              mode="pct"
              seriesKey="sov"
            />
          </Panel>
        </div>

        <section aria-labelledby="mx-h" className="rp-panel" data-visite="concurrents">
          <div className="rp-panel-head flex-wrap">
            <h2 id="mx-h" className="rp-h2">
              Où vous êtes cité : thème par IA
            </h2>
            <span className="text-[13px] text-[var(--muted)]">Part des réponses qui vous citent, et l’acteur le plus cité</span>
          </div>
          <div className="rp-panel-body">
            {v && v.themes.length && providers.length ? (
              <div className="rp-scroll -mx-1">
                <table className="rp-matrix">
                  <thead>
                    <tr>
                      <th scope="col">Thème</th>
                      {providers.map((p) => (
                        <th key={p} scope="col">
                          {PROVIDER_LABEL[p].replace(' (Le Chat)', '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {v.themes.map((t, i) => (
                      <tr key={t}>
                        <th scope="row" className="max-w-[180px] whitespace-normal font-semibold text-[var(--ink)]">
                          {t}
                        </th>
                        {providers.map((p) => {
                          const j = v.providers.indexOf(p);
                          const c = j >= 0 ? v.cells[i]?.[j] ?? null : null;
                          if (!c || !c.answers)
                            return (
                              <td key={p} className="rp-cell rp-cell-empty">
                                —<span className="sr-only"> pas de réponse exploitable</span>
                              </td>
                            );
                          const h = heat(c.mentionRate);
                          const leader = c.leaders.find((l) => !l.client);
                          const rc = refCell(t, p);
                          const d = rc && rc.answers ? Math.round((c.mentionRate - rc.mentionRate) * 100) : null;
                          return (
                            <td key={p} className="rp-cell" style={{ ['--heat' as string]: h }} data-strong={h > 45 ? 'true' : undefined}>
                              <span className="rp-num text-[15px] font-semibold">{pct(c.mentionRate)}</span>{' '}
                              <span className="rp-margin">± {Math.round(proportionMargin(c.cited, c.answers) * 100)}</span>
                              {d !== null && d !== 0 && (
                                <span className="rp-num ml-1 text-[11.5px] font-semibold" title="Évolution depuis la mesure de comparaison">
                                  {d > 0 ? '↑' : '↓'}
                                  {Math.abs(d)}
                                </span>
                              )}
                              <span className="rp-cell-sub" title={leader ? `${leader.name} : ${leader.mentions} citations` : undefined}>
                                {c.cited}/{c.answers} réponses{leader ? ` · ${leader.name}` : ''}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 px-1 text-[12px] text-[var(--muted)]">
                  Plus la case est foncée, plus vous êtes cité. La marge (±) est large quand une case repose sur peu de réponses : lisez les tendances, pas une case isolée.{' '}
                  <Link href={crossLink('/app/reponses', sp, { nc: '1' })} className="rp-link">
                    Lire les réponses où vous n’êtes pas cité
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-[14px] text-[var(--muted)]">La matrice par thème apparaîtra à la prochaine mesure (elle demande les réponses complètes des IA).</p>
            )}
          </div>
        </section>

      </div>
    </>
  );
}
