import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, Card, h1Class, h1Style } from '@/lib/seo/shell';
import { abs, fmtDate } from '@/lib/seo';
import { GUIDES, guidePath, guideWordCount } from '@/lib/seo/guides';
import { pageMeta } from '@/lib/seo/meta';
import { Byline, RelatedLinks } from '@/lib/seo/editorial';
import { PAGE_UPDATED } from '@/lib/seo/site';
import { breadcrumbListLd, graph, pageIds, webPageLd } from '@/lib/seo/jsonld';

const PATH = '/guides';
const TITLE = 'Guides SEO et référencement IA (GEO)';
const DESCRIPTION =
  'Guides sourcés pour les sites pros : SEO + GEO en 2026, SEO local, fiches produit, données structurées, robots des IA, Search Console, Core Web Vitals.';

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function GuidesHub() {
  return (
    <PageShell>
      <JsonLd
        data={graph([
          {
            ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'CollectionPage', dateModified: PAGE_UPDATED[PATH] }, { withContext: false }),
            mainEntity: { '@id': pageIds(PATH).list },
          },
          {
            '@type': 'ItemList',
            '@id': pageIds(PATH).list,
            itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(guidePath(g)), name: g.title })),
          },
          breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Guides', path: PATH }], { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Guides' }]} />
      <h1 className={h1Class} style={h1Style}>Guides SEO et référencement IA</h1>
      <Byline published={null} updated={GUIDES.map((g) => g.updated).sort().at(-1)} />
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        Des guides pratiques, qui disent aussi ce qui reste incertain. Chaque affirmation chiffrée renvoie à une source ; aucune ne promet de résultat.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.slug}>
            <h2 className="font-semibold text-xl">
              <Link href={guidePath(g)} className="underline-offset-2 hover:underline">{g.title}</Link>
            </h2>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>{g.description}</p>
            <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
              Lecture : environ {Math.max(1, Math.round(guideWordCount(g) / 220))} min · Mis à jour le{' '}
              <time dateTime={g.updated}>{fmtDate(g.updated)}</time>
            </p>
          </Card>
        ))}
      </div>
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
