/**
 * /llms.txt généré (et non plus statique) : domaine tiré de SITE_URL, prix tirés de la grille affichée,
 * pages tirées des catalogues (guides, études, secteurs). Hygiène, pas un levier prouvé (voir /geo) :
 * aucune étude ne montre d'effet sur les citations, mais nous le recommandons à nos clients, donc nous l'appliquons.
 */
import { GUIDES, guidePath } from '@/lib/seo/guides';
import { CATEGORIES, SEGMENTS } from '@/lib/seo/segments';
import { TRADES, PRIORITY_TRADES, tradePath } from '@/lib/seo';
import { STUDIES, studyPath } from '@/lib/studies';
import { BRAND, CONTACT_EMAIL, ENTITY_READY, LEGAL, ONE_LINER, PAGE_UPDATED, abs } from '@/lib/seo/site';
import { euros, tiersFor, VAT_NOTICE } from '@/components/site/plans-v2';
import { v3Routes, type RouteEntry } from '@/lib/seo/routes';
import { publishedEntries } from '@/lib/barometre/public';
import { SOFTWARE_FEATURES } from '@/lib/seo/jsonld';

// Régénéré toutes les heures : la section « Baromètres » n'apparaît qu'une fois un baromètre réellement mesuré.
export const revalidate = 3600;

const link = (label: string, path: string, note?: string) => `- [${label}](${abs(path)})${note ? `: ${note}` : ''}`;

function priceLine(seg: 'local' | 'pme' | 'ecommerce', label: string) {
  const t = tiersFor(seg);
  const parts = [
    'analyse gratuite du site',
    t.deep ? `audit approfondi ${euros(t.deep.priceCents)}` : null,
    t.essentielMonth ? `Essentiel ${euros(t.essentielMonth.priceCents)}/mois` : null,
    t.accompagne ? `Accompagné ${euros(t.accompagne.priceCents)}/mois (3 mois minimum)` : null,
  ].filter(Boolean);
  return `  - ${label} : ${parts.join(', ')}`;
}

function routeLines(section: RouteEntry['section'], routes: RouteEntry[]) {
  return routes.filter((r) => r.section === section).map((r) => link(r.label, r.path, r.note));
}

export async function GET() {
  const baros = await publishedEntries().catch(() => []);
  // Pages V3 : seulement celles qui existent et sont indexables (même règle que sitemap.xml).
  const routes = v3Routes();
  const updated = Object.values(PAGE_UPDATED).sort().at(-1)!;
  const lines = [
    `# ${BRAND}`,
    '',
    `> ${ONE_LINER} Depuis novembre 2026, il couvre aussi le SEO classique : analyse réelle du site, audit SEO, Search Console, positions, et un agent qui applique les corrections validées. Trois parcours : commerces locaux, PME et services B2B, e-commerce. Service en français.`,
    '',
    "Règles de lecture : aucune promesse de position ni de citation n'est faite ; les IA varient d'une réponse à l'autre. Les scores publiés sont des mesures à un instant donné, avec leur fourchette, le nombre de réponses analysées et la date. Les statistiques par métier, secteur ou catégorie ne sont publiées qu'à partir de 5 audits ; aucun nom d'entreprise auditée n'est publié. Les listes de sources par secteur sont des hypothèses éditoriales à confirmer par la mesure.",
    '',
    '## Ce que fait le logiciel',
    ...SOFTWARE_FEATURES.map((f) => `- ${f}`),
    '',
    '## Faits clés',
    `- Marque : ${BRAND} (site officiel : ${abs('/')})`,
    `- Prix nets (${VAT_NOTICE}) :`,
    priceLine('local', 'Commerce local'),
    priceLine('pme', 'PME et services B2B'),
    priceLine('ecommerce', 'E-commerce'),
    '- Offre gratuite permanente (Découverte) : 1 marque, 5 questions suivies, 1 mesure par mois, 3 IA (ChatGPT, Perplexity, Gemini), sans carte bancaire',
    '- IA suivies : ChatGPT, Perplexity, Gemini, Claude ; Mistral (Le Chat) en option. Les aperçus IA et le mode IA de Google ne sont pas mesurés directement ; leurs clics sont compris dans la Search Console',
    '- Agences : marque blanche et partenariat, sur liste d\'attente',
    "- Ce que nous ne faisons pas : aucune garantie de position dans Google ni de citation par une IA, aucun faux avis, rien n'est publié sans la validation du client, aucune donnée inventée (un fournisseur non configuré est affiché comme tel)",
    '- Limites : pas d\'index de liens propre (liens entrants via un fournisseur de données, selon l\'offre) ; exploration plafonnée à 60 pages (analyse publique), 500 ou 2 000 pages selon l\'offre ; pas d\'analyse de journaux serveur',
    `- Contact : ${CONTACT_EMAIL}`,
    ...(ENTITY_READY ? [`- Entreprise : ${LEGAL.name || BRAND}, SIREN ${LEGAL.siren}, ${LEGAL.street}, ${[LEGAL.postalCode, LEGAL.city].filter(Boolean).join(' ')}`] : []),
    `- Mise à jour de ce fichier : ${updated}`,
    '',
    '## Produit',
    link('Analyse gratuite du site en 60 secondes', '/analyse', 'exploration réelle, audit SEO et GEO, score Google et score IA, 5 priorités'),
    link('Test de visibilité IA par nom', '/audit', 'score de visibilité IA sur 100, concurrents cités, premières sources, selon le parcours (local, PME, e-commerce)'),
    link('Tarifs', '/tarifs', 'tous les prix des trois parcours, rendus dans la page sans JavaScript'),
    link('Méthode', '/methode', 'exploration du site, audit SEO (familles, poids, note), audit GEO et niveaux de preuve, Search Console et positions, agent de publication, formule du score IA, marge d’erreur, sources, vérification des faits, limites, versions'),
    ...routeLines('produit', routes).filter((l) => !l.includes('/analyse)')),
    link('Commerces locaux : SEO local et IA', '/local'),
    link('PME et services B2B : SEO B2B et IA', '/pme'),
    link('E-commerce : SEO e-commerce et IA (fiches produit, facettes, Shopping)', '/e-commerce'),
    '',
    ...(routes.some((r) => r.section === 'outils') ? ['## Outils gratuits', ...routeLines('outils', routes), ''] : []),
    ...(routes.some((r) => r.section === 'fonctionnalites') ? ['## Fonctionnalités', ...routeLines('fonctionnalites', routes), ''] : []),
    ...(routes.some((r) => r.section === 'cas-usage') ? ['## Cas d’usage', ...routeLines('cas-usage', routes), ''] : []),
    ...(routes.some((r) => r.section === 'aide') ? ['## Centre d’aide', ...routeLines('aide', routes), ''] : []),
    '## Référence',
    link("Qu'est-ce que le GEO (référencement IA) ?", '/geo', 'définition, différences avec le SEO et l\'AEO, 7 leviers, chiffres sourcés'),
    link('Glossaire du référencement IA', '/glossaire', 'termes du GEO définis en une ou deux phrases'),
    link('Questions fréquentes', '/questions', 'questions de dirigeants, réponses courtes et sourcées'),
    link('Comparatif', '/comparatif', 'Repéré, Semrush, Ahrefs, Screaming Frog, Peec, Otterly, Meteoria, agences GEO : tableau factuel, prix publics datés, cas où un autre outil est meilleur'),
    ...routes.filter((r) => r.path.startsWith('/comparatif/')).map((r) => link(r.label, r.path)),
    ...routeLines('reference', routes).filter((l) => !l.includes('/comparatif/')),
    link('Études', '/etudes'),
    ...STUDIES.map((s) => link(s.title, studyPath(s))),
    ...(ENTITY_READY ? [link(`À propos de ${BRAND}`, '/a-propos', 'mission, fondateur, coordonnées, engagements')] : []),
    '',
    '## Guides',
    ...GUIDES.map((g) => link(g.title, guidePath(g))),
    link('Tous les guides', '/guides'),
    '',
    '## Visibilité IA par métier, secteur et catégorie',
    link("Vue d'ensemble", '/visibilite-ia', 'commerces locaux, PME, e-commerce'),
    link(SEGMENTS.pme.name, SEGMENTS.pme.path, CATEGORIES.filter((c) => c.segment === 'pme').map((c) => c.name).join(', ')),
    link(SEGMENTS.ecommerce.name, SEGMENTS.ecommerce.path, CATEGORIES.filter((c) => c.segment === 'ecommerce').map((c) => c.name).join(', ')),
    ...PRIORITY_TRADES.map((t) => link(`${t.nom_pluriel} : qui ChatGPT recommande-t-il ?`, tradePath(t))),
    `- Autres métiers (${TRADES.length} au total), format : ${abs('/visibilite-ia/[metier]')}`,
    '',
    ...(baros.length ? ['## Baromètres (mesures mensuelles réelles)', ...baros.map((b) => link(b.title, b.path, `mis à jour le ${b.lastModified}`)), ''] : []),
    ...(routes.some((r) => r.section === 'communaute') ? ['## Communauté', ...routeLines('communaute', routes), ''] : []),
    '## Optional',
    link('Mentions légales', '/mentions-legales'),
    link('Confidentialité', '/confidentialite'),
    link('CGV', '/cgv'),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
