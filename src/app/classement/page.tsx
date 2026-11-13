import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/meta';
import { h2Class } from '@/lib/seo/shell';
import { PageHero, SitePage } from '@/components/pages/ui';
import { Container } from '@/components/ui/Container';
import { buttonClasses } from '@/components/ui/Button';
import v4 from '@/components/pages/v4/v4.module.css';
import { RANKING_MAX_AGE_DAYS, RANKING_MIN_ENTRIES } from '@/lib/growth/constants';
import { buildRanking, listRankingPairs } from '@/lib/growth/ranking';
import { RankingMethod } from './RankingMethod';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const pub = await published().catch(() => []);
  return pageMeta({
    title: 'Classement de la visibilité IA par métier et par ville',
    description: 'Quels commerces les assistants IA citent-ils le plus dans leur métier et leur ville ? Classement volontaire, mesuré, daté.',
    path: '/classement',
    noindex: pub.length === 0,
  });
}

async function published() {
  const pairs = (await listRankingPairs()).slice(0, 40);
  const out: { trade: string; city: string; tradeSlug: string; citySlug: string; count: number; state: 'preparation' | 'published' }[] = [];
  for (const p of pairs) {
    const r = await buildRanking(p.tradeSlug, p.citySlug);
    out.push({ ...p, count: r.count, state: r.state });
  }
  return out.filter((p) => p.state === 'published');
}

export default async function ClassementIndex() {
  const pairs = (await listRankingPairs().catch(() => [])).slice(0, 40);
  const rows = await Promise.all(pairs.map(async (p) => ({ ...p, r: await buildRanking(p.tradeSlug, p.citySlug) })));
  const pub = rows.filter((x) => x.r.state === 'published');
  const prep = rows.filter((x) => x.r.state !== 'published');
  const top = [...prep].sort((x, y) => y.r.count - x.r.count)[0];
  const filled = top ? Math.min(top.r.count, RANKING_MIN_ENTRIES) : 0;
  return (
    <SitePage>
      <PageHero
        crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Classement' }]}
        title="Classement de la visibilité IA par métier et par ville"
        lead="Seuls figurent les commerces qui ont choisi d’y apparaître, après avoir vu ce qui serait publié. Ce n’est pas un classement de qualité : il compte à quelle fréquence les assistants IA citent un commerce."
        aside={
          <figure data-reveal="" className={v4.slots}>
            <figcaption className="font-display text-[1.1rem] font-bold">Une page s’ouvre à {RANKING_MIN_ENTRIES} commerces inscrits</figcaption>
            <p className="mt-1 text-[0.92rem] text-muted">Même métier, même ville, mesure de moins de {RANKING_MAX_AGE_DAYS} jours.</p>
            <ol className={v4.slotRow} aria-hidden="true">
              {Array.from({ length: RANKING_MIN_ENTRIES }, (_, i) => (
                <li key={i} className={`${v4.slot} ${v4.pop}`} data-on={i < filled ? '' : undefined} style={{ ['--d' as string]: `${150 + i * 70}ms` }} />
              ))}
            </ol>
            <p className="mt-3 text-[0.95rem]">
              {top ? (
                <>
                  Le plus avancé : <strong>{top.trade} à {top.city}</strong>, {top.r.count} inscrit{top.r.count > 1 ? 's' : ''} sur {RANKING_MIN_ENTRIES}.
                </>
              ) : (
                <>Aucun commerce inscrit pour l’instant : nous n’affichons aucun exemple fictif.</>
              )}
            </p>
          </figure>
        }
      >
        <div className="mt-8">
          <Link href="/audit?from=classement" className={buttonClasses({ size: 'lg', className: 'lift' })}>
            Mesurer ma visibilité IA
          </Link>
        </div>
      </PageHero>
      <Container size="narrow" className={`${v4.editorial} pb-16 pt-4`}>
      {pub.length === 0 ? (
        <section aria-labelledby="prep-t" className="rounded-[14px] bg-white p-6 shadow-[0_0_0_1px_var(--color-line)]">
          <h2 id="prep-t" className="text-xl font-semibold">Classement en préparation</h2>
          <p className="mt-2" style={{ color: 'var(--muted)' }}>
            Une page n’est publiée qu’à partir de {RANKING_MIN_ENTRIES} commerces inscrits pour un même métier et une même ville, avec une mesure récente. Aucun couple n’a encore atteint ce seuil, et nous n’affichons aucun exemple fictif.
          </p>
        </section>
      ) : (
        <section aria-labelledby="pub-t">
          <h2 id="pub-t" className={h2Class}>Classements publiés</h2>
          <ul className="space-y-2">
            {pub.map((p) => (
              <li key={`${p.tradeSlug}/${p.citySlug}`}>
                <Link className="underline underline-offset-2" href={`/classement/${p.tradeSlug}/${p.citySlug}`}>
                  {p.trade} à {p.city}
                </Link>{' '}
                <span style={{ color: 'var(--muted)' }}>({p.r.count} commerces)</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {prep.length > 0 && (
        <p className="mt-6 text-sm" style={{ color: 'var(--muted)' }}>
          En préparation : {prep.length} couple{prep.length > 1 ? 's' : ''} métier × ville sous le seuil de {RANKING_MIN_ENTRIES} inscrits.
        </p>
      )}

      <RankingMethod />
      </Container>
    </SitePage>
  );
}
