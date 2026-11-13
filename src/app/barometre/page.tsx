import type { Metadata } from 'next';
import { PageShell, Crumbs, JsonLd } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { listPublished } from '@/lib/barometre/public';
import type { EditionSummary } from '@/lib/barometre/types';
import { BarometreIndexView } from './_components/BarometreView';

/** L'index se recalcule au plus une fois par heure (nouvelles éditions publiées). */
export const revalidate = 3600;

const PATH = '/barometre';
const TITLE = 'Baromètres : qui les IA recommandent';
const DESCRIPTION =
  'Chaque mois, les entreprises citées par ChatGPT, Perplexity, Gemini et Claude par métier et ville, logiciel ou marque. Mesures réelles avec marges d’erreur.';

async function items(): Promise<EditionSummary[]> {
  try {
    return await listPublished();
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const list = await items();
  // Tant que rien n'est publié, la page « en préparation » n'est pas indexée.
  return pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION, noindex: list.length === 0 });
}

export default async function BarometreIndexPage() {
  const list = await items();
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Baromètres', path: PATH },
  ];
  return (
    <PageShell>
      {list.length > 0 && (
        <JsonLd
          data={graph([
            webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'CollectionPage', dateModified: list.map((x) => x.measuredTo).sort().at(-1)!.slice(0, 10) }, { withContext: false }),
            breadcrumbListLd(PATH, crumbs, { withContext: false }),
          ])}
        />
      )}
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Baromètres' }]} />
      <BarometreIndexView items={list} />
    </PageShell>
  );
}
