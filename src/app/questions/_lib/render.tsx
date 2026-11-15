/**
 * Rendu des contenus structurés (pages /questions/[slug] et étude « marque citée ») :
 * liens internes `[texte](/chemin)` et renvois `[n]` (déjà résolus par refResolver).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TableWrap, withRefs } from '@/lib/seo/editorial';
import type { Block } from './target-questions';

const LINK_RE = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** Texte enrichi : liens internes et renvois numérotés. */
export function Rich({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index! > last) out.push(<span key={i++}>{withRefs(text.slice(last, m.index))}</span>);
    out.push(
      <Link key={i++} href={m[2]} className="underline" style={{ color: 'var(--primary)' }}>
        {m[1]}
      </Link>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(<span key={i++}>{withRefs(text.slice(last))}</span>);
  return <>{out}</>;
}

/** Texte brut (JSON-LD, meta) : liens réduits à leur libellé, renvois retirés. */
export const plain = (text: string) =>
  text
    .replace(LINK_RE, '$1')
    .replace(/\s?\[(?:@\w+|\d+)\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, k) => {
        if ('p' in b)
          return (
            <p key={k} className="mb-4 leading-relaxed">
              <Rich text={b.p} />
            </p>
          );
        if ('ul' in b)
          return (
            <ul key={k} className="mb-4 list-disc space-y-2 pl-6 leading-relaxed">
              {b.ul.map((x, j) => (
                <li key={j}>
                  <Rich text={x} />
                </li>
              ))}
            </ul>
          );
        if ('ol' in b)
          return (
            <ol key={k} className="mb-4 list-decimal space-y-2 pl-6 leading-relaxed">
              {b.ol.map((x, j) => (
                <li key={j}>
                  <Rich text={x} />
                </li>
              ))}
            </ol>
          );
        return (
          <TableWrap
            key={k}
            caption={b.table.caption}
            head={b.table.head}
            rows={b.table.rows.map((r) => r.map((cell, j) => <Rich key={j} text={cell} />))}
          />
        );
      })}
    </>
  );
}

/** Applique `t` (refResolver) à tous les textes d'une liste de blocs, dans l'ordre de lecture. */
export function resolveBlocks(blocks: Block[] | undefined, t: (s: string) => string): Block[] {
  return (blocks ?? []).map((b) => {
    if ('p' in b) return { p: t(b.p) };
    if ('ul' in b) return { ul: b.ul.map(t) };
    if ('ol' in b) return { ol: b.ol.map(t) };
    return { table: { ...b.table, rows: b.table.rows.map((r) => r.map(t)) } };
  });
}
