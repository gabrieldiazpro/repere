import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, SitePage, linkClass } from "@/components/pages/ui";
import { HELP_ARTICLES, HELP_UPDATED, getHelpArticle, helpPath } from "@/components/pages/aide-data";
import { pageMeta } from "@/lib/seo/meta";
import { fmtDate } from "@/lib/seo";
import { articleLd, breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const a = getHelpArticle((await params).slug);
  if (!a) return {};
  return pageMeta({ path: helpPath(a.slug), title: `${a.title} (aide)`, description: a.summary, type: "article", publishedTime: HELP_UPDATED, modifiedTime: HELP_UPDATED });
}

export default async function AideArticlePage({ params }: { params: Promise<Params> }) {
  const a = getHelpArticle((await params).slug);
  if (!a) notFound();
  const path = helpPath(a.slug);
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Aide", path: "/aide" },
    { name: a.title, path },
  ];
  const jsonLd = graph([
    webPageLd(path, { name: a.title, description: a.summary, dateModified: HELP_UPDATED }, { withContext: false }),
    articleLd({ path, headline: a.title, description: a.summary, datePublished: HELP_UPDATED, dateModified: HELP_UPDATED, type: "TechArticle", withContext: false }),
    breadcrumbListLd(path, crumbs, { withContext: false }),
  ]);
  const siblings = HELP_ARTICLES.filter((x) => x.category === a.category && x.slug !== a.slug);

  return (
    <SitePage jsonLd={jsonLd}>
      <article aria-labelledby="aide-title" className="bg-white">
        <Container size="narrow" className="py-10 sm:py-14">
          <Breadcrumbs items={[{ name: "Accueil", href: "/" }, { name: "Aide", href: "/aide" }, { name: a.title }]} />
          <p className="mt-8 text-[0.95rem] font-semibold text-primary">{a.category}</p>
          <h1 id="aide-title" className="mt-1 text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
            {a.title}
          </h1>
          <p className="mt-4 text-lg text-ink/75">{a.summary}</p>
          <p className="mt-2 text-[0.9rem] text-muted">
            Mis à jour le <time dateTime={HELP_UPDATED}>{fmtDate(HELP_UPDATED)}</time>
          </p>
          <div className="mt-8 space-y-4 text-[1.05rem] leading-relaxed text-ink/85">
            {a.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {a.steps ? (
            <>
              <h2 className="mt-10 font-display text-xl font-bold">Marche à suivre</h2>
              <ol className="mt-4 space-y-4">
                {a.steps.map((s, i) => (
                  <li key={s} className="flex gap-4">
                    <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[0.95rem] font-bold text-white">{i + 1}</span>
                    <span className="pt-1 text-[1.03rem]">{s}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {a.note ? (
            <p className="mt-10 rounded-xl border-l-4 border-accent bg-canvas p-4 text-[1rem]">
              <strong className="font-semibold">À savoir : </strong>
              {a.note}
            </p>
          ) : null}
          {a.related?.length ? (
            <p className="mt-8 text-[1rem]">
              Voir aussi :{" "}
              {a.related.map((r, i) => (
                <span key={r.href}>
                  {i > 0 ? ", " : ""}
                  <Link href={r.href} className={linkClass}>
                    {r.label}
                  </Link>
                </span>
              ))}
              .
            </p>
          ) : null}

          {siblings.length ? (
            <nav aria-labelledby="meme-rubrique" className="mt-14 border-t border-line pt-8">
              <h2 id="meme-rubrique" className="font-display text-lg font-bold">
                Dans la même rubrique
              </h2>
              <ul className="mt-3 space-y-2">
                {siblings.map((s) => (
                  <li key={s.slug}>
                    <Link href={helpPath(s.slug)} className={linkClass}>
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <p className="mt-10 text-[0.95rem] text-muted">
            Cet article ne répond pas à votre question ? <Link href="/contact" className={linkClass}>Écrivez-nous</Link>.
          </p>
        </Container>
      </article>
    </SitePage>
  );
}
