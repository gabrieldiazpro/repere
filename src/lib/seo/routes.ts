/**
 * Routes publiques ajoutées par la V3 (sitemap.xml et llms.txt). Règle : on ne liste JAMAIS une page absente ou en noindex.
 *
 * - `pageExists(path)` vérifie avec fs qu'un dossier `src/app/<chemin>` contient une page (page.tsx|ts|jsx|js|mdx).
 *   Si les sources ne sont pas lisibles (exécution serverless sans le dossier src), on considère que la page existe :
 *   le build a déjà compilé uniquement des pages réelles, et le sitemap généré à la compilation a fait foi.
 * - `isNoindexSource(path)` repère un `noindex: true` ou `index: false` écrit en dur dans la page.
 * - Les familles à paramètre (/outils/[slug], /fonctionnalites/[slug]) lisent le registre de leur agent ; /cas-usage/*
 *   est découvert par les dossiers littéraux tant qu'aucun registre n'existe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { COMPETITORS, competitorPath } from './competitors';
import { TOOLS } from '@/components/tools/registry';
import { FEATURES } from '@/components/pages/features-data';
import { USE_CASES, casUsagePath } from '@/components/pages/cas-usage-data';
import { HELP_ARTICLES, helpPath } from '@/components/pages/aide-data';

export const NEW_ROUTES_UPDATED = '2026-11-09';

export interface RouteEntry {
  path: string;
  label: string;
  note?: string;
  section: 'produit' | 'aide' | 'outils' | 'fonctionnalites' | 'cas-usage' | 'ressources' | 'communaute' | 'reference';
}

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'page.mdx'];

function appDir(): string | null {
  const dir = path.join(process.cwd(), 'src', 'app');
  try {
    return fs.statSync(dir).isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

/** Vrai si la page existe (ou si les sources ne sont pas lisibles : voir l'en-tête). */
export function pageExists(routePath: string, root: string | null = appDir()): boolean {
  if (!root) return true;
  const dir = path.join(root, routePath.replace(/^\//, ''));
  return PAGE_FILES.some((f) => fs.existsSync(path.join(dir, f)));
}

/** Vrai si le fichier de la page déclare un noindex en dur. */
export function isNoindexSource(routePath: string, root: string | null = appDir()): boolean {
  if (!root) return false;
  const dir = path.join(root, routePath.replace(/^\//, ''));
  for (const f of PAGE_FILES) {
    const file = path.join(dir, f);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    return /noindex:\s*true/.test(src) || /index:\s*false/.test(src);
  }
  return false;
}

/** Dossiers littéraux (sans crochets) d'une famille qui contiennent une page. */
export function literalChildren(parent: string, root: string | null = appDir()): string[] {
  if (!root) return [];
  const dir = path.join(root, parent.replace(/^\//, ''));
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[[(_@]/.test(d.name) && PAGE_FILES.some((f) => fs.existsSync(path.join(dir, d.name, f))))
      .map((d) => `${parent}/${d.name}`)
      .sort();
  } catch {
    return [];
  }
}

/** Pages sans paramètre, dans l'ordre d'affichage. Les pages dynamiques ou conditionnelles sont traitées à part. */
const STATIC_CANDIDATES: RouteEntry[] = [
  { path: '/analyse', label: 'Analyse SEO et IA gratuite du site', note: 'exploration réelle, audit SEO et GEO, 5 priorités, en 60 secondes', section: 'produit' },
  { path: '/demo', label: 'Démo guidée', note: 'le produit en vidéo et en démo interactive, sur trois comptes d’exemple', section: 'produit' },
  { path: '/nouveautes', label: 'Nouveautés', note: 'journal des évolutions du produit', section: 'produit' },
  { path: '/securite', label: 'Sécurité et données', note: 'hébergement, accès, sous-traitants, conservation', section: 'produit' },
  { path: '/integrations', label: 'Intégrations', note: 'Google Analytics 4, Shopify, Slack, webhook, exports', section: 'produit' },
  { path: '/aide', label: 'Centre d’aide', section: 'produit' },
  { path: '/contact', label: 'Contact', section: 'produit' },
  { path: '/inscription', label: 'Créer un compte gratuit (offre Découverte)', note: '1 marque, 5 questions suivies, 1 mesure par mois, 3 IA', section: 'produit' },
  { path: '/badge', label: 'Badge « Visibilité IA mesurée »', note: 'badge daté, avec sa mention de limites', section: 'communaute' },
  { path: '/parrainage', label: 'Parrainage', section: 'communaute' },
  { path: '/methode/robot', label: 'RepereBot, notre robot', note: 'user agent, ce qu’il lit, comment le bloquer', section: 'reference' },
];

/** Hubs de familles : listés seulement si la page existe. */
const HUBS: RouteEntry[] = [
  { path: '/outils', label: 'Outils gratuits', note: 'audit de page, robots.txt, JSON-LD, llms.txt, fiche produit, lien d’avis', section: 'outils' },
  { path: '/fonctionnalites', label: 'Fonctionnalités', note: 'mesurer, comprendre, agir, prouver', section: 'fonctionnalites' },
  { path: '/cas-usage', label: 'Cas d’usage par métier', section: 'cas-usage' },
];

/** Toutes les pages V3 à lister, existantes et indexables. */
export function v3Routes(root: string | null = appDir()): RouteEntry[] {
  const ok = (p: string) => pageExists(p, root) && !isNoindexSource(p, root);
  const out: RouteEntry[] = [];

  for (const r of STATIC_CANDIDATES) if (ok(r.path)) out.push(r);
  for (const r of HUBS) if (ok(r.path)) out.push(r);

  // /outils/[slug] : registre de l'agent OUTILS (si la page dynamique existe).
  if (pageExists('/outils/[slug]', root)) {
    for (const t of TOOLS) out.push({ path: `/outils/${t.slug}`, label: t.name, note: t.description, section: 'outils' });
  } else {
    for (const p of literalChildren('/outils', root)) out.push({ path: p, label: p.split('/').pop()!, section: 'outils' });
  }

  // /fonctionnalites/[slug] : registre de l'agent PAGES-SITE.
  if (pageExists('/fonctionnalites/[slug]', root)) {
    for (const f of FEATURES) out.push({ path: `/fonctionnalites/${f.slug}`, label: f.name, note: f.summary, section: 'fonctionnalites' });
  } else {
    for (const p of literalChildren('/fonctionnalites', root)) out.push({ path: p, label: p.split('/').pop()!, section: 'fonctionnalites' });
  }

  // /cas-usage/[metier] : registre PAGES-SITE (dossiers littéraux en repli si la page dynamique n'existe pas).
  if (pageExists('/cas-usage/[metier]', root)) {
    for (const u of USE_CASES) out.push({ path: casUsagePath(u.slug), label: u.name, note: u.description, section: 'cas-usage' });
  } else {
    for (const p of literalChildren('/cas-usage', root)) if (!isNoindexSource(p, root)) out.push({ path: p, label: p.split('/').pop()!, section: 'cas-usage' });
  }

  // /aide/[slug] : articles du centre d'aide.
  if (pageExists('/aide', root) && pageExists('/aide/[slug]', root)) {
    for (const a of HELP_ARTICLES) out.push({ path: helpPath(a.slug), label: a.title, note: a.summary, section: 'aide' });
  }

  // /comparatif/[concurrent] : registre de ce module.
  for (const c of COMPETITORS) out.push({ path: competitorPath(c), label: `Repéré ou ${c.name}`, section: 'reference' });

  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
}
