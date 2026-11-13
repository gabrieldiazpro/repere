/**
 * Trois sites témoins complets (artisan, PME, boutique) avec leurs défauts typiques et les résultats attendus :
 * liste exacte des constats, bande de score, premiers correctifs, correctifs automatiques proposés.
 */
import { describe, expect, it } from 'vitest';
import { auditSeo, priorityOf } from '..';
import type { SeoReport, SiteCrawl } from '../types';
import { cleanLocal, cleanPme, cleanShop, clone, mkPage, ORIGIN, page, PLUMBER_LD } from './fixtures';

const ids = (r: SeoReport) => r.sections.flatMap((s) => s.findings.map((f) => f.id)).sort();
const get = (r: SeoReport, id: string) => r.sections.flatMap((s) => s.findings).find((f) => f.id === id)!;

/** Artisan : site fait soi-même, jamais optimisé. */
function artisan(): SiteCrawl {
  const s = clone(cleanLocal());
  const home = page(s, '/');
  home.title = 'Accueil';
  home.jsonLd = [];
  setNoHours(s);
  for (const p of s.pages) {
    p.metaDescription = undefined;
    p.canonical = undefined;
    p.html = p.html!.replace(/<a href="tel:[^"]+">([^<]+)<\/a>/, '$1');
    p.images[0].alt = undefined;
  }
  s.robots!.text = 'User-agent: *\nDisallow: /wp-admin/\n';
  s.robots!.sitemaps = [];
  return s;
}
function setNoHours(s: SiteCrawl) {
  const home = page(s, '/');
  home.html = home.html!.replace(/<p>Horaires[^<]*<\/p>/, '');
}

/** PME : site correct mais vieillissant (http interne, doublons, liens cassés, pas de balisage). */
function pme(): SiteCrawl {
  const s = clone(cleanPme());
  for (const p of s.pages) p.jsonLd = [];
  page(s, '/expertises/transport/').title = page(s, '/expertises/audit-entrepot/').title;
  page(s, '/expertises/transport/').textHash = page(s, '/expertises/audit-entrepot/').textHash;
  const dead = mkPage({ path: '/references/', title: 'r', h1: 'r' });
  dead.status = 404;
  s.pages.push(dead);
  s.links.push({ from: `${ORIGIN}/expertises/`, to: dead.url, anchor: 'Nos références', rel: [], internal: true });
  s.links.push({ from: `${ORIGIN}/`, to: 'http://www.exemple.fr/contact/', anchor: 'Écrivez-nous', rel: [], internal: true });
  for (const p of s.pages) p.fetchMs = 1400;
  return s;
}

/** Boutique : filtres indexables, fiches pauvres, produits sans balisage, recherche interne indexée. */
function boutique(): SiteCrawl {
  const s = clone(cleanShop());
  for (const c of ['bleu', 'rouge', 'vert', 'noir', 'blanc']) {
    const p = mkPage({ path: `/collections/t-shirts?filter.color=${c}`, title: `T-shirts couleur ${c} en coton bio | Exemple`, h1: `T-shirts ${c}`, words: 260, depth: 2 });
    p.jsonLd = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` }, { '@type': 'ListItem', position: 2, name: `T-shirts ${c}` }] }];
    s.pages.push(p);
    s.sitemapUrls.push(p.url);
    s.links.push({ from: `${ORIGIN}/collections/t-shirts`, to: p.url, anchor: c, rel: [], internal: true });
  }
  const t2 = page(s, '/products/tshirt-2');
  t2.wordCount = 70;
  const t3 = page(s, '/products/sweat-3');
  t3.jsonLd = t3.jsonLd.filter((b) => (b as Record<string, unknown>)['@type'] !== 'Product');
  const search = mkPage({ path: '/search?q=indigo', title: 'Résultats de recherche pour indigo | Exemple', h1: 'Recherche : indigo', words: 260 });
  s.pages.push(search);
  s.sitemapUrls.push(search.url);
  s.links.push({ from: `${ORIGIN}/`, to: search.url, anchor: 'Recherche indigo', rel: [], internal: true });
  return s;
}

describe('site témoin 1 : artisan plombier', () => {
  const r = auditSeo(artisan());
  it('constats attendus (et seulement eux)', () => {
    expect(r.stats.siteType).toBe('local');
    expect(ids(r)).toEqual(
      [
        'seo.robots.no_sitemap',
        'seo.title.generic',
        'seo.meta.missing',
        'seo.canonical.missing',
        'seo.img.alt_missing',
        'seo.sd.localbusiness_missing',
        'seo.local.no_tel_link',
        'seo.local.no_hours',
        'seo.local.city_not_in_title',
        'seo.sd.none',
      ].sort(),
    );
  });
  it('score moyen, le balisage d’établissement en tête des priorités', () => {
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.score).toBeLessThanOrEqual(65);
    expect(r.grade).toBe('moyen');
    expect(r.score % 5).toBe(0);
    expect(r.sections.find((s) => s.id === 'local')!.score).toBeLessThanOrEqual(70);
    expect(r.topFixes[0].id).toBe('seo.sd.localbusiness_missing');
    for (let i = 1; i < r.topFixes.length; i++) expect(priorityOf(r.topFixes[i - 1])).toBeGreaterThanOrEqual(priorityOf(r.topFixes[i]));
  });
  it('correctifs automatiques : JSON-LD, descriptions, alt, titre avec la ville, robots', () => {
    const lb = get(r, 'seo.sd.localbusiness_missing').autoFix!;
    expect(lb.kind).toBe('jsonld');
    const ld = (lb.payload as { items: { jsonld: Record<string, unknown> }[] }).items[0].jsonld;
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.telephone).toBe('+33240123456');
    expect(ld.address).toMatchObject({ postalCode: '44000', addressLocality: 'Nantes', streetAddress: '12 rue des Lilas' });
    const metas = (get(r, 'seo.meta.missing').autoFix!.payload as { items: { value: string; review: boolean }[] }).items;
    expect(metas).toHaveLength(6);
    for (const m of metas) {
      expect(m.value.length).toBeGreaterThan(40);
      expect(m.value.length).toBeLessThanOrEqual(155);
      expect(m.review).toBe(true);
    }
    const alts = (get(r, 'seo.img.alt_missing').autoFix!.payload as { items: { alt: string }[] }).items;
    expect(alts[0].alt).toMatch(/atelier/i);
    const t = (get(r, 'seo.local.city_not_in_title').autoFix!.payload as { items: { value: string }[] }).items[0].value;
    expect(t).toMatch(/Nantes/);
    expect(t.length).toBeLessThanOrEqual(60);
    expect(get(r, 'seo.title.generic').autoFix!.kind).toBe('meta.title');
    const robots = get(r, 'seo.robots.no_sitemap').autoFix!.payload as { text: string };
    expect(robots.text).toMatch(/Disallow: \/wp-admin\//);
    expect(robots.text).toMatch(/Sitemap: https:\/\/www\.exemple\.fr\/sitemap\.xml/);
  });
});

describe('site témoin 2 : PME B2B', () => {
  const r = auditSeo(pme());
  it('constats attendus', () => {
    expect(r.stats.siteType).toBe('pme');
    expect(ids(r)).toEqual(
      ['seo.dup.content', 'seo.dup.title', 'seo.broken.internal', 'seo.https.http_links', 'seo.sd.none', 'seo.sd.entity_missing', 'seo.sd.breadcrumb_missing', 'seo.perf.slow_server'].sort(),
    );
  });
  it('lien cassé : redirection proposée vers le parent existant ; lien http → https', () => {
    const b = get(r, 'seo.broken.internal');
    expect(b.severity).toBe('high');
    expect(b.affected[0].detail).toMatch(/HTTP 404/);
    expect(b.autoFix).toEqual({ kind: 'redirect', payload: { items: [{ from: `${ORIGIN}/references/`, to: `${ORIGIN}/`, status: 301, review: true }] } });
    const h = get(r, 'seo.https.http_links').autoFix!.payload as { items: { from: string; to: string }[] };
    expect(h.items[0]).toMatchObject({ from: 'http://www.exemple.fr/contact/', to: 'https://www.exemple.fr/contact/' });
  });
  it('fil d’Ariane généré avec les titres des pages parentes', () => {
    const items = (get(r, 'seo.sd.breadcrumb_missing').autoFix!.payload as { items: { url: string; jsonld: { itemListElement: Record<string, unknown>[] } }[] }).items;
    const audit = items.find((i) => i.url.endsWith('/audit-entrepot/'))!;
    expect(audit.jsonld.itemListElement.map((x) => x.name)).toEqual(['Accueil', 'Nos expertises', 'Audit d’entrepôt']);
    expect(audit.jsonld.itemListElement[2].item).toBeUndefined();
  });
  it('score et priorités', () => {
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.score).toBeLessThanOrEqual(75);
    expect(r.topFixes.map((f) => f.id).slice(0, 2)).toContain('seo.broken.internal');
  });
});

describe('site témoin 3 : boutique en ligne', () => {
  const r = auditSeo(boutique());
  it('constats attendus', () => {
    expect(r.stats.siteType).toBe('ecommerce');
    expect(ids(r)).toEqual(
      ['seo.ecom.facets_indexable', 'seo.ecom.facets_crawlable', 'seo.ecom.product_thin', 'seo.ecom.product_schema_missing', 'seo.ecom.search_indexable', 'seo.link.weak_inlinks'].sort(),
    );
  });
  it('facettes : canonical vers la catégorie et règles robots proposées', () => {
    const c = get(r, 'seo.ecom.facets_indexable');
    expect(c.affectedCount).toBe(5);
    const items = (c.autoFix!.payload as { items: { href: string }[] }).items;
    expect(new Set(items.map((i) => i.href))).toEqual(new Set([`${ORIGIN}/collections/t-shirts`]));
    const rb = get(r, 'seo.ecom.facets_crawlable').autoFix!.payload as { text: string; changes: string[] };
    expect(rb.text).toMatch(/Disallow: \/\*\?\*filter\.color=/);
    expect(get(r, 'seo.ecom.search_indexable').autoFix!.kind).toBe('meta.robots');
  });
  it('section e-commerce faible, facettes en tête', () => {
    expect(r.sections.find((s) => s.id === 'ecommerce')!.score).toBeLessThan(60);
    expect(r.topFixes[0].id).toMatch(/seo\.ecom\.(facets_indexable|product_schema_missing)/);
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(r.score).toBeLessThanOrEqual(75);
  });
});

describe('score : règles générales', () => {
  it('blocage critique global → note plafonnée à 40', () => {
    const s = clone(cleanPme());
    s.robots!.text = 'User-agent: *\nDisallow: /\n';
    const r = auditSeo(s);
    expect(r.score).toBeLessThanOrEqual(40);
    expect(r.grade).toBe('faible');
    expect(r.topFixes[0].id).toBe('seo.robots.blocks_all');
  });
  it('erreur 5xx sur une page sur dix : critique sans plafond global', () => {
    const s = clone(cleanPme());
    page(s, '/expertises/transport/').status = 500;
    const r = auditSeo(s);
    expect(r.score).toBeGreaterThan(40);
  });
  it('affected plafonné à 200, affectedCount exact', () => {
    const s = clone(cleanPme());
    for (let i = 0; i < 250; i++) {
      const p = mkPage({ path: `/fiches/fiche-${i}/`, title: `Fiche pratique logistique numéro ${i} | Exemple`, h1: `Fiche ${i}`, depth: 2 });
      p.metaDescription = undefined;
      p.jsonLd = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` }, { '@type': 'ListItem', position: 2, name: `Fiche ${i}` }] }];
      s.pages.push(p);
      s.sitemapUrls.push(p.url);
      s.links.push({ from: `${ORIGIN}/`, to: p.url, anchor: `Fiche ${i}`, rel: [], internal: true });
      s.links.push({ from: `${ORIGIN}/contact/`, to: p.url, anchor: `Fiche ${i}`, rel: [], internal: true });
    }
    const r = auditSeo(s);
    const f = get(r, 'seo.meta.missing');
    expect(f.affectedCount).toBe(250);
    expect(f.affected).toHaveLength(200);
    expect(f.title).toBe('250 pages n’ont pas de description (meta description)');
  });
  it('type de site imposé par l’appelant', () => {
    const r = auditSeo(cleanPme(), { siteType: 'local' });
    expect(r.stats.siteType).toBe('local');
    expect(r.stats.siteTypeDetected).toBe(false);
    expect(r.sections.find((s) => s.id === 'local')!.applicable).toBe(true);
    expect(ids(r)).toContain('seo.sd.localbusiness_missing');
  });
  it('page d’accueil seule et vide : aucune exception', () => {
    const p = mkPage({ path: '/', title: '', h1: '' });
    p.html = undefined;
    p.h1 = [];
    p.headings = [];
    p.images = [];
    const r = auditSeo({ ...cleanPme(), pages: [p], links: [], sitemapUrls: [], sitemaps: [], robots: null });
    expect(r.stats.checksRun).toBe(r.stats.checksApplicable);
    expect(ids(r)).toContain('seo.title.missing');
  });
  it('balisage LocalBusiness complet = pas de constat de données structurées', () => {
    const s = clone(cleanLocal());
    page(s, '/').jsonLd = [PLUMBER_LD];
    expect(auditSeo(s).sections.find((x) => x.id === 'donnees')!.findings).toEqual([]);
  });
});
