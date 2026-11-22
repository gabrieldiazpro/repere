/**
 * Markdown restreint des brouillons (éditable par le client dans une simple zone de texte) :
 * `## intertitre`, `### sous-titre`, paragraphes séparés par une ligne vide, listes `- …`, `[texte](https://…)` ou
 * `[texte](/chemin)`, `**gras**`, renvois de source `[1]`, et marqueurs `[à compléter : …]` qui bloquent la validation.
 */
import { blocksToHtml, plainInline } from '@/lib/publish/pages/render';
import type { PageBlock } from '@/lib/publish/pages/types';

/** Marqueur de fait manquant : « [à compléter] » ou « [à compléter : tarif du déplacement] ». */
export const TODO_RE = /\[\s*à compléter(?:\s*:\s*([^\]]*))?\]/gi;
export const TODO_TEST = /\[\s*à compléter(?:\s*:[^\]]*)?\]/i;
export const TODO_SPLIT = /(\[\s*à compléter(?:\s*:[^\]]*)?\])/i;

export const todo = (label: string) => `[à compléter : ${label}]`;

export function todosOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TODO_RE)) out.push((m[1] ?? '').trim() || 'information manquante');
  return [...new Set(out)];
}

export function parseBody(md: string): PageBlock[] {
  const out: PageBlock[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) out.push({ type: 'p', text: para.join(' ').replace(/\s+/g, ' ').trim() });
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push({ type: 'ul', items: list });
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (h) {
      flushPara();
      flushList();
      out.push({ type: h[1].length === 2 ? 'h2' : 'h3', text: h[2].trim() });
      continue;
    }
    const li = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (li) {
      flushPara();
      list.push(li[1].trim());
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (/^#\s/.test(line.trim())) continue; // le H1 est le titre de la page
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out;
}

export function bodyToHtml(md: string): string {
  return blocksToHtml(parseBody(md));
}

/** Texte brut (comptage de mots, diff, contrôle anti-invention). */
export function bodyToText(md: string): string {
  return parseBody(md)
    .map((b) => (b.type === 'ul' ? b.items.map(plainInline).join('\n') : plainInline(b.text)))
    .join('\n\n');
}

export function wordsOf(text: string): number {
  return (text.match(/[\p{L}\d][\p{L}\d’'-]*/gu) ?? []).length;
}

/** Adresse courte à partir d'un titre (« Nos tarifs à Lyon » → « nos-tarifs-a-lyon »). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');
}

/** Blocs du contenu principal d'une page (src/lib/siteaudit/html) → Markdown restreint (réécriture). */
export function htmlBlocksToMarkdown(blocks: { tag: string; text: string }[], max = 12_000): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const t = b.text.replace(/\s+/g, ' ').trim();
    if (!t || b.tag === 'h1') continue;
    if (/^h[2-6]$/.test(b.tag)) parts.push(`## ${t}`);
    else if (b.tag === 'li') parts.push(`- ${t}`);
    else if (t.split(' ').length >= 4) parts.push(t);
  }
  return parts.join('\n\n').slice(0, max);
}
