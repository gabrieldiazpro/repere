/**
 * QA-FONCTIONNEL : les 9 routes /api/tools/* sur de VRAIES pages servies par un serveur HTTP local, avec le
 * transport réel (node:http, décompression, taille bornée). Le résolveur rend une IP publique pour des noms de test,
 * puis le transport se connecte au serveur local : l'anti-SSRF (qui refuse 127.0.0.1) reste actif pour tout le reste
 * (redirection vers localhost, 169.254.169.254, IPv6 interne).
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { nodeTransport, setFetchDeps, type Resolver, type Transport } from '../fetch';
import { POST as robots } from '@/app/api/tools/robots/route';
import { POST as readiness } from '@/app/api/tools/readiness/route';
import { POST as citability } from '@/app/api/tools/citability/route';
import { POST as jsonldValidate } from '@/app/api/tools/jsonld/validate/route';
import { POST as jsonldGenerate } from '@/app/api/tools/jsonld/generate/route';
import { POST as llms } from '@/app/api/tools/llms/route';
import { POST as product } from '@/app/api/tools/product/route';
import { POST as compare } from '@/app/api/tools/compare/route';
import { POST as reviewLink } from '@/app/api/tools/review-link/route';

const GOOD = `<!doctype html><html lang="fr"><head><title>Plomberie Martin, plombier à Lyon 3e</title>
<meta name="description" content="Dépannage plomberie à Lyon 3e, 7j/7. Devis gratuit.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Plomberie Martin","url":"https://bonne-page.test/","telephone":"+33478000000","address":{"@type":"PostalAddress","streetAddress":"12 rue Exemple","addressLocality":"Lyon","postalCode":"69003","addressCountry":"FR"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Intervenez-vous le dimanche ?","acceptedAnswer":{"@type":"Answer","text":"Oui, 7 jours sur 7, de 8 h à 20 h."}}]}</script>
</head><body><main><h1>Plombier à Lyon 3e : dépannage en 1 heure</h1>
<p>Plomberie Martin intervient en moins d’une heure à Lyon 3e pour les fuites, chauffe-eau et débouchages. Tarif de déplacement : 49 € TTC (grille 2026).</p>
<p>Par <span class="author">Paul Martin</span>, mis à jour le <time datetime="2026-10-01">1er octobre 2026</time>.</p>
<h2>Questions fréquentes</h2><h3>Intervenez-vous le dimanche ?</h3><p>Oui, 7 jours sur 7.</p>
<table><tr><th>Prestation</th><th>Prix</th></tr><tr><td>Débouchage</td><td>89 €</td></tr></table>
${'<p>Texte de contenu utile sur la plomberie lyonnaise, les quartiers desservis et les délais.</p>'.repeat(20)}
</main></body></html>`;
const SPA = `<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const PRODUCT = `<!doctype html><html><head><title>Crème solaire bio SPF 50</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Crème solaire bio SPF 50","sku":"CS50","brand":{"@type":"Brand","name":"Maison Sora"},"image":"https://fiche-produit.test/img.jpg","description":"Crème minérale.","offers":{"@type":"Offer","price":"24.90","priceCurrency":"EUR","availability":"https://schema.org/InStock"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.6","reviewCount":"128"}}</script>
</head><body><h1>Crème solaire bio SPF 50</h1><p>Filtre minéral, 50 ml, 24,90 €.</p></body></html>`;

const ROUTES: Record<string, Record<string, { status?: number; body: string; type?: string; headers?: Record<string, string>; gzip?: boolean }>> = {
  'bonne-page.test': {
    '/': { body: GOOD, gzip: true },
    '/robots.txt': { body: 'User-agent: *\nAllow: /\nSitemap: https://bonne-page.test/sitemap.xml\n', type: 'text/plain' },
    '/sitemap.xml': { body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://bonne-page.test/</loc></url></urlset>', type: 'application/xml' },
  },
  'spa-vide.test': { '/': { body: SPA }, '/robots.txt': { body: 'User-agent: *\nAllow: /\n', type: 'text/plain' } },
  'robots-bloquant.test': {
    '/': { body: GOOD },
    '/robots.txt': { body: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n', type: 'text/plain' },
  },
  'fiche-produit.test': { '/produit': { body: PRODUCT }, '/robots.txt': { body: '', status: 404 } },
  'redirige.test': {
    '/': { status: 302, body: '', headers: { location: 'http://127.0.0.1/admin' } },
    '/meta': { status: 301, body: '', headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
    '/robots.txt': { body: '', status: 404 },
  },
};

let server: http.Server;
let port = 0;
const hits: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const host = String(req.headers.host ?? '').split(':')[0];
    const path = (req.url ?? '/').split('?')[0];
    hits.push(`${host}${path}`);
    const r = ROUTES[host]?.[path];
    if (!r) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<h1>404</h1>');
      return;
    }
    const headers: Record<string, string> = { 'content-type': r.type ?? 'text/html; charset=utf-8', ...(r.headers ?? {}) };
    let body: Buffer = Buffer.from(r.body);
    if (r.gzip) {
      body = zlib.gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(r.status ?? 200, headers);
    res.end(body);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

// Noms de test → IP publique de documentation (validée par resolvePublic) ; le transport se connecte au serveur local.
const resolver: Resolver = async (host) => {
  if (host.endsWith('.test')) return [{ address: '93.184.216.34', family: 4 }];
  if (host === 'interne.test6') return [{ address: 'fd00:ec2::254', family: 6 }];
  throw new Error('ENOTFOUND');
};
const toLocal: Transport = (req) => {
  const u = new URL(req.url.toString());
  const host = u.hostname;
  u.protocol = 'http:';
  u.hostname = '127.0.0.1';
  u.port = String(port);
  return nodeTransport({ ...req, url: u, address: { address: '127.0.0.1', family: 4 }, headers: { ...req.headers, host } });
};

let restore: () => void;
beforeAll(() => {
  restore = setFetchDeps({ resolver, transport: toLocal });
});
afterAll(() => restore());
beforeEach(() => resetRateLimit());

let ip = 0;
const post = (body: unknown) =>
  new Request('http://localhost/api/tools/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++ip % 250}` },
    body: JSON.stringify(body),
  });
type Out = { ok: boolean; data?: Record<string, unknown>; error?: string; code?: string };
const call = async (h: (r: Request) => Promise<Response>, body: unknown) => {
  const r = await h(post(body));
  return { status: r.status, body: (await r.json()) as Out };
};

describe('outils gratuits sur un serveur HTTP local', () => {
  it('bonne page : contrôles positifs, JSON-LD trouvé et valide, llms.txt proposé', async () => {
    const r = await call(readiness, { url: 'https://bonne-page.test/' });
    expect(r.status).toBe(200);
    const score = r.body.data!.score as number;
    expect(score).toBeGreaterThanOrEqual(60);
    const c = await call(citability, { url: 'https://bonne-page.test/' });
    expect(c.body.ok).toBe(true);
    expect(c.body.data!.score as number).toBeGreaterThan(40);
    const v = await call(jsonldValidate, { url: 'https://bonne-page.test/' });
    expect(JSON.stringify(v.body.data)).toMatch(/Plumber/);
    const l = await call(llms, { url: 'https://bonne-page.test/' });
    expect(String(l.body.data!.llmsTxt)).toContain('Plomberie Martin');
    const g = await call(jsonldGenerate, { type: 'FAQPage', fields: { questions: [{ q: 'Dimanche ?', a: 'Oui.' }] } });
    expect(g.status).toBeLessThan(500);
    const rv = await call(reviewLink, { name: 'Plomberie Martin', city: 'Lyon' });
    expect(rv.status).toBeLessThan(500);
  });

  it('SPA vide : le rendu sans JavaScript est signalé, score plus bas que la bonne page', async () => {
    const good = (await call(readiness, { url: 'https://bonne-page.test/' })).body.data!.score as number;
    const spa = await call(readiness, { url: 'https://spa-vide.test/' });
    expect(spa.body.ok).toBe(true);
    expect(spa.body.data!.score as number).toBeLessThan(good);
    const checks = spa.body.data!.checks as { id: string; status: string }[];
    expect(checks.some((x) => x.status === 'fail')).toBe(true);
  });

  it('robots bloquant : GPTBot et ClaudeBot bloqués, les autres non mentionnés ou autorisés', async () => {
    const r = await call(robots, { url: 'https://robots-bloquant.test/' });
    const bots = r.body.data!.bots as { token: string; status: string }[];
    const of = (t: string) => bots.find((b) => b.token.toLowerCase() === t)?.status;
    expect(of('gptbot')).toBe('blocked');
    expect(of('claudebot')).toBe('blocked');
    expect(bots.filter((b) => b.status === 'blocked').map((b) => b.token.toLowerCase()).sort()).toEqual(['claudebot', 'gptbot']);
  });

  it('fiche produit : Product/Offer/Review reconnus', async () => {
    const r = await call(product, { url: 'https://fiche-produit.test/produit' });
    expect(r.body.ok).toBe(true);
    expect(r.body.data!.score as number).toBeGreaterThanOrEqual(50);
    const cmp = await call(compare, { url: 'https://bonne-page.test/', competitorUrl: 'https://spa-vide.test/' });
    expect(Array.isArray(cmp.body.data!.rows)).toBe(true);
  });

  it('anti-SSRF : localhost, 169.254.169.254, IPv6 interne et redirections vers l’intérieur refusés', async () => {
    for (const url of ['http://localhost/', 'http://127.0.0.1:8080/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'https://interne.test6/']) {
      const r = await call(readiness, { url });
      expect(r.body.ok, url).toBe(false);
      expect(r.status, url).toBeLessThan(500);
    }
    const before = hits.length;
    for (const path of ['/', '/meta']) {
      const r = await call(readiness, { url: `https://redirige.test${path}` });
      expect(r.body.ok).toBe(false);
    }
    // seule la page qui redirige a été servie ; jamais la cible interne
    expect(hits.slice(before).every((h) => h.startsWith('redirige.test'))).toBe(true);
  });

  it('limites : débit par IP (429) et entrée invalide (400)', async () => {
    const bad = await call(readiness, { url: 'pas une url' });
    expect(bad.status).toBe(400);
    const fixed = () =>
      new Request('http://localhost/api/tools/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.250' }, body: JSON.stringify({ url: 'https://bonne-page.test/' }) });
    let last = 200;
    for (let i = 0; i < 40 && last !== 429; i++) last = (await robots(fixed())).status;
    expect(last).toBe(429);
  });
});
