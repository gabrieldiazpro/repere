import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, Card, h1Class, h1Style } from '@/lib/seo/shell';
import { Byline, RelatedLinks, EDITORIAL_UPDATED } from '@/lib/seo/editorial';
import { breadcrumbListLd, graph, orgRef, pageIds, webPageLd } from '@/lib/seo/jsonld';
import { abs, fmtDate } from '@/lib/seo';
import { STUDIES, studyPath } from '@/lib/studies';

const PATH = '/etudes';
const TITLE = 'Études sur la visibilité des entreprises dans les IA (France)';
const DESCRIPTION =
  "Le Baromètre Repéré de la visibilité IA et une synthèse sourcée des études publiques 2025-2026 sur la recherche par IA en France : usages, sources citées, exactitude, trafic.";

const SEO_TITLE = "Études sur la visibilité IA en France";

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'website',
});

export default function EtudesHub() {
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Études', path: PATH },
  ];
  const collection = {
    ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'CollectionPage', dateModified: EDITORIAL_UPDATED }, { withContext: false }),
    publisher: orgRef(),
    // Même @type et mêmes champs que sur la page de l'étude (Report), pour un graphe cohérent entre les pages.
    hasPart: STUDIES.map((s) => ({
      '@type': 'Report',
      '@id': pageIds(studyPath(s)).article,
      headline: s.title,
      description: s.description,
      url: abs(studyPath(s)),
      inLanguage: 'fr-FR',
      datePublished: s.published,
      dateModified: s.updated,
      author: orgRef(),
      publisher: orgRef(),
    })),
  };
  return (
    <PageShell>
      <JsonLd data={graph([collection, breadcrumbListLd(PATH, crumbs, { withContext: false })])} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Études' }]} />
      <h1 className={h1Class} style={h1Style}>
        Études sur la visibilité des entreprises dans les IA
      </h1>
      <Byline />
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        Deux types de contenus : nos propres mesures, agrégées et anonymes, publiées seulement quand l&apos;échantillon est suffisant, et une synthèse
        des études publiques, chacune avec sa source, son périmètre et ses limites. Aucun chiffre n&apos;est inventé ni extrapolé.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {STUDIES.map((s) => (
          <Card key={s.slug}>
            <h2 className="font-semibold text-xl">
              <Link href={studyPath(s)} className="underline-offset-2 hover:underline">
                {s.title}
              </Link>
            </h2>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {s.description}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
              Mis à jour le {fmtDate(s.updated)}
            </p>
          </Card>
        ))}
      </div>
      <div className="max-w-3xl">
        <RelatedLinks current={PATH} />
      </div>
    </PageShell>
  );
}
