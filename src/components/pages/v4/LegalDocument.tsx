/**
 * Pages légales V4 (/cgv, /mentions-legales, /confidentialite, /dpa) : même texte et mêmes données que LegalPage
 * (src/lib/seo/shell.tsx), présentés avec un sommaire cliquable qui suit la lecture et des sections aérées.
 */
import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, SitePage } from "@/components/pages/ui";
import { Hl, ValidationNotice, type LegalSection } from "@/lib/seo/shell";
import { breadcrumbListLd } from "@/lib/seo/jsonld";
import { DocLayout, slugify } from "./DocLayout";
import s from "./v4.module.css";

/** « 2 bis. Contenu des offres » → ["2 bis", "Contenu des offres"] ; sans numéro → [null, titre]. */
export function splitNumber(title: string): [string | null, string] {
  const m = /^(\d+(?:\s?(?:bis|ter|quater))?)\.\s+(.*)$/.exec(title);
  return m ? [m[1], m[2]] : [null, title];
}

/** Met en gras l'intitulé d'un point de liste (« Test gratuit : … ») sans changer le texte. */
export function leadIn(t: string): [string | null, string] {
  const i = t.indexOf(" : ");
  if (i < 3 || i > 70 || t.slice(0, i).includes("[")) return [null, t];
  return [t.slice(0, i + 3), t.slice(i + 3)];
}

export function legalToc(sections: LegalSection[]) {
  const seen = new Map<string, number>();
  return sections.map((sec) => {
    let id = slugify(sec.title) || "section";
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n + 1}`;
    const [num, rest] = splitNumber(sec.title);
    return { id, label: num ? `${num}. ${rest}` : rest };
  });
}

export function LegalDocument({
  title,
  updated,
  sections,
  path,
  intro,
  extra,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
  path?: string;
  intro?: ReactNode;
  /** Contenu ajouté en fin de document (ex. tableau des sous-traitants). */
  extra?: ReactNode;
}) {
  const toc = legalToc(sections);
  return (
    <SitePage jsonLd={path ? breadcrumbListLd(path, [{ name: "Accueil", path: "/" }, { name: title, path }]) : undefined}>
      <section aria-labelledby="legal-title" className="bg-canvas">
        <Container className="pb-10 pt-8 sm:pb-12 sm:pt-12">
          {path ? <Breadcrumbs items={[{ name: "Accueil", href: "/" }, { name: title }]} /> : null}
          <h1 id="legal-title" className="mt-6 max-w-3xl text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
            {title}
          </h1>
          <p className="mt-3 text-[0.95rem] text-muted">
            Dernière mise à jour : <Hl text={updated} />
          </p>
          {intro ? <div className="mt-4 max-w-[68ch] text-[1.02rem] text-ink/80">{intro}</div> : null}
        </Container>
      </section>
      <Container className="py-10 sm:py-14">
        <DocLayout toc={toc} idBase="legal">
          <div className={s.notice}>
            <ValidationNotice />
          </div>
          {sections.map((sec, i) => {
            const [num, rest] = splitNumber(sec.title);
            return (
              <section key={toc[i].id} id={toc[i].id} aria-labelledby={`${toc[i].id}-t`} className={s.legalSection}>
                <h2 id={`${toc[i].id}-t`} className={s.legalH2}>
                  {num ? (
                    <>
                      <span className={s.legalNum}>{num}.</span> <span>{rest}</span>
                    </>
                  ) : (
                    rest
                  )}
                </h2>
                {sec.paras?.map((p, k) => (
                  <p key={k} className={s.legalP}>
                    <Hl text={p} />
                  </p>
                ))}
                {sec.list ? (
                  <ul className={s.legalList}>
                    {sec.list.map((l, k) => {
                      const [lead, body] = leadIn(l);
                      return (
                        <li key={k}>
                          {lead ? (
                            <>
                              <strong className="font-semibold text-ink">
                                <Hl text={lead} />
                              </strong>
                              <Hl text={body} />
                            </>
                          ) : (
                            <Hl text={l} />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {sec.table ? (
                  <div className={s.tableWrap} tabIndex={0} role="region" aria-label={`Tableau : ${rest}`}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          {sec.table.head.map((h) => (
                            <th key={h} scope="col">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.table.rows.map((r, k) => (
                          <tr key={k}>
                            {r.map((c, j) =>
                              j === 0 ? (
                                <th key={j} scope="row">
                                  <Hl text={c} />
                                </th>
                              ) : (
                                <td key={j}>
                                  <Hl text={c} />
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {sec.after?.map((p, k) => (
                  <p key={`a${k}`} className={s.legalP}>
                    <Hl text={p} />
                  </p>
                ))}
              </section>
            );
          })}
          {extra}
        </DocLayout>
      </Container>
    </SitePage>
  );
}

export default LegalDocument;
