import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crawlSite } from '../crawl';
import type { CrawlProgress, CrawledPage, SiteCrawl } from '../types';
import { startFakeSites, type FakeServer } from './fakesites';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());

const page = (c: SiteCrawl, path: string): CrawledPage | undefined => c.pages.find((p) => new URL(p.url).pathname === path || new URL(p.finalUrl).pathname === path);
const fast = { delayMs: 0, timeBudgetMs: 15_000 };

describe('site normal', () => {
  let c: SiteCrawl;
  const progress: CrawlProgress[] = [];
  beforeAll(async () => {
    c = await crawlSite('normal.test', { ...fast, checkLinks: true, onProgress: (p) => progress.push(p) });
  });

  it('normalise l’entrée et lit robots + sitemap', () => {
    expect(c.startUrl).toBe('https://normal.test/');
    expect(c.finalOrigin).toBe('https://normal.test');
    expect(c.robots?.status).toBe(200);
    expect(c.robots?.sitemaps).toEqual(['https://normal.test/sitemap.xml']);
    expect(c.sitemaps[0]).toMatchObject({ url: 'https://normal.test/sitemap.xml', status: 200, urlCount: 6 });
    expect(c.sitemaps[0].errors.join(' ')).toContain('hors du site');
    expect(c.sitemapUrls).toContain('https://normal.test/orphelin');
    expect(c.sitemapUrls).not.toContain('https://autre-site.test/x');
    expect(c.truncated).toBe(false);
  });

  it('explore toutes les pages une seule fois (suivi retiré, fragments, pas de PDF)', () => {
    const urls = c.pages.map((p) => p.finalUrl).sort();
    expect(urls).toEqual(
      ['/', '/blog/', '/blog/article-1', '/contact', '/orphelin', '/page-disparue', '/services/', '/services/traiteur'].map((p) => `https://normal.test${p}`).sort(),
    );
    expect(srv.hits.filter((h) => h === 'GET normal.test/contact')).toHaveLength(1);
    expect(srv.hits.some((h) => h.includes('/doc.pdf'))).toBe(false);
    expect(srv.hits.some((h) => h.includes('piege-404'))).toBe(false); // liens d'une page 404 non suivis
  });

  it('extrait les champs de la page d’accueil', () => {
    const h = page(c, '/')!;
    expect(h).toMatchObject({ status: 200, depth: 0, title: 'Boulangerie Exemple à Lyon', metaDescription: 'Pain au levain à Lyon.', lang: 'fr', isIndexable: true });
    expect(h.h1).toEqual(['Boulangerie Exemple']);
    expect(h.openGraph['og:title']).toBe('Boulangerie Exemple');
    expect(h.jsonLd).toEqual([{ '@context': 'https://schema.org', '@type': 'Bakery', name: 'Boulangerie Exemple' }]);
    expect(h.headers['content-type']).toContain('text/html');
    expect(h.html).toContain('<h1>Boulangerie Exemple</h1>');
    expect(h.wordCount).toBeGreaterThan(50);
    expect(h.textHash).toMatch(/^[0-9a-f]{16}$/);
    const imgs = Object.fromEntries(h.images.map((i) => [i.src.replace('https://normal.test', ''), i]));
    expect(imgs['/img/pain.jpg']).toMatchObject({ alt: 'Pain au levain', width: 800, height: 600, loading: 'lazy', bytes: 12_345 });
    expect(imgs['/img/deco.png'].alt).toBe('');
    expect('alt' in imgs['/img/sans-alt.png']).toBe(false);
    expect(h.externalLinks).toBe(2);
    expect(h.internalLinks).toBeGreaterThanOrEqual(5);
    expect(h.renderHints.likelyClientRendered).toBe(false);
  });

  it('calcule la profondeur de clic et repère l’orpheline', () => {
    expect(page(c, '/services/')!.depth).toBe(1);
    expect(page(c, '/services/traiteur')!.depth).toBe(2);
    expect(page(c, '/blog/article-1')!.depth).toBe(2);
    expect(page(c, '/orphelin')!.depth).toBe(-1);
  });

  it('construit le graphe de liens et repère les liens cassés', () => {
    const l = c.links.find((x) => x.to === 'https://ext.test/absent')!;
    expect(l).toMatchObject({ from: 'https://normal.test/', anchor: 'Ancien partenaire', internal: false });
    expect(l.rel).toEqual(['nofollow', 'noopener']);
    expect(c.links.some((x) => x.to === 'https://normal.test/contact' && x.internal)).toBe(true);
    expect(page(c, '/page-disparue')).toMatchObject({ status: 404, isIndexable: false });
    const checks = Object.fromEntries((c.linkChecks ?? []).map((k) => [k.url, k]));
    expect(checks['https://ext.test/ok'].status).toBe(200);
    expect(checks['https://ext.test/absent'].status).toBe(404);
    expect(checks['https://normal.test/img/sans-alt.png']).toMatchObject({ kind: 'image', status: 404 });
    expect(srv.hits).toContain('HEAD ext.test/ok');
  });

  it('émet la progression dans l’ordre des phases', () => {
    const phases = [...new Set(progress.map((p) => p.phase))];
    expect(phases).toEqual(['robots', 'sitemaps', 'pages', 'done']);
    expect(progress.at(-1)).toMatchObject({ phase: 'done', fetched: c.pages.length });
  });
});

describe('redirections', () => {
  let c: SiteCrawl;
  beforeAll(async () => {
    c = await crawlSite('http://redirs.test', fast);
  });

  it('suit la redirection du domaine (www) et la garde dans la chaîne', () => {
    expect(c.startUrl).toBe('http://redirs.test/');
    expect(c.finalOrigin).toBe('https://www.redirs.test');
    const h = c.pages[0];
    expect(h.finalUrl).toBe('https://www.redirs.test/');
    expect(h.redirectChain).toEqual([{ url: 'http://redirs.test/', status: 301 }]);
    expect(h.isIndexable).toBe(true);
  });

  it('enregistre les chaînes, les boucles, les sorties et bloque la tentative SSRF', () => {
    const chain = c.redirects!.find((r) => r.from.endsWith('/ancienne'))!;
    expect(chain.chain.map((x) => x.status)).toEqual([301, 302]);
    expect(chain.to).toBe('https://www.redirs.test/nouvelle');
    const loop = c.redirects!.find((r) => r.from.endsWith('/boucle-a'))!;
    expect(loop.error).toMatch(/Boucle/);
    expect(c.errors.some((e) => e.url.endsWith('/boucle-a') && /Boucle/.test(e.error))).toBe(true);
    const out = page(c, '/sortie')!;
    expect(out).toMatchObject({ status: 301, finalUrl: 'https://ailleurs.test/', isIndexable: false });
    expect(srv.hits.some((h) => h.includes('ailleurs.test'))).toBe(false);
    // redirection vers une adresse interne : hors du site, jamais suivie
    expect(page(c, '/ssrf')).toMatchObject({ status: 302, finalUrl: 'http://127.0.0.1/admin', isIndexable: false });
    expect(srv.hits.some((h) => h.includes('/admin'))).toBe(false);
    // /nouvelle n'est explorée qu'une fois, même atteinte par /ancienne
    expect(c.pages.filter((p) => p.finalUrl === 'https://www.redirs.test/nouvelle')).toHaveLength(1);
  });

  it('refuse une entrée interne (anti-SSRF)', async () => {
    await expect(crawlSite('http://127.0.0.1/')).rejects.toThrow();
    await expect(crawlSite('http://localhost/')).rejects.toThrow();
    // l'accueil redirige vers les métadonnées cloud : refusé avant toute connexion
    await expect(crawlSite('piege.test', fast)).rejects.toMatchObject({ code: 'blocked_ip' });
  });
});

describe('robots.txt', () => {
  it('ne lit pas un site qui bloque RepereBot', async () => {
    const before = srv.hits.length;
    const c = await crawlSite('bloque.test', fast);
    expect(c.pages).toHaveLength(1);
    expect(c.pages[0]).toMatchObject({ blockedByRobots: true, isIndexable: false });
    expect(srv.hits.slice(before).filter((h) => !h.endsWith('/robots.txt'))).toEqual([]);
  });

  it('respecte une section interdite', async () => {
    const c = await crawlSite('partiel.test', fast);
    expect(page(c, '/public')!.status).toBe(200);
    expect(page(c, '/prive/secret')).toMatchObject({ blockedByRobots: true });
    expect(srv.hits).not.toContain('GET partiel.test/prive/secret');
  });

  it('respectRobots: false lit quand même', async () => {
    const c = await crawlSite('bloque.test', { ...fast, respectRobots: false });
    expect(c.pages[0].status).toBe(200);
  });
});

describe('sitemaps', () => {
  it('lit un index avec un fichier gzip et signale le fichier absent', async () => {
    const c = await crawlSite('gz.test', { ...fast, maxPages: 10 });
    const by = Object.fromEntries(c.sitemaps.map((s) => [s.url.replace('https://gz.test', ''), s]));
    expect(by['/sitemap_index.xml'].urlCount).toBe(3);
    expect(by['/sm-produits.xml.gz'].urlCount).toBe(30);
    expect(by['/sm-pages.xml'].urlCount).toBe(4);
    expect(by['/sm-absent.xml'].status).toBe(404);
    expect(c.sitemapUrls).toHaveLength(34);
    // échantillon équilibré : les sections blog et produits sont toutes deux représentées
    const paths = c.pages.map((p) => new URL(p.finalUrl).pathname);
    expect(paths.some((p) => p.startsWith('/produits/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('/blog/'))).toBe(true);
    expect(c.pages).toHaveLength(10);
    expect(c.truncated).toBe(true);
  });
});

describe('budgets', () => {
  it('site géant : 60 pages en moins de 10 s, résultat partiel', async () => {
    const t = Date.now();
    const c = await crawlSite('geant.test', { maxPages: 60 });
    const ms = Date.now() - t;
    expect(c.pages).toHaveLength(60);
    expect(c.truncated).toBe(true);
    expect(ms).toBeLessThan(10_000);
    expect(c.sitemapUrls).toHaveLength(5000);
    const sections = new Set(c.pages.map((p) => new URL(p.finalUrl).pathname.split('/')[1]));
    for (const s of ['p', 'produits', 'blog', 'magasins', 'aide', 'marques']) expect(sections.has(s)).toBe(true);
  }, 15_000);

  it('pages lentes : budget de temps respecté, résultat partiel', async () => {
    const t = Date.now();
    const c = await crawlSite('lent.test', { delayMs: 0, timeBudgetMs: 1_500 });
    expect(Date.now() - t).toBeLessThan(3_000);
    expect(c.truncated).toBe(true);
    expect(page(c, '/rapide')?.status).toBe(200);
    expect(page(c, '/tres-lente')).toBeUndefined();
  });

  it('annulation : résultat partiel marqué', async () => {
    const ac = new AbortController();
    const c = await crawlSite('geant.test', { maxPages: 500, delayMs: 0, signal: ac.signal, onProgress: (p) => p.phase === 'pages' && p.fetched >= 5 && ac.abort() });
    expect(c.aborted).toBe(true);
    expect(c.truncated).toBe(true);
    expect(c.pages.length).toBeLessThan(20);
  });
});

describe('contenus difficiles', () => {
  it('HTML cassé : pas d’échec, champs extraits', async () => {
    const c = await crawlSite('casse.test', fast);
    const h = page(c, '/')!;
    expect(h.title).toBe('Cassé & co');
    expect(h.metaDescription).toBe('sans-guillemets');
    expect(h.jsonLd).toEqual([]);
    expect(h.jsonLdErrors[0]).toMatch(/illisible/);
    expect(h.images[0]).toMatchObject({ src: 'https://casse.test/x.png', alt: 'Logo' });
    expect(c.pages.some((p) => p.finalUrl === 'https://casse.test/autre')).toBe(true);
    expect(h.wordCount).toBeGreaterThan(100);
  });

  it('page rendue côté client détectée', async () => {
    const c = await crawlSite('spa.test', fast);
    expect(c.pages[0].renderHints).toMatchObject({ likelyClientRendered: true, scriptsCount: 1 });
    expect(c.pages[0].wordCount).toBeLessThan(20);
  });

  it('noindex, canonical, hreflang, doublons', async () => {
    const c = await crawlSite('meta.test', fast);
    expect(page(c, '/')!.isIndexable).toBe(true);
    expect(page(c, '/noindex')).toMatchObject({ metaRobots: 'noindex, follow', isIndexable: false });
    expect(page(c, '/xrobots')).toMatchObject({ isIndexable: false });
    expect(page(c, '/xrobots')!.headers['x-robots-tag']).toBe('googlebot: noindex');
    expect(page(c, '/canon-autre')).toMatchObject({ canonical: 'https://meta.test/canon-soi', isIndexable: false });
    expect(page(c, '/canon-soi')).toMatchObject({ isIndexable: true });
    expect(page(c, '/fr/')!.hreflang).toEqual([
      { lang: 'fr-FR', href: 'https://meta.test/fr/' },
      { lang: 'en', href: 'https://meta.test/en/' },
      { lang: 'x-default', href: 'https://meta.test/' },
    ]);
    expect(page(c, '/doublon-1')!.textHash).toBe(page(c, '/doublon-2')!.textHash);
    expect(page(c, '/doublon-1')!.textHash).not.toBe(page(c, '/')!.textHash);
  });
});
