/**
 * Faux sites servis par un serveur HTTP local (node:http). Le résolveur rend une IP publique de documentation pour
 * les noms *.test, le transport réel (nodeTransport) se connecte au serveur local : l'anti-SSRF reste actif pour
 * tout le reste (127.0.0.1, 169.254.169.254 en redirection…). Aucune sortie sur Internet.
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { nodeTransport, setFetchDeps, type Resolver, type Transport } from '@/lib/siteaudit/fetch';

export interface FakeResponse {
  status?: number;
  body?: string | Buffer;
  type?: string;
  headers?: Record<string, string>;
  gzip?: boolean;
  delayMs?: number;
}
type Handler = (path: string, query: string) => FakeResponse | undefined;

const html = (title: string, body: string, head = '') =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;
const para = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `<p>${seed} paragraphe ${i} : contenu utile et original sur le métier, les tarifs et les horaires.</p>`).join('');
const robotsAll = (host: string, extra = '') => ({ body: `User-agent: *\nAllow: /\n${extra}Sitemap: https://${host}/sitemap.xml\n`, type: 'text/plain' });

export const SITES: Record<string, Handler> = {
  /* Site normal : accueil, sections, images, liens sortants (dont un cassé), page orpheline du sitemap, 404 interne. */
  'normal.test': (p) => {
    const nav = `<nav><a href="/">Accueil</a><a href="/services/">Services</a><a href="/blog/">Blog</a><a href="/contact?utm_source=x#form">Contact</a></nav>`;
    switch (p) {
      case '/robots.txt':
        return robotsAll('normal.test');
      case '/sitemap.xml':
        return { type: 'application/xml', body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/services/', '/blog/', '/orphelin', '/contact'].map((u) => `<url><loc>https://normal.test${u}</loc></url>`).join('')}<url><loc>https://autre-site.test/x</loc></url></urlset>` };
      case '/':
        return {
          body: html(
            'Boulangerie Exemple à Lyon',
            `${nav}<main><h1>Boulangerie Exemple</h1>${para(5, 'accueil')}<img src="/img/pain.jpg" alt="Pain au levain" width="800" height="600" loading="lazy"><img src="/img/deco.png" alt=""><img src="/img/sans-alt.png"><a href="https://ext.test/ok">Partenaire</a><a href="https://ext.test/absent" rel="nofollow noopener">Ancien partenaire</a><a href="mailto:x@y.fr">Courriel</a><a href="/doc.pdf">Tarifs PDF</a></main>`,
            `<meta name="description" content="Pain au levain à Lyon."><meta property="og:title" content="Boulangerie Exemple"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"Boulangerie Exemple"}</script>`,
          ),
        };
      case '/services/':
        return { body: html('Services', `${nav}<h1>Nos services</h1>${para(4, 'services')}<a href="/services/traiteur">Traiteur</a><a href="/page-disparue">Ancienne page</a>`) };
      case '/services/traiteur':
        return { body: html('Traiteur', `${nav}<h1>Traiteur</h1>${para(3, 'traiteur')}`) };
      case '/blog/':
        return { body: html('Blog', `${nav}<h1>Blog</h1>${para(2, 'blog')}<a href="/blog/article-1">Article</a>`) };
      case '/blog/article-1':
        return { body: html('Article 1', `${nav}<h1>Article 1</h1>${para(6, 'article')}`) };
      case '/contact':
        return { body: html('Contact', `${nav}<h1>Contact</h1>${para(1, 'contact')}`) };
      case '/orphelin':
        return { body: html('Orphelin', `<h1>Page orpheline</h1>${para(2, 'orphelin')}`) };
      case '/doc.pdf':
        return { type: 'application/pdf', body: '%PDF-1.4' };
      case '/img/pain.jpg':
        return { type: 'image/jpeg', body: Buffer.alloc(12_345) };
      case '/img/deco.png':
        return { type: 'image/png', body: Buffer.alloc(100) };
      default:
        return undefined;
    }
  },
  'ext.test': (p) => (p === '/ok' ? { body: html('Partenaire', '<p>ok</p>') } : p === '/robots.txt' ? { status: 404, body: '' } : undefined),

  /* Redirections : domaine nu → www, chaîne 301→302, boucle, sortie du site, tentative SSRF. */
  'redirs.test': (p) => (p === '/robots.txt' ? { status: 404, body: '' } : { status: 301, headers: { location: `https://www.redirs.test${p}` } }),
  'www.redirs.test': (p) => {
    const nav = `<a href="/ancienne">Ancienne</a><a href="/boucle-a">Boucle</a><a href="/sortie">Sortie</a><a href="/ssrf">Interne</a><a href="/nouvelle">Nouvelle</a>`;
    switch (p) {
      case '/robots.txt':
        return { status: 404, body: '' };
      case '/':
        return { body: html('Accueil redirs', `<h1>Accueil</h1>${para(3, 'r')}${nav}`) };
      case '/ancienne':
        return { status: 301, headers: { location: '/intermediaire' } };
      case '/intermediaire':
        return { status: 302, headers: { location: 'https://www.redirs.test/nouvelle' } };
      case '/nouvelle':
        return { body: html('Nouvelle', `<h1>Nouvelle</h1>${para(2, 'n')}`) };
      case '/boucle-a':
        return { status: 302, headers: { location: '/boucle-b' } };
      case '/boucle-b':
        return { status: 302, headers: { location: '/boucle-a' } };
      case '/sortie':
        return { status: 301, headers: { location: 'https://ailleurs.test/' } };
      case '/ssrf':
        return { status: 302, headers: { location: 'http://127.0.0.1/admin' } };
      default:
        return undefined;
    }
  },

  'piege.test': (p) => (p === '/robots.txt' ? { status: 404, body: '' } : { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),

  /* robots.txt qui bloque RepereBot partout. */
  'bloque.test': (p) => (p === '/robots.txt' ? { type: 'text/plain', body: 'User-agent: RepereBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n' } : { body: html('Interdit', '<h1>Ne devrait pas être lue</h1>') }),
  /* robots.txt qui bloque une section seulement + crawl-delay. */
  'partiel.test': (p) => {
    if (p === '/robots.txt') return { type: 'text/plain', body: 'User-agent: *\nDisallow: /prive/\n' };
    if (p === '/') return { body: html('Partiel', `<h1>Partiel</h1>${para(2, 'p')}<a href="/prive/secret">Secret</a><a href="/public">Public</a>`) };
    if (p === '/public') return { body: html('Public', `<h1>Public</h1>${para(2, 'pub')}`) };
    if (p === '/prive/secret') return { body: html('Secret', '<h1>Ne devrait pas être lue</h1>') };
    return undefined;
  },

  /* Index de sitemaps avec un fichier gzip. */
  'gz.test': (p) => {
    const urlset = (paths: string[]) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((u) => `<url><loc>https://gz.test${u}</loc></url>`).join('')}</urlset>`;
    if (p === '/robots.txt') return { type: 'text/plain', body: 'User-agent: *\nAllow: /\nSitemap: https://gz.test/sitemap_index.xml\n' };
    if (p === '/sitemap_index.xml')
      return { type: 'application/xml', body: `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://gz.test/sm-produits.xml.gz</loc></sitemap><sitemap><loc>https://gz.test/sm-pages.xml</loc></sitemap><sitemap><loc>https://gz.test/sm-absent.xml</loc></sitemap></sitemapindex>` };
    if (p === '/sm-produits.xml.gz') return { type: 'application/x-gzip', body: zlib.gzipSync(urlset(Array.from({ length: 30 }, (_, i) => `/produits/p${i}`))) };
    if (p === '/sm-pages.xml') return { type: 'application/xml', body: urlset(['/', '/a-propos', '/blog/b1', '/blog/b2']) };
    if (p === '/') return { body: html('GZ', `<h1>Boutique</h1>${para(2, 'gz')}<a href="/a-propos">À propos</a>`) };
    if (p.startsWith('/produits/') || p === '/a-propos' || p.startsWith('/blog/')) return { body: html(`Page ${p}`, `<h1>${p}</h1>${para(2, p)}`) };
    return undefined;
  },

  /* Site géant : chaque page relie 10 pages plus profondes ; sitemap de 5 000 URL en 5 sections. */
  'geant.test': (p) => {
    if (p === '/robots.txt') return robotsAll('geant.test');
    if (p === '/sitemap.xml') {
      const secs = ['produits', 'blog', 'magasins', 'aide', 'marques'];
      const locs = Array.from({ length: 5000 }, (_, i) => `<url><loc>https://geant.test/${secs[i % 5]}/${i}</loc></url>`).join('');
      return { type: 'application/xml', body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs}</urlset>` };
    }
    const m = /^\/(?:p\/(\d+)|([a-z]+)\/(\d+))?$/.exec(p);
    if (!m) return undefined;
    const n = Number(m[1] ?? 0);
    const kids = Array.from({ length: 10 }, (_, i) => `<a href="/p/${n * 10 + i + 1}">Page ${n * 10 + i + 1}</a>`).join('');
    return { body: html(`Page ${p}`, `<h1>Page ${p}</h1>${para(3, `g${p}`)}${kids}`) };
  },

  /* Pages lentes. */
  'lent.test': (p) => {
    if (p === '/robots.txt') return { status: 404, body: '' };
    if (p === '/') return { body: html('Lent', `<h1>Lent</h1>${para(2, 'l')}<a href="/tres-lente">A</a><a href="/rapide">B</a>`) };
    if (p === '/tres-lente') return { delayMs: 4_000, body: html('Très lente', '<h1>Enfin</h1>') };
    if (p === '/rapide') return { body: html('Rapide', `<h1>Rapide</h1>${para(2, 'ra')}`) };
    return undefined;
  },

  /* HTML cassé. */
  'casse.test': (p) => {
    if (p === '/robots.txt') return { status: 404, body: '' };
    if (p === '/')
      return {
        body: `<html><head><title>Cassé & co</title><script type="application/ld+json">{"@type": "Organization", "name": </script><meta name=description content=sans-guillemets>
<body><h1>Titre <b>gras</h1><p>Texte non fermé <a href=/suite>suite<a href='/autre' >autre</a><img src=/x.png alt=Logo><div><span>${'mot '.repeat(120)}<table><tr><td>cellule`,
      };
    if (p === '/suite' || p === '/autre') return { body: html(p, `<h1>${p}</h1>${para(2, p)}`) };
    return undefined;
  },

  /* Application rendue côté client. */
  'spa.test': (p) => {
    if (p === '/robots.txt') return { status: 404, body: '' };
    if (p === '/') return { body: `<!doctype html><html><head><title>App</title><script type="module" src="/assets/index.js"></script></head><body><div id="root"></div><noscript>Activez JavaScript pour utiliser ce site.</noscript></body></html>` };
    return undefined;
  },

  /* Indexabilité : noindex (méta, en-tête), canonical, hreflang, doublons. */
  'meta.test': (p) => {
    if (p === '/robots.txt') return { status: 404, body: '' };
    const nav = `<a href="/noindex">1</a><a href="/xrobots">2</a><a href="/canon-autre">3</a><a href="/canon-soi">4</a><a href="/fr/">5</a><a href="/doublon-1">6</a><a href="/doublon-2">7</a>`;
    const dup = `<h1>Nos horaires</h1><p>Ouvert du mardi au samedi, de 7 h à 19 h. Fermé le lundi.</p>${para(3, 'dup')}`;
    switch (p) {
      case '/':
        return { body: html('Meta', `<h1>Meta</h1>${para(2, 'm')}${nav}`) };
      case '/noindex':
        return { body: html('Noindex', '<h1>N</h1><p>texte</p>', '<meta name="robots" content="noindex, follow">') };
      case '/xrobots':
        return { headers: { 'X-Robots-Tag': 'googlebot: noindex' }, body: html('X', '<h1>X</h1><p>texte</p>') };
      case '/canon-autre':
        return { body: html('Canon', '<h1>C</h1><p>texte</p>', '<link rel="canonical" href="/canon-soi">') };
      case '/canon-soi':
        return { body: html('Canon soi', '<h1>C2</h1><p>texte</p>', '<link rel="canonical" href="https://meta.test/canon-soi?utm_source=x">') };
      case '/fr/':
        return { body: html('FR', '<h1>FR</h1><p>texte</p>', '<link rel="alternate" hreflang="fr-FR" href="/fr/"><link rel="alternate" hreflang="en" href="https://meta.test/en/"><link rel="alternate" hreflang="x-default" href="/">') };
      case '/doublon-1':
        return { body: html('Doublon 1', dup) };
      case '/doublon-2':
        return { body: html('Doublon 2', dup.toUpperCase().replace(/\. /g, '.   ')) };
      default:
        return undefined;
    }
  },
};

export interface FakeServer {
  port: number;
  hits: string[];
  restore: () => void;
  close: () => Promise<void>;
}

export async function startFakeSites(): Promise<FakeServer> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    const host = String(req.headers.host ?? '').split(':')[0];
    const [path, query = ''] = (req.url ?? '/').split('?');
    hits.push(`${req.method} ${host}${req.url}`);
    const r = SITES[host]?.(path, query);
    const reply = () => {
      if (!r) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><html><head><title>Introuvable</title></head><body><h1>404</h1><a href="/piege-404">x</a></body></html>');
        return;
      }
      const headers: Record<string, string> = { 'content-type': r.type ?? 'text/html; charset=utf-8', ...(r.headers ?? {}) };
      let body: Buffer = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body ?? '');
      if (r.gzip) {
        body = zlib.gzipSync(body);
        headers['content-encoding'] = 'gzip';
      }
      headers['content-length'] = String(body.length);
      res.writeHead(r.status ?? 200, headers);
      res.end(body);
    };
    if (r?.delayMs) {
      const t = setTimeout(reply, r.delayMs);
      res.on('close', () => clearTimeout(t));
    } else reply();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  const port = (server.address() as { port: number }).port;
  const resolver: Resolver = async (host) => {
    if (host.endsWith('.test')) return [{ address: '93.184.216.34', family: 4 }];
    throw new Error('ENOTFOUND');
  };
  const transport: Transport = (req) => {
    const u = new URL(req.url.toString());
    const host = u.hostname;
    u.protocol = 'http:';
    u.hostname = '127.0.0.1';
    u.port = String(port);
    return nodeTransport({ ...req, url: u, address: { address: '127.0.0.1', family: 4 }, headers: { ...req.headers, host } });
  };
  const restore = setFetchDeps({ resolver, transport });
  return {
    port,
    hits,
    restore,
    close: () =>
      new Promise<void>((ok) => {
        restore();
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}
