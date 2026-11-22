/** Rendu des blocs de contenu : HTML échappé (WordPress, Shopify, Webflow, PrestaShop, export) et Ricos (Wix). */
import type { PageBlock } from './types';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Liens Markdown `[texte](https://… ou /chemin)` et gras `**…**` dans un texte déjà échappé. */
function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g, (_m, t: string, href: string) => `<a href="${href.replace(/"/g, '%22')}">${t}</a>`);
  return s;
}

/** Texte brut d'un fragment en ligne (liens → texte, gras retiré). */
export function plainInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g, '$1');
}

export function blocksToHtml(blocks: PageBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'ul') return `<ul>\n${b.items.map((i) => `  <li>${inline(i)}</li>`).join('\n')}\n</ul>`;
      return `<${b.type}>${inline(b.text)}</${b.type}>`;
    })
    .join('\n');
}

export function jsonLdHtml(blocks: string[]): string {
  return blocks.map((j) => `<script type="application/ld+json">${j.replace(/</g, '\\u003c')}</script>`).join('\n');
}

type RicosNode = Record<string, unknown>;

function ricosText(text: string): RicosNode[] {
  // Liens et gras : décorations Ricos (LINK, BOLD) sur des segments.
  const out: RicosNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ type: 'TEXT', textData: { text: text.slice(last, m.index), decorations: [] } });
    if (m[1]) out.push({ type: 'TEXT', textData: { text: m[1], decorations: [{ type: 'BOLD', fontWeightValue: 700 }] } });
    else out.push({ type: 'TEXT', textData: { text: m[2], decorations: [{ type: 'LINK', linkData: { link: { url: m[3] } } }] } });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: 'TEXT', textData: { text: text.slice(last), decorations: [] } });
  return out;
}

const para = (text: string): RicosNode => ({ type: 'PARAGRAPH', nodes: ricosText(text), paragraphData: {} });

/** Document Ricos (texte toujours enveloppé dans un PARAGRAPH, comme l'exige l'API Wix Blog). */
export function blocksToRicos(blocks: PageBlock[]): { nodes: RicosNode[] } {
  return {
    nodes: blocks.map((b) => {
      if (b.type === 'ul') return { type: 'BULLETED_LIST', nodes: b.items.map((i) => ({ type: 'LIST_ITEM', nodes: [para(i)] })), bulletedListData: { indentation: 0 } };
      if (b.type === 'p') return para(b.text);
      return { type: 'HEADING', nodes: ricosText(b.text), headingData: { level: b.type === 'h2' ? 2 : 3 } };
    }),
  };
}

/** Texte brut (comparaison, vérification). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
}
