import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import { adaptSnippet, adaptTasks, adaptTraffic } from '@/components/app/adapters';
import { CategoryBars } from '@/components/app/Charts';
import { CopyButton } from '@/components/app/CopyButton';
import { Icon } from '@/components/app/icons';
import { Empty, PageHeader, Panel } from '@/components/app/PageHeader';
import { Ga4Button, TrafficChart } from '@/components/app/TrafficClient';
import { ENGINE_COLOR, ENGINE_LABEL, ENGINE_ORDER, fmtDate, fmtInt, pct } from '@/components/app/tokens';
import { copilotHref, loadActionContext } from '@/components/app/action/context';
import { VerrouBouton } from '@/components/app/shell/Verrou';
import { listAnnotations } from '@/lib/annotations';
import { connectionStatus } from '@/lib/ecommerce';
import { Verdict } from '@/components/app/v4/Verdict';
import { FillBar, InView } from '@/components/app/v4/motion';

export const metadata = { title: 'Trafic et ventes' };

const BOT_KIND: Record<string, { kind: string; note: string }> = {
  'ChatGPT-User': { kind: 'Visite en direct', note: 'Une personne vient de poser une question qui mène à votre page' },
  'Perplexity-User': { kind: 'Visite en direct', note: 'Idem, côté Perplexity' },
  'Claude-User': { kind: 'Visite en direct', note: 'Idem, côté Claude' },
  'OAI-SearchBot': { kind: 'Indexation', note: 'Condition pour être cité par ChatGPT' },
  PerplexityBot: { kind: 'Indexation', note: 'Condition pour être cité par Perplexity' },
  'Claude-SearchBot': { kind: 'Indexation', note: 'Condition pour être cité par Claude' },
  Applebot: { kind: 'Indexation', note: 'Siri et Apple Intelligence' },
  GPTBot: { kind: 'Entraînement', note: 'Aucun trafic en retour' },
  ClaudeBot: { kind: 'Entraînement', note: 'Aucun trafic en retour' },
};

function wordpressPluginAvailable() {
  try {
    return existsSync(join(process.cwd(), 'public', 'integrations', 'repere-ia-wordpress.zip'));
  } catch {
    return false;
  }
}

export default async function TraficPage() {
  const { ws, ent } = await loadActionContext();
  const id = ws.business.id;
  const [t, t30, tasks] = await Promise.all([adaptTraffic(id, 90, ws.fb), adaptTraffic(id, 30, ws.fb), adaptTasks(id, ws.fb)]);
  const snippet = adaptSnippet(id);
  const ga4 = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const wp = wordpressPluginAvailable();

  if (!t) {
    return (
      <>
        <PageHeader title="Trafic et ventes" />
        <div className="rp-page">
          <div data-visite="trafic">
            <Empty title="Aucune visite mesurée pour l’instant" action={<CopyButton text={snippet} label="Copier le code de suivi" small={false} />}>
              Collez ce code dans le &lt;head&gt; de toutes vos pages (ou installez le plugin WordPress) : les visites envoyées par ChatGPT, Perplexity, Gemini ou Claude apparaîtront ici dès le lendemain.
            </Empty>
            <pre className="rp-code mt-3">{snippet}</pre>
          </div>
        </div>
      </>
    );
  }

  const last30 = t.days.slice(-30);
  const prev30 = t.days.slice(-60, -30);
  const sum = (ds: typeof t.days) => ds.reduce((s, d) => s + Object.values(d.visits).reduce((a, b) => a + (b ?? 0), 0), 0);
  const v30 = sum(last30);
  const vPrev = sum(prev30);
  const all30 = last30.reduce((s, d) => s + d.totalVisits, 0);
  const conv30 = last30.reduce((s, d) => s + Object.values(d.conversions).reduce((a, b) => a + (b ?? 0), 0), 0);
  const growth = vPrev ? Math.round(((v30 - vPrev) / vPrev) * 100) : null;
  const byEngine = ENGINE_ORDER.map((e) => ({ e, v: last30.reduce((s, d) => s + (d.visits[e] ?? 0), 0) })).filter((x) => x.v > 0);
  const bots: Record<string, { n: number; last: string }> = {};
  for (const d of t.days)
    for (const [b, n] of Object.entries(d.bots ?? {}))
      if (n > 0) {
        bots[b] = { n: (bots[b]?.n ?? 0) + n, last: d.date };
      }
  const botRows = Object.entries(bots).sort((a, b) => b[1].n - a[1].n);
  const lastDay = [...t.days].reverse().find((d) => d.totalVisits > 0)?.date;
  const actions = tasks.filter((x) => x.status === 'done' && x.doneAt).map((x) => ({ date: x.doneAt!, label: `Action faite : ${x.title}` }));
  // Repères posés à la main (ou par d'autres écrans) sur la courbe de trafic : même liste que les autres courbes.
  const notes = await listAnnotations(id, { series: 'traffic' }).catch(() => []);
  for (const n of notes) if (!n.taskId && !actions.some((a) => a.date.slice(0, 10) === n.date && a.label.includes(n.label))) actions.push({ date: n.date, label: n.kind === 'external' ? `Événement : ${n.label}` : `Repère : ${n.label}` });
  // TR6 : la question d'audit dont une réponse cite la page d'arrivée (jointure avec les URL citées).
  const queryText = new Map((ws.latest?.queries ?? []).map((q) => [q.id, q.text]));
  const site = (ws.business.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const citedFrom = (path: string): string | null => {
    for (const u of ws.latest?.sources?.urls ?? []) {
      try {
        const url = new URL(u.url);
        if (site && !url.hostname.replace(/^www\./, '').endsWith(site)) continue;
        if ((url.pathname.replace(/\/$/, '') || '/') !== (path.replace(/\/$/, '') || '/')) continue;
        const q = u.queries.map((x) => queryText.get(x)).find(Boolean);
        if (q) return q;
      } catch {
        /* URL illisible */
      }
    }
    return null;
  };
  const shopify = ws.segment === 'ecommerce' ? await connectionStatus(id).catch(() => null) : null;
  const exportHref = `/api/export?businessId=${encodeURIComponent(id)}&kind=traffic`;
  const missingIndex = ['OAI-SearchBot', 'PerplexityBot'].filter((b) => !bots[b]);
  const seg = ws.segment;
  const commerce = t30?.commerce ?? null;
  const eur = (n: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)}\u00a0€`;
  // 3ᵉ carte : la valeur prouvée selon le parcours (appels pour un artisan, commandes et CA pour une boutique).
  const valueCard =
    seg === 'local'
      ? { k: 'Appels déclenchés', v: fmtInt(conv30), extra: 'clics sur votre numéro ou e-mail' }
      : seg === 'ecommerce' && commerce
        ? { k: 'Commandes venues des IA', v: fmtInt(commerce.orders), extra: `${eur(commerce.revenueEur)} de CA` }
        : seg === 'ecommerce'
          ? { k: 'Conversions suivies', v: fmtInt(conv30), extra: 'connectez Shopify pour le CA' }
          : { k: 'Demandes de contact', v: fmtInt(conv30), extra: 'formulaire ou rendez-vous envoyé après une visite IA' };
  const pages = (t30 ?? t).topLandingPages;
  const maxPage = Math.max(1, ...pages.slice(0, 8).map((p) => p.visits));
  const firstEngine = [...byEngine].sort((a, b) => b.v - a.v)[0];
  const verdictTitle =
    v30 === 0
      ? 'Aucune visite venue des IA ces 30 derniers jours'
      : seg === 'ecommerce' && commerce && commerce.orders > 0
        ? `Les IA vous ont apporté ${fmtInt(commerce.orders)} commande${commerce.orders > 1 ? 's' : ''} et ${eur(commerce.revenueEur)} en 30 jours`
        : growth !== null && growth >= 10
          ? `Les visites venues des IA progressent de ${growth} % en 30 jours`
          : growth !== null && growth <= -10
            ? `Les visites venues des IA reculent de ${Math.abs(growth)} % en 30 jours`
            : `${firstEngine ? ENGINE_LABEL[firstEngine.e] : 'Les IA'} vous envoie${firstEngine ? '' : 'nt'} le plus de visites ce mois-ci`;

  return (
    <>
      <PageHeader
        title="Trafic et ventes"
        meta={<>{fmtDate(t.from, { day: 'numeric', month: 'short' })} – {fmtDate(t.to, { day: 'numeric', month: 'short' })}{t.demo ? ' · démo' : ''}</>}
        actions={
          <>
            <VerrouBouton ent={ent} feature="exports" label="CSV">
              <a href={exportHref} className="rp-btn rp-btn-sm" download>
                <Icon name="download" size={15} /> CSV
              </a>
            </VerrouBouton>
          </>
        }
      />
      <div className="rp-page">
        <Verdict
          tone={v30 === 0 ? 'neutral' : growth !== null && growth <= -10 ? 'bad' : growth !== null && growth >= 10 ? 'good' : 'brand'}
          title={verdictTitle}
          lead={`${fmtInt(v30)} visites envoyées par ChatGPT, Perplexity, Gemini ou Claude, soit ${pct(all30 ? v30 / all30 : 0, 1)} de votre trafic.`}
          figure={{ value: v30, label: 'visites venues des IA, 30 jours' }}
          delta={growth !== null ? <span className={`rp-chip rp-num ${growth > 0 ? 'rp-chip-success' : growth < 0 ? 'rp-chip-danger' : ''}`}><span aria-hidden="true">{growth > 0 ? '↑' : growth < 0 ? '↓' : '→'}</span>{growth > 0 ? '+' : growth < 0 ? '−' : ''}{Math.abs(growth)}&nbsp;%<span className="sr-only"> par rapport aux 30 jours précédents</span></span> : undefined}
          action={missingIndex.length ? { href: '/app/technique', label: `Ouvrir votre site à ${missingIndex[0]}`, icon: 'shield' } : { href: '#pages-h', label: 'Voir les pages qui reçoivent ces visites', icon: 'eye' }}
          secondary={
            <Link href={copilotHref('trafic', 'Pourquoi mon trafic venu des IA a-t-il bougé ?')} className="rp-btn">
              <Icon name="spark" size={15} /> Demander au copilote
            </Link>
          }
          details={<p>C’est un plancher mesuré : les visites sans referrer ni UTM restent invisibles, et Google AI Overviews est fondu dans le trafic Google classique.</p>}
        />
        <dl className="rp-panel grid grid-cols-2 lg:grid-cols-4" data-visite="trafic">
          {[
            { k: 'Visites IA, 30 jours', v: fmtInt(v30), extra: growth !== null ? `${growth >= 0 ? '+' : '−'}${Math.abs(growth)}\u00a0% sur 30\u00a0j` : '' },
            { k: 'Part du trafic total', v: pct(all30 ? v30 / all30 : 0, 1), extra: 'plancher' },
            valueCard,
            { k: 'Premier moteur', v: byEngine.sort((a, b) => b.v - a.v)[0] ? ENGINE_LABEL[byEngine[0].e] : '—', extra: byEngine[0] ? pct(byEngine[0].v / Math.max(1, v30)) : '' },
          ].map((x, i) => (
            <div key={x.k} className={`border-[var(--hair)] p-4 lg:px-6 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 1 ? 'lg:border-r' : ''}`}>
              <dt className="text-[12px] text-[var(--muted)]">{x.k}</dt>
              <dd className="mt-1">
                <span className="rp-display rp-num text-[24px]">{x.v}</span>
                {x.extra && <span className="ml-1.5 text-[12px] text-[var(--muted)]">{x.extra}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <Panel id="curve-h" title="Visites venues des IA, par moteur">
          <TrafficChart initial={t} businessId={id} actions={actions} />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <Panel id="engines-h" title="Répartition par moteur, 30 jours">
            <CategoryBars title="Visites IA par moteur" total={v30} rows={byEngine.map((x) => ({ label: ENGINE_LABEL[x.e], value: x.v, color: ENGINE_COLOR[x.e] }))} />
            <p className="mt-4 rounded-lg bg-[var(--bg)] p-3 text-[12px] text-[var(--muted)]">
              Non mesurable : Google AI Overviews et AI Mode sont fondus dans le trafic Google classique, et les applications mobiles arrivent souvent sans referrer. Le « direct » n’est jamais attribué à une IA.
            </p>
          </Panel>
          <Panel id="pages-h" title="Pages d’arrivée, 30 jours" pad={false} className="scroll-mt-20">
            <InView as="ul" className="v4-list v4-cascade" aria-label="Pages d’arrivée des visites IA">
              {pages.slice(0, 8).map((p, i) => {
                const from = citedFrom(p.path);
                return (
                  <li key={p.path} className="v4-item">
                    <div className="min-w-0">
                      <p className="v4-item-title truncate" title={p.path}>
                        {p.path}
                        {p.path.startsWith('/p/') && <span className="rp-chip rp-chip-primary ml-2">Page Repéré</span>}
                      </p>
                      <p className="v4-item-sub">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: ENGINE_COLOR[p.engine] }} aria-hidden="true" />
                        Surtout {ENGINE_LABEL[p.engine]}
                        {from ? <> · probablement depuis « {from} »</> : null}
                      </p>
                    </div>
                    <p className="v4-item-num">
                      {fmtInt(p.visits)}
                      <span className="sr-only"> visites</span>
                    </p>
                    <FillBar value={p.visits / maxPage} delay={i * 40} />
                  </li>
                );
              })}
            </InView>
            {pages.length === 0 && <p className="p-4 text-[14px] text-[var(--muted)] lg:px-5">Aucune page d’arrivée sur 30 jours.</p>}
          </Panel>
        </div>

        {seg === 'ecommerce' && (
          <Panel
            id="sales-h"
            title="Commandes et CA venus des IA, 30 jours"
            aside={commerce ? (commerce.source === 'demo' ? 'démo' : commerce.source === 'shopify' ? 'Shopify' : 'GA4') : undefined}
            pad={false}
          >
            {commerce ? (
              <>
                <p className="px-4 pt-3 text-[14px] lg:px-5">
                  <strong className="rp-num">{fmtInt(commerce.orders)}</strong> commande{commerce.orders > 1 ? 's' : ''} et <strong className="rp-num">{eur(commerce.revenueEur)}</strong> de chiffre d’affaires
                  dont la visite d’arrivée venait d’une IA
                  {Object.entries(commerce.byEngine).length > 0 &&
                    ` (${Object.entries(commerce.byEngine)
                      .filter(([, v]) => (v?.orders ?? 0) > 0)
                      .sort((a, b) => (b[1]?.revenueEur ?? 0) - (a[1]?.revenueEur ?? 0))
                      .map(([e, v]) => `${ENGINE_LABEL[e as keyof typeof ENGINE_LABEL]} ${v?.orders} · ${eur(v?.revenueEur ?? 0)}`)
                      .join(' ; ')})`}
                  .
                </p>
                <div className="rp-scroll px-2 pb-2 lg:px-3">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th scope="col">Produit d’arrivée</th>
                        <th scope="col" className="num">Visites IA</th>
                        <th scope="col" className="num">Commandes</th>
                        <th scope="col" className="num">CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commerce.products.map((p) => (
                        <tr key={p.path}>
                          <td className="font-medium">
                            {p.name}
                            <span className="block text-[12px] text-[var(--muted)]">{p.path}</span>
                          </td>
                          <td className="num">{fmtInt(p.visits)}</td>
                          <td className="num">{fmtInt(p.orders)}</td>
                          <td className="num">{eur(p.revenueEur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 pb-4 text-[12px] text-[var(--muted)] lg:px-5">
                  Attribution : commandes Shopify dont la page d’arrivée ou le référent de la session vient d’une IA (webhook orders/create, landing_site, referring_site, UTM). Plancher : une partie des ventes venues des IA n’est pas attribuable.
                </p>
              </>
            ) : (
              <p className="p-4 text-[14px] text-[var(--muted)] lg:px-5">
                Connectez Shopify (ou GA4 avec le suivi e-commerce) pour voir les commandes et le chiffre d’affaires venus de ChatGPT, Perplexity ou Gemini, produit par produit.
              </p>
            )}
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          <Panel id="bots-h" title="Robots IA qui lisent votre site" aside="90 jours" pad={false}>
            {missingIndex.length > 0 && (
              <p className="mx-4 mb-1 mt-3 flex items-start gap-2 rounded-lg bg-[var(--warning-bg)] p-3 text-[13px] text-[var(--warning-ink)] lg:mx-5">
                <Icon name="alert" size={16} className="mt-0.5 flex-none" />
                {missingIndex.join(' et ')} n’{missingIndex.length > 1 ? 'ont' : 'a'} pas visité votre site : vérifiez votre robots.txt, sinon vous restez invisible dans cette IA.
              </p>
            )}
            {botRows.length ? (
              <ul className="v4-list" aria-label="Robots IA">
                {botRows.map(([b, x]) => (
                  <li key={b} className="v4-item">
                    <div className="min-w-0">
                      <p className="v4-item-title">
                        {b} <span className={`rp-chip ml-1 ${BOT_KIND[b]?.kind === 'Visite en direct' ? 'rp-chip-success' : BOT_KIND[b]?.kind === 'Indexation' ? 'rp-chip-primary' : ''}`}>{BOT_KIND[b]?.kind ?? 'Autre'}</span>
                      </p>
                      <p className="v4-item-sub">
                        {BOT_KIND[b]?.note ? `${BOT_KIND[b].note} · ` : ''}dernier passage le {fmtDate(x.last, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <p className="v4-item-num">
                      {fmtInt(x.n)}
                      <span className="sr-only"> passages</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-[14px] text-[var(--muted)] lg:px-5">Les passages de robots s’affichent avec le plugin WordPress ou l’export de logs.</p>
            )}
          </Panel>

          <Panel
            id="install-h"
            title="Installation"
            aside={
              t.installed ? (
                <span className="rp-chip rp-chip-success">
                  <Icon name="check" size={12} /> Snippet actif
                </span>
              ) : (
                <span className="rp-chip rp-chip-warning">Pas encore reçu</span>
              )
            }
          >
            <p className="text-[14px]">
              {t.installed ? `Dernière visite reçue le ${lastDay ? fmtDate(lastDay, { day: 'numeric', month: 'long' }) : '—'}.` : 'Collez ce code dans le <head> de toutes vos pages.'} Sans cookie, sans identifiant, aucune adresse IP enregistrée.
            </p>
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Snippet à coller</p>
                <CopyButton text={snippet} />
              </div>
              <pre className="rp-code">{snippet}</pre>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--hair)] pt-4">
              <div>
                <p className="text-[13px] font-semibold">WordPress</p>
                {wp ? (
                  <a href="/integrations/repere-ia-wordpress.zip" download className="rp-link text-[14px]">
                    Télécharger le plugin Repéré
                  </a>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">Plugin Repéré : bientôt téléchargeable. Il installera le snippet, le balisage schema.org et le relevé des robots IA.</p>
                )}
              </div>
              {seg === 'ecommerce' && (
                <div>
                  <p className="text-[13px] font-semibold">Shopify</p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {ws.demo
                      ? 'Démo : commandes simulées, étiquetées « démo ».'
                      : !shopify?.enabled
                        ? 'Connexion Shopify non configurée sur ce serveur : le CA vient du script de suivi (valeur de conversion) s’il est envoyé.'
                        : shopify.connected
                          ? `Connecté à ${shopify.shop}${shopify.connectedAt ? ` depuis le ${fmtDate(shopify.connectedAt, { day: 'numeric', month: 'long' })}` : ''}.`
                          : 'Non connecté.'}{' '}
                    {!ws.demo && shopify?.enabled && (
                      <Link href="/app/reglages#integrations" className="rp-link">
                        {shopify.connected ? 'Gérer' : 'Connecter Shopify'}
                      </Link>
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="mb-1 text-[13px] font-semibold">Google Analytics 4</p>
                <Ga4Button businessId={id} enabled={ga4} demo={ws.demo} />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
