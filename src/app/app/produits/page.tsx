import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { fmtDate, pct } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { copilotHref, demoProductHtml, fmtEur, scoresByProduct, scoreTone, type ProductScore } from '@/components/app/metiers/logic';
import { AuditFicheButton, CatalogAdd } from '@/components/app/metiers/ProduitsClient';
import { KeyFigures, LoadError, NextSteps, ParcoursGate, PRODUITS_TABS, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { buildProductTracking, connectionStatus, loadContext, type Catalog, type ProductTrackingReport } from '@/lib/ecommerce';
import { productFromHtml } from '@/lib/siteaudit';
import { listRuns } from '@/lib/siteaudit/runs';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Produits' };
export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = { manual: 'saisie', url: 'fiche lue', sitemap: 'plan du site', products_json: 'catalogue public', shopify: 'Shopify', demo: 'démo' };

export default async function ProduitsPage() {
  const ctx = await loadMetier('ecommerce');
  const header = (
    <PageHeader
      title="Produits"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''}</>}
      lead="Quels produits les IA recommandent quand on leur demande quoi acheter, et si vos fiches leur donnent de quoi vous citer."
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="ecommerce" demo={ctx.demo} /></>;

  const b = ctx.business;
  let catalog: Catalog | null = null;
  let tracking: ProductTrackingReport | null = null;
  let scores: Record<string, ProductScore> = {};
  let shopify = { enabled: false, connected: false };
  try {
    const c = await loadContext(b);
    catalog = c.catalog;
    tracking = buildProductTracking(c.audit, c.catalog, { demo: c.demo });
    if (ctx.demo) {
      // Démo : vrai audit de fiche sur une page reconstituée à partir des seuls champs du catalogue fictif.
      for (const p of c.catalog.products) {
        const r = productFromHtml(demoProductHtml(p, c.catalog.brand), p.url ?? null);
        scores[p.id] = { score: r.score, at: p.updatedAt, fixes: r.fixes, missing: r.missing, demo: true };
      }
    } else {
      const [runs, st] = await Promise.all([listRuns(b.id, 100).catch(() => []), connectionStatus(b.id)]);
      scores = scoresByProduct(c.catalog.products, runs);
      shopify = st;
    }
  } catch (e) {
    console.error('[app/produits]', (e as Error).message);
  }

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={PRODUITS_TABS} current="/app/produits" label="Parcours e-commerce" />
        {!catalog || !tracking ? (
          <LoadError what="votre catalogue" />
        ) : (
          <>
            {tracking.products.length > 0 && (() => {
              const never = tracking.products.filter((p) => p.appearances === 0).length;
              const cited = tracking.products.length - never;
              return (
                <Verdict
                  tone={never === 0 ? 'good' : never > cited ? 'bad' : 'warn'}
                  title={never === 0 ? 'Les IA citent chacun de vos produits suivis' : `${never} produit${never > 1 ? 's' : ''} sur ${tracking.products.length} jamais cité${never > 1 ? 's' : ''} par les IA`}
                  lead={`Sur ${tracking.answersAnalyzed} réponses analysées.`}
                  figure={{ value: cited, suffix: `/${tracking.products.length}`, label: 'produits cités au moins une fois' }}
                  action={{ href: '#catalogue-h', label: 'Voir les fiches à corriger', icon: 'box' }}
                />
              );
            })()}
            <KeyFigures
              items={[
                { k: 'Produits suivis', v: catalog.products.length },
                { k: 'Cités au moins une fois', v: tracking.products.filter((p) => p.appearances > 0).length, extra: `sur ${tracking.products.length}` },
                { k: 'Réponses analysées', v: tracking.answersAnalyzed, extra: tracking.measuredAt ? fmtDate(tracking.measuredAt, { day: 'numeric', month: 'short' }) : undefined },
                { k: 'Fiches à corriger', v: Object.values(scores).filter((s) => s.score < 75).length, extra: `sur ${Object.keys(scores).length} analysées` },
              ]}
            />

            <Panel id="catalogue-h" title="Catalogue suivi" aside={catalog.products.length ? `${catalog.products.length} produit${catalog.products.length > 1 ? 's' : ''}` : undefined} pad={false}>
              {catalog.products.length === 0 ? (
                <div className="p-4 lg:px-5">
                  <Empty title="Aucun produit suivi">Ajoutez vos fiches produit ci-dessous : nous les lisons, notons leur balisage et suivons leur présence dans les réponses des IA.</Empty>
                </div>
              ) : (
                <div className="rp-scroll px-2 pb-2 lg:px-3" data-visite="produits">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th scope="col">Produit</th>
                        <th scope="col" className="num">Fiche</th>
                        <th scope="col" className="num">Présence IA</th>
                        <th scope="col" className="num">Rang moyen</th>
                        <th scope="col">Recommandé à sa place</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.products.map((p) => {
                        const st = tracking!.products.find((x) => x.productId === p.id);
                        const sc = scores[p.id];
                        return (
                          <tr key={p.id}>
                            <td className="min-w-[180px]">
                              <span className="font-medium">{p.name}</span>
                              <span className="block text-[12px] text-[var(--muted)]">
                                {[p.category, p.price !== undefined ? fmtEur(p.price) : null, SOURCE_LABEL[p.source]].filter(Boolean).join(' · ')}
                              </span>
                            </td>
                            <td className="num">
                              {sc ? (
                                <span className={`rp-chip rp-chip-${scoreTone(sc.score)} rp-num`} title={sc.missing.length ? `Manque : ${sc.missing.join(', ')}` : 'Fiche complète'}>
                                  {sc.score}/100
                                </span>
                              ) : (
                                <span className="text-[12px] text-[var(--muted)]">non analysée</span>
                              )}
                            </td>
                            <td className="num">
                              {st && st.answers ? (
                                <>
                                  {pct(st.visibility)}
                                  <span className="block text-[11px] text-[var(--muted)]">
                                    {st.appearances}/{st.answers} réponses
                                  </span>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="num">{st?.avgRank ? st.avgRank.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}</td>
                            <td className="max-w-[220px] text-[13px]">{st?.recommendedInstead.length ? st.recommendedInstead.slice(0, 2).map((r) => r.label).join(', ') : '—'}</td>
                            <td>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {p.url && !ctx.demo && <AuditFicheButton businessId={b.id} url={p.url} demo={false} label={sc ? 'Réanalyser' : 'Analyser'} />}
                                <Link href={`/app/produits/ventes?produit=${encodeURIComponent(p.id)}#livrables`} className="rp-btn rp-btn-sm rp-btn-ghost">
                                  FAQ
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-col gap-3 border-t border-[var(--hair)] p-4 lg:px-5">
                <SourceNote
                  label={ctx.demo ? 'Démo' : 'Votre catalogue et la dernière mesure'}
                  detail={ctx.demo ? 'Maison Sora est une marque fictive ; scores de fiche calculés sur ses champs de catalogue.' : 'Score de fiche : balisage Product, prix, disponibilité, avis, livraison, retours (audit de fiche Repéré).'}
                  demo={ctx.demo}
                />
                <FixesSummary scores={scores} names={Object.fromEntries(catalog.products.map((p) => [p.id, p.name]))} />
              </div>
            </Panel>

            <Panel id="questions-h" title="Produits cités par les IA, question par question" pad={false}>
              {tracking.queries.length === 0 ? (
                <div className="p-4 lg:px-5">
                  <Empty title="Pas encore de réponses à analyser">Les produits cités apparaîtront après la prochaine mesure de vos questions suivies.</Empty>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--hair)]">
                  {tracking.queries.map((q) => (
                    <li key={q.queryId} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:px-5">
                      <div>
                        <p className="font-medium">« {q.query} »</p>
                        <p className="mt-0.5 text-[13px]">
                          {q.bestClientRank ? (
                            <span className="rp-chip rp-chip-success">Le vôtre : n°{q.bestClientRank}</span>
                          ) : q.clientBrandAnswers ? (
                            <span className="rp-chip rp-chip-warning">Votre marque, sans produit précis</span>
                          ) : (
                            <span className="rp-chip rp-chip-danger">Vous n’y êtes pas</span>
                          )}
                          <span className="ml-2 text-[var(--muted)]">
                            {q.clientProductAnswers}/{q.answers} réponses avec un de vos produits
                          </span>
                        </p>
                      </div>
                      <ol className="flex flex-col gap-1 text-[13px]">
                        {q.recommended.slice(0, 4).map((r, i) => (
                          <li key={`${r.label}-${i}`} className="flex items-baseline gap-2">
                            <span className="rp-num w-8 flex-none text-[var(--muted)]">{r.avgRank.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
                            <span className={r.isClient ? 'font-semibold text-[var(--success-ink)]' : ''}>
                              {r.label}
                              {r.brand && r.brand !== r.label ? <span className="text-[var(--muted)]"> ({r.brand})</span> : null}
                            </span>
                            <span className="ml-auto text-[var(--muted)]">×{r.count}</span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-4 pb-4 lg:px-5">
                <p className="mb-3 mt-1 text-[12px] text-[var(--muted)]">Rang moyen à gauche (1 = premier cité), nombre de réponses à droite. {tracking.notes.join(' ')}</p>
                <NextSteps
                  steps={[
                    { href: '/app/produits/revendeurs', label: 'Où les IA envoient l’acheteur', primary: true },
                    { href: '/app/produits/prix-avis', label: 'Prix et notes cités' },
                    { href: copilotHref(`Produits : ${tracking.products.filter((p) => p.appearances === 0).map((p) => p.name).slice(0, 3).join(', ') || 'aucun'} jamais cités par les IA. Que faire ?`, 'produits'), label: 'Demander au copilote' },
                  ]}
                />
              </div>
            </Panel>

            <Panel id="ajout-h" title="Ajouter des produits">
              <CatalogAdd businessId={b.id} demo={ctx.demo} shopifyConnected={shopify.connected} site={b.website} />
            </Panel>
          </>
        )}
      </div>
    </>
  );
}

function FixesSummary({ scores, names }: { scores: Record<string, ProductScore>; names: Record<string, string> }) {
  const worst = Object.entries(scores)
    .filter(([, s]) => s.fixes.length)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3);
  if (!worst.length) return null;
  return (
    <div>
      <p className="text-[13px] font-semibold">Fiches à reprendre en premier</p>
      <ul className="mt-1 flex flex-col gap-1 text-[13px]">
        {worst.map(([id, s]) => (
          <li key={id}>
            <strong>{names[id] ?? id}</strong> ({s.score}/100) : {s.fixes.slice(0, 2).map((f) => f.fix).join(' ')}{' '}
            <Link className="rp-link" href={`/app/produits/ventes?produit=${encodeURIComponent(id)}#livrables`}>
              Générer le balisage
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
