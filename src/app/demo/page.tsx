import Link from "next/link";
import { statSync } from "node:fs";
import path from "node:path";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { DemoClip } from "@/components/site/DemoClip";
import { HeroScene } from "@/components/motion/scenes/HeroScene";
import { demoHeroScene } from "@/components/site/demo-figures";
import { DEMO_VIDEO_LABELS, findDemoVideo, type DemoVideoId } from "@/components/motion/videos";
import { Faq, SectionTitle, type QA } from "@/components/site/blocks";
import { CtaBand, PageHero, SitePage } from "@/components/pages/ui";
import { FeatureVisual } from "@/components/pages/visuals";
import { DEMO_ACCOUNTS, DEMO_CLIPS, demoAppHref } from "@/components/pages/demo-data";
import { featurePath } from "@/components/pages/features-data";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, faqPageLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { abs } from "@/lib/seo/site";

/** Chiffres des comptes démo (trafic glissant sur 30 jours) recalculés chaque jour. */
export const revalidate = 86400;

const PATH = "/demo";
const TITLE = "Démo de Repéré : vidéos et compte démo à explorer";
const DESCRIPTION =
  "Regardez Repéré en action puis explorez l'application sur un compte démo : artisan, PME ou e-commerce. Sans inscription, données fictives étiquetées.";
const UPDATED = "2026-11-09";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

const FAQ: QA[] = [
  { q: "Faut-il s'inscrire pour voir la démo ?", a: "Non. Les vidéos et les trois comptes démo sont ouverts sans inscription ni e-mail." },
  {
    q: "Les données de la démo sont-elles réelles ?",
    a: "Non. Plomberie Martin, Paysia et Maison Sora sont des entreprises fictives. Les écrans sont ceux de l'application réelle, remplis avec des données de démonstration étiquetées comme telles.",
  },
  { q: "Puis-je modifier quelque chose dans le compte démo ?", a: "Les comptes démo sont en lecture seule : vous pouvez tout ouvrir, rien n'est enregistré." },
  {
    q: "Comment voir mes propres résultats ?",
    a: "Créez un compte gratuit (offre Découverte) : 5 questions suivies sur 3 IA, une mesure par mois, sans carte bancaire. Ou lancez d'abord le test gratuit en quelques minutes.",
  },
];

/** VideoObject seulement pour une vidéo réellement présente (fichier dans public/videos). */
function videoLd(id: DemoVideoId) {
  const files = findDemoVideo(id);
  if (!files || !files.poster) return null;
  const src = files.mp4 ?? files.webm!;
  let uploadDate = UPDATED;
  try {
    uploadDate = statSync(path.join(process.cwd(), "public", src)).mtime.toISOString();
  } catch {
    /* date de la page */
  }
  return {
    "@type": "VideoObject",
    "@id": `${abs(PATH)}#video-${id}`,
    name: DEMO_VIDEO_LABELS[id],
    description: DEMO_VIDEO_LABELS[id],
    thumbnailUrl: abs(files.poster),
    contentUrl: abs(src),
    uploadDate,
    inLanguage: "fr-FR",
  };
}

export default function DemoPage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Démo", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    faqPageLd(PATH, FAQ, { withContext: false }),
    ...(["hero", "mesurer", "comprendre", "agir", "prouver"] as const).map(videoLd),
  ]);
  const first = DEMO_ACCOUNTS[0];

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Démo" }]}
        title="Voyez Repéré en action, puis essayez-le."
        lead="Trente secondes de vidéo pour comprendre, puis l'application réelle sur un compte démo pour explorer à votre rythme. Sans inscription."
        aside={
          <figure>
            <DemoClip id="hero" title="Repéré en 30 secondes" duration="0:35" fallback={<HeroScene segment="local" data={demoHeroScene("local")} />} />
          </figure>
        }
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={demoAppHref(first)} rel="nofollow" className={buttonClasses({ size: "lg", className: "lift" })}>
            Explorer la démo
          </Link>
          <a href="#comptes" className={buttonClasses({ size: "lg", variant: "secondary" })}>
            Choisir un autre compte
          </a>
        </div>
        <p className="mt-4 text-[0.92rem] text-muted">Données fictives, en lecture seule : rien de ce que vous faites n&apos;est enregistré.</p>
      </PageHero>

      <section aria-labelledby="explication-title" className="bg-canvas py-20 sm:py-24">
        <Container>
          <SectionTitle
            id="explication-title"
            title="Repéré de A à Z, en 2 minutes"
            intro="L'analyse en 60 secondes d'un site fictif, puis l'application semaine après semaine : mesurer, comprendre, agir, prouver. Sous-titrée, sans son."
          />
          <div className="mx-auto mt-10 max-w-4xl">
            <DemoClip id="explication" title="Repéré de A à Z, en 2 minutes" duration="1:55" fallback={<HeroScene segment="local" data={demoHeroScene("local")} />} />
          </div>
        </Container>
      </section>

      <section id="comptes" aria-labelledby="comptes-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
        <Container>
          <SectionTitle
            id="comptes-title"
            title="Choisissez le compte qui vous ressemble"
            intro="Trois entreprises fictives, trois parcours. Les écrans sont ceux de l'application, en lecture seule."
          />
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {DEMO_ACCOUNTS.map((a, i) => (
              <Reveal as="li" i={i} key={a.id} className="flex flex-col rounded-2xl bg-canvas p-6">
                <p className="text-[0.9rem] font-semibold text-muted">{a.activity}</p>
                <h3 className="mt-1 text-2xl font-bold">{a.name}</h3>
                <p className="mt-3 font-display text-[1.05rem] text-ink/85">{a.question}</p>
                <p className="mt-3 text-[0.98rem] text-ink/75">{a.text}</p>
                <div className="mt-auto pt-6">
                  <Link href={demoAppHref(a)} rel="nofollow" className={buttonClasses({ className: "w-full lift", size: "md" })} aria-label={`Explorer le compte démo ${a.name}`}>
                    Explorer ce compte
                  </Link>
                </div>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="clips-title" className="bg-canvas py-20 sm:py-24">
        <Container>
          <SectionTitle id="clips-title" title="Les quatre temps, en courtes démos" intro="Survolez une vidéo pour un aperçu, cliquez pour la regarder avec les sous-titres, en plein écran si vous voulez." />
          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-16 lg:grid-cols-2">
            {DEMO_CLIPS.map((c, i) => (
              <Reveal as="article" i={i % 2} key={c.id} aria-labelledby={`clip-${c.id}`} className="min-w-0">
                <h3 id={`clip-${c.id}`} className="text-xl font-bold">
                  {i + 1}. {c.title}
                </h3>
                <p className="mt-1.5 text-[0.98rem] text-ink/75">{c.text}</p>
                <div className="mt-5">
                  <DemoClip id={c.id} title={c.title} fallback={<FeatureVisual id={c.pillar} />} />
                </div>
                <Link href={featurePath(c.pillar)} className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
                  En savoir plus sur « {c.title} »
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="demo-faq-title" className="bg-white py-20 sm:py-24">
        <Container size="narrow">
          <SectionTitle id="demo-faq-title" title="Questions sur la démo" />
          <div className="mt-8">
            <Faq items={FAQ} idPrefix="faq-demo" />
          </div>
        </Container>
      </section>

      <CtaBand title="Et votre entreprise ?" text="Créez un compte gratuit pour suivre vos propres questions, ou lancez d'abord le test gratuit." />
    </SitePage>
  );
}
