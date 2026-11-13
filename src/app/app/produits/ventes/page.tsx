import Link from 'next/link';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { ENGINE_COLOR, ENGINE_LABEL, fmtDate, fmtInt, pct } from '@/components/app/tokens';
import { loadMetier } from '@/components/app/metiers/context';
import { Deliverables } from '@/components/app/metiers/Deliverables';
import { copilotHref, engineRows, fmtEur, REVENUE_SOURCE_LABEL, revenueCompare } from '@/components/app/metiers/logic';
import { ShopifyConnect } from '@/components/app/metiers/ShopifyConnect';
import { ShopifyReturnNotice, shopifyReturnStatus } from '@/components/app/metiers/ShopifyReturn';
import { KeyFigures, LoadError, Meter, NextSteps, ParcoursGate, PRODUITS_TABS, SourceNote, SubNav } from '@/components/app/metiers/ui';
import { Verrou } from '@/components/app/shell/Verrou';
import { connectionStatus, getCatalog, revenueReport, type Catalog, type RevenueReport } from '@/lib/ecommerce';
import type { AiEngine } from '@/lib/engine/types-v2';
import { Verdict } from '@/components/app/v4/Verdict';

export const metadata = { title: 'Ventes venues des IA' };
export const dynamic = 'force-dynamic';

const times = (x: number | null) => (x === null ? null : `${x.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}×`);

export default async function VentesPage({ searchParams }: { searchParams: Promise<{ produit?: string; shopify?: string }> }) {
  const sp = await searchParams;
  const ctx = await loadMetier('ecommerce');
  const header = (
    <PageHeader
      title="Ventes venues des IA"
      meta={<>{ctx.ws.business.name}{ctx.demo ? ' · démo' : ''} · 30 jours</>}
      lead="Le chiffre d’affaires des commandes dont la visite venait d’une IA. Un plancher : une partie des ventes inspirées par une IA arrive sans trace."
    />
  );
  if (!ctx.inParcours) return <>{header}<ParcoursGate parcours="ecommerce" demo={ctx.demo} /></>;

  const b = ctx.business;
  let r: RevenueReport | null = null;
  let catalog: Catalog | null = null;
  let shop = { enabled: false, connected: false, shop: null as string | null, connectedAt: null as string | null };
  try {
    [r, catalog, shop] = await Promise.all([revenueReport(b, 30), getCatalog(b), connectionStatus(b.id)]);
  } catch (e) {
    console.error('[app/produits/ventes]', (e as Error).message);
  }
  const returned = shopifyReturnStatus(sp.shopify);
  const categories = catalog ? [...new Set(catalog.products.map((p) => p.category).filter((c): c is string => Boolean(c)))] : [];

  return (
    <>
      {header}
      <div className="rp-page">
        <SubNav tabs={PRODUITS_TABS} current="/app/produits/ventes" label="Parcours e-commerce" />
        {returned && <ShopifyReturnNotice status={returned} />}
        {!r ? <LoadError what="vos ventes" /> : <Revenue r={r} />}

        <Panel id="shopify-h" title="Connexion Shopify" aside={shop.connected ? 'connectée' : shop.enabled ? 'non connectée' : 'indisponible'}>
          {!shop.enabled ? (
            <p className="text-[14px] text-[var(--muted)]">
              Le connecteur Shopify n’est pas encore activé sur ce service. En attendant, le script de suivi Repéré mesure les commandes avec leur montant (page Trafic et ventes).
            </p>
          ) : (
            <Verrou ent={ctx.ent} feature="integrations" titre="Connexion Shopify">
              <ShopifyConnect businessId={b.id} demo={ctx.demo} connected={shop.connected} shop={shop.shop} connectedAt={shop.connectedAt} />
            </Verrou>
          )}
        </Panel>

        <Panel id="livrables" title="Livrables : FAQ produit et guide d’achat">
          <p className="mb-4 text-[14px] text-[var(--muted)]">Des réponses claires sur vos pages donnent aux IA de quoi citer votre site plutôt qu’un revendeur. Les informations manquantes restent marquées « à compléter » : rien n’est inventé.</p>
          <Deliverables
            businessId={b.id}
            products={(catalog?.products ?? []).map((p) => ({ id: p.id, name: p.name }))}
            categories={categories}
            llmAllowed={ctx.ent.execution && !ctx.demo}
            llmLock={!ctx.ent.execution ? <Verrou ent={ctx.ent} feature="execution" titre="Reformulation par IA" compact /> : undefined}
            initialProduct={typeof sp.produit === 'string' ? sp.produit : null}
          />
        </Panel>
      </div>
    </>
  );
}

function Revenue({ r }: { r: RevenueReport }) {
  if (r.source === 'none')
    return (
      <Empty
        title="Aucune vente mesurée pour l’instant"
        action={
          <Link href="/app/trafic" className="rp-btn rp-btn-primary">
            Installer le script de suivi
          </Link>
        }
      >
        Connectez Shopify ci-dessous, ou installez le script de suivi Repéré avec la valeur de commande : les ventes venues de ChatGPT, Perplexity ou Gemini apparaîtront ici.
      </Empty>
    );
  const cmp = revenueCompare(r);
  const engines = engineRows<AiEngine>(r.byEngine);
  const maxRev = Math.max(1, ...engines.map((e) => e.line.revenueEur));
  return (
    <>
      <Verdict
        tone={r.ai.orders > 0 ? 'good' : 'neutral'}
        title={r.ai.orders > 0 ? `Les IA vous ont apporté ${fmtInt(r.ai.orders)} commande${r.ai.orders > 1 ? 's' : ''}${r.aiRevenueShare !== null ? `, ${pct(r.aiRevenueShare, 1)} de votre CA` : ''}` : 'Aucune commande venue des IA sur la période'}
        lead={`${fmtInt(r.ai.visits)} visites venues des IA, du ${fmtDate(r.from, { day: 'numeric', month: 'short' })} au ${fmtDate(r.to, { day: 'numeric', month: 'short' })}. C’est un plancher.`}
        figure={{ value: Math.round(r.ai.revenueEur), suffix: ' €', label: 'de CA venu des IA' }}
        action={{ href: '#moteurs-h', label: 'Voir le détail par IA', icon: 'trend' }}
      />
      <div data-visite="ventes">
        <KeyFigures
          items={[
            { k: 'CA venu des IA', v: fmtEur(r.ai.revenueEur, 0), extra: r.aiRevenueShare !== null ? `${pct(r.aiRevenueShare, 1)} du CA` : undefined },
            { k: 'Commandes', v: fmtInt(r.ai.orders), extra: `${fmtInt(r.ai.visits)} visites` },
            { k: 'Panier moyen IA', v: fmtEur(r.ai.aov), extra: r.other.aov !== null ? `autres : ${fmtEur(r.other.aov)}` : undefined },
            { k: 'Conversion IA', v: r.ai.conversionRate === null ? '—' : pct(r.ai.conversionRate, 1), extra: r.other.conversionRate !== null ? `autres : ${pct(r.other.conversionRate, 1)}` : undefined },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-5">
        <Panel id="moteurs-h" title="Par IA" aside={`${fmtDate(r.from, { day: 'numeric', month: 'short' })} – ${fmtDate(r.to, { day: 'numeric', month: 'short' })}`}>
          {engines.length ? (
            <ul className="flex flex-col gap-3">
              {engines.map(({ engine, line }) => (
                <li key={engine} className="grid grid-cols-[minmax(90px,28%)_1fr] items-center gap-x-3 gap-y-1 text-[14px] sm:grid-cols-[minmax(90px,22%)_1fr_auto]">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: ENGINE_COLOR[engine] }} aria-hidden="true" />
                    {ENGINE_LABEL[engine]}
                  </span>
                  <Meter value={line.revenueEur} max={maxRev} color="var(--primary)" />
                  <span className="rp-num col-span-2 text-[13px] sm:col-span-1 sm:text-right">
                    <strong>{fmtEur(line.revenueEur, 0)}</strong>
                    <span className="text-[var(--muted)]">
                      {' '}
                      · {line.orders} cde · panier {fmtEur(line.aov, 0)} · conv. {line.conversionRate === null ? '—' : pct(line.conversionRate, 1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-[var(--muted)]">Pas encore de commande attribuée à une IA sur la période.</p>
          )}
        </Panel>
        <Panel id="compare-h" title="Comparé aux autres visites">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Conversion</dt>
              <dd className="rp-display rp-num text-[26px]">{times(cmp.conversion) ?? '—'}</dd>
              <dd className="text-[12px] text-[var(--muted)]">celle des autres visites</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--muted)]">Panier moyen</dt>
              <dd className="rp-display rp-num text-[26px]">{times(cmp.aov) ?? '—'}</dd>
              <dd className="text-[12px] text-[var(--muted)]">celui des autres visites</dd>
            </div>
          </dl>
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Autres sources : {fmtInt(r.other.orders)} commandes, {fmtEur(r.other.revenueEur, 0)}. Une comparaison sur peu de commandes reste fragile.
          </p>
        </Panel>
      </div>

      {r.products.length > 0 && (
        <Panel id="produits-ventes-h" title="Produits d’arrivée" pad={false}>
          <div className="rp-scroll px-2 pb-2 lg:px-3">
            <table className="rp-table">
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col" className="num">Visites IA</th>
                  <th scope="col" className="num">Commandes</th>
                  <th scope="col" className="num">CA</th>
                </tr>
              </thead>
              <tbody>
                {r.products.slice(0, 10).map((p) => (
                  <tr key={p.path}>
                    <td className="font-medium">
                      {p.name}
                      <span className="block text-[12px] text-[var(--muted)]">{p.path}</span>
                    </td>
                    <td className="num">{fmtInt(p.visits)}</td>
                    <td className="num">{fmtInt(p.orders)}</td>
                    <td className="num">{fmtEur(p.revenueEur, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="flex flex-col gap-3">
        <SourceNote label={REVENUE_SOURCE_LABEL[r.source]} detail={r.caveats.join(' ')} demo={r.demo} />
        <NextSteps
          steps={[
            { href: '/app/produits', label: 'Produits les plus cités', primary: true },
            { href: '/app/trafic', label: 'Trafic et ventes' },
            { href: copilotHref(`Ventes venues des IA sur 30 jours : ${fmtEur(r.ai.revenueEur, 0)}, ${r.ai.orders} commandes. Comment augmenter ce chiffre ?`, 'produits'), label: 'Demander au copilote' },
          ]}
        />
      </div>
    </>
  );
}
