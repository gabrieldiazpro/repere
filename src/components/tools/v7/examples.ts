/**
 * États « exemple » des outils V7 : calculés par les vraies fonctions d'analyse sur des pages FICTIVES (domaines en
 * .example, réservés : aucune entreprise réelle). Exécuté côté serveur au rendu statique, étiqueté « Exemple fictif ».
 */
import type { PageFetch } from '../v6/analyze';
import { analyzeDuplicate, analyzeFreshness, analyzeHeadings, analyzeHttps, analyzeImages, analyzeMobile, analyzeRich, analyzeWeight, pageImages, pageResources } from './analyze';
import type { DuplicateReport, FactsInput, FreshnessReport, HeadingsReport, HttpsReport, ImagesReport, MobileReport, NapEntry, RichReport, UtmInput, WeightReport } from './types';

const M = 'https://plomberie-martin.example';
const S = 'https://maison-sora.example';
const T = 'https://the-des-lilas.example';
const FIXED_NOW = Date.parse('2026-11-15T09:00:00Z');
const fixDate = <R extends { checkedAt: string }>(r: R): R => ({ ...r, checkedAt: new Date(FIXED_NOW).toISOString() });

const page = (url: string, html: string, headers: Record<string, string> = {}, extra: Partial<PageFetch> = {}): PageFetch => ({
  requestedUrl: url,
  finalUrl: url,
  status: 200,
  chain: [],
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  html,
  fetchMs: 180,
  ...extra,
});

const MARTIN_SERVICE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Remplacement de chauffe-eau à Lyon | Plomberie Martin</title>
<link rel="stylesheet" href="/css/theme.css"><script src="/js/app.js"></script><script src="http://widgets.avis.example/badge.js"></script>
</head><body>
<header><h1><img src="/logo.png" alt="Plomberie Martin"></h1><nav><a href="/">Accueil</a> | <a href="/services">Services</a> | <a href="/tarifs">Tarifs</a> | <a href="/zone">Zone</a> | <a href="/avis">Avis</a> | <a href="/blog">Conseils</a> | <a href="/contact">Contact</a></nav></header>
<main><h1>Remplacement de chauffe-eau à Lyon</h1>
<p>Plomberie Martin remplace votre chauffe-eau électrique ou thermodynamique en une demi-journée, à Lyon et Villeurbanne. Devis écrit avant travaux. Appelez le 04 78 00 00 00.</p>
<h2>Combien coûte un chauffe-eau posé ?</h2><p>Comptez de 900 à 1 400 € pour un ballon électrique de 200 litres, pose comprise (tarifs 2025).</p>
<h4>Les aides</h4><p>MaPrimeRénov’ peut financer une partie d’un modèle thermodynamique.</p>
<h2></h2>
<h2>Nos réalisations</h2>
<p><img src="/img/IMG_2034.jpg"> <img src="/img/chantier-villeurbanne.webp" alt="Chauffe-eau thermodynamique posé dans un garage à Villeurbanne"> <a href="/devis"><img src="/img/bouton-devis.png"></a> <img src="/img/photo.jpg" alt="photo"> <img src="http://cdn.plomberie-martin.example/old/ballon.png" alt="Ballon d’eau chaude de 200 litres"></p>
<table style="width:900px"><tr><td>Modèle</td><td>Prix</td></tr></table>
<form><input type="text" name="telephone"><input type="text" name="email"></form>
</main><footer><p>© 2022 Plomberie Martin</p></footer></body></html>`;

export function exampleHeadings(): HeadingsReport {
  return fixDate(analyzeHeadings(page(`${M}/services/chauffe-eau`, MARTIN_SERVICE)));
}

export function exampleImages(): ImagesReport {
  const p = page(`${M}/services/chauffe-eau`, MARTIN_SERVICE);
  const rows = pageImages(p);
  const st = new Map<string, { status: number; bytes?: number; contentType?: string; error?: string }>([
    [`${M}/logo.png`, { status: 200, bytes: 18_000, contentType: 'image/png' }],
    [`${M}/img/IMG_2034.jpg`, { status: 200, bytes: 2_400_000, contentType: 'image/jpeg' }],
    [`${M}/img/chantier-villeurbanne.webp`, { status: 200, bytes: 140_000, contentType: 'image/webp' }],
    [`${M}/img/bouton-devis.png`, { status: 200, bytes: 9_000, contentType: 'image/png' }],
    [`${M}/img/photo.jpg`, { status: 404 }],
    ['http://cdn.plomberie-martin.example/old/ballon.png', { status: 200, bytes: 610_000, contentType: 'image/png' }],
  ]);
  return fixDate(analyzeImages(p, rows, st));
}

export function exampleWeight(): WeightReport {
  const p = page(`${M}/services/chauffe-eau`, MARTIN_SERVICE);
  const rows = pageResources(p);
  const st = new Map<string, { status: number; bytes?: number; contentType?: string }>([
    [`${M}/css/theme.css`, { status: 200, bytes: 210_000, contentType: 'text/css' }],
    [`${M}/js/app.js`, { status: 200, bytes: 640_000, contentType: 'application/javascript' }],
    ['http://widgets.avis.example/badge.js', { status: 200 }],
    [`${M}/logo.png`, { status: 200, bytes: 18_000, contentType: 'image/png' }],
    [`${M}/img/IMG_2034.jpg`, { status: 200, bytes: 2_400_000, contentType: 'image/jpeg' }],
    [`${M}/img/chantier-villeurbanne.webp`, { status: 200, bytes: 140_000, contentType: 'image/webp' }],
    [`${M}/img/bouton-devis.png`, { status: 200, bytes: 9_000, contentType: 'image/png' }],
    [`${M}/img/photo.jpg`, { status: 404 }],
    ['http://cdn.plomberie-martin.example/old/ballon.png', { status: 200, bytes: 610_000, contentType: 'image/png' }],
  ]);
  return fixDate(analyzeWeight(p, rows, st, null, 48_000));
}

export function exampleMobile(): MobileReport {
  return fixDate(analyzeMobile(page(`${M}/services/chauffe-eau`, MARTIN_SERVICE)));
}

export function exampleHttps(): HttpsReport {
  return fixDate(analyzeHttps(page(`${M}/services/chauffe-eau`, MARTIN_SERVICE), { start: 'http://plomberie-martin.example/services/chauffe-eau', final: `${M}/services/chauffe-eau`, status: 301, toHttps: true }));
}

const villePage = (ville: string, cp: string) => `<!doctype html><html lang="fr"><head><title>Plombier à ${ville} | Plomberie Martin</title><meta name="description" content="Plombier chauffagiste à ${ville} : dépannage de fuite, chauffe-eau, débouchage. Devis gratuit."></head><body>
<nav><a href="/">Accueil</a></nav><main><h1>Plombier à ${ville}</h1>
<p>Plomberie Martin intervient à ${ville} (${cp}) pour tous vos travaux de plomberie et de chauffage. Notre équipe de plombiers qualifiés se déplace rapidement pour réparer une fuite, remplacer un chauffe-eau ou déboucher une canalisation.</p>
<p>Nous intervenons du lundi au samedi, avec un devis écrit avant chaque intervention et des pièces garanties deux ans. Nos plombiers sont formés aux équipements récents, des ballons thermodynamiques aux chaudières à condensation.</p>
<p>Pour une urgence, appelez-nous : nous vous rappelons dans l’heure et vous donnons une estimation du délai d’intervention avant de nous déplacer.</p>
</main></body></html>`;

export function exampleDuplicate(): DuplicateReport {
  return fixDate(analyzeDuplicate(page(`${M}/plombier-villeurbanne`, villePage('Villeurbanne', '69100')), page(`${M}/plombier-bron`, villePage('Bron', '69500'))));
}

export function exampleFreshness(): FreshnessReport {
  const html = `<!doctype html><html lang="fr"><head><title>Nos tarifs de thés en vrac | Le Thé des Lilas</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Nos tarifs","datePublished":"2023-02-01","dateModified":"2026-10-30"}</script>
</head><body><main><h1>Nos tarifs</h1><p>Grille tarifaire 2024 : thé vert Sencha 8 € les 100 g, thé noir Assam 7 € les 100 g.</p>
<p>Mis à jour le 3 mars 2024.</p></main><footer><p>© 2021 Le Thé des Lilas</p></footer></body></html>`;
  return fixDate(analyzeFreshness(page(`${T}/tarifs`, html, { 'last-modified': new Date(FIXED_NOW).toUTCString() }), null, FIXED_NOW));
}

/** Bloc collé de l'exemple « Coller du code » (fiche produit fictive, prix mal formé, image absente). */
export const RICH_SAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Théière en fonte Kyoto 0,8 L",
  "brand": { "@type": "Brand", "name": "Maison Sora" },
  "offers": {
    "@type": "Offer",
    "price": "59,00 €",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
}
</script>`;

export function exampleRich(): RichReport {
  const html = `<!doctype html><html lang="fr"><head><title>Théière en fonte Kyoto | Maison Sora</title>
${RICH_SAMPLE}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Passe-t-elle sur le feu ?","acceptedAnswer":{"@type":"Answer","text":"Non, la fonte émaillée ne va pas sur le feu."}}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Accueil","item":"${S}/"},{"@type":"ListItem","position":2,"name":"Théières"}]}</script>
</head><body><main><h1>Théière en fonte Kyoto</h1><p>59 €</p></main></body></html>`;
  return fixDate(analyzeRich(page(`${S}/theiere-kyoto`, html)));
}

export const NAP_EXAMPLE: { reference: NapEntry; others: NapEntry[] } = {
  reference: { source: 'Votre site', name: 'Plomberie Martin', address: '12 boulevard des Belges, 69006 Lyon', phone: '04 78 00 00 00' },
  others: [
    { source: 'Fiche Google', name: 'Plomberie Martin', address: '12 Bd des Belges, 69006 Lyon', phone: '+33 4 78 00 00 00' },
    { source: 'Pages Jaunes', name: 'SARL Plomberie Martin', address: '21 boulevard des Belges, 69006 Lyon', phone: '04 78 00 00 00' },
    { source: 'Facebook', name: 'Martin Plomberie Chauffage', address: '12 boulevard des Belges, 69006 Lyon', phone: '04 78 00 00 01' },
  ],
};

export const UTM_EXAMPLE: UtmInput = { url: `${M}/contact`, source: 'google', medium: 'organic', campaign: 'fiche-google' };

export const FACTS_EXAMPLE: FactsInput = {
  name: 'Plomberie Martin',
  activity: 'Plombier chauffagiste',
  area: 'Lyon (1er au 9e), Villeurbanne, Bron, Caluire',
  address: '12 boulevard des Belges, 69006 Lyon',
  phone: '04 78 00 00 00',
  hours: 'Du lundi au samedi, de 8 h à 19 h',
  since: '2011',
  prices: 'Déplacement 49 € à Lyon ; remplacement de chauffe-eau 200 L de 900 à 1 400 € posé',
  facts: 'Intervention sous 2 heures pour une fuite, du lundi au samedi\nPièces et main-d’œuvre garanties 2 ans\nLe meilleur plombier de Lyon\nQualification RGE QualiPAC depuis 2019',
  updated: '2026-11-15',
  site: `${M}/`,
};
