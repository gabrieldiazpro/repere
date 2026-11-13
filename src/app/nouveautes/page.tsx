import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CtaBand, PageHero, SitePage } from "@/components/pages/ui";
import { RisingBars } from "@/components/pages/v4/diagrams";
import v4 from "@/components/pages/v4/v4.module.css";
import { CHANGELOG, UPCOMING, frDate, sortedChangelog, type ChangeTag } from "@/components/pages/changelog";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { abs } from "@/lib/seo/site";

const PATH = "/nouveautes";
const TITLE = "Nouveautés : ce qui change dans Repéré";
const DESCRIPTION = "Le journal public des nouveautés de Repéré, de la V1 à aujourd'hui : fonctions livrées, améliorations et ce qui est en préparation.";

export const metadata = {
  ...pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION }),
  alternates: { canonical: PATH, types: { "application/rss+xml": [{ url: "/nouveautes/rss.xml", title: "Nouveautés de Repéré" }] } },
};

const TAG_CLASS: Record<ChangeTag, string> = {
  Nouveau: "bg-primary text-white",
  Amélioré: "bg-primary-bg text-primary",
  Corrigé: "bg-canvas text-ink ring-1 ring-inset ring-line",
};

export default function NouveautesPage() {
  const entries = sortedChangelog();
  const latest = entries[0]?.date;
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Nouveautés", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "CollectionPage", dateModified: latest }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    ...entries.map((e) => ({
      "@type": "BlogPosting",
      "@id": `${abs(PATH)}#${e.id}`,
      headline: e.title,
      description: e.text,
      datePublished: e.date,
      inLanguage: "fr-FR",
      author: orgRef(),
      publisher: orgRef(),
      url: `${abs(PATH)}#${e.id}`,
    })),
  ]);

  // Regroupement par version, dans l'ordre du plus récent.
  const versions = Array.from(new Set(entries.map((e) => e.version)));

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Nouveautés" }]}
        title="Ce qui change dans Repéré"
        lead="Chaque fonction livrée, datée. Ce qui est seulement prévu est séparé et n'a pas de date promise."
        aside={
          <RisingBars
            label="Entrées du journal, par version"
            unit="entrées"
            items={[...versions].reverse().map((v) => ({ label: v, value: entries.filter((e) => e.version === v).length }))}
          />
        }
      >
        <p className="mt-6 text-[0.95rem] text-ink/80">
          Suivre les nouveautés :{" "}
          <a href="/nouveautes/rss.xml" className="font-semibold text-primary underline underline-offset-4">
            flux RSS
          </a>
          . {CHANGELOG.length} entrées, dernière mise à jour le {latest ? frDate(latest) : "–"}.
        </p>
      </PageHero>

      <section aria-label="Journal" className="bg-white py-16 sm:py-20">
        <Container>
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
            <div className="space-y-16">
              {versions.map((v) => (
                <section key={v} aria-labelledby={`version-${v}`}>
                  <h2 id={`version-${v}`} className="font-display text-3xl font-bold">
                    {v}
                  </h2>
                  <div data-reveal="" className={`${v4.timelineWrap} relative`}>
                  <span aria-hidden="true" className={v4.timelineRail} />
                  <ol className={v4.timeline}>
                    {entries
                      .filter((e) => e.version === v)
                      .map((e, k) => (
                        <li key={e.id} id={e.id} className="relative scroll-mt-24 pb-10 last:pb-0" style={{ ["--k" as string]: Math.min(k, 8) }}>
                          <span aria-hidden="true" className={v4.timelineDot} />
                          <div className="flex flex-wrap items-center gap-2 text-[0.88rem]">
                            <time dateTime={e.date} className="text-muted">
                              {frDate(e.date)}
                            </time>
                            <span className={`rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold ${TAG_CLASS[e.tag]}`}>{e.tag}</span>
                          </div>
                          <h3 className="mt-2 text-xl font-bold">{e.title}</h3>
                          <p className="mt-1.5 max-w-[62ch] text-[1rem] text-ink/75">{e.text}</p>
                          {e.href ? (
                            <Link href={e.href} className="mt-2 inline-flex min-h-10 items-center font-semibold text-primary underline-offset-4 hover:underline">
                              Voir
                              <span className="sr-only"> : {e.title}</span>
                            </Link>
                          ) : null}
                        </li>
                      ))}
                  </ol>
                  </div>
                </section>
              ))}
            </div>
            <aside aria-labelledby="prevu-title" className="h-fit rounded-2xl bg-canvas p-6 lg:sticky lg:top-24">
              <h2 id="prevu-title" className="font-display text-xl font-bold">
                En préparation
              </h2>
              <p className="mt-1 text-[0.9rem] text-muted">Sans date promise. Ces fonctions ne sont pas encore disponibles.</p>
              <ul className="mt-4 space-y-4">
                {UPCOMING.map((u) => (
                  <li key={u.title}>
                    <p className="font-semibold">{u.title}</p>
                    <p className="text-[0.92rem] text-ink/75">{u.text}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Container>
      </section>

      <CtaBand title="Essayez la version d'aujourd'hui." text="Compte gratuit, 5 questions suivies, sans carte bancaire." />
    </SitePage>
  );
}
