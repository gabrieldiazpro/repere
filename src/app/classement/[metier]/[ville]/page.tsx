import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/seo/meta';
import { abs } from '@/lib/seo/site';
import { Card, Crumbs, JsonLd, PageShell, h1Class, h1Style } from '@/lib/seo/shell';
import { buildRanking, listRankingPairs } from '@/lib/growth/ranking';
import { dateFr } from '@/lib/growth/measure';
import { RankingMethod } from '../../RankingMethod';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ metier: string; ville: string }> };
const SLUG = /^[a-z0-9-]{1,60}$/;

const humanize = (s: string) => s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

async function load(metier: string, ville: string) {
  if (!SLUG.test(metier) || !SLUG.test(ville)) return null;
  const [page, pairs] = await Promise.all([buildRanking(metier, ville), listRankingPairs().catch(() => [])]);
  const pair = pairs.find((p) => p.tradeSlug === metier && p.citySlug === ville);
  return { page, trade: pair?.trade ?? humanize(metier), city: pair?.city ?? humanize(ville) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { metier, ville } = await params;
  const d = await load(metier, ville).catch(() => null);
  if (!d) return { title: { absolute: 'Page introuvable' }, robots: { index: false, follow: false } };
  return pageMeta({
    title: `Visibilité IA : ${d.trade} à ${d.city}`,
    description: `Les ${d.trade.toLowerCase()} à ${d.city} les plus cités par les assistants IA, classement volontaire et daté.`,
    path: `/classement/${metier}/${ville}`,
    noindex: d.page.state !== 'published',
  });
}

export default async function ClassementPage({ params }: Props) {
  const { metier, ville } = await params;
  const d = await load(metier, ville).catch(() => null);
  if (!d) notFound();
  const { page, trade, city } = d;
  const path = `/classement/${metier}/${ville}`;
  const ld =
    page.state === 'published'
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          '@id': `${abs(path)}#list`,
          name: `Visibilité IA : ${trade} à ${city}`,
          url: abs(path),
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: page.entries.length,
          itemListElement: page.entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name })),
        }
      : null;
  return (
    <PageShell narrow>
      {ld ? <JsonLd data={ld} /> : null}
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Classement', href: '/classement' }, { name: `${trade} à ${city}` }]} />
      <h1 className={h1Class} style={h1Style}>
        Visibilité IA : {trade} à {city}
      </h1>
      {page.state === 'preparation' ? (
        <Card className="mt-6">
          <h2 className="text-xl font-semibold">Classement en préparation</h2>
          <p className="mt-2" style={{ color: 'var(--muted)' }}>
            {page.count} commerce{page.count > 1 ? 's' : ''} inscrit{page.count > 1 ? 's' : ''} avec une mesure récente sur {page.minEntries} nécessaires. Les noms ne sont pas publiés tant que le seuil n’est pas atteint.
          </p>
          <Link href="/audit?from=classement" className="mt-4 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold text-white" style={{ background: 'var(--primary)' }}>
            Mesurer ma visibilité IA
          </Link>
        </Card>
      ) : (
        <>
          <p className="mt-4" style={{ color: 'var(--muted)' }}>
            {page.count} commerces, mesures datées entre le {dateFr(page.oldestMeasure ?? '')} et aujourd’hui. Classement par taux de citation, pas de qualité.
          </p>
          <ol className="mt-6 space-y-2">
            {page.entries.map((e) => (
              <li key={`${e.rank}-${e.name}`} className="flex items-baseline gap-4 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
                <span className="w-8 text-xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
                  {e.rank}
                </span>
                <span className="flex-1 font-semibold">{e.name}</span>
                <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
                  cité dans {e.citationRate} % des réponses ({e.cited}/{e.total}) · {dateFr(e.measuredAt)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <RankingMethod />
    </PageShell>
  );
}
