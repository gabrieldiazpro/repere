import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, Faq, FactsRow, Reassure, SectionTitle, type QA } from "@/components/site/blocks";
import { AiStrip } from "@/components/site/AiStrip";
import { Bento } from "@/components/site/Bento";
import { ProofWall } from "@/components/site/ProofWall";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { MeasureScene } from "@/components/motion/scenes/live";
import { UnderstandScene } from "@/components/motion/scenes/live";
import { ActScene } from "@/components/motion/scenes/ActScene";
import { ProveScene } from "@/components/motion/scenes/live";
import { HomeHero } from "@/components/site/HomeHero";
import { QuickAuditForm } from "@/components/motion/QuickAuditForm";
import { AgentFlow, ChecksMap, FamilyCompare, HeroAnalysisPreview, PUBLISH_PLATFORMS, SEO_CHECK_COUNT, TwoReaders } from "@/components/site/v5-blocks";
import { DemoClip } from "@/components/site/DemoClip";
import { SiteTabs } from "@/components/site/SiteTabs";
import { FACTS } from "@/components/site/facts";
import { DigestScreen, HallucinationScreen } from "@/components/site/mockups";
import { euros, tiersFor } from "@/components/site/plans-v2";
import { frequencySummary } from "@/components/site/offer-facts";
import { pageMeta } from "@/lib/seo/meta";
import { JsonLd } from "@/lib/seo/shell";
import { GUIDES, guidePath } from "@/lib/seo/guides";
import { PAGE_UPDATED } from "@/lib/seo/site";
import { faqPageLd, graph, organizationLd, webPageLd, websiteLd, ORG_ID } from "@/lib/seo/jsonld";
import { houseOrgExtras, mergeOrg } from "@/lib/seo/house";

const TITLE = "SEO et référencement IA (GEO) des sites pros | Repéré";
const DESCRIPTION =
  `Analyse de votre site en 60 s : ${SEO_CHECK_COUNT} contrôles SEO, ce que lisent ChatGPT, Gemini et Perplexity, vos 5 priorités, puis les corrections avec vous.`;

export const metadata = pageMeta({
  path: "/",
  title: TITLE,
  absoluteTitle: true,
  description: DESCRIPTION,
  ogTitle: "Google et les IA décident qui vos clients trouvent.",
});

/** Le balisage de l'organisation est complété par notre propre module d'exécution (dogfooding), une fois par jour. */
export const revalidate = 86400;

const RESOURCES = [
  { href: "/guides/seo-geo-sites-pros-2026", title: "SEO + GEO pour les sites pros en 2026", text: "Le guide de référence : ce que Google et les IA lisent, et dans quel ordre agir." },
  { href: "/geo", title: "Qu'est-ce que le GEO ?", text: "La définition du référencement IA et les leviers qui comptent, sources à l'appui." },
  { href: "/methode", title: "Notre méthode", text: "Les contrôles SEO, les règles GEO et leur niveau de preuve, la mesure des IA." },
  { href: "/comparatif", title: "Le comparatif", text: "Repéré, Semrush, Ahrefs, Screaming Frog, Peec, Otterly : pour qui chacun est fait." },
] as const;

/** Les quatre temps du service : une vraie suite (Mesurer → Prouver), d'où les numéros des onglets. */
const PILLARS = [
  {
    id: "mesurer",
    verb: "Mesurer",
    hint: "Google et les IA",
    title: "Votre point de départ sur Google et dans les IA",
    text: "Votre site exploré et noté, vos positions et vos clics Search Console, et vos questions clients posées plusieurs fois à ChatGPT, Gemini, Perplexity et Claude. Chaque chiffre dit d'où il vient.",
    points: [`Analyse du site : ${SEO_CHECK_COUNT} contrôles SEO et l'audit GEO`, "Search Console, PageSpeed et positions suivies", `Réponses des IA avec marge d'erreur : ${frequencySummary()}`],
    video: "mesurer" as const,
    videoTitle: "Les réponses des IA, question par question",
  },
  {
    id: "comprendre",
    verb: "Comprendre",
    hint: "Pourquoi eux, pas vous",
    title: "Ce qui fait passer un concurrent devant vous",
    text: "Un titre en double, une page vide sans JavaScript, une adresse contradictoire, une source que lisent les IA et où vous manquez : chaque constat dit pourquoi il compte et ce qu'il faut faire.",
    points: ["5 priorités classées par effet et par effort", "Les sources que citent les IA, classées par opportunité", "Le niveau de preuve de chaque règle GEO"],
    video: "comprendre" as const,
    videoTitle: "Les sources des IA, et qui passe devant",
  },
  {
    id: "agir",
    verb: "Agir",
    hint: "Prêt ou appliqué",
    title: "La correction prête, ou appliquée sur votre site",
    text: "Titres, descriptions, balisage, redirections, réécriture de passages : l'agent prépare, vous validez, il publie sur WordPress, Shopify, Webflow ou PrestaShop, puis vérifie.",
    points: ["Avant / après visible, page par page", "Rien n'est publié sans votre accord", "Chaque changement s'annule en un clic"],
    video: "agir" as const,
    videoTitle: "Les actions de la semaine, déjà rédigées",
  },
  {
    id: "prouver",
    verb: "Prouver",
    hint: "Clics et visites",
    title: "Ce que le travail a changé, mesuré",
    text: "Chaque mois : vos clics Google, vos citations par les IA et les visites qui en viennent, avec les corrections faites marquées sur les courbes.",
    points: ["Clics et impressions Search Console, avant et après", "Visites venues de chatgpt.com, perplexity.ai, Gemini, Copilot", "Un rapport à montrer à votre associé"],
    video: "prouver" as const,
    videoTitle: "Les visites venues des IA, et le rapport du mois",
  },
];

const PARCOURS = [
  {
    seg: "local" as const,
    href: "/local",
    short: "commerce local",
    title: "Commerce local",
    done: ["SEO local : fiche Google, pages par ville et par service, balisage LocalBusiness", "Mêmes coordonnées partout : site, fiche, annuaires", "Avis : réponses rédigées, demandes à vos vrais clients"],
  },
  {
    seg: "pme" as const,
    href: "/pme",
    short: "PME",
    title: "PME et services B2B",
    done: ["Pages services et comparatifs qui répondent aux acheteurs", "Audit technique, titres, maillage, Search Console", "Présence sur les comparateurs et annuaires que citent les IA"],
  },
  {
    seg: "ecommerce" as const,
    href: "/e-commerce",
    short: "e-commerce",
    title: "E-commerce",
    done: ["Fiches produit réécrites, balisage Product et Offer", "Facettes et filtres : pages indexables ou non, sans gaspillage", "Flux Merchant Center vérifié pour Google Shopping"],
  },
];

const FAQ: QA[] = [
  {
    q: "Que fait exactement l'analyse gratuite en 60 secondes ?",
    a: `Notre robot RepereBot explore jusqu'à 60 pages de votre site en respectant votre robots.txt. Il passe ${SEO_CHECK_COUNT} contrôles SEO (indexation, titres, doublons, liens, images, balisage, mobile…) et l'audit GEO (accès des robots d'IA, contenu lisible sans JavaScript, identité, passages citables), puis vous donne un verdict, deux scores et vos 5 priorités.`,
  },
  {
    q: "Qu'est-ce que le GEO, et en quoi diffère-t-il du SEO ?",
    a: "Le SEO travaille votre place dans les résultats de Google. Le GEO (ou référencement IA) travaille vos chances d'être cité quand on interroge ChatGPT, Gemini ou Perplexity. Les deux partagent l'essentiel : des pages accessibles, lisibles et dignes de confiance. Le GEO ajoute les robots des IA, les passages citables et les sources que ces IA lisent.",
  },
  {
    q: "Repéré remplace-t-il Semrush ou Ahrefs ?",
    a: "Pas pour un expert qui a besoin d'un index de liens ou de recherches de mots-clés à grande échelle : ces suites sont meilleures sur ce point. Pour un dirigeant ou une petite équipe, Repéré couvre l'essentiel du SEO (audit, Search Console, positions) et ajoute ce qu'elles font peu : la mesure des IA avec marge d'erreur et des corrections appliquées sur votre site.",
  },
  {
    q: "Pouvez-vous garantir une place sur Google ou dans ChatGPT ?",
    a: "Non, et personne ne le peut honnêtement. Google et les IA décident seuls et changent souvent. Nous nous engageons sur ce qui dépend de nous : une analyse exacte, des explications claires, le travail fait et la mesure de son effet.",
  },
  {
    q: "Est-ce que l'agent publie sans mon accord ?",
    a: "Jamais. Chaque modification est montrée avant / après, attend votre validation, est journalisée et peut être annulée. Sans accès à votre site, vous recevez un fichier prêt à appliquer.",
  },
  {
    q: "Combien de temps avant de voir un effet ?",
    a: `Google prend en compte une correction technique en quelques jours à quelques semaines ; les IA, parfois plus. C'est pour ça que nous remesurons dans la durée (${frequencySummary()}) et marquons chaque correction sur vos courbes.`,
  },
  {
    q: "Que devenez-vous de mes données ?",
    a: "Elles sont hébergées dans l'Union européenne, jamais revendues, et supprimées à votre demande. Les accès à votre site et à la Search Console sont chiffrés. Le détail est dans notre politique de confidentialité.",
  },
];

function PillarPanel({ p }: { p: (typeof PILLARS)[number] }) {
  const fallback =
    p.id === "mesurer" ? <MeasureScene /> : p.id === "comprendre" ? <UnderstandScene /> : p.id === "agir" ? <ActScene /> : <ProveScene />;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <div>
        <h3 className="text-[1.6rem] font-bold leading-tight sm:text-[1.9rem]">{p.title}</h3>
        <p className="mt-3 max-w-[52ch] text-[1.02rem] text-ink/75">{p.text}</p>
        <ul className="mt-6 space-y-2.5 text-[0.98rem]">
          {p.points.map((t) => (
            <li key={t} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 text-primary" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">
        <DemoClip id={p.video} title={p.videoTitle} fallback={fallback} />
        {p.id === "prouver" ? (
          <p className="mt-2 text-[0.82rem] text-muted">Données de démonstration. Les effets réels varient ; nous ne promettons pas de résultat.</p>
        ) : null}
      </div>
    </div>
  );
}

function ParcoursPanel({ p }: { p: (typeof PARCOURS)[number] }) {
  const t = tiersFor(p.seg);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <dl className="grid grid-cols-2 gap-3 self-start">
        <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
          <dt className="text-[0.92rem] font-semibold">Essentiel</dt>
          <dd className="mt-1">
            <span className="tabular site-swap font-display text-[2.2rem] font-bold leading-none">{t.essentielMonth ? euros(t.essentielMonth.priceCents) : "–"}</span>
            <span className="text-sm text-muted">/mois</span>
            <span className="mt-2 block text-[0.88rem] text-muted">Vous faites, avec nos textes prêts. Sans engagement.</span>
          </dd>
        </div>
        <div className="on-dark relative rounded-2xl bg-primary p-5 text-white shadow-[0_24px_50px_-26px_rgba(30,26,92,.9)]">
          <dt className="text-[0.92rem] font-semibold text-white">Accompagné</dt>
          <dd className="mt-1">
            <span className="tabular site-swap font-display text-[2.2rem] font-bold leading-none">{t.accompagne ? euros(t.accompagne.priceCents) : "–"}</span>
            <span className="text-sm text-on-deep">/mois</span>
            <span className="mt-2 block text-[0.88rem] text-on-deep">Nous faisons, vous validez. 3 mois minimum.</span>
          </dd>
        </div>
      </dl>
      <div>
        <h3 className="font-display text-lg font-semibold">Ce que nous faisons pour vous en Accompagné</h3>
        <ul className="mt-3 space-y-2.5 text-[0.98rem]">
          {p.done.map((d) => (
            <li key={d} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 text-primary" />
              {d}
            </li>
          ))}
        </ul>
        <Link href={p.href} className={buttonClasses({ variant: "secondary", className: "lift mt-6" })}>
          Découvrir le parcours {p.short}
        </Link>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const org = mergeOrg(organizationLd({ withContext: false }), await houseOrgExtras());
  return (
    <>
      <JsonLd
        data={graph([
          org,
          websiteLd({ withContext: false }),
          webPageLd(
            "/",
            { name: TITLE, description: DESCRIPTION, dateModified: PAGE_UPDATED["/"], breadcrumb: false, about: ORG_ID },
            { withContext: false },
          ),
          faqPageLd("/", FAQ, { withContext: false }),
        ])}
      />
      <Header />
      <main id="contenu">
        <MotionRoot />
        {/* ---------- Hero : la promesse, UN appel (analyser mon site), l'aperçu d'analyse étiqueté ---------- */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden bg-canvas">
          <Parallax className="scope-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_30%,transparent_95%)]" />
          <Container className="relative pb-14 pt-8 sm:pb-20 sm:pt-14">
            <HomeHero preview={<HeroAnalysisPreview />}>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[0.82rem] font-medium text-ink/80 shadow-[0_0_0_1px_rgba(27,31,46,.08)] sm:text-[0.9rem]">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                SEO et référencement IA des sites professionnels
              </p>
              <h1
                id="hero-title"
                className="mt-5 text-[2.2rem] font-bold leading-[1.03] tracking-[-0.035em] text-ink sm:mt-6 sm:text-[3.3rem] lg:text-[3.35rem]"
              >
                Google et les IA décident qui vos clients trouvent.
              </h1>
              <p className="mt-4 max-w-[50ch] text-[1.05rem] text-ink/75 sm:mt-5 sm:text-[1.2rem]">
                Repéré analyse votre site pour de vrai, vous dit quoi corriger, et le fait avec vous. Commerces, PME, e-commerce.
              </p>
            </HomeHero>
          </Container>
        </section>

        {/* ---------- Deux lecteurs : Google classe des pages, les IA citent des passages ---------- */}
        <section aria-labelledby="lecteurs-title" className="border-y border-line/70 bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="lecteurs-title"
              title="Deux lecteurs décident de votre visibilité"
              intro="Google range des pages dans une liste. Les IA lisent quelques pages et en citent des passages. L'essentiel du travail sert aux deux."
            />
            <div className="mt-10">
              <TwoReaders />
            </div>
            <div className="mt-14">
              <h3 className="sr-only">Ce que disent les études</h3>
              <FactsRow facts={[FACTS.weeklyUse, FACTS.credoc, FACTS.g2Start, FACTS.valiuz]} />
            </div>
          </Container>
        </section>

        {/* ---------- Ce que l'analyse contrôle : chiffres lus dans le code ---------- */}
        <section id="controles" aria-labelledby="controles-title" className="bg-canvas py-20 sm:py-28">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                id="controles-title"
                title={`${SEO_CHECK_COUNT} contrôles SEO, l'audit GEO, et 5 priorités à la fin`}
                intro="Une vraie exploration de vos pages, pas un questionnaire. Puis un tri : ce qui compte le plus pour vous, et ce que ça demande."
              />
              <Link href="/analyse" className={buttonClasses({ variant: "secondary", className: "lift shrink-0" })}>
                Analyser mon site
              </Link>
            </div>
            <div className="mt-10">
              <ChecksMap />
            </div>
          </Container>
        </section>

        <AiStrip />

        {/* ---------- Méthode : 4 temps en onglets, chacun avec sa vidéo de démo ---------- */}
        <section id="methode" aria-labelledby="methode-title" className="bg-white py-20 sm:py-28">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                id="methode-title"
                title="Mesurer, comprendre, agir, prouver. Sur Google et sur les IA."
                intro="Quatre temps, chaque mois. Choisissez-en un pour le voir sur un compte démo."
              />
              <Link href="/demo" className={buttonClasses({ variant: "secondary", className: "lift shrink-0" })}>
                Toutes les vidéos de démo
              </Link>
            </div>
            <SiteTabs
              className="mt-10"
              label="Les quatre temps de Repéré"
              numbered
              tabs={PILLARS.map((p) => ({ id: p.id, label: p.verb, hint: p.hint, panel: <PillarPanel p={p} /> }))}
            />
          </Container>
        </section>

        {/* ---------- L'agent de publication ---------- */}
        <section id="agent" aria-labelledby="agent-title" className="on-dark relative overflow-hidden bg-primary-deep py-20 text-white sm:py-28">
          <div aria-hidden="true" className="scope-grid-dark absolute inset-0 opacity-70" />
          <Container className="relative">
            <SectionTitle
              id="agent-title"
              dark
              title="L'agent fait les corrections. Vous gardez la main."
              intro={`Connectez ${PUBLISH_PLATFORMS.join(", ").replace(/, ([^,]*)$/, " ou $1")} : l'agent applique les corrections que vous validez. Ailleurs, vous recevez un fichier prêt à déposer.`}
            />
            <div className="mt-10">
              <AgentFlow dark />
            </div>
            <p className="mt-6 text-[0.85rem] text-on-deep">
              Application directe dès l&apos;offre Essentiel ; l&apos;export est ouvert à tous.{" "}
              <Link href="/fonctionnalites/agent-de-publication" className="font-semibold text-white underline underline-offset-4">
                Ce que l&apos;agent peut modifier, plateforme par plateforme
              </Link>
            </p>
          </Container>
        </section>

        {/* ---------- Les IA disent-elles des choses fausses ? ---------- */}
        <section aria-labelledby="faux-title" className="bg-white py-20 sm:py-28">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <SectionTitle
                  id="faux-title"
                  title="Les IA disent‑elles des choses fausses sur vous ?"
                  intro="Oui, cela arrive : un mauvais numéro, des horaires périmés, un vieux prix. Les IA reprennent ce qu'elles trouvent ; nous comparons leurs réponses à votre fiche de vérité, à chaque mesure."
                />
                <ul className="mt-8 space-y-3 text-[1rem]">
                  {[
                    "Alerte dès qu'une IA se trompe sur vos coordonnées, vos prix ou vos services",
                    "La source probable de l'erreur, pour la corriger à la racine",
                    "La correction préparée, ou appliquée par l'agent",
                  ].map((t, i) => (
                    <Reveal as="li" i={i} key={t} className="flex gap-2.5">
                      <CheckIcon className="mt-0.5 text-primary" />
                      {t}
                    </Reveal>
                  ))}
                </ul>
              </div>
              <Reveal className="min-w-0">
                <HallucinationScreen />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* ---------- Le rendez-vous du lundi ---------- */}
        <section aria-labelledby="lundi-title" className="bg-canvas py-20 sm:py-28">
          <Container>
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
              <div>
                <SectionTitle
                  id="lundi-title"
                  title="Le lundi, une phrase, un rang et trois actions"
                  intro="Pas besoin d'ouvrir un tableau de bord : le lundi matin, vous recevez ce qui a bougé sur Google et dans les IA, et les trois choses à faire cette semaine, déjà préparées."
                />
                <ul className="mt-8 space-y-3 text-[1rem]">
                  {[
                    "La phrase de la semaine : ce qui a changé pour vous",
                    "Votre rang face aux concurrents que citent les IA",
                    "Trois actions prêtes, et les alertes s'il y en a",
                  ].map((t, i) => (
                    <Reveal as="li" i={i} key={t} className="flex gap-2.5">
                      <CheckIcon className="mt-0.5 text-primary" />
                      {t}
                    </Reveal>
                  ))}
                </ul>
              </div>
              <Reveal className="mx-auto w-full min-w-0 max-w-md">
                <DigestScreen />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* ---------- Fonctionnalités côté IA : grille bento ---------- */}
        <section aria-labelledby="features-title" className="bg-white py-20 sm:py-28">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                id="features-title"
                title="Côté IA : ce que vous suivez chaque mois"
                intro="Les réponses, leurs sources, les erreurs et les visites qui en viennent."
              />
              <Link href="/fonctionnalites" className={buttonClasses({ variant: "secondary", className: "shrink-0 lift" })}>
                Toutes les fonctionnalités
              </Link>
            </div>
            <div className="mt-10">
              <Bento />
            </div>
          </Container>
        </section>

        {/* ---------- Comparaison par familles d'outils ---------- */}
        <section aria-labelledby="compare-title" className="bg-canvas py-20 sm:py-28">
          <Container>
            <SectionTitle
              id="compare-title"
              title="Une suite SEO liste les problèmes. Un outil GEO mesure les IA. Repéré fait les deux, et corrige."
              intro="En français, pour des dirigeants plutôt que des experts, au prix d'un petit logiciel."
              className="max-w-3xl"
            />
            <Reveal className="mt-10">
              <FamilyCompare />
            </Reveal>
          </Container>
        </section>

        {/* ---------- Trois parcours, en onglets ---------- */}
        <section aria-labelledby="parcours-title" className="bg-white py-20 sm:py-28">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                id="parcours-title"
                title="Un moteur, trois parcours, deux façons de travailler"
                intro="Essentiel : chaque correction prête, appliquée par l'agent quand vous validez. Accompagné : nous pilotons le travail avec vous."
              />
              <Link href="/tarifs" className="inline-flex min-h-11 shrink-0 items-center font-semibold text-primary underline-offset-4 hover:underline">
                Voir tous les tarifs
              </Link>
            </div>
            <SiteTabs
              className="mt-10"
              label="Votre parcours"
              tabs={PARCOURS.map((p) => ({ id: p.seg, label: p.title, panel: <ParcoursPanel p={p} /> }))}
            />
          </Container>
        </section>

        {/* ---------- Mur de preuves honnêtes ---------- */}
        <section aria-labelledby="preuves-title" className="bg-canvas py-20 sm:py-28">
          <Container>
            <SectionTitle
              id="preuves-title"
              title="Pourquoi nous croire"
              intro="Pas de faux avis ni de logos empruntés : une méthode ouverte, des sources pour chaque règle, des marges d'erreur publiées et des engagements écrits."
            />
            <div className="mt-10">
              <ProofWall facts={[FACTS.g2Switch, FACTS.orbit]} />
            </div>
          </Container>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" aria-labelledby="faq-title" className="bg-white py-20 sm:py-28">
          <Container size="narrow">
            <SectionTitle id="faq-title" title="Vos questions, nos réponses franches" />
            <div className="mt-8">
              <Faq items={FAQ} idPrefix="faq" />
            </div>
            <p className="mt-8 text-[1rem] text-ink/80">
              Pour aller plus loin :{" "}
              <Link href="/guides/seo-geo-sites-pros-2026" className="font-semibold text-primary underline underline-offset-4">
                le guide SEO + GEO 2026
              </Link>{" "}
              et{" "}
              <Link href="/questions" className="font-semibold text-primary underline underline-offset-4">
                les questions les plus posées
              </Link>
              .
            </p>
          </Container>
        </section>

        {/* ---------- Ressources : maillage vers le contenu de référence ---------- */}
        <section aria-labelledby="ressources-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="ressources-title"
              title="Comprendre le SEO et le référencement IA"
              intro="Des pages de référence sourcées et datées, pour décider en connaissance de cause."
            />
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {RESOURCES.map((r, i) => (
                <Reveal as="li" i={i} key={r.href} className="group relative flex flex-col rounded-2xl bg-white p-5 transition-shadow duration-[var(--dur-base)] hover:shadow-[0_0_0_2px_var(--color-primary)]">
                  <h3 className="text-lg font-bold">
                    <Link href={r.href} className="after:absolute after:inset-0 after:rounded-2xl group-hover:text-primary">
                      {r.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-[0.95rem] text-ink/75">{r.text}</p>
                </Reveal>
              ))}
            </ul>
            <h3 className="mt-12 font-display text-lg font-semibold">Guides pratiques</h3>
            <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {GUIDES.map((g) => (
                <li key={g.slug}>
                  <Link href={guidePath(g)} className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* ---------- CTA final : l'analyse ---------- */}
        <section aria-labelledby="cta-title" className="on-dark relative overflow-hidden bg-primary py-20 text-white sm:py-28">
          <div aria-hidden="true" className="scope-grid-dark absolute inset-0 opacity-60" />
          <Container className="relative">
            <h2 id="cta-title" className="max-w-3xl text-[2.2rem] font-bold leading-[1.05] text-white sm:text-[3.4rem]">
              Voyez votre site comme Google et les IA le voient.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-on-deep">60 secondes, votre vrai site, vos 5 priorités.</p>
            <QuickAuditForm segment="local" idPrefix="cta" dark className="mt-8" submitLabel="Analyser mon site" shortLabel="Analyser" />
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Reassure dark items={["Gratuit", "Sans compte ni carte bancaire", "Robot respectueux de votre robots.txt"]} />
              <Link href="/tarifs?segment=agence" className="inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4 hover:no-underline">
                Vous êtes une agence ? L&apos;offre partenaire
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
