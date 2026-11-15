import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFetchDeps, type Resolver, type Transport } from '@/lib/siteaudit/fetch';
import { resetRateLimit } from '@/lib/ratelimit';
import {
  analyzeHeaders,
  analyzeHreflang,
  analyzeIndex,
  analyzeLinks,
  analyzeMeta,
  analyzeOg,
  analyzeRedirects,
  analyzeSitemap,
  pageLinks,
  urlVariants,
  type PageFetch,
} from '../v6/analyze';
import { runHreflang, runIndex, runLinks, runMeta, runOg, runRedirects, runSitemap } from '../v6/run';
import { POST } from '@/app/outils/api/[outil]/route';
import { TOOLS } from '../registry';
import { HUB_GROUPS, TOOL_ICON } from '../hub';
import { V6_SLUGS, V6_TOOLS } from '../v6/registry';
import * as EX from '../v6/examples';
import { GUIDES } from '@/lib/seo/guides';

const page = (url: string, html: string, headers: Record<string, string> = {}, extra: Partial<PageFetch> = {}): PageFetch => ({
  requestedUrl: url,
  finalUrl: url,
  status: 200,
  chain: [],
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  html,
  fetchMs: 10,
  ...extra,
});

describe('analyse : title, meta, H1', () => {
  it('relève le titre trop long, la description absente et les doublons de title', () => {
    const r = analyzeMeta(page('https://a.example/', '<html lang="fr"><head><title>Un titre beaucoup trop long pour tenir dans la page de résultats de Google, vraiment beaucoup trop</title><title>Doublon</title></head><body><h1>Bonjour</h1></body></html>'));
    const ids = r.checks.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['title.long', 'desc.missing', 'title.multiple', 'h1.ok']));
    expect(r.titleCount).toBe(2);
    expect(r.serp.title.truncated).toBe(true);
    expect(r.verdict.tone).toBe('warn');
    expect(r.lang).toBe('fr');
  });
  it('page en erreur : rouge', () => {
    const r = analyzeMeta(page('https://a.example/x', '<title>Introuvable</title>', {}, { status: 404 }));
    expect(r.verdict.tone).toBe('fail');
  });
});

describe('analyse : indexabilité', () => {
  const robots = (text: string) => ({ url: 'https://a.example/robots.txt', status: 200, text });
  it('noindex en balise : non indexable', () => {
    const r = analyzeIndex(page('https://a.example/p', '<head><meta name="robots" content="noindex"><link rel="canonical" href="https://a.example/p"></head>'), robots('User-agent: *\nAllow: /'));
    expect(r.indexable).toBe('no');
    expect(r.verdict.title).toMatch(/noindex/);
  });
  it('X-Robots-Tag noindex et robots.txt qui bloque Googlebot', () => {
    const r = analyzeIndex(page('https://a.example/prive/p', '<head><link rel="canonical" href="https://a.example/prive/p"></head>', { 'x-robots-tag': 'googlebot: noindex' }), robots('User-agent: Googlebot\nDisallow: /prive/'));
    expect(r.indexable).toBe('no');
    expect(r.robots.allowedGoogle).toBe(false);
    expect(r.robots.rule).toBe('Disallow: /prive/');
    expect(r.checks.find((c) => c.id === 'x-robots')?.status).toBe('fail');
  });
  it('canonical vers une autre page : probablement une autre adresse ; tout bon : indexable', () => {
    const other = analyzeIndex(page('https://a.example/p?tri=prix', '<head><link rel="canonical" href="https://a.example/p"></head>'), null);
    expect(other.indexable).toBe('maybe');
    const ok = analyzeIndex(page('https://a.example/p', '<head><link rel="canonical" href="https://a.example/p/"></head>'), null);
    expect(ok.indexable).toBe('yes');
    expect(ok.verdict.tone).toBe('ok');
  });
  it('robots.txt en erreur 5xx : bloquant', () => {
    const r = analyzeIndex(page('https://a.example/', '<head><link rel="canonical" href="https://a.example/"></head>'), { url: 'https://a.example/robots.txt', status: 503 });
    expect(r.indexable).toBe('no');
  });
});

describe('analyse : redirections', () => {
  it('chaîne avec 302 : alerte ; boucle : rouge ; variantes divergentes signalées', () => {
    const r = analyzeRedirects(
      { start: 'http://a.example/x', chain: [{ url: 'http://a.example/x', status: 301 }, { url: 'https://a.example/x', status: 302 }], final: { url: 'https://a.example/y', status: 200 } },
      [
        { start: 'https://a.example/x', chain: [], final: { url: 'https://a.example/y', status: 200 } },
        { start: 'https://www.a.example/x', chain: [], final: { url: 'https://www.a.example/x', status: 200 } },
      ],
    );
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['hops', 'temp', 'final', 'https', 'variants.split']));
    expect(r.verdict.tone).toBe('warn');
    const loop = analyzeRedirects({ start: 'https://a.example/a', chain: [{ url: 'https://a.example/a', status: 301 }, { url: 'https://a.example/b', status: 301 }], final: { url: 'https://a.example/a', status: 301 }, error: 'Boucle de redirection.', errorCode: 'redirect_loop' });
    expect(loop.loop).toBe(true);
    expect(loop.verdict.tone).toBe('fail');
  });
  it('variantes : 4 pour un domaine nu, 2 pour un sous-domaine', () => {
    expect(urlVariants('https://exemple.fr/p?q=1')).toEqual(['https://exemple.fr/p?q=1', 'https://www.exemple.fr/p?q=1', 'http://exemple.fr/p?q=1', 'http://www.exemple.fr/p?q=1']);
    expect(urlVariants('https://boutique.exemple.fr/')).toHaveLength(2);
  });
});

describe('analyse : en-têtes, hreflang, Open Graph, liens, sitemap', () => {
  it('en-têtes : noindex serveur en rouge, protections manquantes, cookie masqué, version du serveur', () => {
    const r = analyzeHeaders(page('https://a.example/', '<p>x</p>', { 'x-robots-tag': 'noindex', 'set-cookie': 'session=secret123; path=/', server: 'nginx/1.18.0' }));
    expect(r.verdict.tone).toBe('fail');
    expect(r.verdict.title).toMatch(/ne pas indexer/);
    expect(r.headers.find((h) => h.name === 'set-cookie')?.value).not.toContain('secret123');
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['hsts', 'nosniff', 'gzip', 'version', 'cache']));
  });
  it('hreflang : code invalide, retour manquant, x-default absent', () => {
    const html = '<html lang="fr"><head><link rel="alternate" hreflang="fr" href="https://a.example/fr/"><link rel="alternate" hreflang="en-UK" href="https://a.example/en/"></head></html>';
    const r = analyzeHreflang(page('https://a.example/fr/', html), [{ href: 'https://a.example/en/', status: 200, hreflang: [{ lang: 'en', href: 'https://a.example/en/' }] }]);
    expect(r.entries.find((e) => e.lang === 'en-UK')).toMatchObject({ valid: false, returnLink: false });
    expect(r.entries.find((e) => e.lang === 'fr')?.returnLink).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['codes', 'xdefault', 'return']));
    expect(r.verdict.tone).toBe('fail');
    const none = analyzeHreflang(page('https://a.example/', '<html></html>'));
    expect(none.verdict.tone).toBe('ok');
  });
  it('Open Graph : sans image en rouge ; image en 404 en rouge ; complet en vert', () => {
    const bare = analyzeOg(page('https://a.example/', '<head><title>T</title><meta property="og:title" content="Titre"></head>'));
    expect(bare.verdict.tone).toBe('fail');
    expect(bare.preview.title).toBe('Titre');
    const html = '<head><meta property="og:title" content="Titre"><meta property="og:description" content="Desc"><meta property="og:image" content="/og.jpg"><meta property="og:url" content="https://a.example/"><meta name="twitter:card" content="summary_large_image"></head>';
    const broken = analyzeOg(page('https://a.example/', html), { url: 'https://a.example/og.jpg', status: 404, contentType: 'text/html' });
    expect(broken.preview.image).toBe('https://a.example/og.jpg');
    expect(broken.checks.find((c) => c.id === 'og:image.status')?.status).toBe('fail');
    const ok = analyzeOg(page('https://a.example/', html.replace('/og.jpg', 'https://a.example/og.jpg')), { url: 'https://a.example/og.jpg', status: 200, contentType: 'image/jpeg' });
    expect(ok.verdict.tone).toBe('ok');
    expect(ok.twitter['twitter:card']).toBe('summary_large_image');
  });
  it('liens : internes / externes, nofollow, ancres vagues ou vides, cassés', () => {
    const p = page('https://a.example/', '<body><a href="/b">Nos tarifs</a><a href="/c">cliquez ici</a><a href="https://x.example/" rel="nofollow sponsored">Partenaire</a><a href="/d"><img src="i.png"></a><a href="mailto:a@b.fr">mail</a></body>');
    const rows = pageLinks(p);
    expect(rows).toHaveLength(4);
    const r = analyzeLinks(p, rows, new Map([['https://a.example/b', { status: 200 }], ['https://a.example/c', { status: 404 }], ['https://x.example/', { status: 0, error: 'injoignable' }]]));
    expect(r).toMatchObject({ total: 4, internal: 3, external: 1, nofollow: 1, sponsored: 1, broken: 2, checked: 3 });
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['broken', 'anchors.generic', 'anchors.empty']));
    expect(r.verdict.title).toMatch(/2 liens cassés/);
  });
  it('sitemap : date future, échantillon en erreur, non déclaré ; page HTML refusée ; absence', () => {
    const xml = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://a.example/</loc><lastmod>2030-01-01</lastmod></url><url><loc>https://a.example/b</loc></url></urlset>';
    const base = { url: 'https://a.example/sitemap.xml', source: 'default' as const, status: 200, contentType: 'application/xml', text: xml, bytes: xml.length, truncated: false, declaredInRobots: false };
    const r = analyzeSitemap(base, [{ url: 'https://a.example/', status: 200 }, { url: 'https://a.example/b', status: 404 }], [], Date.parse('2026-11-15'));
    expect(r.urlCount).toBe(2);
    expect(r.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['lastmod', 'robots', 'sample.err']));
    expect(r.verdict.tone).toBe('fail');
    const html = analyzeSitemap({ ...base, text: '<!doctype html><html><body>Page introuvable</body></html>', contentType: 'text/html' });
    expect(html.checks.find((c) => c.id === 'format')?.status).toBe('fail');
    const missing = analyzeSitemap({ ...base, status: 404, text: '' });
    expect(missing.kind).toBe('missing');
    expect(missing.verdict.title).toMatch(/Aucun sitemap/);
  });
});

/* ------------------------------------------------------------------ */
/* Réseau simulé : aucune sortie sur Internet                          */
/* ------------------------------------------------------------------ */

type Fake = { status: number; headers?: Record<string, string>; body?: string };
let restore: () => void = () => {};
const seen: string[] = [];
function fakeWeb(routes: Record<string, Fake>) {
  const resolver: Resolver = async (h) => {
    if (h.endsWith('.prive.example')) return [{ address: '10.0.0.5', family: 4 }];
    return [{ address: '93.184.216.34', family: 4 }];
  };
  const transport: Transport = async (req) => {
    const key = req.url.toString();
    seen.push(`${req.method ?? 'GET'} ${key}`);
    const r = routes[key] ?? { status: 404, body: 'introuvable' };
    return { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers ?? {}) }, body: Buffer.from(req.method === 'HEAD' ? '' : (r.body ?? '')), truncated: false };
  };
  restore = setFetchDeps({ resolver, transport });
}

describe('récupération réseau (simulée)', () => {
  beforeEach(() => {
    seen.length = 0;
    resetRateLimit();
  });
  afterEach(() => restore());

  it('suit une boucle de redirection et la signale', async () => {
    fakeWeb({
      'https://b.example/a': { status: 301, headers: { location: '/b' } },
      'https://b.example/b': { status: 301, headers: { location: '/a' } },
    });
    const r = await runRedirects('b.example/a', false);
    expect(r.loop).toBe(true);
    expect(r.chain.map((h) => h.status)).toEqual([301, 301]);
    expect(r.verdict.tone).toBe('fail');
  });

  it('indexabilité : lit robots.txt et l’applique à Googlebot', async () => {
    fakeWeb({
      'https://c.example/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: Googlebot\nDisallow: /brouillons/\n' },
      'https://c.example/brouillons/p': { status: 200, body: '<head><link rel="canonical" href="https://c.example/brouillons/p"></head><h1>x</h1>' },
    });
    const r = await runIndex('https://c.example/brouillons/p');
    expect(r.indexable).toBe('no');
    expect(r.robots.found).toBe(true);
  });

  it('refuse une adresse qui pointe vers un réseau privé (anti-SSRF)', async () => {
    fakeWeb({});
    await expect(runMeta('https://interne.prive.example/')).rejects.toMatchObject({ code: 'blocked_ip' });
    await expect(runMeta('http://127.0.0.1/')).rejects.toMatchObject({ code: 'blocked_ip' });
    expect(seen.filter((s) => !s.includes('robots.txt'))).toEqual([]);
  });

  it('respecte le robots.txt de RepereBot', async () => {
    fakeWeb({ 'https://d.example/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: RepereBot\nDisallow: /\n' } });
    await expect(runMeta('https://d.example/page')).rejects.toMatchObject({ code: 'robots_disallowed' });
  });

  it('sitemap : trouvé via robots.txt, échantillon testé en HEAD', async () => {
    fakeWeb({
      'https://e.example/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nAllow: /\nSitemap: https://e.example/plan.xml\n' },
      'https://e.example/plan.xml': { status: 200, headers: { 'content-type': 'application/xml' }, body: '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://e.example/</loc></url><url><loc>https://e.example/vieux</loc></url></urlset>' },
      'https://e.example/': { status: 200 },
      'https://e.example/vieux': { status: 301, headers: { location: '/neuf' } },
    });
    const r = await runSitemap('e.example');
    expect(r.source).toBe('robots');
    expect(r.declaredInRobots).toBe(true);
    expect(r.sample).toEqual([{ url: 'https://e.example/', status: 200 }, { url: 'https://e.example/vieux', status: 301, finalUrl: 'https://e.example/neuf' }]);
    expect(seen).toContain('HEAD https://e.example/vieux');
  });

  it('liens : teste les adresses et trouve le lien cassé ; hreflang : ouvre les versions', async () => {
    fakeWeb({
      'https://f.example/': { status: 200, body: '<html lang="fr"><head><link rel="alternate" hreflang="fr" href="https://f.example/"><link rel="alternate" hreflang="en" href="https://f.example/en/"><link rel="alternate" hreflang="x-default" href="https://f.example/"></head><body><a href="/ok">Page</a><a href="/ko">Autre page</a></body></html>' },
      'https://f.example/ok': { status: 200 },
      'https://f.example/en/': { status: 200, body: '<head><link rel="alternate" hreflang="en" href="https://f.example/en/"><link rel="alternate" hreflang="fr" href="https://f.example/"></head>' },
    });
    const l = await runLinks('https://f.example/');
    expect(l.broken).toBe(1);
    expect(l.links.find((x) => x.href === 'https://f.example/ko')?.status).toBe(404);
    const h = await runHreflang('https://f.example/');
    expect(h.entries.find((e) => e.lang === 'en')?.returnLink).toBe(true);
    expect(h.verdict.tone).toBe('ok');
  });

  it('Open Graph : vérifie l’image en HEAD', async () => {
    fakeWeb({
      'https://g.example/': { status: 200, body: '<head><meta property="og:title" content="T"><meta property="og:description" content="D"><meta property="og:image" content="https://g.example/og.png"><meta property="og:url" content="https://g.example/"></head>' },
      'https://g.example/og.png': { status: 200, headers: { 'content-type': 'image/png' } },
    });
    const r = await runOg('https://g.example/');
    expect(r.image).toMatchObject({ status: 200, contentType: 'image/png' });
    expect(r.verdict.tone).toBe('ok');
  });
});

describe('route POST /outils/api/[outil]', () => {
  beforeEach(() => resetRateLimit());
  afterEach(() => restore());
  const call = (outil: string, body: unknown, ip = '198.51.100.9') =>
    POST(new Request(`http://localhost/outils/api/${outil}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }), { params: Promise.resolve({ outil }) });

  it('outil inconnu : 404 ; corps invalide : 400 ; adresse privée : 400', async () => {
    fakeWeb({});
    expect((await call('inconnu', { url: 'a.fr' })).status).toBe(404);
    expect((await call('toString', { url: 'a.fr' })).status).toBe(404);
    expect((await call('meta', { nope: 1 })).status).toBe(400);
    const priv = await call('meta', { url: 'http://10.0.0.1/' });
    expect(priv.status).toBe(400);
    expect(await priv.json()).toMatchObject({ ok: false, code: 'blocked_ip' });
  });

  it('limite par IP : 10 analyses de liens par heure, la 11e est refusée (429)', async () => {
    fakeWeb({ 'https://h.example/': { status: 200, body: '<a href="/x">x</a>' }, 'https://h.example/x': { status: 200 } });
    for (let i = 0; i < 10; i++) expect((await call('liens', { url: 'https://h.example/' }, '203.0.113.50')).status).toBe(200);
    const r = await call('liens', { url: 'https://h.example/' }, '203.0.113.50');
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
});

describe('catalogue et exemples', () => {
  it('20 outils, slugs uniques, contenu complet, lien vers /analyse, tous rangés dans le hub', () => {
    expect(TOOLS).toHaveLength(20);
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(20);
    const grouped = HUB_GROUPS.flatMap((g) => g.slugs);
    expect(new Set(grouped)).toEqual(new Set(TOOLS.map((t) => t.slug)));
    for (const t of V6_TOOLS) {
      expect(t.faq.length, t.slug).toBeGreaterThanOrEqual(4);
      expect(t.sources.length, t.slug).toBeGreaterThan(0);
      expect(t.howItWorks.length, t.slug).toBe(3);
      expect(t.related.some((r) => r.href === '/analyse'), t.slug).toBe(true);
      expect(t.metaTitle.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.description.length, t.slug).toBeLessThanOrEqual(200);
      expect(TOOL_ICON[t.slug], t.slug).toBeTruthy();
      expect(t.h1).not.toMatch(/garanti|n° ?1|explosez/i);
    }
    expect(V6_SLUGS).toHaveLength(11);
    const guides = new Set(GUIDES.map((g) => `/guides/${g.slug}`));
    for (const t of V6_TOOLS) for (const r of t.related) if (r.href.startsWith('/guides/')) expect(guides.has(r.href), r.href).toBe(true);
  });
  it('les exemples se calculent sur des domaines fictifs (.example) et ont un verdict', () => {
    const all = [EX.exampleMeta(), EX.exampleIndex(), EX.exampleRedirects(), EX.exampleHeaders(), EX.exampleSitemap(), EX.exampleHreflang(), EX.exampleOg(), EX.exampleLinks()];
    for (const r of all) {
      expect(r.url).toMatch(/\.example\//);
      expect(r.verdict.title.length).toBeGreaterThan(10);
      expect(r.checks.length).toBeGreaterThan(0);
      expect(r.checkedAt).toBe('2026-11-15T09:00:00.000Z');
    }
    expect(EX.exampleIndex().indexable).toBe('no');
    expect(EX.exampleLinks().broken).toBe(1);
    expect(EX.exampleSitemap().checks.some((c) => c.id === 'sample.err')).toBe(true);
    expect(EX.exampleHreflang().entries.some((e) => !e.valid)).toBe(true);
  });
});
