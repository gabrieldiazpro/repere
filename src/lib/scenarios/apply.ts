/**
 * Application SIMULÉE de corrections à une exploration (SCENARIOS, V9).
 *
 * Principe : on ne modélise pas l'effet d'une correction, on la fait « pour de faux » sur une copie de l'exploration
 * (le HTML de la page, le robots.txt, le sitemap, les redirections), on relit la page avec l'extracteur du robot
 * (src/lib/crawl/extract.ts, le même qu'à l'exploration), puis l'appelant relance les MÊMES audits (auditSeo /
 * auditGeo). Ce qui ne peut pas être reproduit exactement sur l'exploration est exclu, avec la raison.
 *
 * Formes de `autoFix` reconnues : celles de src/lib/seoaudit/autofix.ts et de src/lib/geo (voir
 * src/lib/publish/autofix.ts pour la liste complète). Les blocs insérés sont ceux qu'écrit l'agent de publication
 * (jsonLdBlock, faqBlock de src/lib/publish/planner.ts).
 */
import type { CrawledPage, Finding, SiteCrawl } from '@/lib/crawl/types';
import { extractPage, hasNoindex } from '@/lib/crawl/extract';
import { normalizeUrl } from '@/lib/crawl/url';
import { parseAttrs } from '@/lib/siteaudit/html';
import { isAllowed, parseRobots } from '@/lib/siteaudit/robots';
import { BOT_TOKEN } from '@/lib/siteaudit/fetch';
import { faqBlock, jsonLdBlock } from '@/lib/publish/planner';

export interface ApplyOutcome {
  /** élément appliqué (une page, une image, une redirection…) */
  applied: number;
  /** éléments non simulables (et pourquoi) */
  skipped: string[];
  /** remarques affichables (« seules les 3 réponses connues sont simulées »…) */
  notes: string[];
}

/** Raison pour laquelle un constat entier ne peut pas être simulé (null = simulable). */
export type Unsimulable = string | null;

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const itemsOf = (p: Record<string, unknown> | null): Record<string, unknown>[] => (p && Array.isArray(p.items) ? p.items.map(obj).filter((x): x is Record<string, unknown> => !!x) : []);

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const key = (u: string | undefined | null, base?: string): string | null => (u ? normalizeUrl(u, base) : null);

/** Copie profonde (l'exploration d'origine n'est jamais modifiée). */
export function cloneCrawl(c: SiteCrawl): SiteCrawl {
  return structuredClone(c);
}

/* ------------------------------------------------------------------ */
/* Éditions HTML                                                       */
/* ------------------------------------------------------------------ */

/** Insère dans <head> (avant </head>), sinon après <html>, sinon en tête. */
function insertHead(html: string, block: string): string {
  const i = html.search(/<\/head\s*>/i);
  if (i >= 0) return `${html.slice(0, i)}${block}\n${html.slice(i)}`;
  const h = /<html\b[^>]*>/i.exec(html);
  if (h) return `${html.slice(0, h.index + h[0].length)}\n<head>${block}</head>${html.slice(h.index + h[0].length)}`;
  return `${block}\n${html}`;
}

/** Insère en fin de contenu principal (avant </main>), sinon avant </body>, sinon à la fin. */
function insertBody(html: string, block: string): string {
  for (const re of [/<\/main\s*>/i, /<\/body\s*>/i]) {
    const i = html.search(re);
    if (i >= 0) return `${html.slice(0, i)}${block}\n${html.slice(i)}`;
  }
  return `${html}\n${block}`;
}

/** Remplace toutes les balises <tag …> qui vérifient `match` par `replacement` (la première) ; sinon insère dans <head>. */
function upsertHeadTag(html: string, tag: 'meta' | 'link', match: (a: Record<string, string>) => boolean, replacement: string): string {
  let done = false;
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'gi');
  const out = html.replace(re, (m, attrs: string) => {
    if (!match(parseAttrs(attrs))) return m;
    if (done) return '';
    done = true;
    return replacement;
  });
  return done ? out : insertHead(html, replacement);
}

export function setTitle(html: string, value: string): string {
  const re = /<title\b[^>]*>[\s\S]*?<\/title\s*>/i;
  const tag = `<title>${escText(value)}</title>`;
  return re.test(html) ? html.replace(re, tag) : insertHead(html, tag);
}

export function setMetaName(html: string, name: string, value: string): string {
  return upsertHeadTag(html, 'meta', (a) => (a.name ?? '').toLowerCase() === name, `<meta name="${name}" content="${escAttr(value)}">`);
}

export function setCanonical(html: string, href: string): string {
  return upsertHeadTag(html, 'link', (a) => (a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'), `<link rel="canonical" href="${escAttr(href)}">`);
}

/** Pose `alt` sur les <img> dont la source (absolue, comme l'extracteur) vaut `src`. Renvoie [html, nombre]. */
export function setImgAlt(html: string, pageUrl: string, src: string, alt: string): [string, number] {
  const target = key(src, pageUrl) ?? src;
  let n = 0;
  const out = html.replace(/<img\b([^>]*)>/gi, (m, attrs: string) => {
    const a = parseAttrs(attrs);
    const raw = a.src || a['data-src'] || a['data-lazy-src'] || (a.srcset ?? a['data-srcset'] ?? '').split(',')[0]?.trim().split(/\s+/)[0] || '';
    if (!raw) return m;
    const abs = raw.startsWith('data:') ? raw.slice(0, 64) : (key(raw, pageUrl) ?? raw);
    if (abs !== target && raw !== src) return m;
    n++;
    const stripped = attrs.replace(/\s+alt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '').replace(/\s+alt(?=[\s/>]|$)/i, '');
    const selfClose = /\/\s*$/.test(stripped);
    const body = selfClose ? stripped.replace(/\/\s*$/, '') : stripped;
    return `<img${body} alt="${escAttr(alt)}"${selfClose ? ' /' : ''}>`;
  });
  return [out, n];
}

/** Remplace l'adresse des liens <a> qui pointent (après résolution) vers `from`. */
export function updateLinks(html: string, pageUrl: string, from: string, to: string): [string, number] {
  const target = key(from, pageUrl) ?? from;
  let n = 0;
  const out = html.replace(/<a\b([^>]*)>/gi, (m, attrs: string) => {
    const href = parseAttrs(attrs).href?.trim();
    if (!href || (key(href, pageUrl) ?? href) !== target) return m;
    n++;
    return `<a${attrs.replace(/\bhref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `href="${escAttr(to)}"`)}>`;
  });
  return [out, n];
}

/** Remplace un passage de texte : à l'identique, sinon en tolérant espaces et balises entre les mots. */
export function replacePassage(html: string, before: string, after: string): [string, boolean] {
  const b = before.trim();
  if (!b) return [html, false];
  const i = html.indexOf(b);
  if (i >= 0) return [`${html.slice(0, i)}${escText(after)}${html.slice(i + b.length)}`, true];
  const words = b.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '(?:&|&amp;)').replace(/'/g, "(?:'|&#39;|&#x27;|’)").replace(/’/g, "(?:’|'|&rsquo;)"));
  if (words.length > 400) return [html, false];
  const re = new RegExp(words.join('(?:\\s|<[^>]{0,200}>)+'));
  const m = re.exec(html);
  if (!m) return [html, false];
  return [`${html.slice(0, m.index)}${escText(after)}${html.slice(m.index + m[0].length)}`, true];
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function findPage(c: SiteCrawl, url: string | undefined): CrawledPage | undefined {
  const k = key(url, c.finalOrigin || c.origin);
  if (!k) return undefined;
  return c.pages.find((p) => key(p.finalUrl) === k && p.status === 200 && !!p.html) ?? c.pages.find((p) => key(p.url) === k && p.status === 200 && !!p.html);
}

/** Relit la page modifiée avec l'extracteur du robot et recalcule l'indexabilité comme à l'exploration. */
export function reextract(page: CrawledPage, html: string): void {
  const x = extractPage(html, key(page.finalUrl) ?? page.finalUrl);
  const { links: _l, baseUrl: _b, ...fields } = x;
  void _l;
  void _b;
  Object.assign(page, fields);
  const noindex = hasNoindex(page.metaRobots, page.headers['x-robots-tag']);
  const self = key(page.finalUrl) ?? page.finalUrl;
  page.isIndexable = page.status === 200 && !noindex && (!page.canonical || key(page.canonical) === self);
}

type PageEdit = (html: string, page: CrawledPage) => [string, boolean];

/** Applique une édition HTML à une page. Faux si la page n'a pas pu être modifiée (absente, rendue en JS…). */
function editPage(c: SiteCrawl, url: string | undefined, edit: PageEdit, out: ApplyOutcome): boolean {
  const page = findPage(c, url);
  if (!page || !page.html) {
    out.skipped.push(`${url ?? '(page inconnue)'} : page absente de l’exploration ou sans HTML`);
    return false;
  }
  if (page.rendered) {
    out.skipped.push(`${page.finalUrl} : page lue après rendu JavaScript, son HTML ne peut pas être rejoué`);
    return false;
  }
  if (page.htmlTruncated) {
    out.skipped.push(`${page.finalUrl} : page trop lourde, seule une partie a été lue`);
    return false;
  }
  const [html, ok] = edit(page.html, page);
  if (!ok) return false;
  reextract(page, html);
  out.applied++;
  return true;
}

/* ------------------------------------------------------------------ */
/* Site : robots.txt, sitemap, redirections                            */
/* ------------------------------------------------------------------ */

function blankBlocked(p: CrawledPage): void {
  Object.assign(p, {
    status: 0,
    finalUrl: p.url,
    redirectChain: [],
    html: undefined,
    title: undefined,
    metaDescription: undefined,
    metaRobots: undefined,
    canonical: undefined,
    hreflang: [],
    h1: [],
    headings: [],
    wordCount: 0,
    textHash: '',
    images: [],
    jsonLd: [],
    jsonLdErrors: [],
    openGraph: {},
    internalLinks: 0,
    externalLinks: 0,
    isIndexable: false,
    blockedByRobots: true,
  });
}

/** Nouveau robots.txt. Null si l'effet ne peut pas être rejoué (pages jamais lues car bloquées). */
export function applyRobots(c: SiteCrawl, text: string, out: ApplyOutcome): boolean {
  if (c.pages.some((p) => p.blockedByRobots)) {
    out.skipped.push('robots.txt : des pages bloquées n’ont jamais été lues ; leur contenu ne peut pas être simulé');
    return false;
  }
  const origin = c.finalOrigin || c.origin;
  const sitemaps = [...text.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
  c.robots = { url: c.robots?.url ?? `${origin}/robots.txt`, status: 200, text, sitemaps };
  // Le robot respecte robots.txt : les pages désormais interdites ne seraient plus lues.
  const parsed = parseRobots(text);
  const blocked = new Set<string>();
  for (const p of c.pages) {
    let path = '/';
    try {
      const u = new URL(p.url);
      path = u.pathname + u.search;
    } catch {
      continue;
    }
    if (!isAllowed(parsed, BOT_TOKEN, path)) {
      blocked.add(p.finalUrl);
      blankBlocked(p);
    }
  }
  if (blocked.size) {
    c.links = c.links.filter((l) => !blocked.has(l.from));
    out.notes.push(`${blocked.size} adresse(s) ne seraient plus explorées (interdites par le nouveau robots.txt).`);
  }
  out.applied++;
  return true;
}

export function applySitemap(c: SiteCrawl, url: string, xml: string, out: ApplyOutcome): boolean {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (!locs.length) {
    out.skipped.push('sitemap : fichier proposé vide');
    return false;
  }
  c.sitemapUrls = locs.slice(0, 10_000);
  const k = key(url);
  const entry = { url, status: 200, urlCount: locs.length, errors: [] as string[] };
  const i = c.sitemaps.findIndex((s) => key(s.url) === k);
  if (i >= 0) c.sitemaps[i] = entry;
  else c.sitemaps = [...c.sitemaps.filter((s) => s.status === 200 && !s.errors.length), entry];
  out.applied++;
  return true;
}

/** Redirection permanente `from` → `to` (page cible lue dans l'exploration, sinon non simulable). */
export function applyRedirect(c: SiteCrawl, from: string, to: string, out: ApplyOutcome): boolean {
  const origin = c.finalOrigin || c.origin;
  const fk = key(from, origin);
  const tk = key(to, origin);
  if (!fk || !tk) {
    out.skipped.push(`${from} : adresse illisible`);
    return false;
  }
  const target = c.pages.find((p) => key(p.finalUrl) === tk && p.status === 200 && !p.blockedByRobots);
  if (!target) {
    out.skipped.push(`${from} → ${to} : la page de destination n’a pas été lue, son état ne peut pas être simulé`);
    return false;
  }
  if (key(target.url) === fk) {
    out.skipped.push(`${from} : l’adresse est déjà la page de destination`);
    return false;
  }
  // La page d'origine n'est plus servie : le robot suivrait la redirection jusqu'à la destination déjà lue.
  const gone = new Set(c.pages.filter((p) => key(p.url) === fk).map((p) => p.finalUrl));
  c.pages = c.pages.filter((p) => key(p.url) !== fk);
  if (gone.size) c.links = c.links.filter((l) => !gone.has(l.from) || gone.has(target.finalUrl));
  const redirects = (c.redirects ?? []).filter((r) => key(r.from) !== fk);
  redirects.push({ from: fk, to: target.finalUrl, chain: [{ url: fk, status: 301 }] });
  c.redirects = redirects;
  out.applied++;
  return true;
}

/* ------------------------------------------------------------------ */
/* Un constat                                                          */
/* ------------------------------------------------------------------ */

/** Pourquoi un constat ne peut pas être simulé, avant toute tentative (null = on essaie). */
export function unsimulableReason(f: Pick<Finding, 'autoFix' | 'id'>): Unsimulable {
  const fx = f.autoFix;
  if (!fx?.kind) return 'Pas de correction préparée par Repéré : l’effet dépend de ce que vous écrirez ou changerez.';
  const p = obj(fx.payload);
  switch (fx.kind) {
    case 'llms.txt':
    case 'llms':
      return 'llms.txt est informatif : il ne compte dans aucun score.';
    case 'jsonld':
      if (p && obj(p.merge)) return 'Fusion dans un bloc existant : le résultat dépend de votre balisage actuel.';
      return null;
    case 'faq': {
      const qa = (Array.isArray(p?.value) ? (p!.value as unknown[]) : []).map(obj).filter(Boolean) as Record<string, unknown>[];
      if (!qa.some((q) => q.from !== 'a_completer' && str(q.answer))) return 'Les réponses sont à rédiger par vous : leur effet ne peut pas être simulé.';
      return null;
    }
    case 'meta.title':
    case 'meta.description':
    case 'meta.robots':
    case 'canonical':
    case 'meta.canonical':
    case 'img.alt':
    case 'image.alt':
    case 'redirect':
    case 'link.update':
    case 'sitemap':
    case 'sitemap.xml':
    case 'robots':
    case 'robots.txt':
    case 'rewrite':
      return null;
    default:
      return `Type de correction « ${fx.kind} » non simulé.`;
  }
}

/**
 * Applique la correction d'un constat sur `c` (modifiée sur place : passer une copie).
 * Le constat est « simulé » si au moins un élément a été appliqué ; les éléments non applicables sont listés.
 */
export function applyFinding(c: SiteCrawl, f: Pick<Finding, 'autoFix' | 'id'>): ApplyOutcome & { ok: boolean; reason?: string } {
  const out: ApplyOutcome = { applied: 0, skipped: [], notes: [] };
  const reason = unsimulableReason(f);
  if (reason) return { ...out, ok: false, reason };
  const fx = f.autoFix!;
  const p = obj(fx.payload) ?? {};
  const list = itemsOf(p);
  const origin = c.finalOrigin || c.origin;
  switch (fx.kind) {
    case 'meta.title':
      for (const it of list.length ? list : [p]) {
        const v = str(it.value);
        if (v) editPage(c, str(it.url), (h) => [setTitle(h, v), true], out);
      }
      break;
    case 'meta.description':
      for (const it of list.length ? list : [p]) {
        const v = str(it.value);
        if (v) editPage(c, str(it.url), (h) => [setMetaName(h, 'description', v), true], out);
      }
      break;
    case 'meta.robots':
      for (const it of list.length ? list : [p]) {
        const v = str(it.value);
        if (v) editPage(c, str(it.url), (h) => [setMetaName(h, 'robots', v), true], out);
      }
      break;
    case 'canonical':
    case 'meta.canonical':
      for (const it of list.length ? list : [p]) {
        const v = str(it.href) ?? str(it.value);
        if (v) editPage(c, str(it.url), (h) => [setCanonical(h, v), true], out);
      }
      break;
    case 'img.alt':
    case 'image.alt': {
      // Regroupé par page : une seule relecture par page.
      const byPage = new Map<string, { src: string; alt: string }[]>();
      for (const it of list.length ? list : [p]) {
        const u = str(it.url);
        const src = str(it.src) ?? str(it.imageSrc);
        const alt = str(it.alt) ?? str(it.value);
        if (!u || !src || !alt) continue;
        byPage.set(u, [...(byPage.get(u) ?? []), { src, alt }]);
      }
      for (const [u, imgs] of byPage)
        editPage(
          c,
          u,
          (h, page) => {
            let html = h;
            let n = 0;
            for (const i of imgs) {
              const [x, k] = setImgAlt(html, page.finalUrl, i.src, i.alt);
              html = x;
              n += k;
            }
            if (!n) out.skipped.push(`${u} : image introuvable dans le HTML`);
            return [html, n > 0];
          },
          out,
        );
      break;
    }
    case 'jsonld': {
      const entries = list.length ? list.map((it) => ({ url: str(it.url), v: it.jsonld ?? it.value })) : [{ url: str(p.url), v: p.value }];
      for (const e of entries) {
        const raw = typeof e.v === 'string' ? e.v.replace(/^\s*<script[^>]*>|<\/script>\s*$/gi, '').trim() : e.v && typeof e.v === 'object' ? JSON.stringify(e.v) : '';
        const block = raw ? jsonLdBlock(raw) : null;
        if (!block) {
          out.skipped.push(`${e.url ?? ''} : bloc de données structurées illisible`);
          continue;
        }
        editPage(c, e.url ?? `${origin}/`, (h) => [insertHead(h, block), true], out);
      }
      break;
    }
    case 'faq': {
      const qa = (Array.isArray(p.value) ? (p.value as unknown[]) : []).map(obj).filter((x): x is Record<string, unknown> => !!x);
      const known = qa.filter((q) => q.from !== 'a_completer' && str(q.answer) && str(q.question)).map((q) => ({ question: String(q.question), answer: String(q.answer) }));
      if (known.length < qa.length) out.notes.push(`Seules les ${known.length} réponse(s) déjà connues (votre fiche) sont simulées ; ${qa.length - known.length} restent à rédiger par vous.`);
      editPage(c, str(p.url) ?? `${origin}/`, (h) => [insertBody(h, faqBlock(known)), true], out);
      break;
    }
    case 'rewrite':
      for (const it of list.length ? list : [p]) {
        const before = str(it.before) ?? str(it.find);
        const after = str(it.value) ?? str(it.replace);
        if (!before || !after) continue;
        editPage(
          c,
          str(it.url),
          (h) => {
            const [x, ok] = replacePassage(h, before, after);
            if (!ok) out.skipped.push(`${str(it.url)} : passage introuvable tel quel dans le HTML`);
            return [x, ok];
          },
          out,
        );
      }
      break;
    case 'link.update':
      for (const it of list) {
        const page = str(it.page);
        const from = str(it.from);
        const to = str(it.to);
        if (!page || !from || !to) continue;
        const ok = editPage(
          c,
          page,
          (h, pg) => {
            const [x, n] = updateLinks(h, pg.finalUrl, from, to);
            if (!n) out.skipped.push(`${page} : lien vers ${from} introuvable`);
            return [x, n > 0];
          },
          out,
        );
        if (ok) {
          const pk = key(page);
          const fk = key(from, page);
          const tk = key(to, page) ?? to;
          for (const l of c.links) if (key(l.from) === pk && key(l.to) === fk) l.to = tk;
        }
      }
      break;
    case 'redirect':
      for (const it of list.length ? list : [p]) {
        const from = str(it.from);
        const to = str(it.to);
        if (from && to) applyRedirect(c, from, to, out);
      }
      break;
    case 'sitemap':
    case 'sitemap.xml': {
      const xml = str(p.xml) ?? str(p.value);
      if (xml) applySitemap(c, str(p.url) ?? `${origin}/sitemap.xml`, xml, out);
      break;
    }
    case 'robots':
    case 'robots.txt': {
      const text = str(p.text) ?? str(p.value);
      if (text) applyRobots(c, text, out);
      break;
    }
  }
  if (!out.applied) return { ...out, ok: false, reason: out.skipped[0] ?? 'Correction vide : rien à simuler.' };
  return { ...out, ok: true };
}
