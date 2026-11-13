import { Verdict } from '@/components/app/v4/Verdict';
import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LineChart } from '@/components/app/ChartsClient';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate, fmtMonth, PROVIDER_LABEL, PROVIDER_ORDER } from '@/components/app/tokens';
import { buildHistory, demandContext, getPrompt, toView } from '@/lib/prompts';
import { matchQuery } from '@/lib/prompts/history';
import { isBrandQuery } from '@/lib/engine/queries-v2';
import { questionResult } from '@/components/app/mesure/derive';
import { loadMesure } from '@/components/app/mesure/server';
import { crossLink, type RawSearch } from '@/components/app/mesure/params';
import { AskCopilot, HighlightedAnswer, HighlightLegend, MesureBar } from '@/components/app/mesure/ui';
import { TaskButton, CopyText } from '@/components/app/mesure/TaskButton';

export const metadata = { title: 'Historique d’une question' };

export default async function QuestionDetailPage({ params: routeParams, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearch> }) {
  const { id } = await routeParams;
  const m = await loadMesure(searchParams);
  const { ws, business, period, params, sp } = m;
  const prompt = await getPrompt(decodeURIComponent(id)).catch(() => null);
  if (!prompt || prompt.businessId !== business.id) notFound();

  const view = toView(prompt, demandContext({ name: ws.business.name, city: business.city, district: business.district }));
  const h = buildHistory(prompt, period.audits, { provider: params.ia ?? undefined, maxAnswers: 60 });
  const providers = PROVIDER_ORDER.filter((p) => (params.ia ? p === params.ia : (ws.latest?.providersUsed ?? []).includes(p)));
  const res = questionResult(h, providers);
  const auditIds = [...new Set(h.series.map((s) => s.auditId))];
  const dates = auditIds.map((a) => h.series.find((s) => s.auditId === a)!.date);
  const lastAudit = auditIds.at(-1);
  // Question sur la marque (elle nomme le client) : hors score, elle sert à lire ce que les IA disent de vous.
  const brand = period.audits.some((a) => isBrandQuery(matchQuery(prompt, a) ?? undefined));
  // Sans point chiffré (question pas encore comptée), les réponses brutes éventuelles restent affichées en tête.
  const lastAnswers = lastAudit ? h.answers.filter((a) => a.auditId === lastAudit) : h.answers.slice(0, 6);
  const olderAnswers = lastAudit ? h.answers.filter((a) => a.auditId !== lastAudit) : h.answers.slice(6);
  const lastPts = h.series.filter((s) => s.auditId === lastAudit);
  const citedNow = lastPts.filter((p) => p.cited).length;
  const validNow = lastPts.filter((p) => !p.noRec).length;
  const rivals = [...new Set(lastPts.flatMap((p) => p.competitors))].slice(0, 8);
  const missing = lastPts.filter((p) => !p.cited && !p.noRec).map((p) => PROVIDER_LABEL[p.provider]);
  const back = crossLink('/app/questions', sp);

  return (
    <>
      <PageHeader
        title="Historique d’une question"
        back={{ href: back, label: 'Questions' }}
        meta={
          <>
            {view.theme}{view.intentLabel.toLowerCase() !== view.theme.toLowerCase() ? ` · ${view.intentLabel}` : ''} · demande {view.demand.level === 'moyen' ? 'moyenne' : view.demand.level === 'fort' ? 'forte' : 'faible'} (estimation){ws.demo ? ' · démo' : ''}
          </>
        }
        dataDate={dates.at(-1) ?? null}
      />
      <div className="rp-page">
        <Verdict
          id="qd-h"
          tone={!res.measured ? 'neutral' : validNow > 0 && citedNow === validNow ? 'good' : citedNow === 0 ? 'bad' : 'warn'}
          title={
            res.measured
              ? citedNow === 0
                ? 'Aucune IA ne vous cite sur cette question'
                : `${citedNow} IA sur ${validNow} vous ${citedNow > 1 ? 'citent' : 'cite'} sur cette question`
              : brand && h.answers.length
                ? 'Question sur votre marque : lisez ce que les IA disent de vous'
                : 'Cette question n’a pas encore de résultat chiffré'
          }
          lead={
            <>
              <span className="font-semibold text-[var(--ink)]">« {prompt.text} »</span>
              <span className="block">
                {res.measured
                  ? missing.length > 0
                    ? `Absent de ${missing.join(', ')} à la dernière mesure.`
                    : 'Cité par toutes les IA mesurées à la dernière mesure.'
                  : brand && h.answers.length
                    ? 'Elle vous nomme, donc ne compte pas dans le score.'
                    : h.answers.length
                      ? 'Elle entrera dans le score à la prochaine mesure ; les réponses déjà recueillies sont ci-dessous.'
                      : 'Elle sera posée à la prochaine mesure de votre offre.'}
              </span>
              {!prompt.active && <span className="mt-1 block text-[13px] text-[var(--warning-ink)]">Question archivée : elle n’est plus posée, son historique reste consultable.</span>}
            </>
          }
          figure={res.measured ? { value: citedNow, suffix: `/${validNow}`, label: 'IA qui vous citent' } : null}
          action={missing.length > 0 && h.queryIds[0] && (
              <Link href={crossLink('/app/citations/brief', sp, { q: h.queryIds.at(-1) ?? null })} className="rp-btn rp-btn-primary v4-press">
                Préparer un brief de contenu
              </Link>
            )}
          secondary={
            <>
              {missing.length > 0 && (
                <TaskButton
                  businessId={business.id}
                  demo={ws.demo}
                  draft={{
                    id: `q-${prompt.id}`,
                    title: `Être cité sur « ${prompt.text.slice(0, 90)} »`,
                    why: `${missing.join(', ')} ne vous cite${missing.length > 1 ? 'nt' : ''} pas sur cette question${rivals.length ? ` ; ${rivals.slice(0, 3).join(', ')} y ${rivals.length > 1 ? 'sont cités' : 'est cité'}` : ''}.`,
                    minutes: 120,
                    impact: 2,
                    steps: ['Lire les réponses ci-dessous et noter les sources citées', 'Publier une réponse claire à cette question sur votre site', 'Viser une des sources citées où vous êtes absent'],
                  }}
                />
              )}
              <AskCopilot context="questions" question={`Que faire pour être cité sur « ${prompt.text} » ?`} />
              <Link href={crossLink('/app/reponses', sp, { question: h.queryIds.at(-1) ?? null })} className="rp-btn rp-btn-sm">
                Toutes les réponses
              </Link>
            </>
          }
          details={
            res.measured ? (
              <p>Sur une seule question, la marge d’erreur est large ({h.series.filter((s) => s.auditId === lastAudit).reduce((n, s) => n + s.runs, 0)} réponses) : fiez-vous à la tendance sur plusieurs mesures.</p>
            ) : undefined
          }
        />

        <MesureBar path={`/app/questions/${encodeURIComponent(prompt.id)}`} sp={sp} params={params} providers={ws.latest?.providersUsed} compare={false} />

        {!res.measured && brand && h.answers.length ? null : !res.measured ? (
          <Empty title="Pas encore d’historique">Les résultats apparaîtront après la prochaine mesure. Élargissez la période si la question a déjà été mesurée.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-5">
            <Panel id="qm-h" title="Mesure par mesure" aside="✓ cité (rang) · ✗ absent" pad={false}>
              <div className="rp-scroll px-2 pb-2 lg:px-3">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th scope="col">Mesure</th>
                      {providers.map((p) => (
                        <th key={p} scope="col" className="text-center">
                          {PROVIDER_LABEL[p].replace(' (Le Chat)', '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...auditIds].reverse().map((aid, i) => (
                      <tr key={aid}>
                        <th scope="row" className="whitespace-nowrap font-normal">
                          {fmtDate(dates[auditIds.length - 1 - i], { day: 'numeric', month: 'short', year: 'numeric' })}
                        </th>
                        {providers.map((p) => {
                          const pt = h.series.find((s) => s.auditId === aid && s.provider === p);
                          return (
                            <td key={p} className="text-center">
                              {!pt ? (
                                <span className="text-[var(--muted)]">—<span className="sr-only"> non mesuré</span></span>
                              ) : pt.noRec ? (
                                <span className="text-[12px] text-[var(--muted)]">sans recommandation</span>
                              ) : pt.cited ? (
                                <span className="rp-num font-semibold text-[var(--success-ink)]">
                                  ✓{pt.rank ? <span className="font-normal text-[var(--muted)]"> ({pt.rank})</span> : null}
                                  <span className="sr-only"> cité</span>
                                </span>
                              ) : (
                                <span className="text-[var(--danger-ink)]">
                                  ✗<span className="sr-only"> absent</span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel id="qc-h" title="Part des IA qui vous citent">
              {res.series.length > 1 ? (
                <LineChart
                  title={`Part des IA qui vous citent sur la question « ${prompt.text} », mesure par mesure`}
                  series={[{ name: 'IA qui vous citent', color: 'var(--primary)', emphasis: true, values: res.series.map((s) => s.rate) }]}
                  labels={res.series.map((s) => fmtMonth(s.date))}
                  mode="pct"
                  height={200}
                />
              ) : (
                <p className="text-[14px] text-[var(--muted)]">La courbe apparaîtra à la deuxième mesure.</p>
              )}
              {rivals.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--hair)] pt-3 text-[13px] text-[var(--muted)]">
                  Cités à la dernière mesure :
                  {rivals.map((c) => (
                    <span key={c} className="rp-chip">
                      {c}
                    </span>
                  ))}
                </p>
              )}
            </Panel>
          </div>
        )}

        <Panel id="qa-h" title="Réponses brutes" aside={<HighlightLegend />}>
          {lastAnswers.length ? (
            <ul className="flex flex-col gap-5">
              {lastAnswers.map((a) => (
                <li key={`${a.auditId}-${a.provider}-${a.run}`} className="border-t border-[var(--hair)] pt-4 first:border-t-0 first:pt-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{PROVIDER_LABEL[a.provider]}</span>
                    <span className="text-[12px] text-[var(--muted)]">
                      passage {a.run} · {fmtDate(a.date, { day: 'numeric', month: 'long' })}
                      {a.model && !/mock/i.test(a.model) ? ` · ${a.model}` : ''}
                      {a.demo ? ' · démo' : ''}
                    </span>
                    <span className="ml-auto">
                      <CopyText text={a.text} />
                    </span>
                  </div>
                  {a.error ? <p className="text-[14px] text-[var(--muted)]">Pas de réponse exploitable ({a.error}).</p> : <HighlightedAnswer item={a} />}
                  {a.sources.length > 0 && (
                    <ol className="mt-2 flex flex-col gap-0.5 text-[12px] text-[var(--muted)] [list-style:decimal] pl-5">
                      {a.sources.slice(0, 8).map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                            {s.title ?? s.domain}
                          </a>{' '}
                          <span>({s.domain})</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-[var(--muted)]">Aucune réponse brute conservée pour cette question sur la période.</p>
          )}
          {olderAnswers.length > 0 && (
            <details className="mt-4 border-t border-[var(--hair)] pt-3">
              <summary className="flex min-h-[36px] items-center gap-1 text-[14px] font-semibold">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="rp-chevron" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="m9 6 6 6-6 6" />
                </svg>
                Réponses des mesures précédentes ({olderAnswers.length})
              </summary>
              <ul className="mt-3 flex flex-col gap-4">
                {olderAnswers.map((a) => (
                  <li key={`${a.auditId}-${a.provider}-${a.run}`}>
                    <p className="mb-1 text-[12px] text-[var(--muted)]">
                      <strong className="text-[var(--ink)]">{PROVIDER_LABEL[a.provider]}</strong> · {fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })} · passage {a.run}
                    </p>
                    {a.error ? <p className="text-[14px] text-[var(--muted)]">Pas de réponse exploitable.</p> : <HighlightedAnswer item={a} className="text-[14px]" />}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>
      </div>
    </>
  );
}
