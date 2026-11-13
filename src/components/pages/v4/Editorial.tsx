/**
 * Cadre des pages éditoriales longues (comparatifs, méthode, sécurité) : en-tête, visuel de synthèse, puis le texte
 * avec sommaire suivi. Les blocs de src/lib/seo/editorial (QaSection, TableWrap…) y sont restylés par .editorial :
 * réponse courte mise en avant, tableaux à première colonne figée, titres plus lisibles. Composant serveur.
 */
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, SitePage, type Crumb } from "@/components/pages/ui";
import { DocLayout } from "./DocLayout";
import type { TocItem } from "./TocSpy";
import s from "./v4.module.css";

export function EditorialFrame({
  crumbs,
  title,
  meta,
  intro,
  visual,
  toc,
  wide = false,
  children,
  head,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  meta?: ReactNode;
  intro?: ReactNode;
  visual?: ReactNode;
  toc: TocItem[];
  wide?: boolean;
  children: ReactNode;
  /** JSON-LD et autres éléments invisibles. */
  head?: ReactNode;
}) {
  return (
    <SitePage>
      {head}
      <section aria-labelledby="page-title" className="relative overflow-hidden bg-canvas">
        <div aria-hidden="true" className="scope-grid absolute inset-x-0 top-0 h-72 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
        <Container className="relative pb-10 pt-8 sm:pb-14 sm:pt-12">
          <Breadcrumbs items={crumbs} />
          <h1 id="page-title" className="mt-6 max-w-4xl text-[2.1rem] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[3rem]">
            {title}
          </h1>
          {meta}
          {intro ? <div className="mt-5 max-w-[64ch] text-[1.08rem] leading-relaxed text-ink/80">{intro}</div> : null}
          {visual ? <div className="mt-10">{visual}</div> : null}
        </Container>
      </section>
      <Container className="pb-16 pt-8 sm:pt-12">
        <DocLayout toc={toc} idBase="page">
          <div className={`${s.editorial} ${wide ? s.editorialWide : ""}`}>{children}</div>
        </DocLayout>
      </Container>
    </SitePage>
  );
}

export type Choice = { title: string; verdict: string; figure: ReactNode; figureNote: string; mark?: boolean };

/** « Quelle option choisir ? » en cartes côte à côte : une phrase et un ordre de prix chacune. */
export function ChoiceCards({ items, caption, label }: { items: Choice[]; caption?: ReactNode; label: string }) {
  return (
    <figure className="m-0" aria-label={label}>
      <ul className={`${s.choices} ui-cascade`}>
        {items.map((c) => (
          <li key={c.title} className={s.choice} data-mark={c.mark ? "" : undefined}>
            <p className={s.choiceTitle}>{c.title}</p>
            <p className={s.choiceVerdict}>{c.verdict}</p>
            <p className={s.choiceFigure}>{c.figure}</p>
            <p className={s.choiceNote}>{c.figureNote}</p>
          </li>
        ))}
      </ul>
      {caption ? <figcaption className="mt-3 text-[0.88rem] text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
