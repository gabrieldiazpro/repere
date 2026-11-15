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
  'Guides sourcés pour les sites pros : SEO local, IA et GEO, WordPress, Shopify, Wix, e-commerce, Search Console, maillage, refonte, liens entrants.';

/**
 * Grappes de sujets (V6, demande GUIDES : 33 guides en une grille devenaient longs). Un guide absent des listes va dans
 * « SEO de fond » ; chaque grappe reste une liste de liens HTML ordinaires (pas de filtre en JavaScript).
 */
const CLUSTERS: { id: string; title: string; intro: string; slugs: string[] }[] = [
  { id: 'essentiel', title: 'Pour commencer', intro: 'Le tour d’horizon : ce que Google et les IA lisent, et par où commencer.', slugs: ['seo-geo-sites-pros-2026', 'audit-seo-30-minutes', 'search-console-debutants'] },
  { id: 'local', title: 'SEO local', intro: 'Fiche Google, pages par ville, annuaires et avis : être recommandé près de chez vos clients.', slugs: ['seo-local-et-ia', 'fiche-google-business-profile', 'pages-ville-sans-doublon', 'annuaires-locaux-bing-apple', 'avis-clients-ia'] },
  { id: 'ia', title: 'IA et GEO', intro: 'ChatGPT, Perplexity, Copilot, aperçus IA de Google : être lu, compris et cité.', slugs: ['apparaitre-dans-chatgpt-pme', 'page-que-les-ia-citent', 'robots-ia-robots-txt', 'llms-txt-faut-il-en-creer-un', 'perplexity-sources', 'bing-copilot-indexnow', 'apercus-ia-google', 'ia-disent-des-choses-fausses', 'suivre-ses-questions-chatgpt', 'trafic-chatgpt-ga4', 'contenu-ecrit-avec-ia'] },
  { id: 'cms', title: 'Votre outil de site', intro: 'Les réglages qui comptent, outil par outil.', slugs: ['seo-wordpress', 'seo-shopify', 'seo-wix', 'seo-prestashop'] },
  { id: 'ecommerce', title: 'E-commerce', intro: 'Fiches produit, Merchant Center, images : vendre sur Google et dans les réponses des IA.', slugs: ['fiche-produit-et-ia', 'google-merchant-center', 'seo-images'] },
  { id: 'fond', title: 'SEO de fond', intro: 'Structure, balises, vitesse, liens : ce qui fait tenir un site dans la durée.', slugs: ['donnees-structurees-utiles', 'core-web-vitals-sans-jargon', 'titres-meta-descriptions', 'maillage-interne', 'seo-b2b-acheteurs', 'refonte-site-sans-perdre-seo', 'liens-entrants-sans-risque'] },
];

function clustered() {
  const placed = new Set<string>();
  const groups = CLUSTERS.map((c) => {
    const guides = c.slugs.map((slug) => GUIDES.find((g) => g.slug === slug)).filter((g): g is (typeof GUIDES)[number] => !!g && !placed.has(g.slug));
    guides.forEach((g) => placed.add(g.slug));
    return { ...c, guides };
  });
  const rest = GUIDES.filter((g) => !placed.has(g.slug));
  const fond = groups.find((g) => g.id === 'fond')!;
  fond.guides.push(...rest);
  return groups.filter((g) => g.guides.length);
}

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
      <nav aria-label="Thèmes des guides" className="mt-6 flex flex-wrap gap-2 text-sm">
        {clustered().map((c) => (
          <a key={c.id} href={`#${c.id}`} className="rounded-full border px-3 py-1.5 underline-offset-2 hover:underline" style={{ borderColor: 'var(--line)' }}>
            {c.title} ({c.guides.length})
          </a>
        ))}
      </nav>
      {clustered().map((c) => (
        <section key={c.id} id={c.id} aria-labelledby={`${c.id}-t`} className="scroll-mt-20">
          <h2 id={`${c.id}-t`} className="mt-12 font-semibold text-2xl">{c.title}</h2>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>{c.intro}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {c.guides.map((g) => (
              <Card key={g.slug}>
                <h3 className="font-semibold text-xl">
                  <Link href={guidePath(g)} className="underline-offset-2 hover:underline">{g.title}</Link>
                </h3>
                <p className="mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>{g.description}</p>
                <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                  Lecture : environ {Math.max(1, Math.round(guideWordCount(g) / 220))} min · Mis à jour le{' '}
                  <time dateTime={g.updated}>{fmtDate(g.updated)}</time>
                </p>
              </Card>
            ))}
          </div>
        </section>
      ))}
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
