import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd, Card, CtaLink, h1Class, h1Style, h2Class } from '@/lib/seo/shell';
import {
  PRIORITY_TRADES, CITIES, getTrade, getCity, buildQueries, directoriesFor, buildFaq, breadcrumbLd, faqLd, serviceLd,
  getSeoStats, isIndexable, fmtDate, tradePath, pairPath, auditHref, relatedTrades, neighbourCities, tradeLower, MIN_AUDITS_FOR_INDEX,
} from '@/lib/seo';

export const dynamicParams = true;
export const revalidate = 86400;

/** 3 verticales prioritaires x (20 arrondissements + 15 villes) ; le reste est rendu à la demande. */
export function generateStaticParams() {
  return PRIORITY_TRADES.flatMap((t) => CITIES.map((c) => ({ metier: t.slug, ville: c.slug })));
}

type Props = { params: Promise<{ metier: string; ville: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { metier, ville } = await params;
  const t = getTrade(metier);
  const c = getCity(ville);
  if (!t || !c) return { robots: { index: false } };
  const stats = await getSeoStats(metier, ville);
  const indexable = isIndexable(stats);
  const title = stats
    ? `${t.nom} ${c.nom} : score IA moyen ${Math.round(stats.avgScore)}/100 (${stats.auditCount} audits)`
    : `${t.nom} ${c.nom} : visibilité dans les IA`;
  return pageMeta({
    path: pairPath(t, c),
    title,
    // Sans données propres : noindex ; canonical toujours auto-référent (pas de signal contradictoire noindex + canonical ailleurs).
    noindex: !indexable,
    description: stats
      ? `Sur ${stats.auditCount} audits au ${fmtDate(stats.lastUpdated)} : visibilité des ${t.nom_pluriel.toLowerCase()} ${c.nom} sur ChatGPT, Gemini et Perplexity.`
      : `Questions types posées aux IA pour trouver ${tradeLower(t)} à ${c.nom}, annuaires clés et audit gratuit.`,
  });
}

export default async function PairPage({ params }: Props) {
  const { metier, ville } = await params;
  const t = getTrade(metier);
  const c = getCity(ville);
  if (!t || !c) notFound();

  const stats = await getSeoStats(metier, ville);
  const queries = buildQueries(t, c);
  const dirs = directoriesFor(t);
  const faq = buildFaq(t, c, stats);
  const path = pairPath(t, c);
  const crumbs = [
    { name: 'Accueil', path: '/' }, { name: 'Visibilité IA', path: '/visibilite-ia' },
    { name: t.nom, path: tradePath(t) }, { name: c.nom, path },
  ];
  const neighbours = neighbourCities(c);
  const related = relatedTrades(t);

  return (
    <PageShell>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={faqLd(faq, path)} />
      <JsonLd data={serviceLd(t, c, path)} />
      <Crumbs items={[
        { name: 'Accueil', href: '/' }, { name: 'Visibilité IA', href: '/visibilite-ia' },
        { name: t.nom, href: tradePath(t) }, { name: c.nom },
      ]} />
      <h1 className={h1Class} style={h1Style}>{t.nom} à {c.nom} : sont-ils visibles sur ChatGPT, Gemini et Perplexity ?</h1>
      {stats && (
        <p className="mt-2" style={{ color: 'var(--muted)' }}>
          Sur {stats.auditCount} audits réalisés du {fmtDate(stats.periodStart)} au {fmtDate(stats.periodEnd)}.
        </p>
      )}

      <h2 className={h2Class}>Statistiques agrégées</h2>
      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>Score moyen</p><p className="text-2xl font-semibold">{Math.round(stats.avgScore)}/100</p></Card>
            <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>Jamais cités</p><p className="text-2xl font-semibold">{Math.round(stats.zeroVisibilityShare * 100)} %</p></Card>
            <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>IA la plus sévère</p><p className="text-2xl font-semibold">{stats.harshestProvider ? `${stats.harshestProvider.id} (${Math.round(stats.harshestProvider.avgScore)})` : 'n.d.'}</p></Card>
            <Card><p className="text-sm" style={{ color: 'var(--muted)' }}>Écart vs national</p><p className="text-2xl font-semibold">{stats.deltaVsNational == null ? 'n.d.' : `${stats.deltaVsNational > 0 ? '+' : ''}${Math.round(stats.deltaVsNational)}`}</p></Card>
          </div>
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
            Mis à jour le {fmtDate(stats.lastUpdated)}. Ces chiffres portent sur les établissements audités, pas sur l&apos;ensemble du marché, et ne sont pas un classement de qualité.
          </p>
        </>
      ) : (
        <Card className="border-dashed">
          <p className="font-semibold">Données en cours de collecte — soyez le premier mesuré.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Nous ne publions une statistique qu&apos;à partir de {MIN_AUDITS_FOR_INDEX} audits pour ce métier dans cette zone, avec sa base et sa date.
            Aucun chiffre n&apos;est affiché tant que ce seuil n&apos;est pas atteint, aucun nom d&apos;établissement audité n&apos;est jamais publié.
          </p>
        </Card>
      )}

      <h2 className={h2Class}>Les questions que posent vos clients à {c.nom}</h2>
      <ul className="space-y-2">
        {queries.map((q) => (
          <li key={q.text} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            « {q.text} »
            {q.kind === 'quartier' && <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>(requête de quartier)</span>}
          </li>
        ))}
      </ul>
      {c.quartiers.length > 0 && (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Quartiers de {c.nom} que nous testons : {c.quartiers.join(', ')}. Une requête « près de {c.quartiers[0]} » ne donne pas toujours les mêmes noms qu&apos;une requête sur {c.nom}.
        </p>
      )}

      <h2 className={h2Class}>Les annuaires clés pour {tradeLower(t)}</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Sources que les IA ont des chances de citer pour ce métier, à confirmer par nos mesures.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {dirs.map((d) => (
          <Card key={d.name}><p className="font-semibold">{d.name}</p><p className="text-sm" style={{ color: 'var(--muted)' }}>{d.note}</p></Card>
        ))}
      </div>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Testez votre établissement à {c.nom} en 2 minutes.</p>
        <CtaLink href={auditHref(t, c)}>Audit gratuit</CtaLink>
      </div>

      <h2 className={h2Class}>Questions fréquentes</h2>
      <div className="space-y-4">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span aria-hidden="true" className="shrink-0 text-xl leading-none transition-transform group-open:rotate-45" style={{ color: 'var(--primary)' }}>+</span>
            </summary>
            <p className="mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className={h2Class}>Voir aussi</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><Link href={tradePath(t)} className="underline" style={{ color: 'var(--primary)' }}>Visibilité IA : tous les {t.nom_pluriel.toLowerCase()}</Link></li>
        {related.slice(0, 2).map((r) => (
          <li key={r.slug}><Link href={pairPath(r, c)} className="underline" style={{ color: 'var(--primary)' }}>{r.nom} à {c.nom}</Link></li>
        ))}
        {neighbours.map((n) => (
          <li key={n.slug}><Link href={pairPath(t, n)} className="underline" style={{ color: 'var(--primary)' }}>{t.nom} à {n.nom}</Link></li>
        ))}
        <li><Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>Méthode, limites et mises à jour</Link></li>
      </ul>
    </PageShell>
  );
}
