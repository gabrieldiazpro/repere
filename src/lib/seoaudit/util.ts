/**
 * Outils purs de l'audit SEO : URL, texte visible, pluriels, extraction NAP (France), JSON-LD.
 */
import type { CrawledPage } from './types';

export type Node = Record<string, unknown>;

/** Normalisation pour la comparaison (fragment retiré, hôte en minuscules, port par défaut retiré). Paramètres conservés. */
export function norm(href: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(href.trim(), base) : new URL(href.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = '';
  return u.toString();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

/** Même site à www près. */
export function sameSite(a: string, b: string): boolean {
  const ha = hostOf(a).replace(/^www\./, '');
  const hb = hostOf(b).replace(/^www\./, '');
  return !!ha && ha === hb;
}

/** « 1 page », « 3 pages ». */
export function pl(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', rsquo: '’' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENT[n.toLowerCase()] ?? m);
}

/** Texte visible approximatif d'un document HTML. */
export function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Paragraphes (<p>) du document, texte brut. */
export function paragraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

/** Coupe à `max` caractères sur une frontière de mot, avec « … » si coupé. */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

/** Valeur d'attribut dans une balise brute. */
export function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : undefined;
}

/** Toutes les balises ouvrantes d'un nom donné. */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

export function headOf(html: string): string {
  const m = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return m ? m[1] : html.slice(0, Math.min(html.length, 20_000));
}

/* ------------------------------------------------------------------ */
/* NAP (France)                                                        */
/* ------------------------------------------------------------------ */

const PHONE_RE = /(?:\+33\s?\(?0?\)?\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g;

/** Numéros français normalisés (0XXXXXXXXX). */
export function phonesIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    let d = m.replace(/\D/g, '');
    if (d.startsWith('33')) d = `0${d.slice(2).replace(/^0/, '')}`;
    if (d.length === 10 && d.startsWith('0')) out.add(d);
  }
  return [...out];
}

export function normPhone(p: string): string {
  let d = p.replace(/\D/g, '');
  if (d.startsWith('33')) d = `0${d.slice(2).replace(/^0/, '')}`;
  return d;
}

const STREET = '(?:rue|avenue|av\\.|boulevard|bd|place|chemin|route|rte|all[ée]e|impasse|quai|cours|square|voie|faubourg|fbg|esplanade|passage|parvis|lieu-dit|za|zi|zac|r[ée]sidence)';
const ADDR_RE = new RegExp(`\\b(\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+${STREET}\\b[^\\n]{2,80}?)[,\\s]+(\\d{5})\\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’\\- ]{1,40}?)(?=$|[\\n,.;|<)]|\\s{2}|\\s+(?:t[ée]l|france|ouvert|du\\s|lun|horaires))`, 'gimu');

export interface FoundAddress { street: string; postalCode: string; city: string }

/** Adresses postales françaises reconnues dans un texte. */
export function addressesIn(text: string): FoundAddress[] {
  const out: FoundAddress[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  ADDR_RE.lastIndex = 0;
  while ((m = ADDR_RE.exec(text))) {
    const a = { street: m[1].replace(/\s+/g, ' ').trim(), postalCode: m[2], city: m[3].trim() };
    const k = `${a.postalCode}|${a.city.toLowerCase()}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

export function typesOf(n: unknown): string[] {
  const t = (n as Node | null)?.['@type'];
  const clean = (x: string) => x.replace(/^https?:\/\/schema\.org\//, '');
  if (typeof t === 'string') return [clean(t)];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string').map(clean);
  return [];
}

export function topNodes(data: unknown): Node[] {
  if (Array.isArray(data)) return data.flatMap(topNodes);
  if (!data || typeof data !== 'object') return [];
  const d = data as Node;
  if (Array.isArray(d['@graph'])) return (d['@graph'] as unknown[]).flatMap(topNodes);
  return [d];
}

export function allNodes(data: unknown, depth = 0, out: Node[] = []): Node[] {
  if (depth > 8 || !data || typeof data !== 'object') return out;
  if (Array.isArray(data)) {
    for (const x of data) allNodes(x, depth + 1, out);
    return out;
  }
  const d = data as Node;
  if (typesOf(d).length) out.push(d);
  for (const [k, v] of Object.entries(d)) if (k !== '@context' && v && typeof v === 'object') allNodes(v, depth + 1, out);
  return out;
}

export function has(n: Node, k: string): boolean {
  const v = n[k];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function isHtml(p: CrawledPage): boolean {
  const ct = (p.contentType ?? p.headers['content-type'] ?? '').toLowerCase();
  return !ct || ct.includes('html');
}

export function robotsDirectives(p: CrawledPage): string[] {
  const parts = [p.metaRobots ?? '', p.headers['x-robots-tag'] ?? '']
    .join(',')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim().replace(/^googlebot:\s*/, ''))
    .filter(Boolean);
  return parts;
}

export function isNoindex(p: CrawledPage): boolean {
  const d = robotsDirectives(p);
  return d.includes('noindex') || d.includes('none');
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Paramètres de facettes / tri / filtres usuels (Shopify, WooCommerce, PrestaShop, Magento). */
export const FACET_PARAMS = /^(filter[\w.\-[\]]*|filtre|filtres|q|couleur|color|colour|taille|size|pointure|prix|price|price_min|price_max|min_price|max_price|marque|brand|matiere|material|sort|sort_by|orderby|order|tri|dir|limit|per_page|product_list_order|product_list_limit|product_list_mode|attribute_pa_[\w-]+|pa_[\w-]+|selected_filters|view|grid|mode)$/i;
export const PAGE_PARAMS = /^(page|p|paged|pg|pagination)$/i;
export const VARIANT_PARAMS = /^(variant|variante|sku|combination|id_product_attribute|option)$/i;
export const SEARCH_PATH = /\/(recherche|search|catalogsearch)(\/|$|\?)|[?&](s|q|search|query|controller=search)=/i;
export const CART_PATH = /\/(panier|cart|checkout|commande|order|mon-compte|my-account|account|connexion|login|wishlist|liste-de-souhaits|compare|comparer)(\/|$|\?)/i;
