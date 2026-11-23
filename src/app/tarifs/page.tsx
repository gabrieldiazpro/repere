import Link from "next/link";
import { headers } from "next/headers";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { PricingExplorer } from "@/components/site/PricingExplorer";
import { Faq, SectionTitle, type QA } from "@/components/site/blocks";
import { PriceTable } from "@/components/site/PriceTable";
import { AiCoverageTable } from "@/components/site/AiStrip";
import { aiCoverageCounts } from "@/components/site/ai-coverage";
import { euros, fromPrice, tiersFor, VAT_NOTICE, type SiteSegment } from "@/components/site/plans-v2";
import { pageMeta } from "@/lib/seo/meta";
import { JsonLd } from "@/lib/seo/shell";
import { Byline } from "@/lib/seo/editorial";
import { PAGE_UPDATED } from "@/lib/seo/site";
import { breadcrumbListLd, faqPageLd, graph, softwareAppLd, webPageLd, SOFTWARE_ID } from "@/lib/seo/jsonld";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Reveal } from "@/components/motion/Reveal";
import { RoiCalculator, type RoiPrices } from "@/components/pages/RoiCalculator";
import { AccompagneProof } from "@/components/pages/AccompagneProof";
import { allCompareRows } from "@/components/pages/pricing-data";
import { AgencyPricing } from "@/components/site/AgencyPricing";
import { optionalEnginesLabel } from "@/components/site/offer-facts";
import { AGENCY_INCLUDED_CLIENTS, getAddon, formatPrice } from "@/lib/plans";
import { getPlan } from "@/lib/plans";

const PATH = "/tarifs";
const FROM = euros(fromPrice("local") ?? 2900);
const TITLE = `Tarifs SEO et référencement IA : gratuit, puis dès ${FROM}/mois`;
const DESCRIPTION = `Découverte gratuite pour toujours, Essentiel dès ${FROM}/mois, Accompagné dès ${euros(tiersFor("local").accompagne?.priceCents ?? 9900)}/mois, Agence ${euros(getPlan("agency_month").priceCents)}/mois. Aperçus IA de Google inclus. Prix nets.`;

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

type SP = Record<string, string | string[] | undefined>;

function parseSegment(v: string | null | undefined): SiteSegment | null {
  if (v === "pme" || v === "local" || v === "ecommerce" || v === "agence") return v;
  if (v === "e-commerce") return "ecommerce";
  if (v === "agency" || v === "agences") return "agence";
  return null;
}

/** Parcours d'origine déduit de la page précédente du site (en-tête Referer, même hôte uniquement). */
function segmentFromReferer(u: URL): SiteSegment | null {
  const q = parseSegment(u.searchParams.get("segment"));
  if (q) return q;
  const path = u.pathname;
  if (path === "/pme" || path.startsWith("/visibilite-ia/pme") || path.endsWith("-pme")) return "pme";
  if (path === "/e-commerce" || path.startsWith("/visibilite-ia/e-commerce")) return "ecommerce";
  if (path === "/local" || path.startsWith("/visibilite-ia/")) return "local";
  return null;
}

/**
 * Onglet initial selon le visiteur : ?segment= d'abord, puis la sous-landing d'où il vient, sinon Commerce local
 * (le volume principal et le prix d'entrée le plus bas). Tous les parcours restent dans le HTML.
 */
async function initialSegment(sp: SP): Promise<SiteSegment> {
  const q = Array.isArray(sp.segment) ? sp.segment[0] : sp.segment;
  const fromQuery = parseSegment(q);
  if (fromQuery) return fromQuery;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const ref = h.get("referer");
  if (ref && host) {
    try {
      const u = new URL(ref);
      // Même hôte que la requête (préproduction comprise) : un lien externe ne choisit pas l'onglet.
      if (u.host === host) {
        const r = segmentFromReferer(u);
        if (r) return r;
      }
    } catch {
      /* Referer invalide : ignoré */
    }
  }
  return "local";
}

/** Circuit d'un livrable Accompagné : une vraie suite, d'où la numérotation. */
const ACCOMPAGNE_FLOW = [
  { title: "Nous préparons", text: "Fiche, page, réponse à un avis ou inscription à un annuaire : rédigé par nous, à partir de votre fiche de vérité." },
  { title: "Vous validez", text: "Un clic depuis votre téléphone, ou une correction. Rien n'est publié sans votre accord." },
  { title: "Nous publions et mesurons", text: "Le livrable part en ligne, et la mesure suivante dit si les IA en tiennent compte." },
];

const GUARANTEES = [
  {
    title: "Rien n'est publié sans votre accord",
    text: "Chaque fiche, page ou réponse vous est soumise. Vous validez en un clic, depuis votre téléphone si vous voulez.",
  },
  {
    title: "Le travail du mois, ou le mois suivant offert",
    text: "Avec Accompagné, si les livrables du mois listés dans votre offre ne sont pas faits, le mois suivant ne vous est pas facturé.",
  },
  {
    title: "Audit remboursé sous 14 jours",
    text: "L'audit approfondi et le plan d'action sont remboursés sous 14 jours si vous n'êtes pas satisfait, sans justification.",
  },
  {
    title: "Aucune promesse de position",
    text: "Personne ne contrôle les réponses des IA. Nous nous engageons sur le travail fait et sur une mesure honnête, avec un niveau de confiance affiché.",
  },
];

const OPTION_PRICE = formatPrice(getAddon("option_more_ai").priceCents);
const AGENCY_PRICE = formatPrice(getPlan("agency_month").priceCents);
const EXTRA_CLIENT = formatPrice(getAddon("agency_extra_client").priceCents);
const WEEKLY_CLIENT = formatPrice(getAddon("agency_weekly_client").priceCents);

const FAQ: QA[] = [
  {
    q: "Y a-t-il une offre gratuite ?",
    a: "Oui, une seule : Découverte. Elle commence sans inscription (l'analyse de votre site en 60 secondes et le test de votre marque auprès des IA), puis continue avec un compte gratuit : 1 marque, 5 questions mesurées chaque mois sur ChatGPT, Gemini et Perplexity, l'audit SEO et GEO du site chaque mois. Sans carte bancaire et sans limite de durée.",
  },
  {
    q: "Qu'est devenu le « test gratuit » ?",
    a: "Il fait désormais partie de Découverte : c'est l'analyse en 60 secondes et le test de marque, toujours gratuits et sans inscription. Les anciens liens mènent au même endroit.",
  },
  {
    q: "Quelle différence entre Essentiel et Accompagné ?",
    a: "Avec Essentiel, vos questions sont mesurées chaque mois et l'agent prépare les corrections que vous validez. Avec Accompagné, la mesure a lieu chaque semaine et nous faisons le travail (fiches, pages, démarches), toujours après votre accord.",
  },
  {
    q: "Pourquoi Essentiel est-il mesuré chaque mois et pas chaque semaine ?",
    a: "Parce que chaque mesure pose plusieurs fois chaque question à chaque IA, ce qui a un coût réel. Une mesure mensuelle complète et honnête vaut mieux qu'une mesure hebdomadaire tronquée. Vous recevez quand même une alerte dès qu'un concurrent passe devant, et Accompagné mesure chaque semaine.",
  },
  {
    q: "Quelles IA sont comprises dans le prix ?",
    a: `Celles écrites dans chaque offre. Découverte : ChatGPT, Gemini et Perplexity. Toutes les offres payantes ajoutent les aperçus IA de Google (AI Overviews) et Google AI Mode ; Claude à partir d'Essentiel PME et e-commerce et en Accompagné ; Mistral Vibe en Accompagné PME et e-commerce. ${optionalEnginesLabel()} sont en option sur Accompagné (+${OPTION_PRICE}/mois) et Agence ; Grok sur demande.`,
  },
  {
    q: "Pourquoi 3 mois minimum sur Accompagné ?",
    a: "Le premier mois sert à tout mettre en place (fiches, balisage, pages) ; les effets se mesurent ensuite sur plusieurs semaines. Après les 3 premiers mois, l'abonnement est mensuel, sans engagement.",
  },
  {
    q: "L'annuel est-il moins cher ?",
    a: "Oui : Essentiel, Réseau et Agence en annuel, c'est 2 mois offerts. Accompagné est mensuel uniquement.",
  },
  {
    q: "L'audit approfondi est-il déduit si je prends Accompagné ?",
    a: "Oui. Son prix est déduit de votre premier mois d'Accompagné si vous souscrivez dans les 30 jours. Acheté seul, il vous donne aussi un mois d'Essentiel offert ; à la fin de ce mois, votre compte repasse en Découverte, sans aucun paiement ni abonnement.",
  },
  {
    q: "Combien coûte l'offre Agence ?",
    a: `${AGENCY_PRICE}/mois pour ${AGENCY_INCLUDED_CLIENTS} clients mesurés chaque mois (30 questions, 6 IA), puis ${EXTRA_CLIENT}/mois par client au-delà. La mesure chaque semaine d'un client est en option (${WEEKLY_CLIENT}/mois par client). Marque blanche, tableau de bord multi-clients et exports inclus. L'offre ouvre prochainement : liste d'attente sur cette page.`,
  },
  {
    q: "Puis-je changer d'offre ou arrêter ?",
    a: "Passer d'Essentiel à Accompagné se fait à tout moment, au prorata, en gardant votre historique. Essentiel s'arrête en un clic depuis votre espace, sans appel ni justification ; le mois en cours reste accessible jusqu'à son terme.",
  },
  {
    q: "Que se passe-t-il si vous ne livrez pas le travail du mois ?",
    a: "Si les livrables listés dans votre offre Accompagné ne sont pas faits, le mois suivant est offert.",
  },
  {
    q: "Y a-t-il de la TVA en plus ?",
    a: `Non. Les prix affichés sont les prix à payer : ${VAT_NOTICE}. Aucune TVA n'est ajoutée et votre facture le mentionne. Pour une entreprise assujettie, il n'y a donc pas de TVA à récupérer sur nos factures : le prix affiché est votre coût final.`,
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Par carte bancaire via Stripe. Nous ne voyons ni ne stockons vos données de carte. Vos factures sont envoyées par e-mail et téléchargeables dans votre espace.",
  },
];

function roiPrices(): RoiPrices {
  const pick = (s: "local" | "pme" | "ecommerce") => {
    const t = tiersFor(s);
    return { essentiel: t.essentielMonth?.priceCents ?? null, accompagne: t.accompagne?.priceCents ?? null };
  };
  return { local: pick("local"), pme: pick("pme"), ecommerce: pick("ecommerce") };
}

export default async function TarifsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const initial = await initialSegment(sp);
  const updated = PAGE_UPDATED[PATH];
  const seg = initial === "agence" ? "local" : initial;
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Tarifs", path: PATH },
  ];

  return (
    <>
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: updated, mainEntity: SOFTWARE_ID }, { withContext: false }),
          softwareAppLd(PATH, ["local", "pme", "ecommerce", "agence"], { withContext: false }),
          faqPageLd(PATH, FAQ, { withContext: false }),
          breadcrumbListLd(PATH, crumbs, { withContext: false }),
        ])}
      />
      <Header segment={initial === "agence" ? undefined : initial} />
      <main id="contenu">
        <MotionRoot />
        <section aria-labelledby="tarifs-title" className="relative overflow-hidden bg-canvas">
          <div aria-hidden="true" className="scope-grid absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
          <Container className="relative pb-16 pt-12 sm:pb-24 sm:pt-20">
            <h1 id="tarifs-title" className="max-w-3xl text-[2.5rem] font-bold leading-[1.03] tracking-[-0.03em] sm:text-[3.75rem]">
              Des tarifs clairs. Le travail inclus.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-ink/75">
              Trois paliers par activité : Découverte (gratuit pour toujours), Essentiel (vous faites, avec les textes prêts) et Accompagné
              (nous faisons, vous validez). Les aperçus IA de Google sont mesurés dans toutes les offres payantes. Prix nets : {VAT_NOTICE}.
            </p>
            <Byline published={null} updated={updated} />
            <div className="mt-10">
              <PricingExplorer key={initial} initial={initial} rows={allCompareRows()} />
            </div>
          </Container>
        </section>

        <section id="agence" aria-labelledby="agence-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="agence-title"
              title="Agences : vendez le référencement IA à vos clients"
              intro="Une offre à part : vos clients mesurés chaque mois sous votre marque, nous faisons la mesure et, si vous le souhaitez, le travail."
            />
            <div className="mt-8">
              <AgencyPricing />
            </div>
          </Container>
        </section>

        <section aria-labelledby="tous-prix-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="tous-prix-title"
              title="Tous les prix en un coup d'œil"
              intro="Les trois parcours partagent le même moteur de mesure ; les questions suivies et le travail fait changent."
            />
            <div className="mt-8">
              <PriceTable updated={updated} />
            </div>
            <p className="mt-4 text-[0.95rem] text-ink/80">
              Comment nous mesurons : <Link href="/methode" className="font-semibold text-primary underline underline-offset-4">la méthode</Link>.
              Repéré face aux outils et aux agences : <Link href="/comparatif" className="font-semibold text-primary underline underline-offset-4">le comparatif</Link>.
            </p>
          </Container>
        </section>

        <section id="ia-mesurables" aria-labelledby="ia-mesurables-title" className="scroll-mt-20 bg-canvas pb-20 sm:pb-24">
          <Container>
            <SectionTitle
              id="ia-mesurables-title"
              title={`Les ${aiCoverageCounts().total} IA mesurables, et celles comprises dans votre offre`}
              intro="Chaque offre dit combien d'IA elle inclut. Les autres sont mesurables en option : interrogées seulement si elles sont activées, jamais simulées, avec la même marge d'erreur."
            />
            <div className="mt-8">
              <AiCoverageTable />
            </div>
          </Container>
        </section>

        <section id="accompagne" aria-labelledby="accompagne-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="accompagne-title"
              title="Accompagné : nous faisons, vous validez"
              intro="Vous nous confiez votre image auprès des IA. Voici comment se passe chaque livrable, et des exemples à ouvrir tout de suite."
            />
            <Reveal as="ol" className="bx-scope mt-10 grid gap-3 sm:grid-cols-3" aria-label="Le circuit de chaque livrable">
              {ACCOMPAGNE_FLOW.map((f, i) => (
                <li
                  key={f.title}
                  className="bx bx-fade relative rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)]"
                  style={{ ["--d" as string]: `${i * 180}ms` }}
                >
                  <span className="tabular flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-[0.95rem] font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
                  <p className="mt-1 text-[0.95rem] text-ink/75">{f.text}</p>
                </li>
              ))}
            </Reveal>
            <div className="mt-10">
              <AccompagneProof segment={seg} />
            </div>
          </Container>
        </section>

        <section id="rentabilite" aria-labelledby="roi-title" className="scroll-mt-20 bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="roi-title"
              title="Combien vaut un client recommandé par une IA ?"
              intro="Entrez vos propres chiffres : le calcul vous dit combien de clients il faut pour que l'offre soit couverte. Il ne promet rien."
            />
            <div className="mt-10">
              <RoiCalculator prices={roiPrices()} initial={seg} />
            </div>
          </Container>
        </section>

        <section aria-labelledby="garanties-title" className="bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle id="garanties-title" title="Ce sur quoi nous nous engageons" />
            <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {GUARANTEES.map((g) => (
                <li key={g.title} className="border-t-2 border-primary pt-5">
                  <h3 className="text-lg font-bold">{g.title}</h3>
                  <p className="mt-2 text-[0.97rem] text-ink/75">{g.text}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="faq-prix-title" className="bg-canvas py-20 sm:py-24">
          <Container size="narrow">
            <SectionTitle id="faq-prix-title" title="Questions sur les prix" />
            <div className="mt-8">
              <Faq items={FAQ} idPrefix="faq-prix" />
            </div>
            <p className="mt-6 text-[0.95rem] text-ink/80">
              D&apos;autres questions sur le référencement IA ? <Link href="/questions" className="font-semibold text-primary underline underline-offset-4">Les questions les plus posées</Link>.
            </p>
          </Container>
        </section>

        <section aria-labelledby="tarifs-cta-title" className="on-dark bg-primary-deep py-16 text-white sm:py-20">
          <Container className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="tarifs-cta-title" className="text-[1.9rem] font-bold leading-tight text-white sm:text-[2.4rem]">
                Pas sûr du palier ?
              </h2>
              <p className="mt-3 text-lg text-on-deep">
                Commencez par le compte gratuit : vous verrez vos résultats chaque mois et vous changerez d&apos;offre quand vous voudrez.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href={`/inscription?parcours=${seg}`} className={buttonClasses({ size: "lg", variant: "light" })}>
                Créer mon compte gratuit
              </Link>
              <Link href={`/analyse?segment=${seg}`} className="inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4 hover:no-underline">
                Ou analyser votre site en 60 secondes
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
