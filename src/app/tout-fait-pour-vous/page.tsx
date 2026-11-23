import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { Faq, CheckIcon, CrossIcon, type QA } from "@/components/site/blocks";
import { PiloteStart, type PiloteOffer } from "@/components/site/PiloteStart";
import { PLATFORM_FITS } from "@/components/site/pilote-data";
import { euros, tiersFor } from "@/components/site/plans-v2";
import { pageMeta } from "@/lib/seo/meta";
import { abs, PAGE_UPDATED } from "@/lib/seo/site";
import { breadcrumbListLd, faqPageLd, graph, offerLd, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { Byline } from "@/lib/seo/editorial";
import { CATEGORY_DEFS, CONTENT_REVIEW_HOURS, NEVER_DONE, SCORE_DROP_MARGIN } from "@/lib/autopilot/mandate";
import { buildRecap, recapEmail } from "@/lib/autopilot/recap";
import { demoAutopilot } from "@/lib/autopilot/demo";
import { getPlan, VAT_NOTICE } from "@/lib/plans";

const PATH = "/tout-fait-pour-vous";
const SEGS = ["local", "pme", "ecommerce"] as const;
type Seg = (typeof SEGS)[number];
const SEG_LABEL: Record<Seg, string> = { local: "Commerce local", pme: "PME et services B2B", ecommerce: "E-commerce" };
const PRICE: Record<Seg, string> = {
  local: euros(getPlan("local_pilote_month").priceCents),
  pme: euros(getPlan("pme_pilote_month").priceCents),
  ecommerce: euros(getPlan("ecom_pilote_month").priceCents),
};
const TITLE = "Tout fait pour vous, sans rendez-vous : pilote automatique";
const DESCRIPTION = `Repéré corrige votre site et publie vos contenus seul, dans le cadre d'un mandat écrit et révocable. Annulation en 1 clic, aucun appel. Dès ${PRICE.local}/mois.`;

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

type SP = Record<string, string | string[] | undefined>;

const FAQ: QA[] = [
  {
    q: "Et si je ne veux pas d'une modification ?",
    a: "Vous l'annulez en un clic, depuis l'e-mail qui vous prévient ou depuis votre espace : Repéré remet la valeur d'avant, à l'identique, et relit la page pour le vérifier. Si vous ne voulez plus d'un type de modification, décochez sa catégorie dans le mandat : il n'est plus jamais appliqué seul.",
  },
  {
    q: "Combien de temps avant de voir un effet ?",
    a: "Nous ne promettons ni délai ni résultat : personne ne contrôle ce que Google et les IA affichent. Les corrections sont faites dès la signature du mandat ; Google et les IA relisent ensuite votre site à leur rythme, souvent en quelques semaines. Chaque récapitulatif compare les mesures avant et après, avec leur marge d'erreur, et dit quand une variation reste dans la marge.",
  },
  {
    q: "Faut-il un appel ou un rendez-vous pour démarrer ?",
    a: "Non. Paiement en ligne, connexion du site avec l'assistant, fiche officielle pré-remplie à confirmer en un écran, mandat à signer : tout se fait seul, en 15 minutes environ. Les questions se posent par écrit (formulaire ou e-mail) et la réponse vient par écrit.",
  },
  {
    q: "Que se passe-t-il pendant les 72 heures de relecture d'un contenu ?",
    a: `La page ou l'article est créé en brouillon chez vous, invisible du public. Vous recevez un e-mail avec un bouton « Bloquer ». Sans blocage, il est mis en ligne au bout de ${CONTENT_REVIEW_HOURS} heures. Vous pouvez aussi le retirer après, en un clic.`,
  },
  {
    q: "Repéré peut-il écrire n'importe quoi sur mon site ?",
    a: "Non. Il n'écrit qu'avec les faits de votre fiche officielle, que vous avez confirmée ; un texte qui contient un fait absent de cette fiche, un prix ou « [à compléter] » n'est jamais publié seul. Il ne touche jamais à vos prix, mentions légales, avis, pages juridiques, ni à la suppression d'une page.",
  },
  {
    q: "Et si une modification fait baisser mon référencement ?",
    a: `Après chaque série, la mesure suivante est comparée à celle d'avant. Si un score SEO ou GEO baisse de plus de ${SCORE_DROP_MARGIN} points, le pilote s'arrête seul, vous prévient et vous propose d'annuler. Il ne reprend qu'avec votre accord.`,
  },
  {
    q: "Mon site n'est pas sur WordPress, Shopify, Wix, Webflow, PrestaShop ou Magento ?",
    a: "Nous vous le disons avant le paiement : sans connexion, rien ne peut être appliqué automatiquement, et nous ne vous vendons pas le pilote. L'offre Essentiel prépare les mêmes corrections, prêtes à déposer par vous ou votre prestataire.",
  },
  {
    q: "Quelle différence avec l'offre Accompagné ?",
    a: "Accompagné, c'est une équipe qui fait le travail avec vous (fiches Google, avis, annuaires, démarches) et vous soumet chaque livrable, avec un point en visio pour les PME et e-commerces. Le pilote automatique, c'est l'Essentiel plus l'application automatique de ce que vous avez autorisé, sans rendez-vous et sans validation au cas par cas.",
  },
  {
    q: "Puis-je arrêter ?",
    a: "Oui : sans engagement, résiliable en un clic. Le mandat se met en pause ou se révoque aussi en un clic, à effet immédiat ; ce qui a déjà été fait reste annulable une modification à la fois.",
  },
];

const STEPS = [
  ["Vous payez en ligne", "Par carte, sur la page de paiement Stripe. Avant de payer, nous vous disons ce que le pilote fera seul sur votre plateforme."],
  ["Vous connectez votre site", "L'assistant vous guide pas à pas (WordPress, Shopify, Wix, Webflow, PrestaShop, Magento). Rien à installer de compliqué."],
  ["Vous confirmez votre fiche officielle", "Pré-remplie depuis votre site : nom, adresse, horaires, services. Un écran à vérifier. Le pilote n'écrit qu'avec ces faits."],
  ["Vous signez le mandat", "Une fois, par écrit, en cochant ce que Repéré peut faire seul. Il est affiché en entier, horodaté, et se révoque en un clic."],
  ["C'est parti", "Le pilote passe après chaque analyse de votre site, vous prévient après coup et vous écrit chaque lundi."],
] as const;

function firstSeg(sp: SP): Seg {
  const v = Array.isArray(sp.segment) ? sp.segment[0] : sp.segment;
  return v === "pme" ? "pme" : v === "ecommerce" || v === "e-commerce" ? "ecommerce" : "local";
}

export default async function ToutFaitPage({ searchParams }: { searchParams: Promise<SP> }) {
  const initial = firstSeg(await searchParams);
  const updated = PAGE_UPDATED[PATH];
  const offers: PiloteOffer[] = SEGS.map((s) => {
    const t = tiersFor(s);
    return { segment: s, planId: t.pilote!.id, price: PRICE[s], essentielId: t.essentielMonth!.id, essentielPrice: euros(t.essentielMonth!.priceCents) };
  });
  const demo = demoAutopilot("demo", "local", new Date(`${updated}T09:00:00Z`));
  const recap = recapEmail(buildRecap({ state: { ...demo.state, lastRecapAt: new Date(Date.parse(`${updated}T09:00:00Z`) - 7 * 86_400_000).toISOString() }, journal: demo.journal, now: new Date(`${updated}T09:00:00Z`), used: 4, limits: { series: 20, contents: 2 }, mandate: demo.mandate, waitingProposals: 2 }), {
    name: "Plomberie Martin (entreprise fictive)",
    businessId: "demo",
    app: "",
    actionUrl: () => "#",
  });
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Tarifs", path: "/tarifs" },
    { name: "Tout fait pour vous", path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: updated, datePublished: updated }, { withContext: false }), about: orgRef() },
    {
      "@type": "Service",
      "@id": `${abs(PATH)}#service`,
      name: "Pilote automatique Repéré",
      serviceType: "SEO et référencement IA, tout fait pour vous",
      description: "Corrections SEO et GEO appliquées et contenus publiés par Repéré dans le cadre d'un mandat écrit, révocable, annulable en un clic.",
      provider: orgRef(),
      areaServed: { "@type": "Country", name: "France" },
      url: abs(PATH),
      offers: offers.map((o) => offerLd(tiersFor(o.segment).pilote!)),
    },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    faqPageLd(PATH, FAQ, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd} segment={initial}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Tarifs", href: "/tarifs" }, { name: "Tout fait pour vous" }]}
        title="Tout fait pour vous, sans rendez-vous"
        lead={`Vous donnez votre accord une fois, par écrit, catégorie par catégorie. Repéré corrige votre site et publie vos contenus seul, vous prévient après coup, et chaque action s'annule en un clic. Aucun appel, aucun rendez-vous, aucune promesse de position.`}
        aside={
          <div className="rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-32px_rgba(30,26,92,.35)] sm:p-8">
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.06em] text-primary">Pilote automatique</p>
            <ul className="mt-3 divide-y divide-line">
              {SEGS.map((s) => (
                <li key={s} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span>{SEG_LABEL[s]}</span>
                  <span className="tabular font-display text-xl font-bold">
                    {PRICE[s]}
                    <span className="text-[0.9rem] font-normal text-muted">/mois</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.92rem] text-ink/75">Tout Essentiel compris. Sans engagement, résiliable en 1 clic. Prix nets, {VAT_NOTICE}.</p>
            <a href="#commencer" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-strong">
              Commencer en ligne
            </a>
            <p className="mt-3 text-[0.9rem] text-muted">
              Plutôt tout valider vous-même ? <Link href="/tarifs" className={linkClass}>Voir Essentiel et Accompagné</Link>.
            </p>
          </div>
        }
      >
        <Byline published={updated} updated={updated} />
      </PageHero>

      <section aria-labelledby="fait-seul" className="bg-canvas pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="border-t-4 border-primary pt-5">
              <h2 id="fait-seul" className="font-display text-[1.7rem] font-bold leading-tight sm:text-[2rem]">
                Ce que Repéré fait seul, si vous l&apos;autorisez
              </h2>
              <ul className="mt-5 space-y-4">
                {CATEGORY_DEFS.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <CheckIcon className="mt-1 shrink-0 text-primary" />
                    <span>
                      <strong>{c.label}</strong>
                      {c.byDefault ? "" : " (à cocher si vous le souhaitez)"}. <span className="text-ink/75">{c.help}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t-4 border-accent pt-5">
              <h2 className="font-display text-[1.7rem] font-bold leading-tight sm:text-[2rem]">Ce qu&apos;il ne fait jamais</h2>
              <ul className="mt-5 space-y-4">
                {NEVER_DONE.map((n) => (
                  <li key={n} className="flex gap-3">
                    <CrossIcon className="mt-1 shrink-0 text-danger-ink" />
                    <span>{n.charAt(0).toUpperCase() + n.slice(1)}.</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[0.95rem] text-ink/75">
                Tout ce qui sort de ce cadre reste une proposition, que vous validez une par une dans votre espace, comme avec{" "}
                <Link href="/fonctionnalites/agent-de-publication" className={linkClass}>
                  l&apos;agent de publication
                </Link>
                .
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="mandat" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 id="mandat" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Le mandat : votre accord, une fois, par écrit
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["Écrit et horodaté", "Le texte complet est affiché avant signature. Nous gardons sa version, son empreinte et l'horodatage de notre serveur : la preuve de ce que vous avez autorisé, et de rien d'autre."],
              ["Catégorie par catégorie", "Titres, descriptions, textes alternatifs, données structurées, llms.txt, robots des IA, redirections des pages cassées, contenus : vous cochez. Les plus sensibles sont décochées par défaut."],
              ["Révocable à tout moment", "Pause ou révocation en un clic, à effet immédiat. Changer les catégories, c'est signer un nouveau mandat : l'ancien reste dans votre journal."],
            ].map(([t, x]) => (
              <div key={t} className="border-l-2 border-primary/30 pl-5">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-2 text-ink/80">{x}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[0.95rem] text-ink/75">
            Le texte du mandat figure dans nos <Link href="/cgv#pilote-automatique" className={linkClass}>conditions générales</Link> (modèle à relire par un avocat
            avant la mise en vente).
          </p>
        </Container>
      </section>

      <section aria-labelledby="annuler" className="bg-canvas py-16 sm:py-20">
        <Container>
          <h2 id="annuler" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Prévenu après coup, annulable en un clic
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              ["Chaque série est annulable", "L'e-mail qui vous prévient porte un bouton « Annuler » par série : la valeur d'avant revient à l'identique, la page est relue pour le vérifier."],
              [`Contenus relisibles ${CONTENT_REVIEW_HOURS} h`, "Créés en brouillon chez vous, invisibles du public. Un bouton « Bloquer » dans l'e-mail ; sans blocage, mise en ligne au bout de 72 heures."],
              ["Arrêt automatique", `Si un score SEO ou GEO baisse de plus de ${SCORE_DROP_MARGIN} points après une série, le pilote s'arrête seul, vous alerte et propose le retour arrière.`],
              ["Tout est journalisé", "Valeur avant, valeur après, date : un journal infalsifiable, consultable dans votre espace. Un récapitulatif chaque lundi, un rapport chaque mois."],
            ].map(([t, x]) => (
              <li key={t} className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-2 text-ink/80">{x}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="deroule" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 id="deroule" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Comment ça se passe, du paiement au premier lundi
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([t, x], i) => (
              <li key={t} className="relative border-l-2 border-primary/30 pl-5">
                <p className="font-display text-[2rem] font-bold leading-none text-primary">{i + 1}</p>
                <h3 className="mt-3 font-display text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[0.97rem] text-ink/80">{x}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="exemple" className="bg-canvas py-16 sm:py-20">
        <Container>
          <h2 id="exemple" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Exemple : le récapitulatif du lundi
          </h2>
          <p className="mt-3 max-w-[62ch] text-lg text-ink/75">
            Exemple de démonstration, entreprise fictive : les chiffres ne sont pas des mesures réelles. Vous pouvez aussi ouvrir{" "}
            <Link href="/demo" className={linkClass}>
              le compte démo
            </Link>{" "}
            (onglet Agent, puis Pilote automatique).
          </p>
          <figure className="mt-8 max-w-[44rem] rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-7">
            <p className="inline-flex rounded-full bg-warning-bg px-3 py-1 text-[0.82rem] font-semibold text-warning-ink">Démo · entreprise fictive</p>
            <p className="mt-3 font-display text-lg font-bold">{recap.subject}</p>
            {recap.paragraphs.map((p) => (
              <p key={p} className="mt-3 text-[0.97rem] text-ink/85">
                {p}
              </p>
            ))}
            <ul className="mt-3 space-y-1.5 text-[0.95rem]">
              {(recap.items ?? []).map((i) => (
                <li key={i.text} className="flex flex-wrap gap-x-2">
                  <span>{i.text}</span>
                  {i.link ? <span className="font-semibold text-primary">{i.link.label}</span> : null}
                </li>
              ))}
            </ul>
            <figcaption className="mt-4 text-[0.85rem] text-muted">Les boutons « Annuler » et « Bloquer » de l&apos;e-mail réel agissent en un clic, sans connexion.</figcaption>
          </figure>
        </Container>
      </section>

      <section aria-labelledby="plateformes" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 id="plateformes" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Ce que le pilote fait seul, plateforme par plateforme
          </h2>
          <p className="mt-3 max-w-[62ch] text-lg text-ink/75">Ce qui ne peut pas être appliqué par la plateforme vous est envoyé par e-mail, prêt à déposer.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {PLATFORM_FITS.map((p) => (
              <div key={p.id} className="rounded-2xl bg-canvas p-5">
                <h3 className="font-display text-lg font-bold">{p.label}</h3>
                {p.auto.length ? (
                  <p className="mt-2 text-[0.95rem]">
                    <strong>Fait seul :</strong> {p.auto.join(" ; ")}.
                  </p>
                ) : (
                  <p className="mt-2 text-[0.95rem]">
                    <strong>Rien ne peut être fait seul</strong> : le pilote ne vous est pas proposé pour ce site.
                  </p>
                )}
                <p className="mt-1 text-[0.95rem] text-ink/75">
                  <strong>Par e-mail :</strong> {p.email.join(" ; ")}.
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[0.95rem] text-ink/75">
            Détail des connexions : <Link href="/integrations" className={linkClass}>intégrations</Link>.
          </p>
        </Container>
      </section>

      <section id="commencer" aria-labelledby="commencer-h" className="scroll-mt-20 bg-canvas py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
            <div>
              <h2 id="commencer-h" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
                Commencer, sans appel
              </h2>
              <div className="mt-6">
                <PiloteStart offers={offers} initial={initial} />
              </div>
            </div>
            <aside className="space-y-6 text-[0.97rem]">
              <div>
                <h3 className="font-display text-lg font-bold">Pas encore sûr ?</h3>
                <p className="mt-2 text-ink/80">
                  Analysez votre site gratuitement, sans inscription : vous verrez les corrections que le pilote ferait.{" "}
                  <Link href={`/analyse?segment=${initial}`} className={linkClass}>
                    Analyser mon site en 60 secondes
                  </Link>
                  .
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Une question ?</h3>
                <p className="mt-2 text-ink/80">
                  Par écrit, réponse par écrit : <Link href="/contact" className={linkClass}>formulaire de contact</Link> ou{" "}
                  <Link href="/aide" className={linkClass}>
                    centre d&apos;aide
                  </Link>
                  . Aucun appel n&apos;est nécessaire, à aucun moment.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      <section aria-labelledby="faq-pilote" className="bg-white py-16 sm:py-20">
        <Container size="narrow">
          <h2 id="faq-pilote" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">
            Questions fréquentes
          </h2>
          <div className="mt-8">
            <Faq items={FAQ} idPrefix="faq-pilote" />
          </div>
        </Container>
      </section>
    </SitePage>
  );
}
