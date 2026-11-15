/**
 * États « exemple » des outils V6 : calculés par les vraies fonctions d'analyse sur des pages FICTIVES
 * (domaines en .example, réservés : aucune entreprise réelle). Exécuté côté serveur au rendu statique de la page,
 * passé en propriété sérialisable, étiqueté « Exemple fictif » à l'affichage.
 */
import { analyzeHeaders, analyzeHreflang, analyzeIndex, analyzeLinks, analyzeMeta, analyzeOg, analyzeRedirects, analyzeSitemap, pageLinks, type PageFetch } from './analyze';
import type { HeadersReport, HreflangReport, IndexReport, LinksReport, MetaReport, OgReport, RedirectReport, SitemapReport } from './types';

const M = 'https://plomberie-martin.example';
const S = 'https://maison-sora.example';
const T = 'https://the-des-lilas.example';
/** Date fixe : les exemples ne bougent pas d'un rendu à l'autre. */
const FIXED_NOW = Date.parse('2026-11-15T09:00:00Z');

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

const fixDate = <R extends { checkedAt: string }>(r: R): R => ({ ...r, checkedAt: new Date(FIXED_NOW).toISOString() });

const MARTIN_HOME = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Plomberie Martin – Plombier chauffagiste à Lyon 3, dépannage de fuite, chauffe-eau et débouchage 7 jours sur 7</title>
<link rel="canonical" href="${M}/">
</head><body>
<header><nav><a href="/">Accueil</a> <a href="/services">Nos services</a> <a href="/tarifs">Tarifs</a> <a href="/contact">Contact</a></nav></header>
<main><h1>Plombier chauffagiste à Lyon 3</h1>
<p>Plomberie Martin intervient pour les fuites, les chauffe-eau et les débouchages à Lyon et Villeurbanne depuis 2011.</p>
<p><a href="/services/chauffe-eau">Remplacement de chauffe-eau</a> · <a href="/services/debouchage">Débouchage</a> · <a href="/ancienne-promo">cliquez ici</a></p>
<p><a href="https://www.service-public.fr/particuliers/vosdroits/F2042">Vos droits pour un devis</a> <a href="https://annuaire.example/plomberie-martin" rel="nofollow">Notre fiche annuaire</a> <a href="/contact"><img src="/tel.svg"></a></p>
</main><footer><a href="/mentions-legales">Mentions légales</a></footer></body></html>`;

export function exampleMeta(): MetaReport {
  return fixDate(analyzeMeta(page(`${M}/`, MARTIN_HOME)));
}

export const SERP_EXAMPLE = {
  title: 'Plombier à Lyon 3 : dépannage de fuite en 2 h, chauffe-eau et débouchage | Plomberie Martin',
  description: 'Fuite, chauffe-eau en panne, évier bouché ? Plomberie Martin intervient en 2 heures à Lyon et Villeurbanne, 6 jours sur 7. Devis écrit avant travaux, pièces garanties deux ans.',
  url: `${M}/services/depannage`,
};

export function exampleIndex(): IndexReport {
  const html = `<!doctype html><html lang="fr"><head><title>Remplacement de chauffe-eau à Lyon | Plomberie Martin</title>
<meta name="robots" content="noindex, follow"><link rel="canonical" href="${M}/services/chauffe-eau"></head>
<body><main><h1>Remplacement de chauffe-eau à Lyon</h1><p>Devis écrit, pose en une demi-journée.</p></main></body></html>`;
  const robots = { url: `${M}/robots.txt`, status: 200, text: 'User-agent: *\nDisallow: /admin/\n\nSitemap: https://plomberie-martin.example/sitemap.xml\n' };
  return fixDate(analyzeIndex(page(`${M}/services/chauffe-eau`, html), robots));
}

export function exampleRedirects(): RedirectReport {
  const start = 'http://plomberie-martin.example/ancien-tarif';
  const main = {
    start,
    chain: [
      { url: start, status: 301 },
      { url: `${M}/ancien-tarif`, status: 302 },
    ],
    final: { url: `${M}/tarifs`, status: 200 },
  };
  const v = (s: string, chain: { url: string; status: number }[], final: string, status = 200) => ({ start: s, chain, final: { url: final, status } });
  const variants = [
    v(`${M}/ancien-tarif`, [{ url: `${M}/ancien-tarif`, status: 302 }], `${M}/tarifs`),
    v('https://www.plomberie-martin.example/ancien-tarif', [], 'https://www.plomberie-martin.example/ancien-tarif'),
    v(start, main.chain, `${M}/tarifs`),
    v('http://www.plomberie-martin.example/ancien-tarif', [{ url: 'http://www.plomberie-martin.example/ancien-tarif', status: 301 }], 'https://www.plomberie-martin.example/ancien-tarif'),
  ];
  return fixDate(analyzeRedirects(main, variants));
}

export function exampleHeaders(): HeadersReport {
  return fixDate(
    analyzeHeaders(
      page(`${M}/`, MARTIN_HOME, {
        'content-type': 'text/html',
        'cache-control': 'max-age=0, no-cache',
        date: 'Sun, 15 Nov 2026 09:00:00 GMT',
        server: 'Apache/2.4.41 (Ubuntu)',
        'x-powered-by': 'PHP/7.4.3',
        'content-language': 'fr',
        vary: 'Accept-Encoding',
        'set-cookie': 'PHPSESSID=fictif; path=/',
      }),
    ),
  );
}

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${S}/</loc><lastmod>2026-11-02</lastmod></url>
<url><loc>${S}/collections/shampoings-solides</loc><lastmod>2026-10-28</lastmod></url>
<url><loc>${S}/products/shampoing-solide-onde</loc><lastmod>2026-10-28</lastmod></url>
<url><loc>${S}/products/apres-shampoing-brume</loc><lastmod>2027-03-01</lastmod></url>
<url><loc>${S}/products/savon-ancienne-recette</loc><lastmod>2026-06-12</lastmod></url>
<url><loc>${S}/pages/livraison</loc><lastmod>2026-09-01</lastmod></url>
</urlset>`;

export function exampleSitemap(): SitemapReport {
  const f = { url: `${S}/sitemap.xml`, source: 'default' as const, status: 200, contentType: 'application/xml; charset=utf-8', text: SITEMAP_XML, bytes: SITEMAP_XML.length, truncated: false, declaredInRobots: false };
  const sample = [
    { url: `${S}/`, status: 200 },
    { url: `${S}/collections/shampoings-solides`, status: 200 },
    { url: `${S}/products/shampoing-solide-onde`, status: 200 },
    { url: `${S}/products/apres-shampoing-brume`, status: 200 },
    { url: `${S}/products/savon-ancienne-recette`, status: 404 },
    { url: `${S}/pages/livraison`, status: 301, finalUrl: `${S}/pages/livraison-et-retours` },
  ];
  return fixDate(analyzeSitemap(f, sample, [], FIXED_NOW));
}

export function exampleHreflang(): HreflangReport {
  const links = `<link rel="alternate" hreflang="fr" href="${S}/fr/"><link rel="alternate" hreflang="fr-BE" href="${S}/fr-be/"><link rel="alternate" hreflang="en-UK" href="${S}/en/">`;
  const html = `<!doctype html><html lang="fr"><head><title>Maison Sora</title><link rel="canonical" href="${S}/fr/">${links}</head><body><main><h1>Cosmétiques solides</h1></main></body></html>`;
  const alternates = [
    { href: `${S}/fr-be/`, status: 200, hreflang: [{ lang: 'fr', href: `${S}/fr/` }, { lang: 'fr-BE', href: `${S}/fr-be/` }] },
    { href: `${S}/en/`, status: 200, hreflang: [{ lang: 'en', href: `${S}/en/` }] },
  ];
  return fixDate(analyzeHreflang(page(`${S}/fr/`, html), alternates));
}

export function exampleOg(): OgReport {
  const html = `<!doctype html><html lang="fr"><head><title>Thé des Lilas, salon de thé à Bordeaux</title>
<meta name="description" content="Salon de thé et pâtisseries maison à Bordeaux Chartrons, ouvert du mardi au dimanche.">
<meta property="og:title" content="Thé des Lilas, salon de thé à Bordeaux"><meta property="og:description" content="Pâtisseries maison et thés en vrac, quartier des Chartrons.">
<meta property="og:type" content="website"></head><body><main><h1>Thé des Lilas</h1></main></body></html>`;
  return fixDate(analyzeOg(page(`${T}/`, html)));
}

export function exampleLinks(): LinksReport {
  const p = page(`${M}/`, MARTIN_HOME);
  const rows = pageLinks(p);
  const statuses = new Map<string, { status: number; error?: string }>();
  for (const r of rows) statuses.set(r.href, { status: r.href.endsWith('/ancienne-promo') ? 404 : r.href.endsWith('/tarifs') ? 301 : 200 });
  return fixDate(analyzeLinks(p, rows, statuses));
}

export const READABILITY_EXAMPLE = `Plomberie Martin, entreprise artisanale implantée dans le troisième arrondissement de Lyon depuis 2011, intervient quotidiennement pour l’ensemble des problématiques de plomberie et de chauffage rencontrées par les particuliers comme par les professionnels, qu’il s’agisse de fuites, de remplacements de chauffe-eau, de débouchages de canalisations ou d’entretiens de chaudières à gaz.

Nous intervenons en deux heures. Le devis est écrit avant les travaux. Les pièces sont garanties deux ans.

Notre équipe de trois plombiers qualifiés, formés aux dernières réglementations en vigueur et disposant d’un véhicule entièrement équipé, se déplace dans tout Lyon ainsi qu’à Villeurbanne et Caluire-et-Cuire, du lundi au samedi, afin de vous proposer une solution rapide, durable et adaptée à votre budget.

Appelez-nous au 04 00 00 00 00.`;
