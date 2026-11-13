/**
 * Briques éditoriales communes aux pages de référence (/geo, /glossaire, /questions, /comparatif, /etudes, /a-propos).
 * Une seule source pour l'auteur, les dates et le rendu des sources numérotées.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDate } from './index';
import { FOUNDER } from './jsonld';

/** Date de première publication des pages de référence. */
export const EDITORIAL_PUBLISHED = '2026-11-09';
/** Date de dernière vérification des sources (à mettre à jour à chaque revue). */
export const EDITORIAL_UPDATED = '2026-11-09';

export const AUTHOR_LABEL = "L'équipe Repéré";

export interface Source {
  label: string;
  url: string;
  /** éditeur, date, périmètre, biais éventuel */
  note?: string;
}

/** Ligne auteur + dates, visible en tête de page. */
export function Byline({ published = EDITORIAL_PUBLISHED, updated = EDITORIAL_UPDATED }: { published?: string | null; updated?: string }) {
  return (
    <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
      Par{' '}
      <Link href="/a-propos" className="underline underline-offset-2">
        {AUTHOR_LABEL}
      </Link>
      {FOUNDER.name ? ` (${FOUNDER.name})` : ''}
      {published ? (
        <>
          {' · '}Publié le <time dateTime={published}>{fmtDate(published)}</time>
        </>
      ) : null}
      {' · '}Mis à jour le <time dateTime={updated}>{fmtDate(updated)}</time>
    </p>
  );
}

/** Transforme les renvois [n] en liens vers la liste des sources (#source-n). */
export function withRefs(text: string): ReactNode {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = /^\[(\d+)\]$/.exec(p);
    return m ? (
      <sup key={i}>
        <a href={`#source-${m[1]}`} className="px-0.5 underline" style={{ color: 'var(--primary)' }} aria-label={`Source ${m[1]}`}>
          {m[1]}
        </a>
      </sup>
    ) : (
      <span key={i}>{p}</span>
    );
  });
}

/** Retire les renvois [n] (pour le JSON-LD et les textes à plat). */
export const stripRefs = (text: string) => text.replace(/\s?\[\d+\]/g, '');

export function SourcesList({ sources, title = 'Sources' }: { sources: Source[]; title?: string }) {
  return (
    <section aria-labelledby="sources">
      <h2 id="sources" className="mt-12 mb-3 font-semibold text-2xl">
        {title}
      </h2>
      <ol className="list-decimal space-y-2 pl-6 text-sm leading-relaxed">
        {sources.map((s, i) => (
          <li key={s.url + i} id={`source-${i + 1}`} className="scroll-mt-20">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>
              {s.label}
            </a>
            {s.note && <span style={{ color: 'var(--muted)' }}> ({s.note})</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Section en question-réponse : la phrase-réponse est en tête, en gras. */
export function QaSection({ id, q, answer, children }: { id: string; q: string; answer: string; children?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mt-12 mb-3 font-semibold text-2xl">{q}</h2>
      <p className="mb-4 text-lg font-medium leading-relaxed">{withRefs(answer)}</p>
      {children}
    </section>
  );
}

export function Toc({ items, title = 'Sur cette page' }: { items: { id: string; label: string }[]; title?: string }) {
  return (
    <nav aria-label="Sommaire" className="mt-8 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', background: '#fff' }}>
      <p className="mb-2 font-semibold">{title}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="underline underline-offset-2">
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Maillage croisé entre les pages de référence. */
export const REFERENCE_LINKS = [
  { href: '/geo', label: "Qu'est-ce que le GEO (référencement IA) ?" },
  { href: '/glossaire', label: 'Glossaire du référencement IA (36 termes)' },
  { href: '/questions', label: 'Les 30 questions que les dirigeants posent sur le référencement IA' },
  { href: '/etudes', label: 'Études et Baromètre Repéré de la visibilité IA' },
  { href: '/comparatif', label: 'Repéré, outils de mesure, agences GEO : le comparatif' },
  { href: '/guides', label: 'Guides pratiques' },
  { href: '/methode', label: 'Notre méthode de mesure' },
  { href: '/a-propos', label: 'À propos de Repéré' },
] as const;

export function RelatedLinks({ current, extra = [] }: { current: string; extra?: { href: string; label: string }[] }) {
  const links = [...REFERENCE_LINKS.filter((l) => l.href !== current), ...extra];
  return (
    <nav aria-label="À lire aussi">
      <h2 className="mt-12 mb-3 font-semibold text-2xl">À lire aussi</h2>
      <ul className="list-disc space-y-1 pl-6">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="underline" style={{ color: 'var(--primary)' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TableWrap({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--line)', background: '#fff' }}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        {caption && <caption className="p-3 text-left text-sm" style={{ color: 'var(--muted)' }}>{caption}</caption>}
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b p-3 font-semibold" style={{ borderColor: 'var(--line)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="border-b p-3 align-top font-semibold" style={{ borderColor: 'var(--line)' }}>
                    {c}
                  </th>
                ) : (
                  <td key={j} className="border-b p-3 align-top" style={{ borderColor: 'var(--line)' }}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditCta({ text = 'Que répondent ChatGPT, Gemini et Perplexity quand on cherche une entreprise comme la vôtre ?' }: { text?: string }) {
  return (
    <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
      <p className="mb-3 text-lg font-semibold">{text}</p>
      <Link
        href="/audit"
        className="inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white"
        style={{ background: 'var(--primary)' }}
      >
        Lancer mon test gratuit
      </Link>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Gratuit, sans carte bancaire. Aucune promesse de position : une mesure datée, avec sa marge d&apos;erreur.{' '}
        <Link href="/methode" className="underline">
          Voir la méthode
        </Link>
        .
      </p>
    </div>
  );
}
