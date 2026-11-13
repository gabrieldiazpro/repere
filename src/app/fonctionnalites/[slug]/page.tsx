import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { CheckIcon } from "@/components/site/blocks";
import { CtaBand, LimitsNote, MainActions, PageHero, SitePage } from "@/components/pages/ui";
import { FeatureVisual } from "@/components/pages/visuals";
import px from "@/components/pages/pages.module.css";
import { FEATURES, FEATURES_UPDATED, featurePath, getFeature } from "@/components/pages/features-data";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd, SOFTWARE_ID } from "@/lib/seo/jsonld";
import type { LandingSegment } from "@/components/site/nav";

/** Chiffres des comptes démo (trafic glissant sur 30 jours) recalculés chaque jour. */
export const revalidate = 86400;

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) return {};
  return pageMeta({ path: featurePath(f.slug), title: f.seoTitle ?? f.title, description: f.description });
}

const SEGMENT_OF: Record<string, LandingSegment | undefined> = { local: "local", "e-commerce": "ecommerce" };

export default async function FeaturePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) notFound();
  const path = featurePath(f.slug);
  const segment = SEGMENT_OF[f.slug];
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Fonctionnalités", path: "/fonctionnalites" },
    { name: f.name, path },
  ];
  const jsonLd = graph([
    webPageLd(path, { name: f.title, description: f.description, dateModified: FEATURES_UPDATED, about: SOFTWARE_ID }, { withContext: false }),
    breadcrumbListLd(path, crumbs, { withContext: false }),
  ]);
  const related = f.related.map(getFeature).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <SitePage jsonLd={jsonLd} segment={segment}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Fonctionnalités", href: "/fonctionnalites" }, { name: f.name }]}
        title={f.title}
        lead={f.lead}
        aside={
          <figure className="min-w-0">
            <FeatureVisual id={f.visual} />
            <figcaption className="mt-2 text-[0.85rem] text-muted">
              {f.visualCaption} <span className="whitespace-nowrap">Données de démonstration.</span>
            </figcaption>
          </figure>
        }
      >
        <MainActions segment={segment} />
        <p className="mt-4 text-[0.92rem] text-muted">Inclus : {f.plans}</p>
      </PageHero>

      {/* Le problème, en une idée (le visuel est dans l'en-tête) */}
      <section aria-labelledby="probleme-title" className="bg-white py-16 sm:py-20">
        <Container>
          <Reveal className={px.problem}>
            <h2 id="probleme-title" className="text-[1.9rem] font-bold leading-[1.1] sm:text-[2.4rem]">
              {f.problem.title}
            </h2>
            <p className="max-w-[56ch] text-lg text-ink/75">{f.problem.text}</p>
          </Reveal>
        </Container>
      </section>

      {/* Comment ça marche : une vraie séquence, donc numérotée */}
      <section aria-labelledby="comment-title" className="bg-canvas py-20 sm:py-24">
        <Container>
          <h2 id="comment-title" className="text-[1.9rem] font-bold leading-[1.1] sm:text-[2.4rem]">
            Comment ça marche
          </h2>
          <Reveal as="ol" className={`mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 ${px.steps}`}>
            {f.how.map((s, i) => (
              <li key={s.title} className={px.step} style={{ ["--k" as string]: i }}>
                <span className={px.stepTrack} aria-hidden="true" />
                <p className="tabular font-display text-sm font-semibold text-primary">
                  <span className={px.stepDot} aria-hidden="true">{i + 1}</span>
                  Étape {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-[0.98rem] text-ink/75">{s.text}</p>
              </li>
            ))}
          </Reveal>
        </Container>
      </section>

      {f.sections?.length ? (
        <section aria-labelledby="detail-title" className="bg-white py-20 sm:py-24">
          <Container>
            <h2 id="detail-title" className="text-[1.9rem] font-bold leading-[1.1] sm:text-[2.4rem]">
              En détail
            </h2>
            {f.sections.length > 2 ? (
              <nav aria-label="Sommaire de la page" className="mt-6">
                <ol className={px.toc}>
                  {f.sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`}>{s.title}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
            <div className={f.sections.some((s) => s.visual) ? "mt-12 space-y-16" : `mt-10 ${px.cards}`}>
              {f.sections.map((s, i) => (
                <Reveal as="article" i={i} key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={`scroll-mt-24 ${s.visual ? "" : px.card}`}>
                  <div className={s.visual ? "grid items-center gap-10 lg:grid-cols-2 lg:gap-16" : ""}>
                    <div>
                      <h3 id={`${s.id}-title`} className="text-2xl font-bold">
                        {s.title}
                      </h3>
                      <p className="mt-3 max-w-[58ch] text-[1.05rem] text-ink/75">{s.text}</p>
                      <ul className="mt-5 space-y-2.5">
                        {s.points.map((pt) => (
                          <li key={pt} className="flex gap-2.5">
                            <CheckIcon className="mt-0.5 text-primary" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {s.visual ? (
                      <div className="min-w-0">
                        <FeatureVisual id={s.visual} />
                      </div>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <section aria-label="Limites" className="bg-canvas py-16 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <LimitsNote id="limites-title" items={f.limits} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="voir-aussi-title" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 id="voir-aussi-title" className="font-display text-2xl font-bold">
            À voir aussi
          </h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={featurePath(r.slug)} className="lift flex h-full flex-col rounded-2xl bg-canvas p-5 hover:shadow-[0_0_0_1px_var(--color-primary)]">
                  <span className="text-lg font-bold">{r.name}</span>
                  <span className="mt-1.5 text-[0.95rem] text-ink/75">{r.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand
        title="Essayez sur votre entreprise."
        text="Créez un compte gratuit : 5 questions suivies sur 3 IA. Ou regardez d'abord la démo, sur des comptes fictifs."
        segment={segment}
      />
    </SitePage>
  );
}
