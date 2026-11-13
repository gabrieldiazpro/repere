import Link from "next/link";
import { Icon, type IconName } from "@/components/app/icons";
import v4 from "@/components/pages/v4/v4.module.css";

const SEG_ICON: Record<"local" | "pme" | "ecommerce", IconName> = { local: "map", pme: "users", ecommerce: "store" };
import { Container } from "@/components/ui/Container";
import { CtaBand, PageHero, SitePage } from "@/components/pages/ui";
import { USE_CASES, USE_CASES_UPDATED, casUsagePath } from "@/components/pages/cas-usage-data";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { abs } from "@/lib/seo/site";

const PATH = "/cas-usage";
const TITLE = "Cas d'usage : Repéré pour votre métier";
const DESCRIPTION = "Plombiers, restaurants, instituts, éditeurs de logiciels, cabinets de conseil, marques de cosmétiques : ce que regardent les IA et ce que Repéré fait pour chacun.";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

const SEG = { local: "Commerce local", pme: "PME et services", ecommerce: "E-commerce" } as const;

export default function CasUsagePage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Cas d'usage", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "CollectionPage", dateModified: USE_CASES_UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    {
      "@type": "ItemList",
      "@id": `${abs(PATH)}#liste`,
      itemListElement: USE_CASES.map((u, i) => ({ "@type": "ListItem", position: i + 1, name: u.name, url: abs(casUsagePath(u.slug)) })),
    },
  ]);
  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Cas d'usage" }]}
        title="Ce que les IA regardent, métier par métier"
        lead="Les questions changent d'un métier à l'autre, les sources aussi. Six exemples détaillés, avec ce que Repéré fait concrètement."
      />
      <section aria-label="Métiers" className="bg-canvas pb-16 sm:pb-20">
        <Container>
          <ul className={`${v4.cardGrid} ui-cascade`} data-cols="3">
            {USE_CASES.map((u) => (
              <li key={u.slug}>
                <article className={v4.card}>
                  <div className="flex items-center gap-3">
                    <span className={v4.cardIcon} aria-hidden="true">
                      <Icon name={SEG_ICON[u.segment]} size={20} />
                    </span>
                    <span className="text-[0.88rem] font-semibold text-muted">{SEG[u.segment]}</span>
                  </div>
                  <h2 className={v4.cardTitle}>
                    <Link href={casUsagePath(u.slug)}>{u.name}</Link>
                  </h2>
                  <p className={v4.askBubble}>
                    <span className="sr-only">Question posée à une IA : </span>« {u.questions[0]} »
                  </p>
                  <span className={`${v4.cardMeta} ${v4.cardGo}`} aria-hidden="true">Voir ce que Repéré fait</span>
                </article>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[0.98rem] text-ink/80">
            Votre métier n&apos;est pas dans la liste ?{" "}
            <Link href="/visibilite-ia" className="font-semibold text-primary underline underline-offset-4">
              La visibilité IA par métier
            </Link>{" "}
            en couvre davantage.
          </p>
        </Container>
      </section>
      <CtaBand title="Voyez ce que les IA disent de vous." text="Compte gratuit, 5 questions suivies, sans carte bancaire." />
    </SitePage>
  );
}
