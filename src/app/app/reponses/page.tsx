import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate, PROVIDER_LABEL } from '@/components/app/tokens';
import { clientNamesOf, dateOf, listAnswers, proportionMargin, type AnswerItem } from '@/components/app/mesure/derive';
import { loadMesure, promptIdsByQuery } from '@/components/app/mesure/server';
import { crossLink, hrefWith, str, type RawSearch } from '@/components/app/mesure/params';
import { ExportLink, HighlightedAnswer, HighlightLegend, MesureBar, PeriodNote } from '@/components/app/mesure/ui';
import { AnswerCard, AnswerStatus } from '@/components/app/mesure/AnswerCard';
import { Verdict, V4Empty } from '@/components/app/v4/Verdict';
import { InView } from '@/components/app/v4/motion';

export const metadata = { title: 'Réponses des IA' };

const STEP = 20;

export default async function ReponsesPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, business, ent, period, params, sp } = m;
  const latest = period.current;
  if (!latest) {
    return (
      <>
        <PageHeader title="Réponses des IA" />
        <div className="rp-page">
          <V4Empty title="Pas encore de réponses" icon="quote" action={<Link href="/app/questions" className="rp-btn rp-btn-primary">Voir mes questions suivies</Link>}>
            Le texte intégral des réponses des IA apparaît ici après votre première mesure.
          </V4Empty>
        </div>
      </>
    );
  }
  const names = clientNamesOf(ws.business.name, ws.business.website);
  const providers = latest.providersUsed;
  const questionId = str(sp, 'question', 60) || null;
  const mesure = str(sp, 'mesure', 80) || null;
  const nc = str(sp, 'nc', 2) === '1';
  const shown = Math.min(400, Math.max(STEP, Number.parseInt(str(sp, 'n', 4), 10) || STEP));
  const compareMode = str(sp, 'comparer', 2) === '1';
  const links = await promptIdsByQuery(business.id, period.audits);
  const historyHref = (queryId: string) => (links.get(queryId) ? crossLink(`/app/questions/${encodeURIComponent(links.get(queryId)!)}`, sp) : null);

  // Questions (dernière formulation connue) et mesures de la période, pour les filtres.
  const questions = new Map<string, string>();
  for (const a of period.audits) for (const q of a.queries) questions.set(q.id, q.text);
  const mesures = [...period.audits].reverse();

  const answers = compareMode ? [] : listAnswers(period.audits, names, { ia: params.ia, queryId: questionId, auditId: mesure, notCited: nc, q: params.q });
  const page = answers.slice(0, shown);
  const total = period.audits.reduce((n, a) => n + (a.answers?.length ?? 0), 0);

  // Comparaison côte à côte : deux mesures, une question.
  const aId = str(sp, 'a', 80) || period.reference?.id || mesures[1]?.id || null;
  const bId = str(sp, 'b', 80) || latest.id;
  const cmpQuestion = questionId ?? latest.queries.find((q) => q.kind !== 'brand')?.id ?? null;
  const cmp = compareMode && cmpQuestion
    ? {
        a: listAnswers(period.audits, names, { auditId: aId, queryId: cmpQuestion, ia: params.ia }),
        b: listAnswers(period.audits, names, { auditId: bId, queryId: cmpQuestion, ia: params.ia }),
      }
    : null;
  const dateLabel = (id: string | null) => {
    const a = period.audits.find((x) => x.id === id);
    return a ? fmtDate(dateOf(a), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  };

  // En-tête-résultat : la dernière mesure, hors questions sur votre marque.
  const lastAns = listAnswers([latest], names, {}).filter((x) => !x.brand && !x.error);
  const citedN = lastAns.filter((x) => x.cited).length;
  const rate = lastAns.length ? citedN / lastAns.length : 0;
  const byIa = providers
    .map((p) => {
      const l = lastAns.filter((x) => x.provider === p);
      return { p, n: l.length, c: l.filter((x) => x.cited).length };
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => x.c / x.n - y.c / y.n);
  const worst = byIa[0] && byIa.length > 1 && byIa[0].c / byIa[0].n < rate - 0.1 ? byIa[0] : null;
  const missing = lastAns.length - citedN;
  const verdictTitle = !lastAns.length
    ? 'Les réponses de la dernière mesure arrivent'
    : worst
      ? `${PROVIDER_LABEL[worst.p]} vous oublie : cité dans ${worst.c} réponse${worst.c > 1 ? 's' : ''} sur ${worst.n}`
      : rate >= 0.5
        ? `Les IA vous citent dans ${citedN} réponses sur ${lastAns.length}`
        : `Les IA vous oublient dans ${missing} réponses sur ${lastAns.length}`;
  const lastDate = fmtDate(dateOf(latest), { day: 'numeric', month: 'long' });

  const keep = (keys: string[]) => keys.map((k) => (str(sp, k, 80) ? <input key={k} type="hidden" name={k} value={str(sp, k, 80)} /> : null));

  return (
    <>
      <PageHeader
        title="Réponses des IA"
        meta={
          <>
            {total} réponses complètes sur la période{latest.demo ? ' · démo' : ''}
          </>
        }
        dataDate={dateOf(latest)}
        actions={<ExportLink ent={ent} businessId={business.id} kind="answers" from={period.from} to={period.to} label="Exporter" />}
      />
      <div className="rp-page">
        <Verdict
          tone={!lastAns.length ? 'neutral' : rate >= 0.5 && !worst ? 'good' : rate >= 0.3 ? 'warn' : 'bad'}
          title={verdictTitle}
          lead={`Mesure du ${lastDate}, toutes questions sauf celles sur votre marque.`}
          figure={lastAns.length ? { value: Math.round(rate * 100), suffix: ' %', label: 'des réponses vous citent, toutes IA' } : null}
          action={missing > 0 ? { href: hrefWith('/app/reponses', sp, { nc: '1', mesure: latest.id, ia: worst?.p ?? null, n: null, comparer: null }), label: `Lire les ${worst ? worst.n - worst.c : missing} réponses où vous manquez`, icon: 'eye' } : undefined}
          details={
            <>
              <p>Le texte intégral de chaque réponse, tel que l’IA l’a écrit. Votre nom est surligné, vos concurrents soulignés, les sources numérotées.</p>
              <p>
                Les IA varient d’une fois à l’autre : chaque réponse est un échantillon. Marge d’erreur sur ce taux : ± {Math.round(proportionMargin(citedN, Math.max(1, lastAns.length)) * 100)} points ({lastAns.length} réponses).
              </p>
            </>
          }
        />
        <MesureBar
          path="/app/reponses"
          sp={sp}
          params={params}
          providers={providers}
          compare={false}
          extra={
            <div className="rp-mbar-group">
              <span className="rp-segs" role="group" aria-label="Mode d’affichage">
                <Link href={hrefWith('/app/reponses', sp, { comparer: null, a: null, b: null })} aria-current={!compareMode ? 'true' : undefined}>
                  Liste
                </Link>
                <Link href={hrefWith('/app/reponses', sp, { comparer: '1', n: null })} aria-current={compareMode ? 'true' : undefined}>
                  Comparer deux dates
                </Link>
              </span>
            </div>
          }
        />
        <PeriodNote from={period.from} to={period.to} refDate={null} limitedByPlan={period.limitedByPlan} historyMonths={ent.historyMonths} />

        {!compareMode && (
          <form method="get" action="/app/reponses" className="rp-panel flex flex-wrap items-end gap-3 p-4 lg:p-5" aria-label="Filtrer les réponses">
            {keep(['periode', 'ia', 'tag'])}
            <label className="flex min-w-[220px] flex-[2] flex-col gap-1 text-[12px] text-[var(--muted)]">
              Question
              <select name="question" defaultValue={questionId ?? ''} className="rp-select w-full">
                <option value="">Toutes les questions</option>
                {[...questions.entries()].map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.length > 90 ? `${t.slice(0, 88)}…` : t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
              Date de mesure
              <select name="mesure" defaultValue={mesure ?? ''} className="rp-select w-full">
                <option value="">Toutes les dates</option>
                {mesures.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fmtDate(dateOf(a), { day: 'numeric', month: 'short', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
              Mot dans la réponse
              <input type="search" name="q" defaultValue={params.q} className="rp-input" placeholder="prix, urgence, un concurrent…" />
            </label>
            <label className="flex min-h-[40px] items-center gap-2 text-[14px]">
              <input type="checkbox" name="nc" value="1" defaultChecked={nc} className="h-4 w-4 accent-[var(--primary)]" />
              Seulement où je ne suis pas cité
            </label>
            <button type="submit" className="rp-btn v4-press">
              Filtrer
            </button>
            {(questionId || mesure || nc || params.q) && (
              <Link href={hrefWith('/app/reponses', sp, { question: null, mesure: null, nc: null, q: null, n: null })} className="rp-btn rp-btn-ghost">
                Tout afficher
              </Link>
            )}
          </form>
        )}

        {compareMode ? (
          <section aria-labelledby="cmp-h" className="flex flex-col gap-4">
            <form method="get" action="/app/reponses" className="rp-panel flex flex-wrap items-end gap-3 p-4 lg:p-5">
              <input type="hidden" name="comparer" value="1" />
              {keep(['periode', 'ia', 'tag'])}
              <label className="flex min-w-[220px] flex-[2] flex-col gap-1 text-[12px] text-[var(--muted)]">
                Question
                <select name="question" defaultValue={cmpQuestion ?? ''} className="rp-select w-full">
                  {[...questions.entries()].map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.length > 90 ? `${t.slice(0, 88)}…` : t}
                    </option>
                  ))}
                </select>
              </label>
              {(['a', 'b'] as const).map((k) => (
                <label key={k} className="flex min-w-[150px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
                  {k === 'a' ? 'Avant' : 'Après'}
                  <select name={k} defaultValue={(k === 'a' ? aId : bId) ?? ''} className="rp-select w-full">
                    {mesures.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fmtDate(dateOf(a), { day: 'numeric', month: 'short', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button type="submit" className="rp-btn rp-btn-primary">
                Comparer
              </button>
            </form>
            {mesures.length < 2 ? (
              <Empty title="Une seule mesure sur la période">Choisissez une période plus longue (6 ou 12 mois) pour comparer deux dates.</Empty>
            ) : cmp ? (
              <>
                <h2 id="cmp-h" className="rp-display text-[18px] lg:text-[20px]">
                  « {questions.get(cmpQuestion!) ?? ''} »
                </h2>
                <HighlightLegend />
                {(params.ia ? [params.ia] : providers).map((p) => {
                  const left = cmp.a.filter((x) => x.provider === p);
                  const right = cmp.b.filter((x) => x.provider === p);
                  if (!left.length && !right.length) return null;
                  return (
                    <Panel key={p} title={PROVIDER_LABEL[p]}>
                      <div className="rp-compare">
                        {[
                          { label: dateLabel(aId), list: left },
                          { label: dateLabel(bId), list: right },
                        ].map((col, i) => (
                          <div key={i} className="min-w-0">
                            <p className="mb-2 text-[13px] font-semibold">
                              {i === 0 ? 'Avant' : 'Après'} · {col.label}
                            </p>
                            {col.list.length ? (
                              <div className="flex flex-col gap-4">
                                {col.list.map((x) => (
                                  <div key={x.key} className="flex flex-col gap-1.5">
                                    <div>
                                      <AnswerStatus a={x} /> <span className="text-[12px] text-[var(--muted)]">passage {x.run}</span>
                                    </div>
                                    <AnswerBody a={x} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[14px] text-[var(--muted)]">Pas de réponse conservée pour cette date.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Panel>
                  );
                })}
              </>
            ) : (
              <Empty title="Aucune question à comparer">Ajoutez des questions suivies pour comparer leurs réponses dans le temps.</Empty>
            )}
          </section>
        ) : (
          <Panel
            id="ans-h"
            title={
              <>
                {answers.length} réponse{answers.length > 1 ? 's' : ''}
                {nc ? ' où vous n’êtes pas cité' : ''}
              </>
            }
            aside={<HighlightLegend />}
          >
            {page.length ? (
              <ul className="flex flex-col v4-swap" key={`${questionId}|${mesure}|${nc}|${params.q}|${params.ia}`}>
                {page.map((a, i) => (
                  <li key={a.key} className="border-t border-[var(--hair)] py-5 first:border-t-0 first:pt-1">
                    <InView className="v4-hl">
                      <AnswerCard a={a} businessId={business.id} demo={ws.demo} historyHref={historyHref(a.queryId)} visite={i === 0 ? 'reponses' : undefined} />
                    </InView>
                  </li>
                ))}
              </ul>
            ) : (
              <V4Empty
                title={nc ? 'Vous êtes cité dans toutes ces réponses' : 'Aucune réponse pour ces filtres'}
                icon={nc ? 'check' : 'search'}
                action={<Link href={hrefWith('/app/reponses', sp, { question: null, mesure: null, nc: null, q: null, n: null })} className="rp-btn">Tout afficher</Link>}
              >
                {nc ? 'Élargissez la période ou choisissez une autre IA pour trouver vos marges de progression.' : 'Retirez un filtre, ou élargissez la période.'}
              </V4Empty>
            )}
            {answers.length > shown && (
              <div className="mt-2 border-t border-[var(--hair)] pt-4 text-center">
                <Link href={hrefWith('/app/reponses', sp, { n: String(shown + STEP) })} className="rp-btn" scroll={false}>
                  Voir {Math.min(STEP, answers.length - shown)} réponses de plus
                </Link>
              </div>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}

function AnswerBody({ a }: { a: AnswerItem }) {
  return a.error ? <p className="text-[14px] text-[var(--muted)]">Pas de réponse exploitable.</p> : <HighlightedAnswer item={a} className="text-[14px]" />;
}
