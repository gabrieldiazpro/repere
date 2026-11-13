/**
 * Mise en page des documents longs (pages légales, méthode, comparatifs, sécurité) : sommaire suivi à gauche sur
 * bureau, sommaire repliable en tête sur mobile, colonne de lecture à 68 caractères. Composant serveur.
 */
import type { ReactNode } from "react";
import { TocSpy, type TocItem } from "./TocSpy";
import s from "./v4.module.css";

export function slugify(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function DocLayout({ toc, children, tocLabel = "Sommaire", idBase = "doc" }: { toc: TocItem[]; children: ReactNode; tocLabel?: string; idBase?: string }) {
  return (
    <div className={s.doc}>
      <details className={s.tocMobile}>
        <summary>
          <span>{tocLabel}</span>
          <span className={s.tocCount}>{toc.length} sections</span>
        </summary>
        <ol>
          {toc.map((it) => (
            <li key={it.id}>
              <a href={`#${it.id}`}>{it.label}</a>
            </li>
          ))}
        </ol>
      </details>
      <aside className={s.docAside}>
        <TocSpy items={toc} label={tocLabel} id={`${idBase}-toc`} />
      </aside>
      <div className={s.docBody}>{children}</div>
    </div>
  );
}

export default DocLayout;
