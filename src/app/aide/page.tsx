import Link from "next/link";
import { DocLayout } from "@/components/pages/v4/DocLayout";
import v4 from "@/components/pages/v4/v4.module.css";
import { Container } from "@/components/ui/Container";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_UPDATED, helpPath } from "@/components/pages/aide-data";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { abs } from "@/lib/seo/site";

const PATH = "/aide";
const TITLE = "Centre d'aide de Repéré";
const DESCRIPTION = "Réponses courtes pour bien utiliser Repéré : créer un compte, lire votre score, faire une tâche, installer le script, partager un rapport, gérer vos données.";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

const catId = (c: string) =>
  c
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function AidePage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Aide", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "CollectionPage", dateModified: HELP_UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    {
      "@type": "ItemList",
      "@id": `${abs(PATH)}#articles`,
      itemListElement: HELP_ARTICLES.map((a, i) => ({ "@type": "ListItem", position: i + 1, name: a.title, url: abs(helpPath(a.slug)) })),
    },
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Aide" }]}
        title="Centre d'aide"
        lead={`${HELP_ARTICLES.length} réponses courtes, sans jargon. Vous ne trouvez pas ? Écrivez-nous.`}
      >
      </PageHero>

      <section aria-label="Articles" className="bg-canvas pb-16 pt-4 sm:pb-20">
        <Container>
          <DocLayout toc={HELP_CATEGORIES.map((c) => ({ id: catId(c), label: `${c} (${HELP_ARTICLES.filter((a) => a.category === c).length})` }))} tocLabel="Rubriques" idBase="aide">
          <div className="space-y-14">
            {HELP_CATEGORIES.map((c) => (
              <section key={c} id={catId(c)} aria-labelledby={`${catId(c)}-title`} className="scroll-mt-24">
                <h2 id={`${catId(c)}-title`} className="font-display text-2xl font-bold">
                  {c}
                </h2>
                <div className="mt-5">
                  <ul className={`${v4.cardGrid} ui-cascade`}>
                    {HELP_ARTICLES.filter((a) => a.category === c).map((a) => (
                      <li key={a.slug}>
                        <article className={v4.card}>
                          <h3 className={v4.cardTitle}>
                            <Link href={helpPath(a.slug)}>{a.title}</Link>
                          </h3>
                          <p className={v4.cardText}>{a.summary}</p>
                          <span className={`${v4.cardMeta} ${v4.cardGo}`} aria-hidden="true">Lire la réponse</span>
                        </article>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
          <p className="mt-14 text-[1rem] text-ink/80">
            Une autre question ? <Link href="/contact" className={linkClass}>Contactez-nous</Link> ; réponse sous 48 heures ouvrées. Sur le
            référencement IA en général : <Link href="/questions" className={linkClass}>les questions fréquentes</Link>.
          </p>
          </DocLayout>
        </Container>
      </section>
    </SitePage>
  );
}
