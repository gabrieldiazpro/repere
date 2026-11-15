/**
 * ROBUSTESSE (V6) — faux sites « web réel » : ce que le moteur rencontrera au lancement et qu'il n'a jamais vu.
 * Fusionnés dans SITES par fakesites.ts (même serveur local, même résolveur). Aucune sortie sur Internet.
 *
 * Familles : lenteurs (TTFB, corps au compte-gouttes), rendu JavaScript seul, robots.txt hostiles, redirections
 * (boucles, chaînes, JS, meta refresh, déménagement), sitemaps (index géant, gzip cassé ou bombe, HTML, autres
 * domaines, SSRF), encodages, HTML énorme ou pathologique, binaires, anti-robots (Cloudflare, DataDome, 429),
 * cookies obligatoires, canonicals contradictoires, hreflang, pièges à URL infinies, plateformes (Wix, Shopify,
 * Squarespace, WordPress, Webflow, PrestaShop…), IDN, IPv6, SSRF (rebinding, formes d'IP détournées).
 */
import type http from 'node:http';
import zlib from 'node:zlib';
import type { ResolvedAddress } from '@/lib/siteaudit/fetch';

export interface HardResponse {
  status?: number;
  body?: string | Buffer;
  type?: string;
  headers?: Record<string, string>;
  gzip?: boolean;
  delayMs?: number;
  /** Réponse entièrement manuelle (flux lent, coupure de connexion…). */
  raw?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
}
export type HardHandler = (path: string, query: string, req: http.IncomingMessage) => HardResponse | undefined;

const para = (n: number, seed: string) =>
  Array.from({ length: n }, (_, i) => `<p>${seed} paragraphe ${i} : nous intervenons rapidement, devis gratuit, artisans qualifiés et horaires étendus.</p>`).join('');
export const page = (title: string, body: string, head = '', htmlAttrs = 'lang="fr"') =>
  `<!doctype html><html ${htmlAttrs}><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;
const r404 = { status: 404, body: '' };
const xml = (body: string) => ({ type: 'application/xml', body: `<?xml version="1.0" encoding="UTF-8"?>${body}` });
const urlset = (host: string, paths: string[]) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>https://${host}${p}</loc></url>`).join('')}</urlset>`;
const robotsOk = { type: 'text/plain', body: 'User-agent: *\nAllow: /\n' };
const simple = (host: string, links: string[] = []) => (p: string): HardResponse | undefined => {
  if (p === '/robots.txt') return r404;
  if (p === '/') return { body: page(`Accueil ${host}`, `<main><h1>Accueil</h1>${para(4, host)}${links.map((l) => `<a href="${l}">${l}</a>`).join(' ')}</main>`) };
  if (links.includes(p)) return { body: page(`Page ${p}`, `<main><h1>${p}</h1>${para(3, p)}<a href="/">Accueil</a></main>`) };
  return undefined;
};

/** Flux lent : en-têtes tout de suite, puis un octet toutes les `everyMs` ms, sans fin. */
const trickle = (everyMs: number, gzip = false) => (_req: http.IncomingMessage, res: http.ServerResponse) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(gzip ? { 'content-encoding': 'gzip' } : {}) });
  const z = gzip ? zlib.createGzip({ flush: zlib.constants.Z_SYNC_FLUSH }) : null;
  if (z) z.pipe(res);
  const out = z ?? res;
  out.write('<!doctype html><html><head><title>Lent</title></head><body><p>');
  const t = setInterval(() => out.write('x'), everyMs);
  res.on('close', () => clearInterval(t));
};

/* ---------- Plateformes : signatures HTML et en-têtes typiques (relevées sur des sites publics) ---------- */
const PLATFORM_PAGES: Record<string, { head: string; body: string; headers?: Record<string, string>; htmlAttrs?: string }> = {
  'wix.test': {
    head: '<meta name="generator" content="Wix.com Website Builder"><link rel="preconnect" href="https://static.parastorage.com"><meta http-equiv="X-Wix-Meta-Site-Id" content="abc">',
    body: '<img src="https://static.wixstatic.com/media/abc.jpg" alt="Atelier"><script src="https://static.parastorage.com/services/wix-thunderbolt/dist/main.js"></script>',
    headers: { 'x-wix-request-id': '1700000000.123', server: 'Pepyaka' },
  },
  'shopify.test': {
    head: '<link rel="preconnect" href="https://cdn.shopify.com"><script>var Shopify = Shopify || {}; Shopify.shop = "boutique.myshopify.com"; Shopify.theme = {"name":"Dawn"};</script>',
    body: '<a href="/collections/all">Boutique</a><a href="/cart">Panier</a><img src="//boutique.test/cdn/shop/files/a.jpg" alt="Produit">',
    headers: { 'x-shopid': '123456', 'powered-by': 'Shopify', 'x-shopify-stage': 'production' },
  },
  'squarespace.test': {
    head: '<!-- This is Squarespace. --><link rel="stylesheet" href="https://static1.squarespace.com/static/versioned-site-css/abc/site.css"><script>Static.SQUARESPACE_CONTEXT = {};</script>',
    body: '<img src="https://images.squarespace-cdn.com/content/v1/abc/photo.jpg" alt="Studio">',
    headers: { server: 'Squarespace' },
  },
  'wordpress.test': {
    head: '<meta name="generator" content="WordPress 6.6.2"><meta name="generator" content="WooCommerce 9.1.0"><link rel="stylesheet" href="/wp-content/themes/astra/style.css"><script src="/wp-includes/js/jquery/jquery.min.js"></script>',
    body: '<div class="woocommerce"><a href="/boutique/">Boutique</a></div><img src="/wp-content/uploads/2026/01/vitrine.jpg" alt="Vitrine">',
    headers: { link: '<https://wordpress.test/wp-json/>; rel="https://api.w.org/"' },
  },
  'webflow.test': {
    head: '<meta content="Webflow" name="generator"><link href="https://cdn.prod.website-files.com/abc/css/site.webflow.css" rel="stylesheet">',
    body: '<img src="https://cdn.prod.website-files.com/abc/hero.jpg" alt="Agence">',
    htmlAttrs: 'lang="fr" data-wf-domain="webflow.test" data-wf-page="65a" data-wf-site="65b"',
  },
  'prestashop.test': {
    head: '<link rel="stylesheet" href="/themes/classic/assets/css/theme.css"><script>var prestashop = {"cart":{"products":[]},"currency":{"iso_code":"EUR"}};</script>',
    body: '<a href="/panier?action=show">Panier</a><img src="/img/p/1/2/12-home_default.jpg" alt="Produit"><script src="/modules/ps_shoppingcart/ps_shoppingcart.js"></script>',
    headers: { 'set-cookie': 'PrestaShop-a1b2c3=def; path=/; HttpOnly' },
  },
  'jimdo.test': { head: '<link rel="stylesheet" href="https://assets.jimstatic.com/web.css">', body: '<img src="https://image.jimcdn.com/app/cms/image/abc.jpg" alt="x">' },
  'nextjs.test': { head: '<link rel="preload" href="/_next/static/chunks/main.js" as="script">', body: '<div id="__next"><main><h1>App</h1></main></div><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>' },
};

/* ---------- Grosses données construites une seule fois ---------- */
let giantChild: string | null = null;
const giantSitemapChild = () =>
  (giantChild ??= `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: 40_000 }, (_, i) => `<url><loc>https://sitemap-geant.test/produits/p-${i}</loc><lastmod>2026-11-01</lastmod></url>`).join('')}</urlset>`);
let bomb: Buffer | null = null;
const gzipBomb = () => (bomb ??= zlib.gzipSync(Buffer.alloc(30 * 1024 * 1024, 0x20)));
let pathological: string | null = null;
const pathologicalHtml = () =>
  (pathological ??= `<!doctype html><html><head><title>Pathologique</title></head><body>${'<a href="/x">lien non fermé <h2>titre non fermé <script>var a=1; <svg><nav>'.repeat(18_000)}</body></html>`);
let hugePage: string | null = null;
const hugeHtml = () => (hugePage ??= page('Énorme', `<main><h1>Énorme</h1>${para(20, 'début')}<div>${'<span class="c">bloc de remplissage</span>'.repeat(120_000)}</div><a href="/fin">fin</a></main>`));
const heavyCache = new Map<number, string>();
const heavyPage = (n: number) => {
  if (!heavyCache.has(n))
    heavyCache.set(
      n,
      page(
        `Page lourde ${n}`,
        `<main><h1>Page ${n}</h1>${Array.from({ length: 3_000 }, (_, i) => `<section><h2>Bloc ${i}</h2><p>Texte du bloc ${i} de la page ${n}, avec des détails utiles sur nos services et nos tarifs en 2026.</p><ul><li><a href="/p${(n * 7 + i) % 80}">Voir ${i}</a></li></ul><img src="/i/${i}.jpg" alt="Image ${i}"></section>`).join('')}</main>`,
        `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Lourd' })}</script>`,
      ),
    );
  return heavyCache.get(n)!;
};
const randomBinary = (() => {
  let b: Buffer | null = null;
  return () => {
    if (!b) {
      b = Buffer.alloc(400_000);
      let x = 12345;
      for (let i = 0; i < b.length; i++) b[i] = (x = (x * 1103515245 + 12345) >>> 0) >>> 24;
    }
    return b;
  };
})();

const latin1 = (s: string) => Buffer.from(s, 'latin1');
export const IDN_HOST = new URL('https://boulangerie-éléonore.test/').hostname; // forme punycode

const CF_CHALLENGE = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="refresh" content="390"></head><body><div class="main-wrapper"><noscript>Enable JavaScript and cookies to continue</noscript><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1?ray=abc"></script></div></body></html>`;

let limiteCount = 0;
let rebindFlip = 0;

export const HARD_SITES: Record<string, HardHandler> = {
  /* ===== Lenteurs ===== */
  'ttfb-lent.test': (p) => (p === '/robots.txt' ? r404 : { delayMs: 9_500, body: page('Lent', '<h1>Enfin</h1>') }),
  'goutte.test': (p) => {
    if (p === '/robots.txt') return r404;
    if (p === '/') return { body: page('Goutte', `<main><h1>Goutte à goutte</h1>${para(3, 'g')}<a href="/corps-lent">a</a><a href="/corps-lent-gz">b</a><a href="/ok">c</a></main>`) };
    if (p === '/corps-lent') return { raw: trickle(200) };
    if (p === '/corps-lent-gz') return { raw: trickle(200, true) };
    if (p === '/ok') return { body: page('OK', `<main><h1>OK</h1>${para(2, 'ok')}</main>`) };
    return undefined;
  },
  'robots-lent.test': (p) => (p === '/robots.txt' ? { delayMs: 9_500, ...robotsOk } : simple('robots-lent.test', ['/a'])(p)),
  'coupe.test': (p) => (p === '/robots.txt' ? r404 : { raw: (req) => req.socket.destroy() }),

  /* ===== JavaScript seul ===== */
  'spa-vide.test': (p) => {
    if (p === '/robots.txt') return r404;
    if (p === '/assets/app.js')
      return {
        type: 'application/javascript',
        body: `document.getElementById('root').innerHTML = '<main><h1>Plombier Martin à Nantes</h1><p>${'Dépannage plomberie 7 jours sur 7, devis gratuit, intervention en moins de deux heures dans toute la métropole nantaise. '.repeat(6)}</p><a href="/services">Nos services</a><a href="/contact">Contact</a></main>'; document.title = 'Plombier Martin | Nantes';`,
      };
    if (p === '/' || p === '/services' || p === '/contact')
      return { body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Vite App</title><script type="module" crossorigin src="/assets/app.js"></script></head><body><div id="root"></div></body></html>` };
    return undefined;
  },
  /* SPA qui tente de sortir du bac à sable pendant le rendu (CRAWL_RENDER) : fetch, image, WebSocket vers des IP internes. */
  'spa-ssrf.test': (p, _q, req) => {
    if (p === '/robots.txt') return r404;
    const port = req.socket.localPort;
    if (p === '/assets/app.js')
      return {
        type: 'application/javascript',
        body: `fetch('http://127.0.0.1:${port}/fuite-fetch').catch(function(){}); fetch('http://169.254.169.254/latest/meta-data/').catch(function(){});
try { new WebSocket('ws://127.0.0.1:${port}/fuite-ws'); } catch (e) {}
var i = new Image(); i.src = 'http://127.0.0.1:${port}/fuite-img';
document.getElementById('app').innerHTML = '<h1>Rendu sûr</h1><p>${'Contenu affiché par JavaScript, sans fuite vers le réseau interne. '.repeat(5)}</p>';`,
      };
    if (p === '/') return { body: `<!doctype html><html lang="fr"><head><title>SPA</title><script src="/assets/app.js" defer></script></head><body><div id="app"></div><noscript>Activez JavaScript.</noscript></body></html>` };
    return undefined;
  },
  /* Vitrine courte mais rendue côté serveur (55 mots, 8 scripts) : ce n'est PAS une page vide pour les robots d'IA. */
  'vitrine-courte.test': (p) =>
    p === '/robots.txt'
      ? r404
      : p === '/'
        ? {
            body: page(
              'Serrurerie Dubois à Tours',
              `<main><h1>Serrurerie Dubois</h1><p>Ouverture de porte, changement de serrure et blindage à Tours et alentours. Intervention 7 jours sur 7, devis gratuit par téléphone. Artisan installé depuis 2004, agréé par les assurances. Appelez le 02 47 00 00 00 ou passez à l’atelier, 12 rue Nationale, du lundi au samedi.</p></main>`,
              Array.from({ length: 8 }, (_, i) => `<script src="/wp-includes/js/s${i}.js"></script>`).join(''),
            ),
          }
        : undefined,
  /* Site Next.js App Router : données RSC en ligne, optimiseur d'images qui répond 400 à HEAD, liens vers des docs « dev. ». */
  'next-like.test': (p, _q, req) => {
    if (p === '/robots.txt') return r404;
    if (p === '/_next/image') return req.method === 'HEAD' ? { status: 400, body: '' } : { type: 'image/webp', body: Buffer.alloc(2_000) };
    if (p === '/')
      return {
        body: page(
          'Next',
          `<main><h1>Agence Next</h1>${para(4, 'nx')}<img src="/_next/image?url=%2Fhero.jpg&w=640&q=75" alt="Héros"><a href="https://dev.wix.com/docs/rest">Doc Wix</a><a href="https://dev.next-like.test/">Préprod</a></main>${Array.from({ length: 60 }, (_, i) => `<script>self.__next_f.push([1,"${i}"])</script>`).join('')}<script src="/_next/static/chunks/main.js" async></script>`,
        ),
      };
    return undefined;
  },
  'nuxt-ssr.test': (p) =>
    p === '/robots.txt'
      ? r404
      : p === '/'
        ? { body: page('Nuxt SSR', `<div id="__nuxt"><main><h1>Rendu serveur</h1>${para(5, 'nuxt')}</main></div><script>window.__NUXT__={}</script><script type="module" src="/_nuxt/entry.js"></script>`) }
        : undefined,

  /* ===== robots.txt hostiles ===== */
  'robots-tout.test': (p) => (p === '/robots.txt' ? { type: 'text/plain', body: 'User-agent: *\nDisallow: /\n' } : { body: page('Interdit', '<h1>Ne devrait pas être lue</h1>') }),
  'robots-500.test': (p) => (p === '/robots.txt' ? { status: 500, body: 'Internal Server Error' } : simple('robots-500.test', ['/a'])(p)),
  'robots-html.test': (p) => (p === '/robots.txt' ? { body: page('Accueil', '<h1>Accueil</h1><p>Disallow: tout</p>') } : simple('robots-html.test', ['/a'])(p)),
  'robots-ia.test': (p) =>
    p === '/robots.txt'
      ? { type: 'text/plain', body: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n' }
      : simple('robots-ia.test', ['/a'])(p),

  /* ===== Redirections ===== */
  'boucle-accueil.test': (p) => (p === '/robots.txt' ? r404 : { status: 302, headers: { location: '/' } }),
  'chaine.test': (p) => {
    if (p === '/robots.txt') return r404;
    const n = p === '/' ? 0 : Number(/^\/(\d+)$/.exec(p)?.[1] ?? -1);
    if (n >= 0 && n < 8) return { status: 301, headers: { location: `/${n + 1}` } };
    if (n === 8) return { body: page('Fin de chaîne', `<h1>Fin</h1>${para(2, 'c')}`) };
    return undefined;
  },
  'meta-refresh.test': (p) => {
    if (p === '/robots.txt') return r404;
    if (p === '/') return { body: '<html><head><meta http-equiv="refresh" content="0; url=/fr/accueil"></head><body></body></html>' };
    if (p === '/fr/accueil') return { body: page('Accueil FR', `<main><h1>Bienvenue</h1>${para(4, 'mr')}<a href="/fr/contact">Contact</a></main>`) };
    if (p === '/fr/contact') return { body: page('Contact', `<main><h1>Contact</h1>${para(2, 'mrc')}</main>`) };
    return undefined;
  },
  'js-redir.test': (p) => {
    if (p === '/robots.txt') return r404;
    if (p === '/') return { body: '<html><head><script>window.location.replace("https://js-redir.test/fr/");</script></head><body>Redirection…</body></html>' };
    if (p === '/fr/') return { body: page('Accueil', `<main><h1>Accueil</h1>${para(4, 'js')}</main>`) };
    return undefined;
  },
  'demenage.test': (p) => (p === '/robots.txt' ? r404 : { status: 301, headers: { location: `https://nouveau-nom.test${p}` } }),
  'nouveau-nom.test': simple('nouveau-nom.test', ['/a']),
  'http-seul.test': (p, _q, req) => {
    if (req.headers['x-fake-proto'] === 'https:') return { raw: (r) => r.socket.destroy() };
    return simple('http-seul.test', ['/a'])(p);
  },

  /* ===== Sitemaps ===== */
  'sitemap-geant.test': (p) => {
    if (p === '/robots.txt') return { type: 'text/plain', body: 'User-agent: *\nAllow: /\nSitemap: https://sitemap-geant.test/sitemap_index.xml\n' };
    if (p === '/sitemap_index.xml')
      return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: 500 }, (_, i) => `<sitemap><loc>https://sitemap-geant.test/sitemaps/s-${i}.xml</loc></sitemap>`).join('')}<sitemap><loc>https://sitemap-geant.test/sitemap_index.xml</loc></sitemap></sitemapindex>`);
    if (p.startsWith('/sitemaps/')) return xml(giantSitemapChild());
    if (p === '/' || p.startsWith('/produits/')) return { body: page(`Produit ${p}`, `<main><h1>${p}</h1>${para(2, p)}</main>`) };
    return undefined;
  },
  'sitemap-casse.test': (p) => {
    const h = 'sitemap-casse.test';
    if (p === '/robots.txt')
      return {
        type: 'text/plain',
        body: ['html', 'tronque', 'gz-casse.xml.gz', 'bombe.xml.gz', 'bon']
          .map((s) => `Sitemap: https://${h}/sm-${s}`)
          .concat(['Sitemap: https://tiers.test/sitemap.xml', 'Sitemap: http://169.254.169.254/latest/sitemap.xml', 'Sitemap: http://127.0.0.1/sitemap.xml', 'Sitemap: pas une url'])
          .join('\n'),
      };
    if (p === '/sm-html') return { body: page('Page introuvable', '<h1>Oups</h1>') };
    if (p === '/sm-tronque') return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${h}/a</loc></url><url><loc>https://${h}/b`);
    if (p === '/sm-gz-casse.xml.gz') return { type: 'application/gzip', body: Buffer.concat([Buffer.from([0x1f, 0x8b, 8, 0]), Buffer.from('pas du gzip du tout')]) };
    if (p === '/sm-bombe.xml.gz') return { type: 'application/gzip', body: gzipBomb() };
    if (p === '/sm-bon') return xml(urlset(h, ['/', '/a', '/c']));
    return simple(h, ['/a', '/b', '/c'])(p);
  },
  'tiers.test': (p) => (p === '/sitemap.xml' ? xml(urlset('tiers.test', ['/x', '/y'])) : undefined),
  'sitemap-html.test': (p) => (p === '/robots.txt' ? r404 : p === '/sitemap.xml' ? { body: page('Accueil', '<h1>Soft 404</h1>') } : simple('sitemap-html.test', ['/a'])(p)),

  /* ===== Encodages ===== */
  'latin1.test': (p) =>
    p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html; charset=ISO-8859-1', body: latin1(page('Pâtisserie Événement à Besançon', '<h1>Crème brûlée</h1><p>Spécialités françaises à déguster sur place, où vous voulez.</p>').replace('<meta charset="utf-8">', '')) } : undefined,
  'meta-latin1.test': (p) =>
    p === '/robots.txt'
      ? r404
      : p === '/'
        ? { type: 'text/html', body: latin1(`<!doctype html><html lang="fr"><head><style>${'.a{color:red}'.repeat(250)}</style><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><title>Fromagerie à Besançon</title></head><body><h1>Comté affiné</h1><p>Fromages français sélectionnés.</p></body></html>`) }
        : undefined,
  'sans-charset.test': (p) =>
    p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html', body: latin1('<html><head><title>Café à Orléans</title></head><body><h1>Café crème</h1><p>Torréfié à Orléans, éthiopie et brésil.</p></body></html>') } : undefined,
  'bom.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html', body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(page('Épicerie fine', '<h1>Été</h1><p>Produits sélectionnés.</p>').replace('<meta charset="utf-8">', ''))]) } : undefined),
  'utf16.test': (p) =>
    p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html', body: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(page('Crêperie à Rennes', '<h1>Galettes</h1><p>Blé noir.</p>').replace('<meta charset="utf-8">', ''), 'utf16le')]) } : undefined,
  'charset-inconnu.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html; charset=utf-8lol', body: page('Bistrot à Lille', '<h1>Carbonnade</h1><p>Cuisine du Nord.</p>') } : undefined),

  /* ===== Tailles et contenus extrêmes ===== */
  'enorme.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { body: hugeHtml() } : undefined),
  'pathologique.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { body: pathologicalHtml() } : p === '/x' ? { body: page('X', `<h1>X</h1>${para(2, 'x')}`) } : undefined),
  'binaire.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { type: 'text/html', body: randomBinary() } : undefined),
  /* 60 pages lourdes (1,3 Mo chacune) : mémoire et temps des audits. */
  'lourd.test': (p) => {
    if (p === '/robots.txt') return r404;
    const n = p === '/' ? 0 : Number(/^\/p(\d+)$/.exec(p)?.[1] ?? -1);
    if (n < 0 || n > 80) return undefined;
    return { body: heavyPage(n) };
  },
  'vide.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { body: '' } : undefined),
  'json.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { type: 'application/json', body: '{"ok":true}' } : undefined),
  'accueil-404.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { status: 404, body: page('Introuvable', '<h1>404</h1><a href="/a">a</a>') } : undefined),
  'accueil-500.test': (p) => (p === '/robots.txt' ? r404 : { status: 500, body: page('Erreur', '<h1>Erreur interne</h1>') }),
  'maintenance.test': (p) => (p === '/robots.txt' ? r404 : { status: 503, headers: { 'retry-after': '3600' }, body: page('Maintenance', '<h1>Site en maintenance</h1><p>Nous revenons vite.</p>') }),
  'parking.test': (p) => (p === '/robots.txt' ? r404 : p === '/' ? { body: page('parking.test - This domain may be for sale!', '<h1>This domain may be for sale</h1><p>Buy this domain. Related searches.</p><script src="https://www.sedoparking.com/x.js"></script>') } : undefined),
  'mdp.test': (p) => (p === '/robots.txt' ? r404 : { status: 401, headers: { 'www-authenticate': 'Basic realm="Staging"' }, body: 'Unauthorized' }),
  'shopify-mdp.test': (p): HardResponse =>
    p === '/robots.txt'
      ? robotsOk
      : p === '/password'
        ? { body: page('Ouverture prochaine', '<form action="/password" method="post"><input type="password" name="password"></form>', '<link rel="preconnect" href="https://cdn.shopify.com">'), headers: { 'x-shopid': '42', 'powered-by': 'Shopify' } }
        : { status: 302, headers: { location: '/password', 'x-shopid': '42', 'powered-by': 'Shopify' } },
  'noindex-partout.test': (p) => {
    if (p === '/robots.txt') return r404;
    const h = "<meta name='robots' content='noindex, nofollow'><meta name=\"generator\" content=\"WordPress 6.6\">";
    if (p === '/') return { body: page('Accueil', `<main><h1>Accueil</h1>${para(4, 'ni')}<a href="/a">a</a></main>`, h) };
    if (p === '/a') return { body: page('A', `<main><h1>A</h1>${para(3, 'ni')}</main>`, h) };
    return undefined;
  },

  /* ===== Anti-robots ===== */
  'cloudflare.test': (p) =>
    p === '/robots.txt'
      ? robotsOk
      : { status: 403, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge', 'cf-ray': '8abc-CDG' }, body: CF_CHALLENGE },
  'datadome.test': (p) =>
    p === '/robots.txt'
      ? robotsOk
      : { status: 403, headers: { 'x-datadome': 'protected' }, body: '<html><head><title>datadome</title></head><body><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>' },
  'interdit.test': (p) => (p === '/robots.txt' ? r404 : { status: 403, headers: { server: 'nginx' }, body: '<html><head><title>403 Forbidden</title></head><body><center><h1>403 Forbidden</h1></center></body></html>' }),
  'limite.test': (p) => {
    if (p === '/robots.txt') return r404;
    limiteCount++;
    if (p !== '/' && limiteCount > 3) return { status: 429, headers: { 'retry-after': '30' }, body: 'Too Many Requests' };
    const links = Array.from({ length: 40 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');
    return { body: page(`Limite ${p}`, `<main><h1>${p}</h1>${para(2, p)}${p === '/' ? links : ''}</main>`) };
  },

  /* ===== Cookies obligatoires ===== */
  'cookie.test': (p, q, req) => {
    if (p === '/robots.txt') return r404;
    if (!/(^|;\s*)acces=ok\b/.test(String(req.headers.cookie ?? ''))) return { status: 302, headers: { location: p + (q ? `?${q}` : ''), 'set-cookie': 'acces=ok; Path=/; HttpOnly; SameSite=Lax; Expires=Wed, 21 Oct 2037 07:28:00 GMT' } };
    return simple('cookie.test', ['/a', '/b'])(p);
  },

  /* ===== Canonicals contradictoires, hreflang ===== */
  'canon.test': (p) => {
    if (p === '/robots.txt') return r404;
    const nav = '<a href="/deux">1</a><a href="/entete">2</a><a href="/vers-404">3</a><a href="/accueil-partout">4</a><a href="/autre-domaine">5</a><a href="/hreflang">6</a>';
    switch (p) {
      case '/':
        return { body: page('Canon', `<main><h1>Accueil</h1>${para(3, 'cn')}${nav}</main>`) };
      case '/deux':
        return { body: page('Deux', `<main><h1>Deux</h1>${para(2, 'd')}</main>`, '<link rel="canonical" href="https://canon.test/deux"><link rel="canonical" href="https://canon.test/autre">') };
      case '/entete':
        return { headers: { link: '<https://canon.test/ailleurs>; rel="canonical"' }, body: page('En-tête', `<main><h1>Entête</h1>${para(2, 'e')}</main>`, '<link rel="canonical" href="https://canon.test/entete">') };
      case '/vers-404':
        return { body: page('Vers 404', `<main><h1>V</h1>${para(2, 'v')}</main>`, '<link rel="canonical" href="https://canon.test/disparue">') };
      case '/accueil-partout':
        return { body: page('Partout', `<main><h1>P</h1>${para(2, 'p')}</main>`, '<link rel="canonical" href="/">') };
      case '/autre-domaine':
        return { body: page('Autre', `<main><h1>Autre</h1>${para(2, 'a')}</main>`, '<link rel="canonical" href="https://ailleurs.test/page">') };
      case '/hreflang':
        return { body: page('Hreflang', `<main><h1>H</h1>${para(2, 'h')}</main>`, '<link rel="alternate" hreflang="fr_FR" href="/hreflang"><link rel="alternate" hreflang="english" href="/en/"><link rel="alternate" hreflang="en" href="javascript:void(0)">') };
      default:
        return undefined;
    }
  },

  /* ===== Pièges à URL infinies ===== */
  'piege-url.test': (p, q) => {
    if (p === '/robots.txt') return r404;
    const sp = new URLSearchParams(q);
    if (p === '/agenda') {
      const m = Number(sp.get('mois') ?? 0);
      return { body: page(`Agenda ${m}`, `<main><h1>Agenda</h1>${para(1, `a${m}`)}<a href="/agenda?mois=${m + 1}">Suivant</a><a href="/agenda?mois=${m - 1}">Précédent</a></main>`) };
    }
    if (p === '/produits') {
      const cols = ['rouge', 'bleu', 'vert', 'noir'];
      const sizes = ['s', 'm', 'l', 'xl'];
      const links = cols.flatMap((c) => sizes.map((s) => `<a href="/produits?${new URLSearchParams({ ...Object.fromEntries(sp), couleur: c, taille: s, tri: String(Math.random()).slice(2, 6) })}">${c} ${s}</a>`)).join('');
      return { body: page('Produits', `<main><h1>Produits</h1>${para(1, 'f')}${links}</main>`) };
    }
    if (/^\/(rel\/)+$/.test(p)) return { body: page('Relatif', `<main><h1>Relatif</h1>${para(1, 'r')}<a href="rel/">encore</a></main>`) };
    if (p === '/session') return { body: page('Session', `<main><h1>S</h1>${para(1, 's')}<a href="/session?sid=${Math.random().toString(36).slice(2)}">ici</a></main>`) };
    const real = ['/services', '/tarifs', '/contact', '/a-propos', '/equipe', '/avis'];
    if (p === '/')
      return { body: page('Pièges', `<main><h1>Accueil</h1>${para(3, 'pg')}<a href="/agenda?mois=0">Agenda</a><a href="/produits">Produits</a><a href="/rel/">Relatif</a><a href="/session?sid=1">Session</a>${real.map((r) => `<a href="${r}">${r}</a>`).join('')}</main>`) };
    if (real.includes(p)) return { body: page(p, `<main><h1>${p}</h1>${para(3, p)}<a href="/">Accueil</a></main>`) };
    return undefined;
  },

  /* ===== IDN, IPv6 ===== */
  [IDN_HOST]: (p) =>
    p === '/robots.txt' ? r404 : p === '/' ? { body: page('Boulangerie Éléonore', `<main><h1>Boulangerie Éléonore</h1>${para(3, 'idn')}<a href="/pains">Pains</a></main>`) } : p === '/pains' ? { body: page('Pains', `<h1>Pains</h1>${para(2, 'pn')}`) } : undefined,
  'v6.test': simple('v6.test', ['/a']),
  'mixte.test': simple('mixte.test', ['/a']),
  'v6-prive.test': simple('v6-prive.test'),

  /* ===== SSRF ===== */
  'rebind.test': simple('rebind.test', ['/a', '/b', '/c']),
  'ssrf-formes.test': (p) => {
    if (p === '/robots.txt') return r404;
    const targets: Record<string, string> = {
      '/r1': 'http://[::ffff:127.0.0.1]/',
      '/r2': 'http://0x7f000001/',
      '/r3': 'http://2130706433/',
      '/r4': 'http://127.1/',
      '/r5': 'http://localhost./',
      '/r6': 'http://metadata.google.internal/computeMetadata/v1/',
      '/r7': 'https://ssrf-formes.test:8443/',
      '/r8': 'http://user:pass@ssrf-formes.test/',
      '/r9': 'http://interne-alias.test/',
      '/r10': 'gopher://ssrf-formes.test/',
      '/r11': 'http://[fd00:ec2::254]/',
    };
    if (targets[p]) return { status: 302, headers: { location: targets[p] } };
    if (p === '/')
      return {
        body: page(
          'SSRF',
          `<main><h1>SSRF</h1>${para(3, 'ss')}${Object.keys(targets).map((t) => `<a href="${t}">${t}</a>`).join('')}<a href="http://169.254.169.254/latest/meta-data/">meta</a><a href="http://interne-alias.test/x">alias</a><img src="http://10.0.0.1/pixel.gif" alt="x"></main>`,
        ),
      };
    return undefined;
  },
  'interne-alias.test': () => ({ body: 'NE DOIT JAMAIS ÊTRE LU' }),
};

for (const [host, def] of Object.entries(PLATFORM_PAGES)) {
  HARD_SITES[host] = (p) => {
    if (p === '/robots.txt') return robotsOk;
    if (p === '/')
      return { headers: def.headers, body: page(`Accueil ${host}`, `<main><h1>Bienvenue</h1>${para(4, host)}${def.body}</main>`, def.head, def.htmlAttrs) };
    return undefined;
  };
}

/** Résolutions DNS particulières (le reste des *.test → 93.184.216.34). */
export const HARD_DNS: Record<string, () => ResolvedAddress[]> = {
  'v6.test': () => [{ address: '2a00:1450:4007:80e::2004', family: 6 }],
  'mixte.test': () => [
    { address: '2a00:1450:4007:80e::2004', family: 6 },
    { address: '93.184.216.34', family: 4 },
  ],
  'v6-prive.test': () => [
    { address: '93.184.216.34', family: 4 },
    { address: 'fd00::1', family: 6 },
  ],
  'interne-alias.test': () => [{ address: '10.0.0.5', family: 4 }],
  // DNS rebinding : une réponse publique, puis une privée, en alternance.
  'rebind.test': () => [(rebindFlip++ % 2 === 0 ? { address: '93.184.216.34', family: 4 } : { address: '127.0.0.1', family: 4 })],
};

export function resetHardState(): void {
  limiteCount = 0;
  rebindFlip = 0;
}
