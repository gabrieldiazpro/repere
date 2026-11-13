import type { AuditCtx, CrawledPage, Hit } from '../types';
import { norm } from '../util';

/** Hit de niveau page, ou null si aucune page concernée. */
export function hitPages(pages: CrawledPage[], detail?: (p: CrawledPage) => string | undefined, extra: Partial<Hit> = {}): Hit | null {
  if (!pages.length) return null;
  return { items: pages.map((p) => ({ url: p.finalUrl || p.url, detail: detail?.(p) })), ...extra };
}

export function hitItems(items: { url: string; detail?: string }[], extra: Partial<Hit> = {}): Hit | null {
  if (!items.length) return null;
  return { items, ...extra };
}

/** Hit de niveau site (un seul élément). */
export function hitSite(ctx: AuditCtx, detail?: string, extra: Partial<Hit> = {}): Hit {
  return { items: [{ url: ctx.home?.finalUrl ?? `${ctx.origin}/`, detail }], ...extra };
}

/** Page crawlée correspondant à une URL (url demandée ou finale). */
export function pageAt(ctx: AuditCtx, url: string): CrawledPage | undefined {
  const n = norm(url);
  return n ? ctx.byUrl.get(n) : undefined;
}

export function inlinkCount(ctx: AuditCtx, p: CrawledPage): number {
  const a = norm(p.url);
  const b = norm(p.finalUrl);
  const seen = new Set<string>();
  for (const k of [a, b]) if (k) for (const l of ctx.inlinks.get(k) ?? []) if (norm(l.from) !== b) seen.add(l.from);
  return seen.size;
}

export function inSitemap(ctx: AuditCtx, p: CrawledPage): boolean {
  const a = norm(p.url);
  const b = norm(p.finalUrl);
  return (!!a && ctx.sitemapSet.has(a)) || (!!b && ctx.sitemapSet.has(b));
}

/** Pages « utilitaires » où un noindex est normal. */
export const UTILITY = /\/(panier|cart|checkout|commande|mon-compte|my-account|account|connexion|login|register|inscription|wishlist|merci|thank-you|thanks|recherche|search|mentions-legales|legal|cgv|cgu|conditions|politique|privacy|confidentialite|cookies?|plan-du-site|wp-admin|admin)(\/|$|\?|-)/i;

export function isUtility(p: CrawledPage): boolean {
  return UTILITY.test(new URL(p.finalUrl || p.url).pathname + new URL(p.finalUrl || p.url).search);
}

export function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}
