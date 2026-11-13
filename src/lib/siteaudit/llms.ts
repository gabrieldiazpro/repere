/**
 * Générateur de llms.txt, honnête : fichier proposé à partir du sitemap (titres et meta des pages principales),
 * validation d'un llms.txt existant, et mention claire de son utilité réelle.
 */
import { normalizeInputUrl, safeFetch, tryFetch, type SafeFetchOptions } from './fetch';
import { parseHtml, sameSite } from './html';
import { findLlmsTxt } from './readiness';
import { analyzeRobots } from './robotsAudit';

export const LLMS_HONEST = {
  title: 'Ce que ça change vraiment',
  points: [
    'Google a déclaré ne pas utiliser llms.txt pour la recherche.',
    'Certains assistants et agents de développement le liraient, sans engagement public clair des principaux opérateurs à en tenir compte.',
    'Aucun effet démontré sur les citations à ce jour : ne comptez pas dessus pour être cité.',
    'Il ne contrôle pas l’entraînement : c’est le rôle du robots.txt.',
  ],
  verdict: 'Facultatif et peu coûteux. Vos pages lisibles sans JavaScript, vos données structurées et votre robots.txt comptent bien davantage.',
};

export const LLMS_INSTRUCTIONS = [
  'Racine du site : déposez le fichier à l’adresse https://votre-site.fr/llms.txt (texte brut, UTF-8).',
  'WordPress : extension de gestion de fichiers ou client FTP, dans le dossier racine (à côté de wp-config.php).',
  'Shopify : la racine n’est pas modifiable directement ; une redirection d’URL de /llms.txt vers un fichier hébergé dans « Contenu > Fichiers » est la voie la plus simple.',
];

export interface LlmsPage {
  url: string;
  title: string;
  description?: string;
}

export interface LlmsResult {
  url: string;
  llmsTxt: string;
  pages: LlmsPage[];
  sitemapUrl: string | null;
  existing: { found: boolean; url: string; issues: string[] } ;
  honest: typeof LLMS_HONEST;
  instructions: string[];
}

const SECTION_NAMES: Record<string, string> = {
  '': 'Pages principales', blog: 'Articles', actualites: 'Actualités', news: 'Actualités', guides: 'Guides', guide: 'Guides',
  services: 'Services', service: 'Services', prestations: 'Prestations', produits: 'Produits', products: 'Produits', produit: 'Produits',
  collections: 'Collections', boutique: 'Boutique', shop: 'Boutique', tarifs: 'Tarifs', faq: 'Questions fréquentes', aide: 'Aide',
  contact: 'Contact', 'a-propos': 'À propos', about: 'À propos', docs: 'Documentation', pages: 'Pages',
};

const titleFromSlug = (u: string) => {
  const seg = new URL(u).pathname.split('/').filter(Boolean).pop() ?? '';
  const t = decodeURIComponent(seg).replace(/\.(html?|php)$/, '').replace(/[-_]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Accueil';
};
const oneLine = (s: string) => s.replace(/\s+/g, ' ').replace(/[\[\]]/g, '').trim();

/** Construit le fichier (pur). */
export function buildLlmsTxt(site: { name: string; summary?: string; details?: string }, pages: LlmsPage[]): string {
  const groups = new Map<string, LlmsPage[]>();
  for (const p of pages) {
    const seg = new URL(p.url).pathname.split('/').filter(Boolean);
    const key = seg.length > 1 ? seg[0].toLowerCase() : '';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const lines = [`# ${oneLine(site.name)}`, ''];
  if (site.summary) lines.push(`> ${oneLine(site.summary)}`, '');
  if (site.details) lines.push(oneLine(site.details), '');
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0)));
  for (const k of keys) {
    const name = SECTION_NAMES[k] ?? (k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' '));
    lines.push(`## ${name}`, '');
    for (const p of groups.get(k) ?? []) lines.push(`- [${oneLine(p.title)}](${p.url})${p.description ? `: ${oneLine(p.description).slice(0, 200)}` : ''}`);
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

/** Vérifie la forme d'un llms.txt (proposition llmstxt.org) : titre H1, résumé, listes de liens. */
export function validateLlmsTxt(text: string): string[] {
  const issues: string[] = [];
  const lines = text.split(/\r?\n/);
  const first = lines.find((l) => l.trim());
  if (!first || !/^#\s+\S/.test(first)) issues.push('La première ligne doit être un titre « # Nom du site ».');
  if (!lines.some((l) => /^>\s+\S/.test(l))) issues.push('Pas de résumé en citation (« > Une phrase qui décrit le site »).');
  const links = lines.filter((l) => /^\s*-\s*\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(l));
  if (!links.length) issues.push('Aucun lien au format « - [Titre](https://…): description ».');
  if ((text.match(/^#\s/gm) ?? []).length > 1) issues.push('Plusieurs titres de niveau 1 : un seul est attendu.');
  if (/<html|<!doctype/i.test(text)) issues.push('Le fichier contient du HTML : il doit être en texte brut (Markdown).');
  return issues;
}

/** Adresses <loc> d'un sitemap (suit un index de sitemaps sur un niveau). */
export async function sitemapUrls(sitemapUrl: string, opts: SafeFetchOptions = {}, limit = 200): Promise<string[]> {
  const r = await tryFetch(sitemapUrl, { ...opts, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
  if (!r || r.status >= 300) return [];
  const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex\b/i.test(r.body)) {
    const child = locs.find((l) => /page|post|product|produit|collection/i.test(l)) ?? locs[0];
    if (!child) return [];
    const r2 = await tryFetch(child, { ...opts, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
    return r2 ? [...r2.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&')).slice(0, limit) : [];
  }
  return locs.slice(0, limit);
}

/** Choisit les pages principales : peu profondes d'abord, sans pages techniques. */
export function pickPages(urls: string[], site: string, max = 25): string[] {
  const bad = /\/(tag|tags|author|auteur|page\/\d+|wp-|feed|cart|panier|checkout|compte|account|login|search|recherche|cgv|mentions|cookies|politique|privacy)\b|\?|\.(jpg|png|pdf|xml)$/i;
  const ok = [...new Set(urls)].filter((u) => {
    try {
      return sameSite(u, site) && !bad.test(new URL(u).pathname + new URL(u).search);
    } catch {
      return false;
    }
  });
  const depth = (u: string) => new URL(u).pathname.split('/').filter(Boolean).length;
  return ok.sort((a, b) => depth(a) - depth(b) || a.length - b.length).slice(0, max);
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

/** Propose un llms.txt pour un site. */
export async function generateLlms(input: string, opts: SafeFetchOptions & { maxPages?: number } = {}): Promise<LlmsResult> {
  const u = normalizeInputUrl(input);
  const home = await safeFetch(new URL('/', u.origin), opts);
  const origin = new URL(home.finalUrl).origin;
  const hp = parseHtml(home.body);
  const name = hp.og['og:site_name'] || hp.title.split(/\s[|–—-]\s/)[0].trim() || new URL(origin).hostname;
  const [robots, existing] = await Promise.all([analyzeRobots(origin, opts).catch(() => null), findLlmsTxt(origin, opts)]);
  const declared = (robots?.sitemaps ?? []).filter((s) => sameSite(s, origin));
  let sitemapUrl: string | null = null;
  let urls: string[] = [];
  for (const c of [...new Set([...declared.slice(0, 2), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])]) {
    urls = await sitemapUrls(c, opts);
    if (urls.length) {
      sitemapUrl = c;
      break;
    }
  }
  if (!urls.length) {
    // Sans sitemap : liens internes de la page d'accueil.
    urls = hp.links.map((l) => { try { return new URL(l.href, origin).toString().replace(/#.*$/, ''); } catch { return ''; } }).filter(Boolean);
  }
  const chosen = pickPages([origin + '/', ...urls], origin, Math.min(opts.maxPages ?? 25, 40));
  const detailed = new Set(chosen.slice(0, 12));
  const pages = await pool(chosen, 4, async (url): Promise<LlmsPage> => {
    if (url.replace(/\/$/, '') === origin) return { url, title: name, description: hp.metaDescription ?? undefined };
    if (!detailed.has(url)) return { url, title: titleFromSlug(url) };
    const r = await tryFetch(url, opts);
    if (!r || r.status >= 300) return { url, title: titleFromSlug(url) };
    const p = parseHtml(r.body);
    return { url, title: (p.title.split(/\s[|–—-]\s/)[0] || titleFromSlug(url)).slice(0, 120), description: p.metaDescription ?? undefined };
  });
  return {
    url: origin,
    llmsTxt: buildLlmsTxt({ name, summary: hp.metaDescription ?? undefined }, pages),
    pages,
    sitemapUrl,
    existing: { found: existing.found, url: existing.url, issues: existing.body ? validateLlmsTxt(existing.body) : [] },
    honest: LLMS_HONEST,
    instructions: LLMS_INSTRUCTIONS,
  };
}
