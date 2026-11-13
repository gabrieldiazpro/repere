/**
 * Analyse HTML légère, sans dépendance (pas de navigateur, pas de JavaScript exécuté : c'est ce que voit un robot IA).
 * Suffisante pour des heuristiques ; ne prétend pas être un parseur HTML5 complet.
 */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ouml: 'ö', ucirc: 'û', ugrave: 'ù', uuml: 'ü', icirc: 'î', iuml: 'ï',
  Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  hellip: '…', ndash: '–', mdash: '—', euro: '€', copy: '©', reg: '®', deg: '°', middot: '·', oelig: 'œ', thinsp: ' ', shy: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(s: string): number {
  const m = s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export interface Tag {
  name: string;
  attrs: Record<string, string>;
}

/** Toutes les balises ouvrantes d'un type (`meta`, `link`, `a`, `img`…). */
export function tags(html: string, name: string): Tag[] {
  const re = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  return [...html.matchAll(re)].map((m) => ({ name, attrs: parseAttrs(m[1]) }));
}

export interface Block {
  tag: string;
  text: string;
  html: string;
}

export interface ParsedPage {
  raw: string;
  /** HTML sans commentaires, scripts, styles (le JSON-LD est extrait à part). */
  clean: string;
  lang: string | null;
  title: string;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  og: Record<string, string>;
  headings: { level: number; text: string }[];
  /** Blocs dans l'ordre (titres, paragraphes, éléments de liste, cellules) du contenu principal. */
  blocks: Block[];
  /** Texte visible du contenu principal. */
  mainText: string;
  /** Texte visible de toute la page (hors scripts). */
  bodyText: string;
  jsonLdRaw: string[];
  links: { href: string; text: string; rel: string }[];
  images: { src: string; alt: string }[];
  scriptsCount: number;
  noscriptText: string;
  hasMainLandmark: boolean;
}

function first(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1] : null;
}

/** Extrait le contenu principal : <main>, sinon le plus long <article>, sinon <body> sans nav/header/footer/aside. */
function mainContent(clean: string): { html: string; landmark: boolean } {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(clean);
  if (main && stripTags(main[1]).length > 50) return { html: main[1], landmark: true };
  const articles = [...clean.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]);
  if (articles.length) {
    const best = articles.sort((a, b) => stripTags(b).length - stripTags(a).length)[0];
    if (stripTags(best).length > 200) return { html: best, landmark: true };
  }
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(clean)?.[1] ?? clean;
  return { html: body.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' '), landmark: false };
}

export function parseHtml(raw: string): ParsedPage {
  const noComments = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  const jsonLdRaw = [...noComments.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim());
  const scriptsCount = (noComments.match(/<script\b/gi) ?? []).length;
  const noscriptText = stripTags([...noComments.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)].map((m) => m[1]).join(' '));
  const clean = noComments.replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(clean)?.[1] ?? clean;
  const metas = tags(head, 'meta');
  const metaBy = (n: string) => metas.find((t) => (t.attrs.name ?? '').toLowerCase() === n)?.attrs.content ?? null;
  const og: Record<string, string> = {};
  for (const t of tags(clean, 'meta')) {
    const p = (t.attrs.property ?? t.attrs.name ?? '').toLowerCase();
    if ((p.startsWith('og:') || p.startsWith('product:') || p.startsWith('article:')) && t.attrs.content && !(p in og)) og[p] = t.attrs.content;
  }
  const canonical = tags(head, 'link').find((t) => (t.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))?.attrs.href ?? null;
  const htmlTag = /<html\b([^>]*)>/i.exec(clean);
  const lang = htmlTag ? (parseAttrs(htmlTag[1]).lang ?? null) : null;
  const titleRaw = first(clean, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const bodyHtml = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(clean)?.[1] ?? clean.replace(/<head\b[\s\S]*?<\/head>/i, ' ');
  const { html: mainHtml, landmark } = mainContent(clean);
  const headings = [...bodyHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: stripTags(m[2]) }));
  const blocks: Block[] = [...mainHtml.matchAll(/<(h[1-6]|p|li|td|th|dt|dd|blockquote|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => ({ tag: m[1].toLowerCase(), text: stripTags(m[2]), html: m[2] }))
    .filter((b) => b.text.length > 0);
  const links = tags(bodyHtml, 'a').map((t) => ({ href: t.attrs.href ?? '', text: '', rel: (t.attrs.rel ?? '').toLowerCase() }));
  // Texte des liens (pour le maillage) : seconde passe.
  const linkTexts = [...bodyHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1]));
  links.forEach((l, i) => (l.text = linkTexts[i] ?? ''));
  const images = tags(bodyHtml, 'img').map((t) => ({ src: t.attrs.src ?? t.attrs['data-src'] ?? '', alt: t.attrs.alt ?? '' }));
  return {
    raw,
    clean,
    lang,
    title: titleRaw ? stripTags(titleRaw) : '',
    metaDescription: metaBy('description'),
    metaRobots: metaBy('robots'),
    canonical,
    og,
    headings,
    blocks,
    mainText: stripTags(mainHtml),
    bodyText: stripTags(bodyHtml),
    jsonLdRaw,
    links,
    images,
    scriptsCount,
    noscriptText,
    hasMainLandmark: landmark,
  };
}

/** Lien absolu (ou null si non http(s)). */
export function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function sameSite(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, '');
    const hb = new URL(b).hostname.replace(/^www\./, '');
    return ha === hb;
  } catch {
    return false;
  }
}

/** Découpe un texte en phrases. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9«“"])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}
