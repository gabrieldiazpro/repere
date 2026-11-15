/**
 * ROBUSTESSE (V6) — le crawl face au « web réel » (faux sites de hardsites.ts, serveur local, aucune sortie réseau).
 * Exigence : ne jamais planter, boucler, mentir ni dépasser le budget ; un diagnostic explicite pour chaque cas dégradé.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crawlSite, trapReason } from '../crawl';
import { detectPlatform } from '../platform';
import { softRedirectTarget } from '../fetcher';
import { sitemapOnSite } from '../sitemap';
import { decodeText, isBlockedIp, looksBinary } from '@/lib/siteaudit/fetch';
import { findBlocks, parseHtml, removeBlocks } from '@/lib/siteaudit/html';
import type { CrawledPage, SiteCrawl } from '../types';
import { startFakeSites, type FakeServer } from './fakesites';
import { IDN_HOST, resetHardState } from './hardsites';
import { auditGeo } from '@/lib/geo';
import { auditSeo } from '@/lib/seoaudit';
import { validateNodes } from '@/lib/seoaudit/schema';

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
});
afterAll(() => srv.close());
beforeEach(() => resetHardState());

const fast = { delayMs: 0, timeBudgetMs: 12_000 };
const page = (c: SiteCrawl, path: string): CrawledPage | undefined => c.pages.find((p) => new URL(p.url).pathname === path || new URL(p.finalUrl).pathname === path);
const notes = (c: SiteCrawl) => c.diagnosis?.notes.map((n) => n.code) ?? [];
const hitsFor = (host: string) => srv.hits.filter((h) => h.includes(` ${host}/`));

describe('lenteurs : budget tenu, rien ne bloque', () => {
  it('accueil qui ne répond pas : délai, état « timeout », pas d’exception', async () => {
    const t = Date.now();
    const c = await crawlSite('ttfb-lent.test', { delayMs: 0, timeBudgetMs: 3_000 });
    expect(Date.now() - t).toBeLessThan(5_000);
    expect(c.pages).toHaveLength(0);
    expect(c.diagnosis).toMatchObject({ state: 'timeout', readable: false });
  });

  it('corps au compte-gouttes (y compris gzip) : la page est abandonnée, le reste du site est lu', async () => {
    const t = Date.now();
    const c = await crawlSite('goutte.test', { delayMs: 0, timeBudgetMs: 5_000 });
    expect(Date.now() - t).toBeLessThan(7_500);
    expect(page(c, '/ok')?.status).toBe(200);
    expect(page(c, '/corps-lent')).toBeUndefined();
    expect(page(c, '/corps-lent-gz')).toBeUndefined();
    expect(c.diagnosis?.readable).toBe(true);
  }, 10_000);

  it('robots.txt qui ne répond pas : 4 s au plus, puis exploration normale et signalée', async () => {
    const t = Date.now();
    const c = await crawlSite('robots-lent.test', fast);
    expect(Date.now() - t).toBeLessThan(6_500);
    expect(page(c, '/a')?.status).toBe(200);
    expect(notes(c)).toContain('robots_timeout');
  }, 10_000);

  it('connexion coupée : pas d’exception, état explicite', async () => {
    const c = await crawlSite('https://coupe.test/', fast);
    expect(c.diagnosis?.readable).toBe(false);
    expect(['unreachable', 'http_error']).toContain(c.diagnosis?.state);
  });
});

describe('JavaScript seul', () => {
  it('SPA vide côté serveur : état js_only, lisible (on voit ce que voient les robots d’IA)', async () => {
    const c = await crawlSite('spa-vide.test', fast);
    expect(c.pages[0].renderHints.likelyClientRendered).toBe(true);
    expect(c.diagnosis).toMatchObject({ state: 'js_only', readable: true });
    expect(c.render).toBeUndefined(); // CRAWL_RENDER=off par défaut
  });
  it('vitrine courte rendue côté serveur (49 mots, 8 scripts) : ni le crawl ni GEO ne la disent vide (faux positif corrigé)', async () => {
    const c = await crawlSite('vitrine-courte.test', fast);
    expect(c.pages[0].renderHints.likelyClientRendered).toBe(false);
    const g = auditGeo(c, { brand: 'Serrurerie Dubois', siteType: 'local' });
    expect(g.sections.flatMap((s) => s.findings.map((f) => f.id))).not.toContain('geo.acces.client_rendered');
  });
  it('rendu serveur (Nuxt) avec un script module : PAS pris pour une SPA (faux positif corrigé)', async () => {
    const c = await crawlSite('nuxt-ssr.test', fast);
    expect(c.pages[0].renderHints.likelyClientRendered).toBe(false);
    expect(c.diagnosis?.state).toBe('ok');
    expect(c.platform?.id).toBe('nuxt');
  });
});

describe('robots.txt hostiles', () => {
  it('« Disallow: / » pour tous : rien n’est lu, état blocked_robots', async () => {
    const before = srv.hits.length;
    const c = await crawlSite('robots-tout.test', fast);
    expect(c.diagnosis).toMatchObject({ state: 'blocked_robots', readable: false });
    expect(srv.hits.slice(before).filter((h) => h.includes('robots-tout.test') && !h.endsWith('/robots.txt'))).toEqual([]);
  });
  it('robots.txt en erreur 500 : lu quand même (audit ponctuel), signalé', async () => {
    const c = await crawlSite('robots-500.test', fast);
    expect(page(c, '/a')?.status).toBe(200);
    expect(notes(c)).toContain('robots_server_error');
  });
  it('robots.txt servi en HTML : aucune règle, signalé', async () => {
    const c = await crawlSite('robots-html.test', fast);
    expect(page(c, '/a')?.status).toBe(200);
    expect(notes(c)).toContain('robots_html');
  });
});

describe('redirections', () => {
  it('boucle sur l’accueil : état redirect_loop, pas de boucle infinie', async () => {
    const c = await crawlSite('boucle-accueil.test', fast);
    expect(c.diagnosis?.state).toBe('redirect_loop');
    expect(hitsFor('boucle-accueil.test').length).toBeLessThan(10);
  });
  it('chaîne de 8 redirections : suivie (Googlebot en suit 10)', async () => {
    const c = await crawlSite('chaine.test', fast);
    expect(c.pages[0]).toMatchObject({ status: 200, title: 'Fin de chaîne' });
    expect(c.pages[0].redirectChain).toHaveLength(8);
  });
  it('meta refresh et redirection JavaScript de l’accueil : suivies et signalées', async () => {
    const m = await crawlSite('meta-refresh.test', fast);
    expect(m.pages[0]).toMatchObject({ finalUrl: 'https://meta-refresh.test/fr/accueil', title: 'Accueil FR' });
    expect(m.pages[0].redirectChain[0]).toMatchObject({ via: 'meta-refresh' });
    expect(page(m, '/fr/contact')?.status).toBe(200);
    expect(notes(m)).toContain('meta_refresh');
    const j = await crawlSite('js-redir.test', fast);
    expect(j.pages[0]).toMatchObject({ finalUrl: 'https://js-redir.test/fr/', title: 'Accueil' });
    expect(notes(j)).toContain('js_redirect');
  });
  it('déménagement vers un autre domaine : on suit et on le dit', async () => {
    const c = await crawlSite('demenage.test', fast);
    expect(c.finalOrigin).toBe('https://nouveau-nom.test');
    expect(c.diagnosis?.notes).toContainEqual({ code: 'moved', detail: 'nouveau-nom.test' });
  });
  it('https coupé, http seul : repli http et signalé', async () => {
    const c = await crawlSite('http-seul.test', fast);
    expect(c.finalOrigin).toBe('http://http-seul.test');
    expect(notes(c)).toContain('http_only');
  });
  it('cookie obligatoire (redirection sur soi-même) : rejoué avec le cookie, signalé', async () => {
    const c = await crawlSite('cookie.test', fast);
    expect(page(c, '/a')?.status).toBe(200);
    expect(page(c, '/b')?.status).toBe(200);
    expect(notes(c)).toContain('cookie_required');
  });
});

describe('sitemaps', () => {
  it('index géant (500 fichiers de 40 000 URL, auto-référencé) : plafonds tenus, budget tenu', async () => {
    const t = Date.now();
    const c = await crawlSite('sitemap-geant.test', { delayMs: 0, timeBudgetMs: 15_000, maxPages: 20 });
    expect(Date.now() - t).toBeLessThan(15_000);
    expect(c.sitemapUrls.length).toBe(10_000);
    expect(c.sitemaps.length).toBeLessThanOrEqual(30);
    expect(c.pages).toHaveLength(20);
  }, 20_000);
  it('HTML, XML tronqué, gzip cassé, bombe gzip, autres domaines, SSRF : chaque fichier a son message, rien n’est lu hors du site', async () => {
    const c = await crawlSite('sitemap-casse.test', fast);
    const by = (s: string) => c.sitemaps.find((x) => x.url.includes(s));
    expect(by('sm-html')?.errors.join()).toMatch(/page HTML/);
    expect(by('sm-tronque')?.errors.join()).toMatch(/incomplet/);
    expect(by('sm-gz-casse')?.errors.join()).toMatch(/gzip illisible/);
    expect(by('sm-bombe')?.errors.join()).toMatch(/trop volumineux/);
    expect(by('sm-bon')?.urlCount).toBe(3);
    expect(by('tiers.test')?.errors.join()).toMatch(/hors de votre site/);
    expect(by('169.254.169.254')?.errors.join()).toMatch(/hors de votre site/);
    expect(srv.hits.some((h) => h.includes('tiers.test'))).toBe(false);
    expect(srv.addresses.every((a) => !isBlockedIp(a))).toBe(true);
  });
  it('sitemapOnSite : même hôte ou sous-domaine seulement', () => {
    expect(sitemapOnSite('https://www.a.fr/s.xml', 'https://a.fr')).toBe(true);
    expect(sitemapOnSite('https://cdn.a.fr/s.xml', 'https://www.a.fr')).toBe(true);
    expect(sitemapOnSite('https://a.fr.evil.com/s.xml', 'https://a.fr')).toBe(false);
    expect(sitemapOnSite('http://169.254.169.254/s.xml', 'https://a.fr')).toBe(false);
  });
});

describe('encodages', () => {
  const title = async (h: string) => (await crawlSite(h, fast)).pages[0].title;
  it('ISO-8859-1 déclaré, méta tardive, charset absent, BOM, UTF-16, charset inconnu', async () => {
    expect(await title('latin1.test')).toBe('Pâtisserie Événement à Besançon');
    expect(await title('meta-latin1.test')).toBe('Fromagerie à Besançon');
    expect(await title('sans-charset.test')).toBe('Café à Orléans');
    expect(await title('bom.test')).toBe('Épicerie fine');
    expect(await title('utf16.test')).toBe('Crêperie à Rennes');
    expect(await title('charset-inconnu.test')).toBe('Bistrot à Lille');
  });
  it('decodeText garde l’UTF-8 valide et ne confond pas une coupure en plein caractère avec du latin-1', () => {
    const buf = Buffer.from('déjà vu — café');
    expect(decodeText(buf)).toBe('déjà vu — café');
    expect(decodeText(buf.subarray(0, buf.length - 1))).toMatch(/^déjà vu — caf/);
  });
});

describe('contenus extrêmes', () => {
  it('HTML pathologique (balises jamais fermées par milliers) : linéaire, moins de 3 s', async () => {
    const t = Date.now();
    const c = await crawlSite('pathologique.test', fast);
    expect(Date.now() - t).toBeLessThan(3_000);
    expect(c.pages[0].title).toBe('Pathologique');
  });
  it('balayages linéaires = mêmes résultats que les regex d’origine sur du HTML normal', () => {
    const html = '<div><script>a</script><p>Un <b>deux</b></p><svg><g/></svg><p>trois</p><h2>T</h2><SCRIPT type="x">b</SCRIPT></div>';
    expect(removeBlocks(html, ['script', 'svg'])).toBe(html.replace(/<(script|svg)\b[\s\S]*?<\/\1>/gi, ' '));
    expect(findBlocks(html, ['p']).map((b) => html.slice(b.openEnd, b.closeStart))).toEqual([...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]));
    const p = parseHtml('<html><head><title>T</title><script type="application/ld+json">{"a":1}</script></head><body><main><h1>Titre</h1><p>Texte assez long pour être le contenu principal de cette page de test.</p></main></body></html>');
    expect(p).toMatchObject({ title: 'T', jsonLdRaw: ['{"a":1}'], hasMainLandmark: true });
    expect(p.headings).toEqual([{ level: 1, text: 'Titre' }]);
  });
  it('page de 5 Mo : tronquée à 2 Mo, signalée, pas d’échec', async () => {
    const c = await crawlSite('enorme.test', fast);
    expect(c.pages[0].status).toBe(200);
    expect(notes(c)).toContain('huge_page');
  });
  it('binaire servi en text/html : non analysé, état not_html', async () => {
    const c = await crawlSite('binaire.test', fast);
    expect(c.pages[0].wordCount).toBe(0);
    expect(c.diagnosis?.state).toBe('not_html');
    expect(looksBinary(Buffer.from('<html>bonjour</html>'.repeat(10)))).toBe(false);
  });
  it('accueil vide, JSON, 404, 500, 503 maintenance, parking, 401, Shopify sous mot de passe', async () => {
    const st = async (h: string) => (await crawlSite(h, fast)).diagnosis!;
    expect(await st('vide.test')).toMatchObject({ state: 'empty', readable: false });
    expect(await st('json.test')).toMatchObject({ state: 'not_html', readable: false });
    expect(await st('accueil-404.test')).toMatchObject({ state: 'http_error', homeStatus: 404, readable: false });
    expect(await st('accueil-500.test')).toMatchObject({ state: 'server_error', readable: false });
    expect(await st('maintenance.test')).toMatchObject({ state: 'maintenance', retryAfterS: 3600, readable: false });
    expect(await st('parking.test')).toMatchObject({ state: 'parked', readable: false });
    expect(await st('mdp.test')).toMatchObject({ state: 'auth_required', readable: false });
    expect(await st('shopify-mdp.test')).toMatchObject({ state: 'password_protected', readable: false });
  });
});

describe('anti-robots et limitations', () => {
  it('défi Cloudflare, DataDome, 403 générique : blocked_firewall, on n’insiste pas', async () => {
    const cf = await crawlSite('cloudflare.test', fast);
    expect(cf.diagnosis).toMatchObject({ state: 'blocked_firewall', firewall: 'Cloudflare', readable: false });
    expect(hitsFor('cloudflare.test').filter((h) => !h.endsWith('/robots.txt')).length).toBe(1);
    expect((await crawlSite('datadome.test', fast)).diagnosis).toMatchObject({ state: 'blocked_firewall', firewall: 'DataDome' });
    expect((await crawlSite('interdit.test', fast)).diagnosis).toMatchObject({ state: 'blocked_firewall', readable: false });
  });
  it('429 avec Retry-After long : arrêt poli après 3 refus, aucune page « cassée » inventée', async () => {
    const c = await crawlSite('limite.test', fast);
    expect(hitsFor('limite.test').filter((h) => !h.endsWith('/robots.txt')).length).toBeLessThanOrEqual(8);
    expect(c.pages.every((p) => p.status !== 429)).toBe(true);
    expect(c.truncated).toBe(true);
    expect(notes(c)).toContain('rate_limited_partial');
  });
});

describe('canonicals, hreflang, pièges à URL', () => {
  it('canonical dans l’en-tête Link exposé à côté de celui du HTML', async () => {
    const c = await crawlSite('canon.test', fast);
    expect(page(c, '/entete')).toMatchObject({ canonical: 'https://canon.test/entete', canonicalHeader: 'https://canon.test/ailleurs' });
    expect(page(c, '/accueil-partout')).toMatchObject({ canonical: 'https://canon.test/', isIndexable: false });
    expect(page(c, '/autre-domaine')?.isIndexable).toBe(false);
    expect(page(c, '/hreflang')!.hreflang.map((h) => h.lang)).toEqual(['fr_FR', 'english', 'en']);
  });
  it('calendrier, facettes, liens relatifs récursifs, sessions : bornés, les vraies pages sont lues', async () => {
    const c = await crawlSite('piege-url.test', { ...fast, maxPages: 60 });
    for (const p of ['/services', '/tarifs', '/contact', '/a-propos', '/equipe', '/avis']) expect(page(c, p)?.status).toBe(200);
    const agenda = c.pages.filter((p) => p.url.includes('/agenda'));
    const facets = c.pages.filter((p) => p.url.includes('/produits?'));
    expect(agenda.length).toBeLessThanOrEqual(5);
    expect(facets.length).toBeLessThanOrEqual(5);
    expect(c.pages.filter((p) => /\/rel\/rel\/rel\//.test(p.url))).toHaveLength(0);
    expect(c.truncated).toBe(false); // l'exploration se termine d'elle-même
    expect(notes(c)).toContain('url_traps');
  });
  it('trapReason', () => {
    const v = new Map<string, number>();
    expect(trapReason('https://a.fr/x/y/y/y/', v)).toMatch(/répété/);
    expect(trapReason(`https://a.fr/${'a'.repeat(500)}`, v)).toMatch(/longue/);
    expect(trapReason('https://a.fr/?a=1&b=2&c=3&d=4&e=5&f=6', v)).toMatch(/paramètres/);
    for (let i = 0; i < 5; i++) expect(trapReason(`https://a.fr/cal?m=${i}`, v)).toBeNull();
    expect(trapReason('https://a.fr/cal?m=9', v)).toMatch(/variantes/);
    expect(trapReason('https://a.fr/page', v)).toBeNull();
  });
});

describe('plateformes', () => {
  const cases: [string, string, string?][] = [
    ['wix.test', 'wix'],
    ['shopify.test', 'shopify'],
    ['squarespace.test', 'squarespace'],
    ['wordpress.test', 'wordpress'],
    ['webflow.test', 'webflow'],
    ['prestashop.test', 'prestashop'],
    ['jimdo.test', 'jimdo'],
    ['nextjs.test', 'nextjs'],
  ];
  it.each(cases)('%s → %s', async (host, id) => {
    const c = await crawlSite(host, fast);
    expect(c.platform?.id).toBe(id);
    expect(c.platform?.evidence.length).toBeGreaterThan(0);
  });
  it('WordPress + WooCommerce : extension relevée, boutique', async () => {
    const c = await crawlSite('wordpress.test', fast);
    expect(c.platform).toMatchObject({ id: 'wordpress', confidence: 'high', ecommerce: true });
    expect(c.platform?.plugins).toContain('WooCommerce');
  });
  it('site sans signature : null, rien de deviné', async () => {
    expect((await crawlSite('normal.test', fast)).platform).toBeNull();
    expect(detectPlatform([{ html: '<html><body>Bonjour</body></html>', headers: {} }])).toBeNull();
  });
  it('Shopify sous mot de passe : plateforme reconnue par les en-têtes de la redirection', async () => {
    expect((await crawlSite('shopify-mdp.test', fast)).platform?.id).toBe('shopify');
  });
});

describe('IDN, IPv6', () => {
  it('domaine accentué : punycode de bout en bout', async () => {
    const c = await crawlSite('boulangerie-éléonore.test', fast);
    expect(c.finalOrigin).toBe(`https://${IDN_HOST}`);
    expect(page(c, '/pains')?.status).toBe(200);
  });
  it('IPv6 seule : adresse publique v6 épinglée ; v4 + v6 : v4 d’abord ; une adresse privée parmi d’autres : refus', async () => {
    srv.addresses.length = 0;
    expect((await crawlSite('v6.test', fast)).pages[0].status).toBe(200);
    expect(srv.addresses).toContain('2a00:1450:4007:80e::2004');
    srv.addresses.length = 0;
    await crawlSite('mixte.test', fast);
    expect(new Set(srv.addresses)).toEqual(new Set(['93.184.216.34']));
    await expect(crawlSite('v6-prive.test', fast)).rejects.toMatchObject({ code: 'blocked_ip' });
  });
});

describe('SSRF', () => {
  it('DNS rebinding : la réponse privée est refusée, aucune connexion vers une adresse privée', async () => {
    srv.addresses.length = 0;
    await crawlSite('rebind.test', fast).catch(() => null);
    expect(srv.addresses.every((a) => !isBlockedIp(a))).toBe(true);
  });
  it('redirections vers IP détournées, métadonnées, ports, identifiants, autres schémas ; liens et images internes vérifiés', async () => {
    srv.addresses.length = 0;
    const c = await crawlSite('ssrf-formes.test', { ...fast, checkLinks: true, maxLinkChecks: 50 });
    expect(srv.hits.some((h) => h.includes('interne-alias.test'))).toBe(false);
    expect(srv.addresses.every((a) => !isBlockedIp(a))).toBe(true);
    const checks = c.linkChecks ?? [];
    expect(checks.find((k) => k.url.includes('169.254.169.254'))?.status).toBe(0);
    expect(checks.find((k) => k.url.includes('10.0.0.1'))?.status).toBe(0);
    expect(checks.find((k) => k.url.includes('interne-alias.test'))?.error).toMatch(/site public/);
    for (const r of ['/r1', '/r2', '/r3', '/r4', '/r5', '/r6', '/r9', '/r11']) expect(page(c, r)?.isIndexable).toBe(false);
    expect(c.errors.map((e) => e.error).join(' ')).toMatch(/ports 80 et 443/);
  });
});

describe('redirections molles (unitaire)', () => {
  it('meta refresh ≤ 5 s seulement ; JS seulement sur une page presque vide', () => {
    expect(softRedirectTarget('<meta http-equiv="refresh" content="0;URL=\'/fr/\'">', 'https://a.fr/', false)).toEqual({ url: 'https://a.fr/fr/', via: 'meta-refresh' });
    expect(softRedirectTarget('<meta http-equiv="refresh" content="30; url=/fr/">', 'https://a.fr/', true)).toBeNull();
    expect(softRedirectTarget('<meta http-equiv="refresh" content="300">', 'https://a.fr/', true)).toBeNull();
    expect(softRedirectTarget('<script>location.href="/x"</script>', 'https://a.fr/', true)).toEqual({ url: 'https://a.fr/x', via: 'js' });
    expect(softRedirectTarget(`<p>${'mot '.repeat(100)}</p><script>location.href="/x"</script>`, 'https://a.fr/', true)).toBeNull();
    expect(softRedirectTarget('<script>location.href="javascript:alert(1)"</script>', 'https://a.fr/', true)).toBeNull();
  });
});

describe('faux positifs signalés par SITE-SEO-90 (demandes-SEOAUDIT.md)', () => {
  it('Next.js : les données RSC en ligne ne sont pas des scripts ; image /_next/image (HEAD 400, GET 200) pas cassée ; dev.wix.com n’est pas un site de test', async () => {
    const c = await crawlSite('next-like.test', { ...fast, checkLinks: true });
    expect(c.pages[0].renderHints.scriptsCount).toBe(1);
    expect(c.linkChecks?.find((k) => k.url.includes('/_next/image'))?.status).toBe(200);
    const s = auditSeo(c);
    const f = s.sections.flatMap((x) => x.findings);
    expect(f.map((x) => x.id)).not.toContain('seo.perf.too_many_scripts');
    expect(f.map((x) => x.id)).not.toContain('seo.img.broken');
    const dev = f.find((x) => x.id === 'seo.broken.dev_links');
    expect(dev?.affected.map((a) => a.detail)).toEqual(['https://dev.next-like.test/']);
  });
  it('offre d’un Service sans prix : pas « obligatoire » ; offre d’un Produit sans prix : obligatoire', () => {
    const service = validateNodes([{ '@context': 'https://schema.org', '@type': 'Service', name: 'Dépannage', offers: { '@type': 'Offer', name: 'Fuite' } }]);
    expect(service.issues.filter((i) => i.type === 'Offer' && i.level === 'required')).toEqual([]);
    expect(service.issues.some((i) => /shippingDetails|hasMerchantReturnPolicy/.test(i.prop ?? ''))).toBe(false);
    const product = validateNodes([{ '@context': 'https://schema.org', '@type': 'Product', name: 'Pain', image: 'x', offers: { '@type': 'Offer' } }]);
    expect(product.issues.some((i) => i.type === 'Offer' && i.level === 'required' && /price/.test(i.prop ?? ''))).toBe(true);
  });
});
