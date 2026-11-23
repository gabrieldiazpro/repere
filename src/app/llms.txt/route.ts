/**
 * /llms.txt généré (et non plus statique) : domaine tiré de SITE_URL, prix tirés de la grille affichée,
 * pages tirées des catalogues (guides, études, secteurs). Hygiène, pas un levier prouvé (voir /geo) :
 * aucune étude ne montre d'effet sur les citations, mais nous le recommandons à nos clients, donc nous l'appliquons.
 */
import { GUIDES, guidePath } from '@/lib/seo/guides';
import { CATEGORIES, SEGMENTS, categoryPath } from '@/lib/seo/segments';
import { TARGET_QUESTIONS, targetQuestionPath } from '@/app/questions/_lib/target-questions';
import { TRADES, PRIORITY_TRADES, tradePath } from '@/lib/seo';
import { STUDIES, studyPath } from '@/lib/studies';
import { sortedEntries, veillePath } from '@/lib/veille';
import { BRAND, CONTACT_EMAIL, ENTITY_READY, LEGAL, ONE_LINER, PAGE_UPDATED, abs } from '@/lib/seo/site';
import { euros, tiersFor, VAT_NOTICE } from '@/components/site/plans-v2';
import { v3Routes, type RouteEntry } from '@/lib/seo/routes';
import { publishedEntries } from '@/lib/barometre/public';
import { SOFTWARE_FEATURES } from '@/lib/seo/jsonld';
import { aiCoverage, aiCoverageCounts } from '@/components/site/ai-coverage';
import { offerEntitlements } from '@/components/site/offer-facts';
import { AGENCY_INCLUDED_CLIENTS, PLAN_ADDONS, getAddon, getPlan } from '@/lib/plans';
import { COMMISSION_BY_FAMILY } from '@/lib/partners/terms';
import { pct } from '@/lib/partners/program';

// Régénéré toutes les heures : la section « Baromètres » n'apparaît qu'une fois un baromètre réellement mesuré.
export const revalidate = 3600;

const link = (label: string, path: string, note?: string) => `- [${label}](${abs(path)})${note ? `: ${note}` : ''}`;

function priceLine(seg: 'local' | 'pme' | 'ecommerce', label: string) {
  const t = tiersFor(seg);
  const ess = offerEntitlements(seg, 'essentiel');
  const acc = offerEntitlements(seg, 'accompagne');
  const parts = [
    'Découverte gratuite',
    t.essentielMonth ? `Essentiel ${euros(t.essentielMonth.priceCents)}/mois${t.essentielYear ? ` ou ${euros(t.essentielYear.priceCents)}/an` : ''} (${ess.prompts} questions, ${ess.engines.length} IA, chaque mois)` : null,
    t.accompagne ? `Accompagné ${euros(t.accompagne.priceCents)}/mois, 3 mois minimum (${acc.prompts} questions, ${acc.engines.length} IA, chaque semaine)` : null,
    t.deep ? `à la carte : audit approfondi ${euros(t.deep.priceCents)}` : null,
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
    '- Une seule offre gratuite, Découverte : sans inscription, l\'analyse du site en 60 secondes et le test de marque ; avec un compte gratuit, 1 marque, 5 questions suivies, 1 mesure par mois, 3 IA (ChatGPT, Perplexity, Gemini), sans carte bancaire ni limite de durée',
    `- Aperçus IA de Google (AI Overviews) et Google AI Mode : inclus dans toutes les offres payantes. Options : ${PLAN_ADDONS.filter((a) => a.unit === 'account').map((a) => `${a.name} ${euros(a.priceCents)}/mois`).join(', ')} (Accompagné) ; Grok sur demande`,
    `- IA mesurables (${aiCoverageCounts().total}) : ${aiCoverage().map((a) => `${a.name} : ${a.mode}, ${a.status === 'offres' ? `offres : ${a.offers}` : a.offers.replace(/^En/, 'en').replace(/^Sur/, 'sur')}`).join(' ; ')}. Une IA en option n'est interrogée que si elle est activée, jamais simulée ; méthode et marge d'erreur par IA sur /methode`,
    `- Agence (liste d'attente) : ${euros(getPlan('agency_month').priceCents)}/mois pour ${AGENCY_INCLUDED_CLIENTS} clients mesurés chaque mois, +${euros(getAddon('agency_extra_client').priceCents)}/mois par client au-delà, mesure hebdomadaire d'un client en option (+${euros(getAddon('agency_weekly_client').priceCents)}/mois) ; partenaires sans abonnement : agences ${pct(COMMISSION_BY_FAMILY.agence!.rate)}, prescripteurs et formateurs ${pct(COMMISSION_BY_FAMILY.prescripteur!.rate)} des paiements HT pendant 12 mois, CCI et chambres : atelier gratuit`,
    "- Ce que nous ne faisons pas : aucune garantie de position dans Google ni de citation par une IA, aucun faux avis, rien n'est publié sans la validation du client, aucune donnée inventée (un fournisseur non configuré est affiché comme tel)",
    '- Limites : pas d\'index de liens propre (liens entrants via un fournisseur de données, selon l\'offre) ; exploration plafonnée à 60 pages (analyse publique), 500 ou 2 000 pages selon l\'offre ; pas d\'analyse de journaux serveur',
    `- Contact : ${CONTACT_EMAIL}`,
    ...(ENTITY_READY ? [`- Entreprise : ${LEGAL.name || BRAND}, SIREN ${LEGAL.siren}, ${LEGAL.street}, ${[LEGAL.postalCode, LEGAL.city].filter(Boolean).join(' ')}`] : []),
    `- Mise à jour de ce fichier : ${updated}`,
    '',
    '## Produit',
    link('Test de marque gratuit (Découverte)', '/analyse', 'sans inscription ni carte bancaire : votre marque est-elle citée par les IA (questions posées en direct, qui est cité à votre place et pourquoi), puis analyse SEO et GEO du site'),
    link('Test de visibilité IA par nom (Découverte, sans site)', '/audit', 'score de visibilité IA sur 100, concurrents cités, premières sources, selon le parcours (local, PME, e-commerce)'),
    link('Tarifs', '/tarifs', 'Découverte, Essentiel et Accompagné pour chacun des trois parcours, l\'offre Agence à part, comparatif des fonctionnalités, rendus dans la page sans JavaScript'),
    link('Méthode', '/methode', 'exploration du site, audit SEO (familles, poids, note), audit GEO et niveaux de preuve, Search Console et positions, agent de publication, formule du score IA, marge d’erreur, sources, vérification des faits, limites, versions'),
    ...routeLines('produit', routes).filter((l) => !l.includes('/analyse)')),
    link('Commerces locaux : SEO local et IA', '/local'),
    link('PME et services B2B : SEO B2B et IA', '/pme'),
    link('E-commerce : SEO e-commerce et IA (fiches produit, facettes, Shopping)', '/e-commerce', 'Shopify, WooCommerce, PrestaShop, Magento / Adobe Commerce, Wix'),
    link('Simulateur pour ma boutique', '/outils/simulateur-boutique', 'ce que la visibilité IA peut représenter pour une boutique : fourchette basse, médiane et haute, hypothèses sourcées et modifiables, une estimation, pas une promesse'),
    link('Agences', '/agences', 'offre Agence : marque blanche, tableau de bord multi-clients, validation par le client, API et MCP ; partenariat sans abonnement'),
    link('Agent de contenu', '/fonctionnalites/agent-de-contenu', 'pages manquantes proposées sur preuves, rédigées avec les seuls faits du client, créées en brouillon chez lui, publiées après validation, mesurées à J+30 et J+90 ; pas d’échange de liens ni de production de masse'),
    link('Développeurs', '/developpeurs', 'API REST (OpenAPI 3.1 sur /api/public/v1/openapi.json), serveur MCP en lecture (/api/mcp), webhooks signés'),
    link('Fiche officielle', '/fonctionnalites/fiche-officielle', 'faits de l’entreprise datés, sourcés et vérifiés par elle : page publique (schema.org, Markdown, llms.txt), encart pour son site, alertes d’écarts, rappel tous les 90 jours'),
    link('Programme partenaires', '/partenaires', 'agences, plateformes compatibles, experts-comptables, CCI, fédérations, écoles et formateurs ; candidature en ligne'),
    link('Réserver une démo', '/rendez-vous', 'démonstration des offres Accompagné et Agence, réponse sous un jour ouvré'),
    '',
    '## Veille',
    link('Veille Google et IA', '/veille', 'fiches datées et sourcées sur Google et les IA : ce qui change, pour qui, et ce qu’il faut faire'),
    ...sortedEntries().map((e) => link(e.title, veillePath(e), `mis à jour le ${e.updated}`)),
    link('Flux RSS de la veille', '/veille/rss.xml'),
    link('Lettre mensuelle', '/veille/lettre', 'une fois par mois, double opt-in, désinscription en un clic'),
    link('Guide 2027 (gratuit)', '/ressources/guide-2027', 'guide complet SEO et IA, à lire en ligne ou en PDF contre une adresse e-mail'),
    '',
    ...(routes.some((r) => r.section === 'outils')
      ? ['## Outils gratuits', 'Outils sans inscription, sans fournisseur de données payant : ils lisent le HTML, les en-têtes, le robots.txt et le sitemap d’une page publique avec le robot déclaré RepereBot.', ...routeLines('outils', routes), '']
      : []),
    ...(routes.some((r) => r.section === 'fonctionnalites') ? ['## Fonctionnalités', ...routeLines('fonctionnalites', routes), ''] : []),
    ...(routes.some((r) => r.section === 'cas-usage') ? ['## Cas d’usage', ...routeLines('cas-usage', routes), ''] : []),
    ...(routes.some((r) => r.section === 'aide') ? ['## Centre d’aide', ...routeLines('aide', routes), ''] : []),
    '## Référence',
    link("Qu'est-ce que le GEO (référencement IA) ?", '/geo', 'définition, différences avec le SEO et l\'AEO, 7 leviers, chiffres sourcés'),
    link('Glossaire du référencement IA et du SEO', '/glossaire', '53 termes définis en une ou deux phrases'),
    link('Questions fréquentes', '/questions', '35 questions de dirigeants, réponses courtes et sourcées'),
    link('Comparatif', '/comparatif', 'Repéré, Semrush, Ahrefs, Screaming Frog, Peec, Otterly, Meteoria, agences GEO : tableau factuel, prix publics datés, cas où un autre outil est meilleur'),
    ...routes.filter((r) => r.path.startsWith('/comparatif/')).map((r) => link(r.label, r.path)),
    ...routeLines('reference', routes).filter((l) => !l.includes('/comparatif/')),
    link('Études', '/etudes'),
    ...STUDIES.map((s) => link(s.title, studyPath(s))),
    ...(ENTITY_READY ? [link(`À propos de ${BRAND}`, '/a-propos', 'mission, fondateur, coordonnées, engagements')] : []),
    link('Programme entreprises pilotes', '/pilotes', '10 places, offre Accompagné offerte 3 mois, mesures J0/J30/J90'),
    link('Espace presse', '/presse', 'présentation, chiffres vérifiables de la méthode, logos SVG, captures de la démo'),
    link('État des services', '/statut', 'état en direct du site, des analyses, du paiement et des e-mails ; incidents des 90 derniers jours'),
    '',
    '## Questions clés',
    ...TARGET_QUESTIONS.map((x) => link(x.q, targetQuestionPath(x), x.description)),
    ...STUDIES.filter((s) => s.slug === 'pourquoi-les-ia-recommandent-une-marque').map((s) => link(s.title, studyPath(s))),
    '',
    '## Guides',
    ...GUIDES.map((g) => link(g.title, guidePath(g))),
    link('Tous les guides', '/guides'),
    '',
    '## Visibilité IA par métier, secteur et catégorie',
    link("Vue d'ensemble", '/visibilite-ia', 'commerces locaux, PME, e-commerce'),
    link(SEGMENTS.pme.name, SEGMENTS.pme.path, CATEGORIES.filter((c) => c.segment === 'pme').map((c) => c.name).join(', ')),
    link(SEGMENTS.ecommerce.name, SEGMENTS.ecommerce.path, CATEGORIES.filter((c) => c.segment === 'ecommerce').map((c) => c.name).join(', ')),
    ...CATEGORIES.map((c) => link(`${c.name} : que répond ChatGPT ?`, categoryPath(c))),
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
