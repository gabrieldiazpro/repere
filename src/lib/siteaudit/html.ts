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

/* ------------------------------------------------------------------ */
/* Balayages LINÉAIRES (ROBUSTESSE V6)                                 */
/* ------------------------------------------------------------------ */
// Les motifs « <x\b[\s\S]*?<\/x> » sont quadratiques quand une balise n'est jamais fermée (HTML réel cassé :
// 18 000 <svg> ou <h2> ouverts = 30 s de CPU, serveur bloqué). Ces fonctions donnent le même résultat en O(n).

/** Retire les commentaires HTML (un « <!-- » jamais fermé est laissé tel quel, comme le ferait la regex). */
export function stripComments(s: string, rep = ' '): string {
  if (!s.includes('<!--')) return s;
  let out = '';
  let i = 0;
  for (;;) {
    const a = s.indexOf('<!--', i);
    if (a < 0) break;
    const b = s.indexOf('-->', a + 4);
    if (b < 0) break;
    out += s.slice(i, a) + rep;
    i = b + 3;
  }
  return out + s.slice(i);
}

export interface BlockMatch {
  /** nom de balise en minuscules */
  name: string;
  start: number;
  /** fin de la balise ouvrante (après « > ») */
  openEnd: number;
  /** début de la balise fermante */
  closeStart: number;
  /** après la balise fermante */
  end: number;
  /** attributs bruts de la balise ouvrante */
  attrs: string;
}

/**
 * Blocs `<nom …>…</nom>` successifs, sans chevauchement, comme `matchAll(/<(a|b)\b([^>]*)>([\s\S]*?)<\/\1>/gi)`,
 * mais en temps linéaire : la position de la prochaine fermeture de chaque nom est mémorisée.
 */
export function findBlocks(s: string, names: string[], limit = Infinity): BlockMatch[] {
  const out: BlockMatch[] = [];
  if (!s) return out;
  const lower = s.toLowerCase();
  const open = new RegExp(`<(${names.map((n) => n.replace(/[^a-z0-9]/gi, '')).join('|')})\\b`, 'gi');
  const nextClose = new Map<string, number>(); // -1 : plus aucune fermeture
  let m: RegExpExecArray | null;
  while ((m = open.exec(s)) && out.length < limit) {
    const name = m[1].toLowerCase();
    const start = m.index;
    const gt = s.indexOf('>', start + m[0].length);
    if (gt < 0) break;
    let c = nextClose.get(name);
    if (c === undefined || (c >= 0 && c < gt + 1)) {
      c = lower.indexOf(`</${name}>`, gt + 1);
      nextClose.set(name, c);
    }
    if (c < 0) {
      open.lastIndex = start + 1;
      continue;
    }
    const end = c + name.length + 3;
    out.push({ name, start, openEnd: gt + 1, closeStart: c, end, attrs: s.slice(start + m[0].length, gt) });
    open.lastIndex = end;
  }
  return out;
}

/** Remplace les blocs trouvés par `rep` (équivalent linéaire de `replace(/<(a|b)\b[\s\S]*?<\/\1>/gi, rep)`). */
export function removeBlocks(s: string, names: string[], rep = ' '): string {
  const bl = findBlocks(s, names);
  if (!bl.length) return s;
  let out = '';
  let i = 0;
  for (const b of bl) {
    out += s.slice(i, b.start) + rep;
    i = b.end;
  }
  return out + s.slice(i);
}

/** Contenu du premier bloc `<nom>…</nom>` (null si absent). */
export function firstBlock(s: string, name: string): string | null {
  const b = findBlocks(s, [name], 1)[0];
  return b ? s.slice(b.openEnd, b.closeStart) : null;
}

/** Contenu entre la première balise `<nom …>` et la DERNIÈRE `</nom>` (comme `/<body\b[^>]*>([\s\S]*)<\/body>/i`). */
export function outerContent(s: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>`, 'i').exec(s);
  if (!m) return null;
  const c = s.toLowerCase().lastIndexOf(`</${name}>`);
  return c >= m.index + m[0].length ? s.slice(m.index + m[0].length, c) : null;
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

/** Extrait le contenu principal : <main>, sinon le plus long <article>, sinon <body> sans nav/header/footer/aside. */
function mainContent(clean: string): { html: string; landmark: boolean } {
  const main = firstBlock(clean, 'main');
  if (main !== null && stripTags(main).length > 50) return { html: main, landmark: true };
  const articles = findBlocks(clean, ['article']).map((b) => clean.slice(b.openEnd, b.closeStart));
  if (articles.length) {
    const best = articles.sort((a, b) => stripTags(b).length - stripTags(a).length)[0];
    if (stripTags(best).length > 200) return { html: best, landmark: true };
  }
  const body = outerContent(clean, 'body') ?? clean;
  return { html: removeBlocks(body, ['nav', 'header', 'footer', 'aside']), landmark: false };
}

export function parseHtml(raw: string): ParsedPage {
  const noComments = stripComments(raw);
  const scripts = findBlocks(noComments, ['script']);
  const jsonLdRaw = scripts
    .filter((b) => /\btype\s*=\s*["']?application\/ld\+json/i.test(b.attrs))
    .map((b) => noComments.slice(b.openEnd, b.closeStart).trim());
  const scriptsCount = (noComments.match(/<script\b/gi) ?? []).length;
  const noscriptText = stripTags(findBlocks(noComments, ['noscript']).map((b) => noComments.slice(b.openEnd, b.closeStart)).join(' '));
  const clean = removeBlocks(noComments, ['script', 'style', 'noscript', 'template', 'svg', 'iframe']);
  const head = firstBlock(clean, 'head') ?? clean;
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
  const titleRaw = firstBlock(clean, 'title');
  const bodyHtml = outerContent(clean, 'body') ?? removeBlocks(clean, ['head']);
  const { html: mainHtml, landmark } = mainContent(clean);
  const headings = findBlocks(bodyHtml, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).map((b) => ({ level: Number(b.name[1]), text: stripTags(bodyHtml.slice(b.openEnd, b.closeStart)) }));
  const blocks: Block[] = findBlocks(mainHtml, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'dt', 'dd', 'blockquote', 'summary'])
    .map((b) => {
      const inner = mainHtml.slice(b.openEnd, b.closeStart);
      return { tag: b.name, text: stripTags(inner), html: inner };
    })
    .filter((b) => b.text.length > 0);
  const links = tags(bodyHtml, 'a').map((t) => ({ href: t.attrs.href ?? '', text: '', rel: (t.attrs.rel ?? '').toLowerCase() }));
  // Texte des liens (pour le maillage) : seconde passe.
  const linkTexts = findBlocks(bodyHtml, ['a']).map((b) => stripTags(bodyHtml.slice(b.openEnd, b.closeStart)));
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
