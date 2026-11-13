/**
 * Extraction d'une page HTML → champs de `CrawledPage` (parse rapide, sans navigateur).
 * S'appuie sur src/lib/siteaudit/html.ts.
 */
import { createHash } from 'node:crypto';
import { parseAttrs, parseHtml, stripTags, tags, wordCount } from '@/lib/siteaudit/html';
import type { CrawledPage } from './types';
import { normalizeUrl } from './url';

export const MAX_KEPT_HTML = 1.5 * 1024 * 1024;

export interface ExtractedLink {
  to: string;
  anchor: string;
  rel: string[];
}

export type Extracted = Omit<CrawledPage, 'url' | 'finalUrl' | 'status' | 'redirectChain' | 'depth' | 'contentType' | 'bytes' | 'fetchMs' | 'headers' | 'blockedByRobots' | 'internalLinks' | 'externalLinks' | 'isIndexable'> & {
  links: ExtractedLink[];
  /** <base href> appliqué. */
  baseUrl: string;
};

/** Empreinte du texte normalisé (minuscules, sans ponctuation ni chiffres isolés, espaces réduits). */
export function textHash(text: string): string {
  const norm = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const SPA_ROOT = /<(div|main|app-root)\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|q-app|main-app)["']?[^>]*>\s*<\/\1>/i;

export function extractPage(html: string, pageUrl: string): Extracted {
  const p = parseHtml(html);
  const baseTag = tags(p.clean.slice(0, 50_000), 'base').find((t) => t.attrs.href)?.attrs.href;
  let baseUrl = pageUrl;
  if (baseTag) {
    try {
      baseUrl = new URL(baseTag, pageUrl).toString();
    } catch {
      /* base invalide : ignorée */
    }
  }
  const abs = (href: string | undefined | null) => (href ? normalizeUrl(href, baseUrl) : null);

  // hreflang : <link rel="alternate" hreflang="…" href="…">
  const linkTags = tags(p.clean, 'link');
  const hreflang = linkTags
    .filter((t) => (t.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('alternate') && t.attrs.hreflang && t.attrs.href)
    .map((t) => ({ lang: t.attrs.hreflang.trim(), href: abs(t.attrs.href) ?? t.attrs.href }));

  // Images : on garde la différence entre alt absent (undefined) et alt vide ("" = décoratif).
  const bodyStart = p.clean.search(/<body\b/i);
  const bodyHtml = bodyStart >= 0 ? p.clean.slice(bodyStart) : p.clean;
  const images: CrawledPage['images'] = [];
  for (const m of bodyHtml.matchAll(/<img\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    const raw = a.src || a['data-src'] || a['data-lazy-src'] || (a.srcset ?? a['data-srcset'] ?? '').split(',')[0]?.trim().split(/\s+/)[0] || '';
    if (!raw) continue;
    const src = raw.startsWith('data:') ? raw.slice(0, 64) : (abs(raw) ?? raw);
    images.push({
      src,
      ...('alt' in a ? { alt: a.alt } : {}),
      ...(num(a.width) !== undefined ? { width: num(a.width) } : {}),
      ...(num(a.height) !== undefined ? { height: num(a.height) } : {}),
      ...(a.loading ? { loading: a.loading.toLowerCase() } : {}),
    });
    if (images.length >= 500) break;
  }

  // Liens : href absolu normalisé, ancre (texte, sinon alt d'image, sinon aria-label/title), rel.
  const links: ExtractedLink[] = [];
  // Ancre = contenu jusqu'au </a> suivant OU au <a suivant (HTML cassé : liens non fermés).
  const opens = [...bodyHtml.matchAll(/<a\b([^>]*)>/gi)];
  for (let i = 0; i < opens.length; i++) {
    const m = opens[i];
    const startIdx = (m.index ?? 0) + m[0].length;
    const nextOpen = i + 1 < opens.length ? (opens[i + 1].index ?? bodyHtml.length) : bodyHtml.length;
    const close = bodyHtml.slice(startIdx, Math.min(nextOpen, startIdx + 5_000)).search(/<\/a\s*>/i);
    const inner = bodyHtml.slice(startIdx, close >= 0 ? startIdx + close : Math.min(nextOpen, startIdx + 5_000));
    const a = parseAttrs(m[1]);
    const href = a.href?.trim();
    if (!href || /^(mailto|tel|javascript|data|sms|whatsapp|callto|ftp):/i.test(href) || href.startsWith('#')) continue;
    const to = abs(href);
    if (!to) continue;
    let anchor = stripTags(inner);
    if (!anchor) anchor = (/<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/i.exec(inner)?.[1] ?? a['aria-label'] ?? a.title ?? '').trim();
    links.push({ to, anchor: anchor.slice(0, 200), rel: (a.rel ?? '').toLowerCase().split(/\s+/).filter(Boolean) });
    if (links.length >= 1000) break;
  }

  const jsonLd: unknown[] = [];
  const jsonLdErrors: string[] = [];
  p.jsonLdRaw.forEach((raw, i) => {
    const txt = raw.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
    if (!txt) {
      jsonLdErrors.push(`Bloc JSON-LD n° ${i + 1} vide.`);
      return;
    }
    try {
      jsonLd.push(JSON.parse(txt));
    } catch (e) {
      jsonLdErrors.push(`Bloc JSON-LD n° ${i + 1} illisible : ${(e as Error).message.slice(0, 120)}`);
    }
  });

  const text = p.bodyText;
  const wc = wordCount(text);
  const textToHtmlRatio = html.length ? Math.round((text.length / html.length) * 1000) / 1000 : 0;
  const noscriptJs = /javascript|js\b/i.test(p.noscriptText) && /(activ|enable)/i.test(p.noscriptText);
  const likelyClientRendered = p.scriptsCount > 0 && wc < 80 && (SPA_ROOT.test(p.clean) || noscriptJs || textToHtmlRatio < 0.02 || /<script\b[^>]*type=["']module["']/i.test(html));

  return {
    baseUrl,
    html: html.length <= MAX_KEPT_HTML ? html : undefined,
    title: p.title || undefined,
    metaDescription: p.metaDescription ?? undefined,
    metaRobots: p.metaRobots ?? undefined,
    canonical: p.canonical ? (abs(p.canonical) ?? p.canonical) : undefined,
    lang: p.lang ?? undefined,
    hreflang,
    h1: p.headings.filter((h) => h.level === 1).map((h) => h.text),
    headings: p.headings,
    wordCount: wc,
    textHash: textHash(p.mainText || text),
    images,
    jsonLd,
    jsonLdErrors,
    openGraph: p.og,
    renderHints: { scriptsCount: p.scriptsCount, textToHtmlRatio, likelyClientRendered },
    links,
  };
}

/** noindex dans la méta robots ou l'en-tête X-Robots-Tag (générique, googlebot ou repèrebot). */
export function hasNoindex(metaRobots: string | undefined, xRobotsTag: string | undefined): boolean {
  if (metaRobots && /\b(noindex|none)\b/i.test(metaRobots)) return true;
  if (!xRobotsTag) return false;
  // « googlebot: noindex, otherbot: nofollow » ou « noindex »
  for (const part of xRobotsTag.split(/,(?=\s*[a-z-]+\s*:)/i)) {
    const m = /^\s*([a-z0-9_-]+)\s*:\s*(.*)$/i.exec(part);
    const agent = m && !/^(unavailable_after|max-[a-z-]+)$/i.test(m[1]) ? m[1].toLowerCase() : null;
    const directives = agent ? m![2] : part;
    if ((!agent || agent === 'googlebot' || agent === 'reperebot' || agent === 'bingbot') && /\b(noindex|none)\b/i.test(directives)) return true;
  }
  return false;
}
