/**
 * Lecture des sitemaps : index imbriqués, fichiers gzip, plafonds (fichiers, profondeur, URL).
 */
import { decodeBody, maybeGunzip, type CrawlFetcher } from './fetcher';
import { decodeEntities } from '@/lib/siteaudit/html';

export const MAX_SITEMAP_FILES = 30;
export const MAX_SITEMAP_DEPTH = 3;
export const MAX_SITEMAP_URLS = 10_000;

export interface ParsedSitemap {
  kind: 'index' | 'urlset' | 'text' | 'unknown';
  locs: string[];
}

/** Analyse un sitemap XML (urlset ou sitemapindex) ou texte (une URL par ligne). */
export function parseSitemap(text: string): ParsedSitemap {
  const t = text.replace(/^﻿/, '').trim();
  const locs = (re: RegExp) => [...t.matchAll(re)].map((m) => decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim()).filter(Boolean);
  if (/<sitemapindex\b/i.test(t)) return { kind: 'index', locs: locs(/<sitemap\b[^>]*>[\s\S]*?<loc\b[^>]*>([\s\S]*?)<\/loc>/gi) };
  if (/<urlset\b/i.test(t)) return { kind: 'urlset', locs: locs(/<url\b[^>]*>[\s\S]*?<loc\b[^>]*>([\s\S]*?)<\/loc>/gi) };
  if (!t.startsWith('<')) {
    const lines = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l));
    if (lines.length) return { kind: 'text', locs: lines };
  }
  return { kind: 'unknown', locs: [] };
}

export interface SitemapResult {
  sitemaps: { url: string; status: number; urlCount: number; errors: string[] }[];
  urls: string[];
}

/**
 * Lit les sitemaps déclarés (ou /sitemap.xml et /sitemap_index.xml à défaut), en largeur.
 * `keep` filtre les URL retenues (même site). Plafonds : 30 fichiers, profondeur 3, 10 000 URL.
 */
export async function readSitemaps(
  fetcher: CrawlFetcher,
  declared: string[],
  origin: string,
  keep: (url: string) => boolean,
  isOver: () => boolean,
): Promise<SitemapResult> {
  const fallback = declared.length === 0;
  const queue: { url: string; depth: number }[] = (fallback ? [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`] : declared).map((url) => ({ url, depth: 0 }));
  const seen = new Set<string>();
  const out: SitemapResult = { sitemaps: [], urls: [] };
  const urlSet = new Set<string>();
  let foundOne = false;
  while (queue.length && out.sitemaps.length < MAX_SITEMAP_FILES && urlSet.size < MAX_SITEMAP_URLS && !isOver()) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    // En repli, /sitemap_index.xml n'est essayé que si /sitemap.xml n'a rien donné.
    if (fallback && foundOne && url.endsWith('/sitemap_index.xml') && depth === 0) continue;
    const errors: string[] = [];
    const r = await fetcher.fetch(url, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5', maxBytes: 2 * 1024 * 1024 });
    if (r.error) {
      // Un sitemap de repli absent n'est pas une erreur du site.
      if (!fallback || r.status) out.sitemaps.push({ url, status: r.status, urlCount: 0, errors: [r.error] });
      continue;
    }
    if (r.status < 200 || r.status >= 300) {
      if (!fallback) out.sitemaps.push({ url, status: r.status, urlCount: 0, errors: [`Réponse HTTP ${r.status}.`] });
      continue;
    }
    let text: string;
    try {
      text = decodeBody(maybeGunzip(r.body), r.headers['content-type']);
    } catch {
      out.sitemaps.push({ url, status: r.status, urlCount: 0, errors: ['Fichier gzip illisible.'] });
      continue;
    }
    if (r.truncated) errors.push('Fichier tronqué (plus de 2 Mo) : seules les premières entrées sont lues.');
    const parsed = parseSitemap(text);
    if (parsed.kind === 'unknown') {
      if (!fallback) out.sitemaps.push({ url, status: r.status, urlCount: 0, errors: [...errors, 'Ce fichier n’est pas un sitemap valide (ni urlset, ni sitemapindex).'] });
      continue;
    }
    foundOne = true;
    if (parsed.kind === 'index') {
      if (depth + 1 > MAX_SITEMAP_DEPTH) errors.push('Index de sitemaps trop imbriqué : niveaux suivants ignorés.');
      else for (const loc of parsed.locs) queue.push({ url: loc, depth: depth + 1 });
      out.sitemaps.push({ url, status: r.status, urlCount: parsed.locs.length, errors });
      continue;
    }
    let outside = 0;
    for (const loc of parsed.locs) {
      if (!keep(loc)) {
        outside++;
        continue;
      }
      if (urlSet.size >= MAX_SITEMAP_URLS) {
        errors.push(`Plafond de ${MAX_SITEMAP_URLS} URL atteint.`);
        break;
      }
      urlSet.add(loc);
    }
    if (outside) errors.push(`${outside} URL hors du site ignorées.`);
    if (parsed.locs.length > 50_000) errors.push('Plus de 50 000 URL dans un seul fichier (limite du protocole).');
    out.sitemaps.push({ url, status: r.status, urlCount: parsed.locs.length, errors });
  }
  out.urls = [...urlSet];
  return out;
}
