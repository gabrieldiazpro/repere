/**
 * Détection de la plateforme d'un site (CMS, constructeur, boutique, cadriciel) à partir du HTML et des en-têtes
 * HTTP des pages lues. Pur, sans réseau. Sert à l'analyse pour adapter les conseils (« Sur Wix : … ») et à l'agent
 * pour savoir où il peut publier.
 *
 * Règle d'honnêteté : une signature forte (en-tête propre à la plateforme, `generator`, objet JavaScript propre)
 * donne `high` ; seulement des ressources hébergées chez la plateforme donnent `medium`. Rien n'est deviné au-delà.
 */
import type { PlatformId, PlatformInfo } from './types';

interface Sig {
  id: PlatformId;
  name: string;
  ecommerce?: boolean;
  /** signatures fortes (une suffit pour `high`) */
  strong: { re: RegExp; where: 'html' | 'headers'; label: string }[];
  /** signatures faibles (deux = `high`, une = `medium`) */
  weak: { re: RegExp; where: 'html' | 'headers'; label: string }[];
}

const SIGS: Sig[] = [
  {
    id: 'wix',
    name: 'Wix',
    strong: [
      { re: /<meta[^>]+name=["']generator["'][^>]+content=["']Wix\.com/i, where: 'html', label: 'meta generator Wix.com' },
      { re: /^x-wix-request-id:/m, where: 'headers', label: 'en-tête x-wix-request-id' },
    ],
    weak: [
      { re: /static\.(wixstatic|parastorage)\.com/i, where: 'html', label: 'ressources static.wixstatic.com / parastorage.com' },
      { re: /^server: pepyaka/im, where: 'headers', label: 'serveur Pepyaka (Wix)' },
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    ecommerce: true,
    strong: [
      { re: /^x-shopid:/m, where: 'headers', label: 'en-tête x-shopid' },
      { re: /^powered-by: shopify/im, where: 'headers', label: 'en-tête powered-by: Shopify' },
      { re: /Shopify\.(theme|shop)\s*=/, where: 'html', label: 'objet JavaScript Shopify.theme' },
    ],
    weak: [
      { re: /cdn\.shopify\.com|\/cdn\/shop\/(files|products)\//i, where: 'html', label: 'ressources cdn.shopify.com' },
      { re: /\.myshopify\.com/i, where: 'html', label: 'domaine myshopify.com' },
    ],
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    strong: [
      { re: /<!-- This is Squarespace\. -->/i, where: 'html', label: 'commentaire « This is Squarespace. »' },
      { re: /Static\.SQUARESPACE_CONTEXT/, where: 'html', label: 'objet Static.SQUARESPACE_CONTEXT' },
      { re: /^server: squarespace/im, where: 'headers', label: 'serveur Squarespace' },
    ],
    weak: [{ re: /static1\.squarespace\.com|images\.squarespace-cdn\.com/i, where: 'html', label: 'ressources squarespace.com' }],
  },
  {
    id: 'webflow',
    name: 'Webflow',
    strong: [
      { re: /<meta[^>]+content=["']Webflow["'][^>]+name=["']generator["']|<meta[^>]+name=["']generator["'][^>]+content=["']Webflow/i, where: 'html', label: 'meta generator Webflow' },
      { re: /<html[^>]+data-wf-(site|page)=/i, where: 'html', label: 'attributs data-wf-site / data-wf-page' },
    ],
    weak: [{ re: /(assets|cdn\.prod)\.website-files\.com|assets-global\.website-files\.com/i, where: 'html', label: 'ressources website-files.com' }],
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    ecommerce: true,
    strong: [
      { re: /var prestashop\s*=/, where: 'html', label: 'objet JavaScript prestashop' },
      { re: /<meta[^>]+name=["']generator["'][^>]+content=["']PrestaShop/i, where: 'html', label: 'meta generator PrestaShop' },
      { re: /^set-cookie: PrestaShop-/im, where: 'headers', label: 'cookie PrestaShop-…' },
    ],
    weak: [{ re: /\/modules\/ps_[a-z_]+\/|\/themes\/[a-z0-9_-]+\/assets\/(css|js)\/theme\./i, where: 'html', label: 'modules ps_* / thème PrestaShop' }],
  },
  {
    id: 'magento',
    name: 'Adobe Commerce (Magento)',
    ecommerce: true,
    strong: [{ re: /Mage\.Cookies|"Magento_[A-Za-z]+\/|\/static\/version\d+\/frontend\//, where: 'html', label: 'modules Magento' }],
    weak: [{ re: /^x-magento-/im, where: 'headers', label: 'en-tête x-magento' }],
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    strong: [
      { re: /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress/i, where: 'html', label: 'meta generator WordPress' },
      { re: /^link:.*rel="https:\/\/api\.w\.org\/"/im, where: 'headers', label: 'en-tête Link api.w.org' },
      { re: /<link[^>]+rel=["']https:\/\/api\.w\.org\/["']/i, where: 'html', label: 'lien api.w.org' },
    ],
    weak: [
      { re: /\/wp-content\/(themes|plugins|uploads)\//i, where: 'html', label: 'chemins /wp-content/' },
      { re: /\/wp-includes\//i, where: 'html', label: 'chemins /wp-includes/' },
    ],
  },
  {
    id: 'joomla',
    name: 'Joomla',
    strong: [{ re: /<meta[^>]+name=["']generator["'][^>]+content=["']Joomla/i, where: 'html', label: 'meta generator Joomla' }],
    weak: [{ re: /\/media\/(jui|system)\/js\//i, where: 'html', label: 'scripts /media/system/' }],
  },
  {
    id: 'drupal',
    name: 'Drupal',
    strong: [
      { re: /^x-generator: drupal/im, where: 'headers', label: 'en-tête x-generator Drupal' },
      { re: /<meta[^>]+name=["']generator["'][^>]+content=["']Drupal/i, where: 'html', label: 'meta generator Drupal' },
    ],
    weak: [{ re: /drupal-settings-json|\/sites\/default\/files\//i, where: 'html', label: 'drupalSettings / sites/default/files' }],
  },
  {
    id: 'jimdo',
    name: 'Jimdo',
    strong: [{ re: /<meta[^>]+name=["']generator["'][^>]+content=["']Jimdo/i, where: 'html', label: 'meta generator Jimdo' }],
    weak: [{ re: /jimcdn\.com|jimstatic\.com/i, where: 'html', label: 'ressources jimcdn.com / jimstatic.com' }],
  },
  {
    id: 'godaddy',
    name: 'GoDaddy (créateur de sites)',
    strong: [{ re: /<meta[^>]+name=["']generator["'][^>]+content=["']Starfield Technologies; Go Daddy Website Builder/i, where: 'html', label: 'meta generator GoDaddy' }],
    weak: [{ re: /img\d\.wsimg\.com/i, where: 'html', label: 'ressources wsimg.com' }],
  },
  {
    id: 'weebly',
    name: 'Weebly / Square Online',
    strong: [{ re: /_W\.configDomain|<meta[^>]+generator[^>]+Weebly/i, where: 'html', label: 'signature Weebly' }],
    weak: [{ re: /editmysite\.com|weeblycloud\.com/i, where: 'html', label: 'ressources editmysite.com' }],
  },
  {
    id: 'hostinger',
    name: 'Hostinger (créateur de sites)',
    strong: [{ re: /<meta[^>]+generator[^>]+Hostinger Website Builder/i, where: 'html', label: 'meta generator Hostinger' }],
    weak: [{ re: /zyrosite\.com|userapp\.zyrosite/i, where: 'html', label: 'ressources zyrosite.com' }],
  },
  {
    id: 'framer',
    name: 'Framer',
    strong: [{ re: /<meta[^>]+generator[^>]+Framer/i, where: 'html', label: 'meta generator Framer' }],
    weak: [{ re: /framerusercontent\.com/i, where: 'html', label: 'ressources framerusercontent.com' }],
  },
  {
    id: 'duda',
    name: 'Duda',
    strong: [{ re: /window\._dm_|dmAPI\b/, where: 'html', label: 'objet JavaScript Duda' }],
    weak: [{ re: /irp\.cdn-website\.com|lirp\.cdn-website\.com/i, where: 'html', label: 'ressources cdn-website.com' }],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    strong: [{ re: /<script[^>]+id=["']__NEXT_DATA__["']|self\.__next_f\.push/, where: 'html', label: 'données __NEXT_DATA__ / __next_f' }],
    weak: [
      { re: /\/_next\/static\//, where: 'html', label: 'scripts /_next/static/' },
      { re: /^x-powered-by: next\.js/im, where: 'headers', label: 'en-tête x-powered-by Next.js' },
    ],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    strong: [{ re: /window\.__NUXT__|<div[^>]+id=["']__nuxt["']/, where: 'html', label: 'objet __NUXT__' }],
    weak: [{ re: /\/_nuxt\//, where: 'html', label: 'scripts /_nuxt/' }],
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    strong: [{ re: /<div[^>]+id=["']___gatsby["']/, where: 'html', label: 'racine ___gatsby' }],
    weak: [{ re: /<meta[^>]+generator[^>]+Gatsby/i, where: 'html', label: 'meta generator Gatsby' }],
  },
];

/** Extensions utiles aux conseils, quand la plateforme est WordPress. */
const WP_PLUGINS: { re: RegExp; name: string; ecommerce?: boolean }[] = [
  { re: /<meta[^>]+generator[^>]+WooCommerce|\bwoocommerce\b/i, name: 'WooCommerce', ecommerce: true },
  { re: /This site is optimized with the Yoast SEO plugin|yoast-schema-graph/i, name: 'Yoast SEO' },
  { re: /Rank Math WordPress SEO plugin|rank-math-schema/i, name: 'Rank Math' },
  { re: /All in One SEO|aioseo/i, name: 'All in One SEO' },
  { re: /\/wp-content\/plugins\/elementor\//i, name: 'Elementor' },
  { re: /\/wp-content\/themes\/Divi\//i, name: 'Divi' },
];

function headerText(h: Record<string, string>): string {
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${String(v).replace(/\n/g, `\n${k}: `)}`)
    .join('\n');
}

/**
 * Plateforme la plus probable d'après jusqu'à 5 pages (la page d'accueil d'abord). null si rien de reconnu.
 * Les sites WordPress gardent la plateforme WordPress (WooCommerce va dans `plugins` et rend `ecommerce` vrai).
 */
export function detectPlatform(pages: { html?: string; headers?: Record<string, string> }[]): PlatformInfo | null {
  const sample = pages.slice(0, 5);
  const html = sample.map((p) => (p.html ?? '').slice(0, 400_000)).join('\n');
  const headers = sample.map((p) => headerText(p.headers ?? {})).join('\n');
  if (!html && !headers) return null;
  let best: { sig: Sig; score: number; evidence: string[] } | null = null;
  for (const sig of SIGS) {
    const evidence: string[] = [];
    let score = 0;
    for (const s of sig.strong)
      if (s.re.test(s.where === 'html' ? html : headers)) {
        score += 2;
        evidence.push(s.label);
      }
    for (const s of sig.weak)
      if (s.re.test(s.where === 'html' ? html : headers)) {
        score += 1;
        evidence.push(s.label);
      }
    if (score > 0 && (!best || score > best.score)) best = { sig, score, evidence };
  }
  if (!best) return null;
  const out: PlatformInfo = {
    id: best.sig.id,
    name: best.sig.name,
    confidence: best.score >= 2 ? 'high' : 'medium',
    evidence: best.evidence.slice(0, 4),
    ...(best.sig.ecommerce ? { ecommerce: true } : {}),
  };
  if (best.sig.id === 'wordpress') {
    const plugins = WP_PLUGINS.filter((p) => p.re.test(html));
    if (plugins.length) out.plugins = plugins.map((p) => p.name);
    if (plugins.some((p) => p.ecommerce)) out.ecommerce = true;
  }
  return out;
}
