import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { abs, CONTACT_EMAIL } from '@/lib/seo/site';
import { barometrePath, getPageData, type PageData } from '@/lib/barometre/public';
import { BarometreView } from '../_components/BarometreView';
import { barometreDescription, barometrePageLd } from '../_components/ld';

/** Une page de baromètre se recalcule au plus une fois par heure (nouvelle édition, retrait). */
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PageData | null> {
  try {
    return await getPageData(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { robots: { index: false, follow: false } };
  const e = data.edition;
  return pageMeta({
    path: barometrePath(e.slug),
    title: `Qui les IA recommandent : ${e.def.title}`,
    description: barometreDescription(e),
    type: 'article',
    modifiedTime: e.aggregatedAt,
    noindex: data.demo,
  });
}

/** Tant qu'un baromètre n'a pas été réellement mesuré (édition publiable), la page n'existe pas : 404. */
export default async function BarometrePage({ params }: Props) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const e = data.edition;
  return (
    <PageShell>
      {!data.demo && <JsonLd data={barometrePageLd(e)} />}
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Baromètres', href: '/barometre' }, { name: e.def.title }]} />
      <BarometreView edition={e} demo={data.demo} history={data.history} url={abs(barometrePath(e.slug))} contactEmail={CONTACT_EMAIL} />
    </PageShell>
  );
}
