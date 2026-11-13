/**
 * Faux crawls pour les tests : des sites « propres » (aucun constat attendu) par type, que chaque test dégrade.
 */
import type { CrawledPage, SiteCrawl } from '../types';

export const ORIGIN = 'https://www.exemple.fr';

let hashSeq = 0;

export interface PageSpec {
  path: string;
  title: string;
  h1: string;
  description?: string;
  words?: number;
  body?: string; // HTML ajouté dans <main>
  head?: string; // HTML ajouté dans <head>
  jsonLd?: unknown[];
  depth?: number;
  extra?: Partial<CrawledPage>;
}

export function footer(phone = '02 40 12 34 56', address = '12 rue des Lilas, 44000 Nantes'): string {
  return `<footer><p>${address}</p><p>Téléphone : <a href="tel:+33${phone.replace(/\D/g, '').slice(1)}">${phone}</a></p><a href="/mentions-legales/">Mentions légales</a> <a href="/confidentialite/">Politique de confidentialité</a></footer>`;
}

export function mkPage(s: PageSpec, foot = footer()): CrawledPage {
  const url = `${ORIGIN}${s.path}`;
  const description = s.description ?? `${s.h1} : informations détaillées, conseils et coordonnées pour vous accompagner au quotidien.`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${s.title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}">${s.head ?? ''}</head><body><header><nav></nav></header><main><h1>${s.h1}</h1><h2>Présentation</h2><p>${s.h1} — un paragraphe de présentation suffisamment long pour servir de description à la page et rassurer les visiteurs.</p>${s.body ?? ''}</main>${foot}</body></html>`;
  return {
    url,
    finalUrl: url,
    status: 200,
    redirectChain: [],
    depth: s.depth ?? (s.path === '/' ? 0 : 1),
    contentType: 'text/html; charset=utf-8',
    bytes: 30_000,
    fetchMs: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'br', 'strict-transport-security': 'max-age=31536000' },
    html,
    title: s.title,
    metaDescription: description,
    canonical: url,
    lang: 'fr',
    hreflang: [],
    h1: [s.h1],
    headings: [{ level: 1, text: s.h1 }, { level: 2, text: 'Présentation' }],
    wordCount: s.words ?? 420,
    textHash: `h${++hashSeq}`,
    images: [{ src: `${ORIGIN}/img/${s.path.replace(/\W+/g, '-') || 'accueil'}-atelier.webp`, alt: `Photo : ${s.h1}`, width: 800, height: 600, loading: 'eager', bytes: 60_000 }],
    jsonLd: s.jsonLd ?? [],
    jsonLdErrors: [],
    openGraph: { 'og:title': s.title, 'og:image': `${ORIGIN}/og.jpg`, 'og:site_name': 'Exemple' },
    internalLinks: 8,
    externalLinks: 2,
    isIndexable: true,
    renderHints: { scriptsCount: 4, textToHtmlRatio: 0.25, likelyClientRendered: false },
    ...s.extra,
  };
}

const ANCHORS: Record<string, string> = {};

/** Assemble un SiteCrawl : chaque page lie toutes les autres (menu), sitemap = pages indexables. */
export function mkSite(pages: CrawledPage[], o: Partial<SiteCrawl> = {}): SiteCrawl {
  const links: SiteCrawl['links'] = [];
  for (const a of pages) {
    if (a.status !== 200) continue;
    for (const b of pages) {
      if (a === b || b.status >= 400 || b.redirectChain.length) continue;
      links.push({ from: a.finalUrl, to: b.url, anchor: ANCHORS[b.url] ?? (b.h1[0] || 'Accueil'), rel: [], internal: true });
    }
    links.push({ from: a.finalUrl, to: 'https://www.facebook.com/exemple', anchor: 'Facebook', rel: [], internal: false });
  }
  return {
    startUrl: `${ORIGIN}/`,
    origin: ORIGIN,
    finalOrigin: ORIGIN,
    startedAt: '2026-11-13T10:00:00.000Z',
    durationMs: 12_000,
    truncated: false,
    robots: { url: `${ORIGIN}/robots.txt`, status: 200, text: `User-agent: *\nDisallow: /wp-admin/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`, sitemaps: [`${ORIGIN}/sitemap.xml`] },
    sitemaps: [{ url: `${ORIGIN}/sitemap.xml`, status: 200, urlCount: pages.filter((p) => p.isIndexable).length, errors: [] }],
    sitemapUrls: pages.filter((p) => p.isIndexable && p.status === 200).map((p) => p.finalUrl),
    pages,
    links,
    errors: [],
    ...o,
  };
}

const crumb = (items: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(i < items.length - 1 ? { item: `${ORIGIN}${path}` } : {}) })),
});

/* ------------------------------------------------------------------ */
/* Site témoin 1 : artisan plombier (local)                            */
/* ------------------------------------------------------------------ */

export const PLUMBER_LD = {
  '@context': 'https://schema.org',
  '@type': 'Plumber',
  name: 'Exemple Plomberie',
  url: `${ORIGIN}/`,
  telephone: '+33240123456',
  image: `${ORIGIN}/og.jpg`,
  priceRange: '€€',
  address: { '@type': 'PostalAddress', streetAddress: '12 rue des Lilas', postalCode: '44000', addressLocality: 'Nantes', addressCountry: 'FR' },
  geo: { '@type': 'GeoCoordinates', latitude: 47.2184, longitude: -1.5536 },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' }],
  areaServed: ['Nantes', 'Rezé', 'Saint-Herblain'],
  sameAs: ['https://maps.app.goo.gl/AbCdEf123', 'https://www.facebook.com/exemple'],
};

export function cleanLocal(): SiteCrawl {
  const pages = [
    mkPage({ path: '/', title: 'Plombier à Nantes – dépannage et rénovation | Exemple', h1: 'Plombier à Nantes', body: '<p>Horaires : du lundi au vendredi, 8 h – 18 h.</p><p>Nous intervenons à Nantes, Rezé et Saint-Herblain.</p>', jsonLd: [PLUMBER_LD] }),
    mkPage({ path: '/depannage/', title: 'Dépannage plomberie en urgence à Nantes | Exemple', h1: 'Dépannage de plomberie en urgence' }),
    mkPage({ path: '/salle-de-bains/', title: 'Rénovation de salle de bains clé en main | Exemple', h1: 'Rénovation de salle de bains' }),
    mkPage({ path: '/contact/', title: 'Contact et accès à l’atelier | Exemple', h1: 'Contact et accès', words: 120, body: '<a href="https://maps.app.goo.gl/AbCdEf123">Itinéraire</a>' }),
    mkPage({ path: '/mentions-legales/', title: 'Mentions légales du site | Exemple', h1: 'Mentions légales', words: 150 }),
    mkPage({ path: '/confidentialite/', title: 'Politique de confidentialité | Exemple', h1: 'Politique de confidentialité', words: 180 }),
  ];
  const s = mkSite(pages);
  s.links.push({ from: `${ORIGIN}/contact/`, to: 'https://maps.app.goo.gl/AbCdEf123', anchor: 'Itinéraire', rel: [], internal: false });
  return s;
}

/* ------------------------------------------------------------------ */
/* Site témoin 2 : PME B2B                                             */
/* ------------------------------------------------------------------ */

export const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Exemple Conseil',
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/logo.png`,
  telephone: '+33240123456',
  address: { '@type': 'PostalAddress', streetAddress: '12 rue des Lilas', postalCode: '44000', addressLocality: 'Nantes', addressCountry: 'FR' },
  sameAs: ['https://www.linkedin.com/company/exemple'],
};

export function cleanPme(): SiteCrawl {
  const pages = [
    mkPage({ path: '/', title: 'Cabinet de conseil en logistique industrielle | Exemple', h1: 'Conseil en logistique industrielle', jsonLd: [ORG_LD] }),
    mkPage({ path: '/expertises/', title: 'Nos expertises : entrepôt, transport, achats | Exemple', h1: 'Nos expertises' }),
    mkPage({ path: '/expertises/audit-entrepot/', depth: 2, title: 'Audit d’entrepôt et plan d’amélioration | Exemple', h1: 'Audit d’entrepôt', jsonLd: [crumb([['Accueil', '/'], ['Nos expertises', '/expertises/'], ['Audit d’entrepôt', '/expertises/audit-entrepot/']])] }),
    mkPage({ path: '/expertises/transport/', depth: 2, title: 'Optimisation du transport routier B2B | Exemple', h1: 'Optimisation du transport', jsonLd: [crumb([['Accueil', '/'], ['Nos expertises', '/expertises/'], ['Optimisation du transport', '/expertises/transport/']])] }),
    mkPage({ path: '/qui-sommes-nous/', title: 'Qui sommes-nous : équipe et références | Exemple', h1: 'Qui sommes-nous' }),
    mkPage({ path: '/contact/', title: 'Contactez nos consultants | Exemple', h1: 'Contact', words: 120 }),
    mkPage({ path: '/mentions-legales/', title: 'Mentions légales du site | Exemple', h1: 'Mentions légales', words: 150 }),
    mkPage({ path: '/confidentialite/', title: 'Politique de confidentialité | Exemple', h1: 'Politique de confidentialité', words: 180 }),
  ];
  return mkSite(pages);
}

/* ------------------------------------------------------------------ */
/* Site témoin 3 : boutique en ligne                                   */
/* ------------------------------------------------------------------ */

export function productLd(name: string, sku: string, price = '29.90', availability = 'https://schema.org/InStock') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    image: `${ORIGIN}/img/${sku}.webp`,
    description: `${name} fabriqué en France, coton biologique, coupe ajustée, lavable à 30 degrés.`,
    brand: { '@type': 'Brand', name: 'Exemple' },
    sku,
    gtin13: '3700000000000'.slice(0, 12) + sku.slice(-1),
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'EUR',
      availability,
      url: `${ORIGIN}/products/${sku}`,
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: '4.90', currency: 'EUR' } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'FR', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 30 },
    },
  };
}

export const SHOP_ORG = { ...ORG_LD, '@type': 'OnlineStore', name: 'Exemple Boutique' };

export function cleanShop(): SiteCrawl {
  const prod = (sku: string, name: string, cat: string) =>
    mkPage({
      path: `/products/${sku}`,
      depth: 2,
      title: `${name} | Exemple`,
      h1: name,
      words: 320,
      body: `<p class="price">29,90 €</p><button class="product-form__submit">Ajouter au panier</button>`,
      extra: { openGraph: { 'og:title': name, 'og:image': `${ORIGIN}/img/${sku}.webp`, 'og:type': 'product' } },
      jsonLd: [productLd(name, sku), crumb([['Accueil', '/'], [cat, '/collections/t-shirts'], [name, `/products/${sku}`]])],
    });
  const pages = [
    mkPage({ path: '/', title: 'Vêtements en coton bio fabriqués en France | Exemple', h1: 'Vêtements en coton bio', jsonLd: [SHOP_ORG], body: '<script src="https://cdn.shopify.com/s/files/app.js" defer></script>' }),
    mkPage({ path: '/collections/t-shirts', title: 'T-shirts en coton bio pour homme et femme | Exemple', h1: 'T-shirts en coton bio', words: 260 }),
    mkPage({ path: '/collections/sweats', title: 'Sweats molletonnés made in France | Exemple', h1: 'Sweats molletonnés', words: 260 }),
    prod('tshirt-1', 'T-shirt col rond indigo', 'T-shirts en coton bio'),
    prod('tshirt-2', 'T-shirt col V écru', 'T-shirts en coton bio'),
    prod('sweat-3', 'Sweat capuche anthracite', 'T-shirts en coton bio'),
    mkPage({ path: '/pages/a-propos', title: 'Notre atelier et nos engagements | Exemple', h1: 'Notre atelier' }),
    mkPage({ path: '/pages/contact', title: 'Contact et service client | Exemple', h1: 'Service client', words: 120 }),
    mkPage({ path: '/pages/cgv', title: 'Conditions générales de vente | Exemple', h1: 'Conditions générales de vente', words: 900 }),
    mkPage({ path: '/mentions-legales/', title: 'Mentions légales du site | Exemple', h1: 'Mentions légales', words: 150 }),
    mkPage({ path: '/confidentialite/', title: 'Politique de confidentialité | Exemple', h1: 'Politique de confidentialité', words: 180 }),
  ];
  // Fil d'Ariane balisé sur toutes les pages à 2 niveaux
  for (const p of pages) {
    const segs = new URL(p.finalUrl).pathname.split('/').filter(Boolean);
    if (segs.length >= 2 && !p.jsonLd.some((b) => (b as Record<string, unknown>)['@type'] === 'BreadcrumbList')) {
      p.jsonLd.push(crumb([['Accueil', '/'], [segs[0], `/${segs[0]}`], [p.h1[0], new URL(p.finalUrl).pathname]]));
    }
  }
  // Les descriptions produit doivent différer (le gabarit les ferait identiques sinon)
  pages.forEach((p, i) => {
    if (p.finalUrl.includes('/products/')) {
      const n = (p.jsonLd[0] as Record<string, unknown>);
      n.description = `${String(n.name)} : modèle n°${i}, coton biologique, coupe ajustée, lavable à 30 degrés.`;
    }
  });
  return mkSite(pages);
}

/** Copie profonde (les tests dégradent une copie). */
export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function page(s: SiteCrawl, path: string): CrawledPage {
  const p = s.pages.find((x) => x.finalUrl === `${ORIGIN}${path}`);
  if (!p) throw new Error(`page absente : ${path}`);
  return p;
}
