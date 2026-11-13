/**
 * Faux site local (node:http) pour les tests de bout en bout de l'analyse 60 s.
 * Le résolveur rend une IP publique de documentation pour les noms *.test ; le transport se connecte au serveur
 * local. L'anti-SSRF reste actif pour tout le reste (127.0.0.1, 169.254.169.254…).
 */
import http from 'node:http';
import { nodeTransport, setFetchDeps, type Resolver, type Transport } from '@/lib/siteaudit/fetch';

const HOME = `<!doctype html><html lang="fr"><head><title>Boulangerie Dupont | Boulanger à Lyon 3e</title>
<meta name="description" content="Pain au levain, viennoiseries et pâtisseries maison à Lyon 3e.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Bakery","name":"Boulangerie Dupont","telephone":"+33478000001","address":{"@type":"PostalAddress","streetAddress":"5 rue Exemple","addressLocality":"Lyon","postalCode":"69003"}}</script>
</head><body><main><h1>Boulangerie artisanale à Lyon 3e</h1>
<p>${'Pain au levain naturel, baguettes tradition et viennoiseries pur beurre, cuits chaque matin. '.repeat(12)}</p>
<a href="/pains">Nos pains</a> <a href="/patisseries">Pâtisseries</a> <a href="/contact">Contact</a> <a href="/ancienne-page">Ancienne page</a>
<img src="/vitrine.jpg"></main></body></html>`;
const page = (title: string | null, h1: string, words = 80) =>
  `<!doctype html><html lang="fr"><head>${title ? `<title>${title}</title>` : ''}</head><body><main><h1>${h1}</h1><p>${'Texte utile sur la boulangerie. '.repeat(words / 5)}</p><a href="/">Accueil</a></main></body></html>`;

export const SITE_HOST = 'boulangerie-dupont.test';
const ROUTES: Record<string, { status?: number; body: string; type?: string; delayMs?: number }> = {
  '/': { body: HOME },
  '/pains': { body: page('Nos pains – Boulangerie Dupont', 'Nos pains') },
  '/patisseries': { body: page('Nos pains – Boulangerie Dupont', 'Pâtisseries') }, // titre en double
  '/contact': { body: page(null, 'Contact', 30) }, // sans titre, contenu court
  '/robots.txt': { body: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://boulangerie-dupont.test/sitemap.xml\n', type: 'text/plain' },
  '/sitemap.xml': {
    type: 'application/xml',
    body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/pains', '/patisseries', '/contact'].map((p) => `<url><loc>https://boulangerie-dupont.test${p}</loc></url>`).join('')}</urlset>`,
  },
};

export interface FakeSite {
  port: number;
  hits: string[];
  close(): Promise<void>;
}

export async function startFakeSite(): Promise<FakeSite> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    const host = String(req.headers.host ?? '').split(':')[0];
    const path = (req.url ?? '/').split('?')[0];
    hits.push(`${host}${path}`);
    const r = host.endsWith('.test') ? ROUTES[path] : undefined;
    if (!r) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<html><head><title>Introuvable</title></head><body><h1>404</h1></body></html>');
      return;
    }
    res.writeHead(r.status ?? 200, { 'content-type': r.type ?? 'text/html; charset=utf-8' });
    res.end(r.body);
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
    close: () =>
      new Promise<void>((ok) => {
        restore();
        server.close(() => ok());
      }),
  };
}

/** Aucune clé d'IA dans les tests : contrôle IA en démonstration, aucun appel réseau sortant. */
export function clearAiKeys(): void {
  for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'AUDIT_PROVIDERS', 'PAGESPEED_API_KEY', 'CRUX_API_KEY']) delete process.env[k];
}
