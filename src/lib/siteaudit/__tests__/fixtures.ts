/** Pages et robots.txt d'exemple + faux réseau (aucune sortie sur Internet pendant les tests). */
import type { ResolvedAddress, Resolver, Transport, TransportRequest } from '../fetch';

export interface FakeResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Attendre l'abandon (simule un site qui ne répond pas). */
  hang?: boolean;
}

export function fakeNet(routes: Record<string, FakeResponse>, dns: Record<string, string | string[]> = {}) {
  const calls: TransportRequest[] = [];
  const resolver: Resolver = async (host) => {
    const v = dns[host] ?? '93.184.216.34';
    return (Array.isArray(v) ? v : [v]).map((address): ResolvedAddress => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
  const transport: Transport = async (req) => {
    calls.push(req);
    const r = routes[req.url.toString()];
    if (r?.hang)
      return new Promise((_, rej) => req.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    if (!r) return { status: 404, headers: { 'content-type': 'text/html' }, body: Buffer.from('<html><body>Introuvable</body></html>'), truncated: false };
    const body = Buffer.from(r.body ?? '');
    return { status: r.status ?? 200, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers ?? {}) }, body: body.subarray(0, req.maxBytes), truncated: body.length > req.maxBytes };
  };
  return { resolver, transport, calls };
}

const para = (n: number, s: string) => Array.from({ length: n }, () => s).join(' ');

export const GOOD_PAGE = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>Plombier à Lyon 3 : dépannage en 2 h | Plomberie Exemple</title>
<meta name="description" content="Plomberie Exemple, plombier chauffagiste à Lyon 3 depuis 2009 : dépannage en 2 heures, devis gratuit, intervention 7 jours sur 7 dans tout le Rhône.">
<link rel="canonical" href="https://plomberie-exemple.fr/">
<meta property="og:title" content="Plomberie Exemple"><meta property="og:description" content="Plombier à Lyon 3"><meta property="og:image" content="https://plomberie-exemple.fr/og.jpg">
<meta property="og:site_name" content="Plomberie Exemple">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Plomberie Exemple","url":"https://plomberie-exemple.fr","telephone":"+33 4 78 00 00 00","address":{"@type":"PostalAddress","streetAddress":"12 rue Exemple","postalCode":"69003","addressLocality":"Lyon","addressCountry":"FR"},"openingHours":"Mo-Fr 08:00-19:00","image":"https://plomberie-exemple.fr/logo.png","geo":{"@type":"GeoCoordinates","latitude":45.76,"longitude":4.85},"priceRange":"€€","sameAs":["https://www.facebook.com/exemple"]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Combien coûte un dépannage de plomberie à Lyon ?","acceptedAnswer":{"@type":"Answer","text":"Le déplacement coûte 49 € et la main-d'œuvre 60 € de l'heure."}}]}</script>
</head><body>
<header><nav><a href="/">Accueil</a><a href="/tarifs">Tarifs</a><a href="/contact">Contact</a></nav></header>
<main>
<h1>Plombier chauffagiste à Lyon 3</h1>
<p>Plomberie Exemple est une entreprise de plomberie installée à Lyon 3 depuis 2009, qui intervient en 2 heures pour les fuites, les chauffe-eau et les débouchages.</p>
<p>Mis à jour le 3 novembre 2026, par Jean Martin, artisan plombier.</p>
<h2>Combien coûte un dépannage de plomberie à Lyon ?</h2>
<p>Le déplacement coûte 49 € et la main-d'œuvre 60 € de l'heure, selon notre grille publiée. Le taux de TVA réduit de 10 % s'applique aux logements de plus de 2 ans, selon <a href="https://www.service-public.fr/particuliers/vosdroits/F23180">Service-Public.fr</a>.</p>
<h2>Quel délai d'intervention ?</h2>
<p>Nous intervenons en 2 heures en moyenne dans Lyon et Villeurbanne, 7 jours sur 7. ${para(3, 'Chaque intervention commence par un diagnostic gratuit et un devis écrit avant travaux.')}</p>
<h2>Quelles zones couvrez-vous ?</h2>
<ul><li>Lyon 3 et Lyon 7</li><li>Villeurbanne</li><li>Bron et Vénissieux</li></ul>
<table><tr><th>Prestation</th><th>Prix</th></tr><tr><td>Déplacement</td><td>49 €</td></tr><tr><td>Heure</td><td>60 €</td></tr></table>
<h2>Questions fréquentes</h2>
<details><summary>Faites-vous les chaudières ?</summary><p>Oui, l'entretien annuel des chaudières gaz Saunier Duval et Viessmann est assuré par Plomberie Exemple.</p></details>
<details><summary>Le devis est-il gratuit ?</summary><p>Oui, le devis est gratuit et sans engagement.</p></details>
<p>${para(8, 'Nos plombiers certifiés RGE Qualibat travaillent avec des pièces garanties 2 ans par le fabricant, conformément aux normes de l’ADEME.')}</p>
<p>Source des normes : <a href="https://www.ademe.fr/">ADEME</a>. Voir nos <a href="/tarifs">tarifs</a> et notre <a href="/zones">zone</a>.</p>
<p>Téléphone : 04 78 00 00 00 — 12 rue Exemple, 69003 Lyon.</p>
</main>
<footer>© Plomberie Exemple</footer>
</body></html>`;

export const BAD_PAGE = `<html><head><title>Accueil</title></head><body>
<div class="hero"><p>Bienvenue sur notre site ! Découvrez notre savoir-faire et notre passion depuis toujours. Il est important pour nous de vous satisfaire.</p></div>
<div><p>${para(12, 'Nous faisons beaucoup de choses très bien pour vous et ils sont toujours contents de notre travail que nous réalisons avec soin et amour du métier.')}</p></div>
</body></html>`;

export const SPA_PAGE = `<!doctype html><html lang="fr"><head><title>Ma boutique</title><meta name="description" content="Boutique en ligne"><script src="/static/js/main.abc123def.js"></script></head>
<body><noscript>Vous devez activer JavaScript pour utiliser cette application.</noscript><div id="root"></div></body></html>`;

export const PRODUCT_FULL = `<!doctype html><html lang="fr"><head><title>Théière en fonte 1,2 L – Maison Exemple</title>
<meta name="description" content="Théière en fonte émaillée de 1,2 litre, fabriquée au Japon.">
<meta property="og:type" content="product"><meta property="product:price:amount" content="89.00"><meta property="product:price:currency" content="EUR">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Théière en fonte 1,2 L","image":["https://maison-exemple.fr/a.jpg","https://maison-exemple.fr/b.jpg"],"description":"Théière en fonte émaillée de 1,2 litre fabriquée à Morioka au Japon, compatible avec toutes les plaques sauf induction, livrée avec un filtre inox amovible. Elle garde le thé chaud pendant 40 minutes et convient à 4 tasses. Entretien : rinçage à l'eau chaude, sans savon, séchage immédiat sur feu doux.","brand":{"@type":"Brand","name":"Maison Exemple"},"sku":"TH-12","gtin13":"3760000000017","offers":{"@type":"Offer","price":"89.00","priceCurrency":"EUR","availability":"https://schema.org/InStock","shippingDetails":{"@type":"OfferShippingDetails"},"hasMerchantReturnPolicy":{"@type":"MerchantReturnPolicy"}},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.7","reviewCount":"38"},"review":[{"@type":"Review","author":{"@type":"Person","name":"Claire"},"reviewRating":{"@type":"Rating","ratingValue":"5"},"reviewBody":"Superbe."}]}</script>
</head><body><main><h1>Théière en fonte 1,2 L</h1><p>Prix : 89,00 €</p><p>Livraison en 48 h, retours gratuits sous 30 jours.</p></main></body></html>`;

export const PRODUCT_POOR = `<!doctype html><html lang="fr"><head><title>Théière</title>
<meta property="og:type" content="product"><meta property="og:title" content="Théière"><meta property="product:price:amount" content="79.00">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Théière","offers":{"@type":"Offer","price":"89.00"}}</script>
</head><body><h1>Théière</h1><p>Belle théière.</p></body></html>`;

export const ROBOTS_BLOCK_SEARCH = `User-agent: OAI-SearchBot
Disallow: /

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: *
Disallow: /admin/
Allow: /

Sitemap: https://plomberie-exemple.fr/sitemap.xml
`;

export const ROBOTS_OPEN = `User-agent: *
Disallow: /panier
Sitemap: https://plomberie-exemple.fr/sitemap.xml
`;

export const SITEMAP = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://plomberie-exemple.fr/</loc></url>
<url><loc>https://plomberie-exemple.fr/tarifs</loc></url>
<url><loc>https://plomberie-exemple.fr/services/debouchage</loc></url>
<url><loc>https://plomberie-exemple.fr/services/chauffe-eau</loc></url>
<url><loc>https://plomberie-exemple.fr/blog/fuite-eau</loc></url>
<url><loc>https://plomberie-exemple.fr/panier</loc></url>
</urlset>`;
