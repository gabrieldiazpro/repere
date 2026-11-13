import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { PROVIDER_LABEL } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { copilotHref, fmtEur, VERDICT_META } from '@/components/app/metiers/logic';
import { KeyFigures, LoadError, NextSteps, ParcoursGate, PRODUITS_TABS, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { priceReport, type PriceCheck, type PriceReport } from '@/lib/ecommerce';
import type { ProviderId } from '@/lib/engine/types';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Prix et avis cités' };
export const dynamic = 'force-dynamic';

const provider = (p: string) => PROVIDER_LABEL[p as ProviderId] ?? p;
const note = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}/5`);
const fmt = (c: Pick<PriceCheck, 'kind'>, v: number | null) => (v === null ? '—' : c.kind === 'prix' ? fmtEur(v) : note(v));

export default async function PrixAvisPage() {
  const ctx = await loadMetier('ecommerce');
  const header = (
    <PageHeader
      title="Prix et avis cités"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
      lead="Les IA citent des prix et des notes, parfois anciens ou faux. Chaque écart avec vos fiches est une erreur à corriger à la source."
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="ecommerce" demo={ctx.demo} /></>;

  let r: PriceReport | null = null;
  try {
    r = await priceReport(ctx.business);
  } catch (e) {
    console.error('[app/produits/prix-avis]', (e as Error).message);
  }

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={PRODUITS_TABS} current="/app/produits/prix-avis" label="Parcours e-commerce" />
        {!r ? (
          <LoadError what="les prix cités" />
        ) : (
          <>
            <Verdict
              tone={r.errors ? 'bad' : 'good'}
              title={r.errors ? `Les IA citent ${r.errors} prix ou note${r.errors > 1 ? 's' : ''} faux` : 'Les prix et notes cités par les IA sont justes'}
              lead={`${r.checks.length} prix ou notes relevés dans les réponses, comparés à vos fiches.`}
              figure={{ value: r.errors, label: `erreur${r.errors > 1 ? 's' : ''} à corriger` }}
              action={r.errors ? { href: '#err-h', label: 'Voir les erreurs', icon: 'alert' } : undefined}
            />
            <KeyFigures
              items={[
                { k: 'Prix ou notes cités', v: r.checks.length },
                { k: 'Erreurs', v: r.errors, extra: r.errors ? 'à corriger' : 'aucune' },
                { k: 'Non vérifiables', v: r.checks.filter((c) => c.verdict === 'non_verifiable').length, extra: 'fiche sans valeur' },
                { k: 'Produits concernés', v: r.products.filter((p) => p.citedPrices.length || p.citedRatings.length).length, extra: `sur ${r.products.length}` },
              ]}
            />

            {r.errors > 0 && (
              <section className="rounded-xl bg-[var(--danger-bg)] p-4 text-[var(--danger-ink)]" aria-labelledby="err-h">
                <h2 id="err-h" className="font-semibold">
                  {r.errors} information{r.errors > 1 ? 's' : ''} fausse{r.errors > 1 ? 's' : ''} dans les réponses des IA
                </h2>
                <p className="mt-1 text-[14px]">Elles sont ajoutées à la vérification de votre fiche de vérité. Corrigez d’abord vos pages (prix visible, balisage Offer à jour), puis les revendeurs qui affichent l’ancien prix.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/app/verite" className="rp-btn rp-btn-sm rp-btn-primary">
                    Ouvrir la fiche de vérité
                  </Link>
                  <Link href="/app/produits/ventes#livrables" className="rp-btn rp-btn-sm">
                    Générer le balisage produit
                  </Link>
                </div>
              </section>
            )}

            <Panel id="checks-h" title="Ce que disent les IA, comparé à vos fiches" pad={false}>
              {r.checks.length === 0 ? (
                <div className="p-4 lg:px-5">
                  <Empty title="Aucun prix ni note cité pour l’instant">Les IA n’ont pas cité de prix ou de note pour vos produits lors de la dernière mesure.</Empty>
                </div>
              ) : (
                <div className="rp-scroll px-2 pb-2 lg:px-3">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th scope="col">Produit</th>
                        <th scope="col" className="hidden sm:table-cell">IA</th>
                        <th scope="col" className="num hidden sm:table-cell">Cité</th>
                        <th scope="col" className="num hidden sm:table-cell">Votre fiche</th>
                        <th scope="col" className="hidden sm:table-cell">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...r.checks]
                        .sort((a, b) => (a.verdict === 'faux' ? -1 : 0) - (b.verdict === 'faux' ? -1 : 0))
                        .map((c, i) => (
                          <tr key={`${c.productId}-${c.provider}-${c.queryId}-${c.kind}-${i}`}>
                            <td className="min-w-[160px]">
                              <span className="font-medium">{c.productName}</span>
                              <span className="block max-w-[calc(100vw-80px)] truncate text-[12px] sm:max-w-[320px] text-[var(--muted)]" title={c.quote.replace(/\*\*/g, '')}>
                                {c.kind === 'prix' ? 'Prix' : 'Note'} · « {c.quote.replace(/\*\*/g, '').replace(/^\s*(?:[-*•]|\d+\.)\s+/, '')} »
                              </span>
                              {/* Mobile : les colonnes repliées sous le produit (pas de tableau à faire défiler) */}
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] sm:hidden">
                                <span className="font-medium">{provider(c.provider)}</span>
                                <span className="rp-num">cité {fmt(c, c.stated)}</span>
                                <span className="rp-num text-[var(--muted)]">fiche {fmt(c, c.expected)}</span>
                                <span className={`rp-chip ${VERDICT_META[c.verdict].chip}`}>{VERDICT_META[c.verdict].label}</span>
                              </span>
                            </td>
                            <td className="hidden text-[13px] sm:table-cell">{provider(c.provider)}</td>
                            <td className="num hidden sm:table-cell">{fmt(c, c.stated)}</td>
                            <td className="num hidden sm:table-cell">{fmt(c, c.expected)}</td>
                            <td className="hidden sm:table-cell">
                              <span className={`rp-chip ${VERDICT_META[c.verdict].chip}`}>{VERDICT_META[c.verdict].label}</span>
                              {c.delta !== null && c.verdict === 'faux' && <span className="rp-num ml-1 text-[12px] text-[var(--muted)]">{c.delta > 0 ? '+' : '−'}{Math.abs(Math.round(c.delta * 100))}&nbsp;%</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel id="concurrents-h" title="Face aux produits concurrents cités dans les mêmes réponses">
              <div className="flex flex-col gap-5">
                {r.products
                  .filter((p) => p.competitors.length || p.citedPrices.length)
                  .map((p) => (
                    <div key={p.productId}>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-[13px] text-[var(--muted)]">
                        Votre fiche : {fmtEur(p.price)} · {note(p.rating)}
                        {p.reviews ? ` (${p.reviews} avis)` : ''}
                      </p>
                      {[...new Set(p.alerts)].map((a) => (
                        <p key={a} className="mt-1 text-[13px] text-[var(--warning-ink)]">
                          {a}
                        </p>
                      ))}
                      {p.competitors.length > 0 && (
                        <div className="rp-scroll mt-2">
                          <table className="rp-table">
                            <thead>
                              <tr>
                                <th scope="col">Cité à côté</th>
                                <th scope="col">IA</th>
                                <th scope="col" className="num">Prix cité</th>
                                <th scope="col" className="num">Note citée</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.competitors.slice(0, 6).map((c, i) => (
                                <tr key={`${c.label}-${c.provider}-${i}`}>
                                  <td className="min-w-[150px] text-[13px]">
                                    {c.label}
                                    {c.brand && c.brand !== c.label ? <span className="text-[var(--muted)]"> ({c.brand})</span> : null}
                                  </td>
                                  <td className="text-[13px]">{provider(c.provider)}</td>
                                  <td className="num">{fmtEur(c.price)}</td>
                                  <td className="num">
                                    {note(c.rating)}
                                    {c.reviews ? <span className="text-[11px] text-[var(--muted)]"> ({c.reviews})</span> : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                {!r.products.some((p) => p.competitors.length || p.citedPrices.length) && <p className="text-[14px] text-[var(--muted)]">Pas encore de prix concurrent cité à comparer.</p>}
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <SourceNote
                  label={r.demo ? 'Démo' : 'Réponses de la dernière mesure, comparées à votre catalogue'}
                  detail={r.demo ? 'Prix, notes et concurrents fictifs. L’erreur de prix est volontaire, pour l’exemple.' : 'Une note n’est jamais inventée : sans note réelle sur votre fiche, le verdict est « non vérifiable ».'}
                  demo={r.demo}
                />
                <NextSteps
                  steps={[
                    { href: '/app/verite', label: 'Fiche de vérité', primary: true },
                    { href: copilotHref(`Prix cités par les IA : ${r.errors} erreur(s). Comment faire corriger les prix et notes affichés ?`, 'produits'), label: 'Demander au copilote' },
                  ]}
                />
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
