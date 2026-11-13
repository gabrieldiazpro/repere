import '@/components/app/mesure/mesure.css';
import Link from 'next/link';
import type { ProviderId } from '@/lib/engine';
import { auditCounts, explainChange, sentimentShares } from '@/lib/engine';
import { HBar, SplitBar } from '@/components/app/Charts';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { QuoteCard } from '@/components/app/Quote';
import { bandFor, fmtDate, PROVIDER_LABEL, PROVIDER_ORDER } from '@/components/app/tokens';
import { auditDate } from '@/components/app/workspace';
import { Verrou } from '@/components/app/shell/Verrou';
import { marginText } from '@/components/app/mesure/derive';
import { loadMesure } from '@/components/app/mesure/server';
import { crossLink, hrefWith, str, type RawSearch } from '@/components/app/mesure/params';
import { Verdict, V4Empty } from '@/components/app/v4/Verdict';
import { AskCopilot, DeltaPts, ExplainChange, ExportLink, MesureBar, PeriodNote } from '@/components/app/mesure/ui';

export const metadata = { title: 'Ce que disent les IA' };

const TONES = ['tous', 'positif', 'neutre', 'negatif'] as const;
type Tone = (typeof TONES)[number];
const TONE_LABEL: Record<Tone, string> = { tous: 'Tous', positif: 'Positifs', neutre: 'Neutres', negatif: 'Négatifs' };
const ALL: ProviderId[] = PROVIDER_ORDER;

export default async function IaPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const m = await loadMesure(searchParams);
  const { ws, ent, period, params, sp } = m;
  const a = period.current;
  if (!a) {
    return (
      <>
        <PageHeader title="Ce que disent les IA" />
        <div className="rp-page">
          <V4Empty title="Pas encore de verbatims" icon="quote">Les phrases exactes des IA sur vous apparaissent après votre première mesure.</V4Empty>
        </div>
      </>
    );
  }
  const ref = period.reference;
  const p = a.perception;
  const providers = a.providersUsed;
  const ia = params.ia;
  const ton = (TONES as readonly string[]).includes(str(sp, 'ton', 10)) ? (str(sp, 'ton', 10) as Tone) : 'tous';
  const allQuotes = p?.quotes ?? [];
  const scoped = allQuotes.filter((q) => !ia || q.provider === ia);
  const quotes = scoped.filter((q) => ton === 'tous' || q.sentiment === ton);
  // Ton calculé sur les verbatims eux-mêmes : la barre et la liste disent la même chose.
  const tone = sentimentShares(scoped);
  const counts = a.counts ?? auditCounts(a);
  const visibility = a.queries.filter((q) => q.kind !== 'brand');
  const brandCount = a.queries.length - visibility.length;
  const ex = ref ? explainChange(ref, a) : null;
  const mg = a.margins;

  const byQuery = visibility.map((q) => ({
    q,
    cells: providers
      .filter((pr) => !ia || pr === ia)
      .map((pr) => {
        const ms = a.mentions.filter((m) => m.queryId === q.id && m.provider === pr && !m.noRec);
        return { pr, hit: ms.some((m) => m.mentioned), rank: ms.find((m) => m.mentioned)?.rank ?? null, n: ms.length };
      }),
  }));

  return (
    <>
      <PageHeader
        title="Ce que disent les IA"
        meta={
          <>
            Mesure du {fmtDate(auditDate(a), { day: 'numeric', month: 'long' })} · {counts.label}
            {a.demo ? ' · démo' : ''}
          </>
        }
        dataDate={auditDate(a)}
      />
      <div className="rp-page">
        {scoped.length > 0 && (
          <Verdict
            tone={tone.negatif >= 0.2 ? 'bad' : tone.positif >= 0.5 ? 'good' : 'warn'}
            title={
              tone.negatif >= 0.2
                ? `Les IA émettent des réserves dans ${Math.round(tone.negatif * 100)} % de leurs phrases sur vous`
                : tone.positif >= 0.5
                  ? `Les IA parlent de vous en bien dans ${Math.round(tone.positif * 100)} % de leurs phrases`
                  : 'Les IA parlent de vous sans enthousiasme : surtout des phrases neutres'
            }
            lead={`${scoped.length} phrase${scoped.length > 1 ? 's' : ''} relevée${scoped.length > 1 ? 's' : ''} à la mesure du ${fmtDate(auditDate(a), { day: 'numeric', month: 'long' })}.`}
            figure={{ value: Math.round(tone.positif * 100), suffix: ' %', label: 'de phrases positives' }}
            action={tone.negatif > 0 ? { href: hrefWith('/app/ia', sp, { ton: 'negatif' }), label: 'Lire les phrases négatives', icon: 'quote' } : undefined}
            secondary={<AskCopilot context="ia" question="Que disent les IA de moi ?" />}
            details={<p>Les phrases exactes des assistants quand on leur pose les questions de vos clients. Les IA varient d’une réponse à l’autre : lisez-les comme un échantillon.</p>}
          />
        )}
        <MesureBar path="/app/ia" sp={sp} params={params} providers={providers} />
        <PeriodNote from={period.from} to={period.to} refDate={ref ? auditDate(ref) : null} limitedByPlan={period.limitedByPlan} historyMonths={ent.historyMonths} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-5">
          <Panel id="tone-h" title="Ton des verbatims" aside={<span className="rp-num">{scoped.length} verbatim{scoped.length > 1 ? 's' : ''}</span>}>
            {scoped.length ? (
              <>
                <SplitBar
                  parts={[
                    { label: 'Positif', value: tone.positif, color: 'var(--success)', ink: 'var(--success-ink)' },
                    { label: 'Neutre', value: tone.neutre, color: 'var(--line-strong)', ink: 'var(--muted)' },
                    { label: 'Négatif', value: tone.negatif, color: 'var(--danger)', ink: 'var(--danger-ink)' },
                  ]}
                />
                <p className="mt-2 text-[12px] text-[var(--muted)]">
                  Calculé sur les {scoped.length} verbatims ci-dessous{ia ? ` de ${PROVIDER_LABEL[ia]}` : ''} ; une information fausse sur vous compte comme négative. Sur si peu de phrases, un verbatim de plus ou de moins change nettement les pourcentages.
                </p>
                {p && p.themes.length > 0 && (
                  <>
                    <p className="mt-4 text-[13px] font-semibold">Thèmes associés à votre nom</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {p.themes.map((t) => (
                        <li key={t} className={`rp-chip ${/fausse|faux/.test(t) ? 'rp-chip-danger' : ''}`}>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="text-[14px] text-[var(--muted)]">{ia ? `${PROVIDER_LABEL[ia]} n’a rien dit de vous sur cette mesure.` : 'L’analyse du ton sera disponible à la prochaine mesure.'}</p>
            )}
          </Panel>

          <Panel
            id="per-ia-h"
            title="Votre note sur chaque IA"
            aside={
              <span>
                Global <strong className="rp-num text-[var(--ink)]">{Math.round(a.score)}</strong>
                {mg && <span className="rp-margin ml-1">{marginText(mg.score, 'score')}</span>}
              </span>
            }
          >
            <ul className="flex flex-col gap-3">
              {ALL.map((pr) => {
                const measured = providers.includes(pr);
                const s = measured ? (a.subScores[pr as keyof typeof a.subScores] ?? null) : null;
                const before = ref && ref.providersUsed.includes(pr) ? (ref.subScores[pr as keyof typeof ref.subScores] ?? null) : null;
                if (!measured) {
                  if (pr !== 'mistral' && pr !== 'claude') return null;
                  const feature = pr;
                  return (
                    <li key={pr} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 text-[13px]">
                      <span className="font-semibold text-[var(--muted)]">{PROVIDER_LABEL[pr]}</span>
                      <Verrou ent={ent} feature={feature} titre={PROVIDER_LABEL[pr]} compact>
                        <span className="text-[var(--muted)]">Inclus dans votre offre : mesuré à partir de la prochaine mesure.</span>
                      </Verrou>
                    </li>
                  );
                }
                return (
                  <li key={pr}>
                    <Link
                      href={hrefWith('/app/ia', sp, { ia: ia === pr ? null : pr })}
                      aria-current={ia === pr ? 'true' : undefined}
                      className={`grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-1 text-[13px] ${ia === pr ? 'bg-[var(--primary-bg)]' : 'hover:bg-[var(--surface-2)]'}`}
                    >
                      <span className="font-semibold">{PROVIDER_LABEL[pr]}</span>
                      {s === null ? (
                        <span className="text-[var(--muted)]">Non mesuré</span>
                      ) : (
                        <span className="overflow-hidden rounded-[3px]">
                          <HBar value={s} max={100} color={bandFor(s).color} />
                        </span>
                      )}
                      <span className="flex items-center gap-2">
                        {s !== null && <span className="rp-num w-[52px] text-right font-semibold">{Math.round(s)}/100</span>}
                        {s !== null && before !== null && <DeltaPts delta={s - before} margin={mg?.score.margin ?? null} unit="" />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12px] text-[var(--muted)]">Touchez une IA pour filtrer les verbatims et la grille. Gemini répond sans sources : il compte pour la perception, pas pour les pages citées.</p>
          </Panel>
        </div>

        <ExplainChange ex={ex} context="ia" />

        <Panel id="quotes-h" title="Verbatims" aside={<span className="rp-num">{quotes.length} sur {scoped.length}</span>}>
          <nav aria-label="Filtrer par ton" className="mb-4">
            <span className="rp-segs" role="group">
              {TONES.map((t) => (
                <Link key={t} href={hrefWith('/app/ia', sp, { ton: t === 'tous' ? null : t })} aria-current={ton === t ? 'true' : undefined} scroll={false}>
                  {TONE_LABEL[t]}
                </Link>
              ))}
            </span>
          </nav>
          {quotes.length ? (
            <ul className="grid gap-5 lg:grid-cols-2 lg:gap-x-8">
              {quotes.map((q, i) => (
                <li key={i}>
                  <QuoteCard q={q} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-[var(--muted)]">Aucun verbatim pour ce filtre.</p>
          )}
          <p className="mt-4 border-t border-[var(--hair)] pt-3 text-[13px]">
            {scoped.length < 6 ? 'Peu de verbatims sur cette mesure. ' : ''}
            <Link href={crossLink('/app/reponses', sp)} className="rp-link">
              Lire les réponses complètes des IA
            </Link>
          </p>
        </Panel>

        <Panel
          id="grid-h"
          title="Question par question"
          aside={
            <span className="flex flex-wrap items-center gap-3">
              <span>✓ cité (rang) · ✗ absent</span>
              <ExportLink ent={ent} businessId={ws.business.id} kind="questions" from={period.from} to={period.to} label="Exporter" />
            </span>
          }
          pad={false}
        >
          <div className="rp-scroll px-2 pb-2 lg:px-3">
            <table className="rp-table">
              <thead>
                <tr>
                  <th scope="col">Question de visibilité</th>
                  {(byQuery[0]?.cells ?? []).map((c) => (
                    <th key={c.pr} scope="col" className="text-center">
                      {PROVIDER_LABEL[c.pr].replace(' (Le Chat)', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byQuery.map(({ q, cells }) => (
                  <tr key={q.id}>
                    <td className="min-w-[220px]">
                      <Link href={crossLink('/app/reponses', sp, { question: q.id })} className="hover:underline">
                        {q.text}
                      </Link>
                      {q.theme && <span className="block text-[12px] text-[var(--muted)]">{q.theme}</span>}
                    </td>
                    {cells.map((c) => (
                      <td key={c.pr} className="text-center">
                        {c.n === 0 ? (
                          <span className="text-[var(--muted)]" aria-label="non mesuré">
                            —
                          </span>
                        ) : c.hit ? (
                          <span className="rp-num font-semibold text-[var(--success-ink)]">
                            ✓{c.rank ? <span className="font-normal text-[var(--muted)]"> ({c.rank})</span> : null}
                            <span className="sr-only"> cité</span>
                          </span>
                        ) : (
                          <span className="text-[var(--danger-ink)]">
                            ✗<span className="sr-only"> absent</span>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {brandCount > 0 && (
            <p className="border-t border-[var(--hair)] px-4 py-3 text-[13px] text-[var(--muted)] lg:px-5">
              {brandCount} question{brandCount > 1 ? 's' : ''} de vérification sur votre marque ne compte{brandCount > 1 ? 'nt' : ''} pas dans le score :{' '}
              <Link href="/app/verite" className="rp-link">
                voir la vérité des informations
              </Link>
              .
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
