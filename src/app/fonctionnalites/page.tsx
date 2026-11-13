import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { SectionTitle, CheckIcon } from "@/components/site/blocks";
import { CtaBand, MainActions, PageHero, SitePage } from "@/components/pages/ui";
import { FeatureVisual } from "@/components/pages/visuals";
import { StepPath } from "@/components/pages/v4/diagrams";
import { Icon, type IconName } from "@/components/app/icons";
import v4 from "@/components/pages/v4/v4.module.css";

const PILLAR_ICON: IconName[] = ["eye", "search", "check", "trend"];
const SOCLE_ICON: Record<string, IconName> = {
  "analyse-60-secondes": "search",
  "audit-seo": "list",
  "positions-et-search-console": "trend",
  performance: "bolt",
  "geo-avance": "compass",
  "agent-de-publication": "send",
  barometres: "podium",
};
const MODULE_ICON: Record<string, IconName> = {
  "questions-suivies": "list",
  copilote: "spark",
  "audit-de-page": "file",
  local: "map",
  "e-commerce": "store",
  "rapports-et-partage": "share",
};
import { FEATURES_UPDATED, MODULES, PILLARS, SOCLE_FEATURES, featurePath, getFeature } from "@/components/pages/features-data";
import { SEO_CHECK_COUNT } from "@/components/site/v5-blocks";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { abs } from "@/lib/seo/site";

/** Chiffres des comptes démo (trafic glissant sur 30 jours) recalculés chaque jour. */
export const revalidate = 86400;

const PATH = "/fonctionnalites";
const TITLE = "Fonctionnalités : SEO, GEO et agent de publication";
const DESCRIPTION = `Analyse du site en 60 s, audit SEO de ${SEO_CHECK_COUNT} contrôles, Search Console et positions, GEO avancé, agent de publication, mesure des IA.`;

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

/** Sous-fonctions liées depuis l'accueil (grille bento) : chaque ancre existe sur cette page. */
const SUB: Record<string, { id: string; parent: string; section: string }[]> = {
  comprendre: [
    { id: "sources", parent: "comprendre", section: "sources" },
    { id: "verite", parent: "comprendre", section: "verite" },
  ],
  agir: [
    { id: "taches", parent: "agir", section: "taches" },
    { id: "pages-hebergees", parent: "agir", section: "pages-hebergees" },
    { id: "plugin", parent: "agir", section: "plugin" },
  ],
  prouver: [
    { id: "trafic", parent: "prouver", section: "trafic" },
    { id: "chiffre-affaires", parent: "prouver", section: "chiffre-affaires" },
  ],
};

export default function FonctionnalitesPage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Fonctionnalités", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "CollectionPage", dateModified: FEATURES_UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    {
      "@type": "ItemList",
      "@id": `${abs(PATH)}#liste`,
      itemListElement: [...SOCLE_FEATURES, ...PILLARS, ...MODULES].map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.name, url: abs(featurePath(f.slug)) })),
    },
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Fonctionnalités" }]}
        title="Tout ce qu'il faut pour être trouvé sur Google et cité par les IA."
        lead="Une analyse réelle de votre site, l'audit SEO et GEO, vos données Google, la mesure des IA, et un agent qui applique les corrections que vous validez."
        aside={
          <StepPath
            label="La boucle de Repéré en quatre étapes, répétée chaque mois"
            start={{ icon: "search", text: "Les questions de vos clients" }}
            steps={PILLARS.map((p, i) => ({ href: `#${p.slug}`, icon: PILLAR_ICON[i] ?? "check", title: p.name, text: p.summary }))}
            end={
              <p className="flex items-center gap-2 pl-1 text-[0.92rem] text-muted">
                <Icon name="trend" size={18} className="text-primary" />
                Puis on remesure, chaque mois : la boucle repart.
              </p>
            }
          />
        }
      >
        <MainActions />
      </PageHero>

      <section id="socle" aria-labelledby="socle-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
        <Container>
          <SectionTitle
            id="socle-title"
            title="Le socle : votre site, Google et les IA"
            intro="Ce que Repéré fait sur votre site et dans Google, avant même de parler des réponses des IA."
          />
          <ul className={`${v4.cardGrid} mt-10`} data-cols="3">
            {SOCLE_FEATURES.map((m, i) => (
              <Reveal as="li" i={i} key={m.slug} id={`f-${m.slug}`} className="scroll-mt-24">
                <article className={v4.card}>
                  <span className={v4.cardIcon} aria-hidden="true">
                    <Icon name={SOCLE_ICON[m.slug] ?? "check"} size={22} />
                  </span>
                  <h3 className={v4.cardTitle}>
                    <Link href={featurePath(m.slug)}>{m.name}</Link>
                  </h3>
                  <p className={v4.cardText}>{m.summary}</p>
                  <span className={`${v4.cardMeta} ${v4.cardGo}`} aria-hidden="true">Voir la fonction</span>
                </article>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {PILLARS.map((p, idx) => {
        const subs = SUB[p.slug] ?? [];
        return (
          <section key={p.slug} id={p.slug} aria-labelledby={`${p.slug}-title`} className={`scroll-mt-20 py-20 sm:py-24 ${idx % 2 ? "bg-white" : "bg-canvas"}`}>
            <Container>
              <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${idx % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <p className="font-display text-lg font-semibold text-primary">
                    {idx + 1}. {p.name}
                  </p>
                  <h2 id={`${p.slug}-title`} className="mt-2 text-[1.9rem] font-bold leading-[1.1] sm:text-[2.4rem]">
                    {p.title}
                  </h2>
                  <p className="mt-4 max-w-[58ch] text-lg text-ink/75">{p.lead}</p>
                  {subs.length ? (
                    <ul className="mt-6 space-y-4">
                      {subs.map((s) => {
                        const sec = getFeature(s.parent)?.sections?.find((x) => x.id === s.section);
                        if (!sec) return null;
                        return (
                          <li key={s.id} id={s.id} className="scroll-mt-24">
                            <h3 className="flex gap-2.5 text-lg font-bold">
                              <CheckIcon className="mt-1 text-primary" />
                              <Link href={`${featurePath(s.parent)}#${s.section}`} className="hover:text-primary hover:underline underline-offset-4">
                                {sec.title}
                              </Link>
                            </h3>
                            <p className="ml-[1.85rem] mt-1 max-w-[58ch] text-[0.98rem] text-ink/75">{sec.text}</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <Link href={featurePath(p.slug)} className="mt-7 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
                    Tout savoir sur « {p.name} »
                  </Link>
                </div>
                <div className="min-w-0">
                  <FeatureVisual id={p.visual} />
                  <p className="mt-2 text-[0.85rem] text-muted">{p.visualCaption}</p>
                </div>
              </div>
            </Container>
          </section>
        );
      })}

      <section id="modules" aria-labelledby="modules-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
        <Container>
          <SectionTitle
            id="modules-title"
            title="Les modules"
            intro="Les mêmes mesures, vues sous l'angle de votre activité ou de votre façon de travailler."
          />
          <ul className={`${v4.cardGrid} mt-10`} data-cols="3">
            {MODULES.map((m, i) => (
              <Reveal as="li" i={i} key={m.slug} id={m.slug === "copilote" ? "copilote" : undefined} className="scroll-mt-24">
                <article className={v4.card}>
                  <span className={v4.cardIcon} aria-hidden="true">
                    <Icon name={MODULE_ICON[m.slug] ?? "check"} size={22} />
                  </span>
                  <h3 className={v4.cardTitle}>
                    <Link href={featurePath(m.slug)}>{m.name}</Link>
                  </h3>
                  <p className={v4.cardText}>{m.summary}</p>
                  <span className={`${v4.cardMeta} ${v4.cardGo}`} aria-hidden="true">Voir le module</span>
                </article>
              </Reveal>
            ))}
          </ul>
          <p className="mt-10 text-[0.98rem] text-ink/80">
            Les connexions avec vos outils sont sur la page{" "}
            <Link href="/integrations" className="font-semibold text-primary underline underline-offset-4">
              intégrations
            </Link>
            , et la protection de vos données sur la page{" "}
            <Link href="/securite" className="font-semibold text-primary underline underline-offset-4">
              sécurité
            </Link>
            .
          </p>
        </Container>
      </section>

      <CtaBand
        title="Voyez-le sur votre propre site."
        text="L'analyse gratuite explore votre site en 60 secondes. L'offre Découverte suit ensuite 5 questions sur 3 IA, une fois par mois, gratuitement."
      />
    </SitePage>
  );
}
