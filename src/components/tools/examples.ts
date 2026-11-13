/**
 * États « exemple » des outils : résultats calculés par les vraies fonctions d'AUDIT-SITE sur des pages FICTIVES
 * (domaines en .example, réservés : aucune entreprise réelle). Exécuté côté serveur au rendu de la page (statique),
 * puis passé en propriété sérialisable aux composants clients. Étiqueté « Exemple fictif » à l'affichage.
 */
import { readinessFromSnapshot, type PageSnapshot } from '@/lib/siteaudit/readiness';
import { robotsReportFromText } from '@/lib/siteaudit/robotsAudit';
import { citabilityFromHtml } from '@/lib/siteaudit/citability';
import { productFromHtml } from '@/lib/siteaudit/product';
import { compareSides } from '@/lib/siteaudit/compare';
import { buildLlmsTxt, LLMS_HONEST, LLMS_INSTRUCTIONS, type LlmsResult, type LlmsPage } from '@/lib/siteaudit/llms';
import { buildReviewLink, type ReviewLinkResult } from '@/lib/siteaudit/reviewLink';
import { DEMO_PRODUCTS } from '@/lib/ecommerce/demo';
import { formatEuros } from './format';
import type { CitabilityReport, CompareReport, ProductReport, ReadinessReport, RobotsReport } from '@/lib/siteaudit/types';

export const EXAMPLE_HOST = 'plomberie-martin.example';
export const EXAMPLE_URL = `https://${EXAMPLE_HOST}/`;
export const EXAMPLE_COMPETITOR_URL = 'https://chauffage-durand.example/';
export const EXAMPLE_PRODUCT_URL = 'https://maison-sora.example/products/shampoing-solide-onde';
/** Place ID d'exemple publié dans la documentation Google Maps Platform (bureaux de Google à Sydney). */
export const EXAMPLE_PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

const ROBOTS_TXT = `# robots.txt de Plomberie Martin (fictif)
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: *
Disallow: /admin/
Allow: /

Sitemap: ${EXAMPLE_URL}sitemap.xml
`;

const MARTIN_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>Plomberie Martin, plombier à Lyon 3</title>
<meta name="description" content="Plomberie Martin, plombier chauffagiste à Lyon 3 : dépannage, chauffe-eau, débouchage. Devis gratuit.">
<link rel="canonical" href="${EXAMPLE_URL}">
<meta property="og:title" content="Plomberie Martin">
</head><body>
<header><nav><a href="/">Accueil</a><a href="/services">Services</a><a href="/contact">Contact</a></nav></header>
<main>
<h1>Plombier chauffagiste à Lyon 3</h1>
<p>Plomberie Martin est une entreprise artisanale installée à Lyon 3 depuis 2011. Nous intervenons pour les fuites, les chauffe-eau et les débouchages dans Lyon et Villeurbanne.</p>
<h2>Nos services</h2>
<ul><li>Dépannage de fuite</li><li>Remplacement de chauffe-eau</li><li>Débouchage de canalisation</li><li>Entretien de chaudière gaz</li></ul>
<h2>Pourquoi nous choisir</h2>
<p>Une équipe de trois plombiers, un devis écrit avant chaque intervention et des pièces garanties deux ans par le fabricant. Nous répondons au téléphone du lundi au samedi.</p>
<div id="avis-widget"></div>
<p>Téléphone : 04 00 00 00 00. Adresse : 1 rue de l’Exemple, 69003 Lyon.</p>
</main>
<footer><a href="/mentions-legales">Mentions légales</a></footer>
<script src="/widgets/avis.js"></script>
</body></html>`;

const DURAND_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>Chauffage Durand : plombier chauffagiste à Lyon, intervention en 2 h</title>
<meta name="description" content="Chauffage Durand, plombier chauffagiste à Lyon depuis 2004 : dépannage en 2 heures, entretien de chaudière dès 120 €, devis gratuit.">
<link rel="canonical" href="${EXAMPLE_COMPETITOR_URL}">
<meta property="og:title" content="Chauffage Durand"><meta property="og:description" content="Plombier chauffagiste à Lyon"><meta property="og:image" content="${EXAMPLE_COMPETITOR_URL}og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Chauffage Durand","url":"${EXAMPLE_COMPETITOR_URL}","telephone":"+33 4 00 00 00 01","address":{"@type":"PostalAddress","streetAddress":"2 rue de l’Exemple","postalCode":"69007","addressLocality":"Lyon","addressCountry":"FR"},"openingHours":"Mo-Sa 08:00-19:00"}</script>
</head><body>
<main>
<h1>Plombier chauffagiste à Lyon, intervention en 2 heures</h1>
<p>Chauffage Durand est un plombier chauffagiste installé à Lyon 7 depuis 2004, qui intervient en 2 heures en moyenne dans Lyon et sa première couronne.</p>
<p>Mis à jour le 2 novembre 2026 par Paul Durand, artisan chauffagiste.</p>
<h2>Combien coûte l’entretien d’une chaudière gaz ?</h2>
<p>L’entretien annuel d’une chaudière gaz coûte 120 € TTC, déplacement compris, selon notre grille publiée. Il est obligatoire chaque année selon <a href="https://www.service-public.fr/">Service-Public.fr</a>.</p>
<h2>Quelles zones couvrez-vous ?</h2>
<ul><li>Lyon 1 à Lyon 9</li><li>Villeurbanne</li><li>Caluire-et-Cuire</li></ul>
<table><tr><th>Prestation</th><th>Prix</th></tr><tr><td>Déplacement</td><td>45 €</td></tr><tr><td>Entretien chaudière</td><td>120 €</td></tr></table>
<p>Téléphone : 04 00 00 00 01. Adresse : 2 rue de l’Exemple, 69007 Lyon.</p>
</main>
</body></html>`;

/** Texte proposé dans l'outil de citabilité (mode « coller un texte »). */
export const CITABILITY_SAMPLE_HTML = `<h1>Combien coûte un logiciel de paie pour une PME ?</h1>
<p>Un logiciel de paie pour une PME de 10 à 50 salariés coûte en général entre 5 € et 15 € par bulletin et par mois, selon le niveau d’accompagnement.</p>
<p>Mis à jour le 4 novembre 2026 par Claire Petit, responsable produit chez Paysia (entreprise fictive).</p>
<h2>Que comprend le prix ?</h2>
<ul><li>Le calcul des bulletins et des cotisations</li><li>La déclaration sociale nominative (DSN) mensuelle</li><li>Les mises à jour légales</li></ul>
<h2>Faut-il un expert-comptable en plus ?</h2>
<p>Ce n’est pas obligatoire. Beaucoup de dirigeants gardent toutefois un expert-comptable pour le contrôle annuel et les situations particulières, comme les ruptures conventionnelles, qui demandent une vérification au cas par cas et dont les règles changent régulièrement, ce qui rend l’accompagnement utile pour éviter les erreurs coûteuses et les redressements.</p>`;

/**
 * Fiche produit d'exemple : le shampoing solide « Onde » du compte démo Maison Sora (cosmétiques solides), lu dans
 * le catalogue démo (src/lib/ecommerce/demo.ts) pour rester identique au compte qu'on visite. Le balisage est
 * volontairement incomplet (ni marque, ni GTIN, ni disponibilité, ni avis balisés) pour que l'audit ait quelque
 * chose à corriger. Domaine en .example : aucune boutique réelle.
 */
export const EXAMPLE_PRODUCT = DEMO_PRODUCTS.find((x) => x.id === 'shampoing-solide-onde') ?? DEMO_PRODUCTS[0];
const EX_NAME = EXAMPLE_PRODUCT.name;
const EX_PRICE_NUM = EXAMPLE_PRODUCT.price ?? 0;
const EX_PRICE = EX_PRICE_NUM.toFixed(2);
const EX_TEXT = (name: string) => name.replace(/"/g, '&quot;');

const PRODUCT_HTML = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>${EX_TEXT(EX_NAME)} | Maison Sora</title>
<meta name="description" content="${EX_TEXT(EXAMPLE_PRODUCT.description ?? '')}">
<meta property="og:type" content="product"><meta property="og:title" content="${EX_TEXT(EX_NAME)}">
<meta property="product:price:amount" content="${EX_PRICE}"><meta property="product:price:currency" content="EUR">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: EX_NAME,
  image: [`${EXAMPLE_PRODUCT_URL}.jpg`],
  description: EXAMPLE_PRODUCT.description,
  offers: { '@type': 'Offer', price: EX_PRICE, priceCurrency: 'EUR' },
})}</script>
</head><body>
<main>
<h1>${EX_TEXT(EX_NAME)}</h1>
<p>${EX_TEXT(EXAMPLE_PRODUCT.description ?? '')}</p>
<p class="price">${formatEuros(EX_PRICE_NUM)}</p>
<div id="variants" data-app="selector"></div>
</main>
</body></html>`;

function snap(url: string, html: string, responseMs: number): PageSnapshot {
  return {
    url,
    finalUrl: url,
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: html,
    bytes: Buffer.byteLength(html, 'utf8'),
    truncated: false,
    responseMs,
  };
}

/** Rend le résultat stable (date fixe) pour un rendu statique reproductible. */
const FIXED_DATE = '2026-11-09T09:00:00.000Z';

export function exampleRobots(): RobotsReport {
  return robotsReportFromText(EXAMPLE_URL, ROBOTS_TXT, 200, ['/', '/tarifs']);
}

export function exampleReadiness(): ReadinessReport {
  const r = readinessFromSnapshot(snap(EXAMPLE_URL, MARTIN_HTML, 420), {
    robots: exampleRobots(),
    sitemap: { found: true, url: `${EXAMPLE_URL}sitemap.xml` },
    llms: { found: false, url: `${EXAMPLE_URL}llms.txt` },
  });
  return { ...r, fetchedAt: FIXED_DATE };
}

export function exampleCitability(): CitabilityReport {
  return citabilityFromHtml(CITABILITY_SAMPLE_HTML, {});
}

export function exampleProduct(): ProductReport {
  return productFromHtml(PRODUCT_HTML, EXAMPLE_PRODUCT_URL);
}

export function exampleCompare(): CompareReport {
  const mine = exampleReadiness();
  const theirs = {
    ...readinessFromSnapshot(snap(EXAMPLE_COMPETITOR_URL, DURAND_HTML, 260), {
      robots: robotsReportFromText(EXAMPLE_COMPETITOR_URL, null, 404),
      sitemap: { found: true, url: `${EXAMPLE_COMPETITOR_URL}sitemap.xml` },
      llms: { found: false, url: `${EXAMPLE_COMPETITOR_URL}llms.txt` },
    }),
    fetchedAt: FIXED_DATE,
  };
  return compareSides(
    { url: EXAMPLE_URL, readiness: mine, citability: citabilityFromHtml(MARTIN_HTML, { url: EXAMPLE_URL }) },
    { url: EXAMPLE_COMPETITOR_URL, readiness: theirs, citability: citabilityFromHtml(DURAND_HTML, { url: EXAMPLE_COMPETITOR_URL }) },
  );
}

export function exampleLlms(): LlmsResult {
  const pages: LlmsPage[] = [
    { url: EXAMPLE_URL, title: 'Plomberie Martin', description: 'Plombier chauffagiste à Lyon 3 : dépannage, chauffe-eau, débouchage. Devis gratuit.' },
    { url: `${EXAMPLE_URL}services/depannage-fuite`, title: 'Dépannage de fuite', description: 'Intervention sur fuite d’eau à Lyon et Villeurbanne.' },
    { url: `${EXAMPLE_URL}services/chauffe-eau`, title: 'Remplacement de chauffe-eau', description: 'Pose et remplacement de chauffe-eau électriques et thermodynamiques.' },
    { url: `${EXAMPLE_URL}tarifs`, title: 'Tarifs', description: 'Prix du déplacement et de la main-d’œuvre.' },
    { url: `${EXAMPLE_URL}contact`, title: 'Contact' },
  ];
  return {
    url: EXAMPLE_URL.replace(/\/$/, ''),
    llmsTxt: buildLlmsTxt({ name: 'Plomberie Martin', summary: pages[0].description }, pages),
    pages,
    sitemapUrl: `${EXAMPLE_URL}sitemap.xml`,
    existing: { found: false, url: `${EXAMPLE_URL}llms.txt`, issues: [] },
    honest: LLMS_HONEST,
    instructions: LLMS_INSTRUCTIONS,
  };
}

export function exampleReviewLink(): ReviewLinkResult {
  return buildReviewLink({ placeId: EXAMPLE_PLACE_ID, name: 'Plomberie Martin' });
}

/** Champs d'exemple du générateur JSON-LD (entreprise fictive). */
export const JSONLD_EXAMPLE_FIELDS = {
  name: 'Plomberie Martin',
  trade: 'plombier',
  url: EXAMPLE_URL,
  description: 'Plombier chauffagiste à Lyon 3 : dépannage de fuite, chauffe-eau, débouchage.',
  telephone: '+33 4 00 00 00 00',
  address: '1 rue de l’Exemple, 69003 Lyon',
  city: 'Lyon',
  openingHours: 'Lun-ven 8h-19h, sam 9h-13h',
  priceRange: '€€',
  areaServed: 'Lyon, Villeurbanne',
};
