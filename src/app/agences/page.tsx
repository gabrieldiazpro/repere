/**
 * V8 — /agences : page publique de l'offre Agence (cible des publicités agences, docs/pub). Même gabarit visuel que
 * /pme et /e-commerce (hero, bandeau des IA, ce qui se joue, comment ça marche, tarifs, en bref, FAQ, appel final).
 * Règles : prix lus dans la grille (plans-v2), état réel de l'offre (liste d'attente tant qu'elle n'est pas ouverte),
 * aucune promesse de résultat, aucun client inventé.
 */
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, Faq, Reassure, SectionTitle, type QA } from "@/components/site/blocks";
import { AiStrip } from "@/components/site/AiStrip";
import { aiCoverageCounts } from "@/components/site/ai-coverage";
import { DemoEntry } from "@/components/site/DemoEntry";
import { WaitlistForm } from "@/components/site/WaitlistForm";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { euros, plansFor, VAT_NOTICE } from "@/components/site/plans-v2";
import { MONTHLY_QUOTA } from "@/lib/content/quota";
import { pageMeta } from "@/lib/seo/meta";
import { JsonLd } from "@/lib/seo/shell";
import { fmtDate } from "@/lib/seo";
import { PAGE_UPDATED } from "@/lib/seo/site";
import { breadcrumbListLd, faqPageLd, graph, pageIds, webPageLd, ORG_ID, SOFTWARE_ID } from "@/lib/seo/jsonld";

const PATH = "/agences";
const TITLE = "Référencement IA en marque blanche pour les agences";
const DESCRIPTION =
  "Offre Agence : marque blanche, tableau de bord multi-clients, validation par vos clients, API et MCP. Partenaire sans abonnement, exécution dès 59 €.";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

function agencyPlans() {
  const list = plansFor("agence");
  const partner = list.find((p) => p.id === "agency_partner");
  const month = list.find((p) => p.id === "agency_month");
  const year = list.find((p) => p.id === "agency_year");
  const execs = list.filter((p) => p.id.startsWith("agency_exec_")).sort((a, b) => a.priceCents - b.priceCents);
  return { partner, month, year, execs, open: list.some((p) => p.available) };
}

const PROBLEMS = [
  {
    title: "Vos clients vous demandent « et ChatGPT ? »",
    text: "Ils voient leurs concurrents cités par les IA et veulent savoir pourquoi. Répondre sans mesure, c'est répondre au hasard.",
  },
  {
    title: "Mesurer les IA à la main ne tient pas",
    text: "Les réponses varient d'un essai à l'autre : une capture d'écran ne prouve rien. Il faut répéter les questions, sur plusieurs IA, et donner une marge d'erreur.",
  },
  {
    title: "Le travail mange vos marges",
    text: "Fiches, pages, balisage, corrections : sans outil, chaque client coûte des heures. Avec l'exécution en marque blanche, vous gardez la relation et fixez votre prix.",
  },
];

const FUNCTIONS = [
  { title: "Marque blanche", text: "Votre nom, votre logo et vos couleurs sur les rapports, les liens partagés et les e-mails, envoyés depuis votre domaine après vérification DNS." },
  { title: "Tous vos clients sur une page", text: "Scores Google et IA, alertes, propositions en attente de validation : le tableau de bord multi-clients montre où agir d'abord." },
  { title: "Validation par votre client", text: "Votre client voit son espace et valide les corrections et les contenus proposés, sans rien régler. Rien n'est publié sans son accord." },
  { title: "Exécution en marque blanche", text: "Nous réalisons le travail d'Accompagné pour vos clients, sous votre marque, à prix revendeur. Vous gardez la relation." },
  { title: "API, MCP et webhooks", text: "API REST, serveur MCP en lecture pour brancher Repéré dans Claude ou ChatGPT, webhooks signés vers vos propres outils." },
  { title: "Les agents, avec garde-fous", text: `Corrections appliquées sur WordPress, Shopify, Webflow, PrestaShop, Wix ou Magento ; contenus rédigés avec les seuls faits du client (${MONTHLY_QUOTA.agence} par mois et par client).` },
];

const STEPS = [
  { verb: "Ouvrir un client", text: "Un espace par client, avec ses questions, ses concurrents et son site. Le test de marque gratuit sert aussi de rendez-vous de prospection." },
  { verb: "Mesurer", text: `Questions posées plusieurs fois à chaque IA de l'offre, jusqu'à ${aiCoverageCounts().total} IA mesurables, avec la méthode et la marge d'erreur de chacune.` },
  { verb: "Préparer et faire valider", text: "Les agents préparent corrections et contenus ; votre client valide depuis son accès, vous appliquez ou nous exécutons pour vous." },
  { verb: "Rendre compte, à votre nom", text: "Rapport mensuel à votre marque, avant / après daté, exports CSV par client. Aucune promesse de position : une mesure honnête." },
];

const FAQ: QA[] = [
  {
    q: "L'offre Agence est-elle ouverte ?",
    a: "Ses fonctions sont construites et visibles dans la démo agence : tableau de bord multi-clients, marque blanche, accès client, exports CSV, API et MCP. L'achat ouvre prochainement ; inscrivez-vous à la liste d'attente, nous écrivons une seule fois, à l'ouverture.",
  },
  {
    q: "Qu'est-ce que la marque blanche comprend ?",
    a: "Votre nom, votre logo et votre couleur sur les rapports, les liens de partage et les e-mails ; les envois partent de votre domaine après vérification DNS. Votre client ne voit pas Repéré, sauf dans les mentions légales des documents.",
  },
  {
    q: "Mes clients doivent-ils valider ce qui est publié ?",
    a: "Oui. Chaque correction et chaque contenu est soumis à validation avant publication, journalisé et annulable. Vous pouvez valider pour eux si votre contrat le prévoit, mais rien ne part sans un accord humain.",
  },
  {
    q: "Puis-je brancher Repéré dans mes outils ?",
    a: "Oui : API REST, serveur MCP en lecture (Claude, ChatGPT et les clients compatibles) et webhooks signés, inclus dans l'offre Agence. La documentation est publique sur la page Développeurs, avec une clé de démonstration.",
  },
  {
    q: "Quelles IA sont mesurées pour mes clients ?",
    a: "ChatGPT, Gemini, Perplexity et Claude, plus Mistral Vibe en option ; les aperçus IA et le mode IA de Google, Copilot et DeepSeek sont mesurables en option, Grok sur demande. Chaque IA a sa méthode publiée et sa marge d'erreur.",
  },
  {
    q: "Faites-vous de l'échange de liens ou du contenu en masse ?",
    a: "Non. Pas d'échange de liens, pas de production de masse, pas de faux avis ni de faux comptes. Les contenus sont plafonnés par client et rédigés avec ses seuls faits ; les mentions s'obtiennent auprès de vraies sources.",
  },
  {
    q: "Comment fonctionne le partenariat sans abonnement ?",
    a: "Un lien partenaire personnel et 30 % de commission pendant 12 mois sur chaque client apporté, sans abonnement. Votre client souscrit lui-même son offre.",
  },
];

export default function AgencesPage() {
  const { partner, month, year, execs, open } = agencyPlans();
  const updated = PAGE_UPDATED[PATH];
  const execFrom = execs[0] ? euros(execs[0].priceCents) : null;
  const reassure = [
    partner ? `${partner.name} : 0 €, sans abonnement` : null,
    month ? `Agence : ${euros(month.priceCents)}/mois` : null,
    execFrom ? `Exécution en marque blanche dès ${execFrom}` : null,
  ].filter((x): x is string => !!x);
  const brief = [
    { label: "Pour qui", value: "Agences web, SEO et marketing, consultants et intégrateurs qui gèrent les sites de plusieurs clients (commerces, PME, boutiques)." },
    { label: "Ce que vous obtenez", value: "Marque blanche, tableau de bord multi-clients, accès client avec validation, exports CSV par client, API REST, serveur MCP et webhooks." },
    {
      label: "Prix",
      value: `Partenaire : 0 €, 30 % de commission pendant 12 mois. Agence : ${month ? euros(month.priceCents) : "–"}/mois${year ? ` ou ${euros(year.priceCents)}/an` : ""}, 20 clients en Essentiel. Exécution en marque blanche : ${execs.map((e) => `${e.name.replace(/^Exécution marque blanche — /, "")} ${euros(e.priceCents)}`).join(", ")} par client et par mois. ${VAT_NOTICE}.`,
    },
    { label: "État de l'offre", value: open ? "Ouverte." : "Fonctions construites et visibles dans la démo agence ; achat sur liste d'attente." },
    { label: "Ce que nous ne faisons pas", value: "Aucune promesse de position ni de citation, aucun échange de liens, aucun faux avis, rien de publié sans validation." },
  ];
  const ld = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: updated, about: SOFTWARE_ID }, { withContext: false }),
    {
      "@type": "Service",
      "@id": pageIds(PATH).service,
      name: "Référencement IA (GEO) en marque blanche pour les agences",
      serviceType: "Référencement IA (GEO)",
      provider: { "@id": ORG_ID },
      areaServed: { "@type": "Country", name: "France" },
      url: pageIds(PATH).url,
      isRelatedTo: { "@id": SOFTWARE_ID },
    },
    faqPageLd(PATH, FAQ, { withContext: false }),
    breadcrumbListLd(PATH, [{ name: "Accueil", path: "/" }, { name: "Agences", path: PATH }], { withContext: false }),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <Header />
      <main id="contenu">
        <MotionRoot />
        <section aria-labelledby="ag-hero-title" className="relative overflow-hidden bg-canvas">
          <Parallax className="scope-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_30%,transparent_95%)]" />
          <Container className="relative pb-14 pt-8 sm:pb-20 sm:pt-16">
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[0.82rem] font-medium text-ink/80 shadow-[0_0_0_1px_rgba(27,31,46,.08)] sm:text-[0.9rem]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                  Offre Agence : référencement IA en marque blanche
                </p>
                <h1 id="ag-hero-title" className="mt-5 text-[2.1rem] font-bold leading-[1.04] tracking-[-0.03em] sm:mt-6 sm:text-[3.1rem] lg:text-[3.3rem]">
                  Vendez le référencement IA à vos clients. Sous votre marque.
                </h1>
                <p className="mt-4 max-w-[60ch] text-[1.02rem] text-ink/75 sm:mt-6 sm:text-lg">
                  Vos clients veulent savoir si les IA les citent. Repéré mesure, prépare les corrections et les contenus, et les fait valider par vos clients ;
                  vous présentez le travail à votre nom, sur un tableau de bord multi-clients, avec l&apos;API et le serveur MCP pour vos propres outils.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <DemoEntry account="demo-agence" className={buttonClasses({ size: "lg", className: "lift cursor-pointer" })}>
                    Voir la démo agence
                  </DemoEntry>
                  <a href="#liste-attente" className={buttonClasses({ size: "lg", variant: "secondary" })}>
                    {open ? "Ouvrir un compte agence" : "Rejoindre la liste d’attente"}
                  </a>
                </div>
                <Reassure className="mt-5" items={reassure} />
                {!open ? (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-warning-bg px-3 py-1 text-[0.9rem] font-semibold text-warning-ink">
                    Ouverture prochaine : fonctions visibles dans la démo
                  </p>
                ) : null}
              </div>
              <div className="relative mx-auto w-full max-w-xl lg:mt-2 lg:max-w-none">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-[radial-gradient(60%_55%_at_60%_40%,rgba(55,48,163,.13),transparent_70%),radial-gradient(40%_40%_at_25%_85%,rgba(245,165,36,.14),transparent_70%)]"
                />
                <div className="relative rounded-3xl bg-white p-5 shadow-[0_24px_60px_-30px_rgba(30,26,92,.45),0_0_0_1px_rgba(27,31,46,.06)] sm:p-7">
                  <p className="text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-muted">Ce que voit votre client</p>
                  <ol className="mt-4 space-y-3">
                    {[
                      ["Rapport à votre marque", "Votre logo, votre couleur, envoyé depuis votre domaine"],
                      ["Une proposition à valider", "Avant / après, sources, effet mesuré ensuite"],
                      ["Sa validation, en un clic", "Journalisée, annulable, rien sans accord"],
                      ["Le travail fait", "Par vous, ou par nous en marque blanche"],
                    ].map(([t, d], i) => (
                      <li key={t} className="flex gap-3 rounded-2xl bg-canvas p-3.5">
                        <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[0.9rem] font-semibold text-white">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold leading-snug">{t}</span>
                          <span className="block text-[0.9rem] text-ink/70">{d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 text-[0.82rem] text-muted">Le parcours réel est visible dans la démo agence, sur des comptes fictifs.</p>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <AiStrip />

        <section aria-labelledby="ag-pb-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle id="ag-pb-title" title="Ce qui se joue chez vos clients" />
            <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
              {PROBLEMS.map((pb) => (
                <li key={pb.title} className="border-t-2 border-ink/10 pt-5">
                  <h3 className="text-xl font-bold">{pb.title}</h3>
                  <p className="mt-2 text-ink/75">{pb.text}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="ag-fn-title" className="bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="ag-fn-title"
              title="Ce que l'offre Agence comprend"
              intro="Des fonctions construites, que vous pouvez ouvrir dans la démo agence avant toute décision."
            />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FUNCTIONS.map((f, i) => (
                <Reveal as="li" i={i} key={f.title} className="flex flex-col rounded-2xl bg-canvas p-5">
                  <h3 className="text-lg font-bold leading-snug">{f.title}</h3>
                  <p className="mt-1.5 text-[0.95rem] text-ink/75">{f.text}</p>
                </Reveal>
              ))}
            </ul>
            <p className="mt-8 text-[1rem]">
              <Link href="/developpeurs" className="font-semibold text-primary underline underline-offset-4">
                La documentation de l&apos;API et du serveur MCP
              </Link>
            </p>
          </Container>
        </section>

        <section aria-labelledby="ag-how-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle id="ag-how-title" title="Comment ça marche" />
            <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.verb} className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.07)]">
                  <span className="tabular flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-[0.95rem] font-semibold text-white">{i + 1}</span>
                  <h3 className="mt-3 text-xl font-bold">{s.verb}</h3>
                  <p className="mt-1.5 text-ink/75">{s.text}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section id="tarifs-agence" aria-labelledby="ag-price-title" className="scroll-mt-20 bg-white py-20 sm:py-24">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle id="ag-price-title" title="Tarifs agences" intro={`Prix nets : ${VAT_NOTICE}.`} />
              <Link href="/tarifs?segment=agence" className={buttonClasses({ variant: "secondary", className: "shrink-0" })}>
                Toutes les offres
              </Link>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {partner ? (
                <article className="flex flex-col rounded-2xl bg-canvas p-6">
                  <h3 className="text-xl font-bold">{partner.name}</h3>
                  <p className="mt-4 font-display text-[2.1rem] font-bold leading-none">0 €</p>
                  <p className="mt-1.5 text-[0.88rem] text-muted">sans abonnement</p>
                  <ul className="mt-5 space-y-2.5 text-[0.95rem]">
                    {partner.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <CheckIcon className="mt-0.5 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {month ? (
                <article className="on-dark flex flex-col rounded-2xl bg-primary-deep p-6 text-white ring-2 ring-primary">
                  <h3 className="text-xl font-bold text-white">{month.name}</h3>
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="tabular font-display text-[2.1rem] font-bold leading-none">{euros(month.priceCents)}</span>
                    <span className="text-[0.95rem] text-on-deep">/mois</span>
                  </p>
                  {year ? <p className="mt-1.5 text-[0.88rem] text-on-deep">ou {euros(year.priceCents)}/an, 2 mois offerts</p> : null}
                  <ul className="mt-5 space-y-2.5 text-[0.95rem]">
                    {[...month.features, "API publique, serveur MCP et webhooks"].map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <CheckIcon className="mt-0.5 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
              <article className="flex flex-col rounded-2xl bg-canvas p-6">
                <h3 className="text-xl font-bold">Exécution en marque blanche</h3>
                <p className="mt-1.5 text-[0.88rem] text-muted">Prix revendeur, par client et par mois</p>
                <ul className="mt-5 divide-y divide-line/70 text-[0.95rem]">
                  {execs.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span>{p.name.replace(/^Exécution marque blanche — /, "Accompagné ")}</span>
                      <span className="tabular font-display text-lg font-bold">{euros(p.priceCents)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.92rem] text-ink/75">Nous exécutons, vous gardez la relation et fixez votre prix.</p>
              </article>
            </div>
            <p className="mt-4 text-[0.88rem] text-muted">
              Prix en vigueur au <time dateTime={updated}>{fmtDate(updated)}</time>.
            </p>

            <div id="liste-attente" className="mt-10 scroll-mt-24 rounded-2xl bg-canvas p-6 sm:p-8">
              <h3 className="text-xl font-bold">{open ? "Ouvrir un compte agence" : "Rejoindre la liste d'attente agences"}</h3>
              <p className="mt-1.5 max-w-2xl text-[0.97rem] text-ink/75">
                Laissez votre e-mail : nous vous écrivons une seule fois, à l&apos;ouverture, avec les conditions des premières agences partenaires.
                En attendant, toutes les fonctions sont visibles dans la démo agence.
              </p>
              <div className="mt-5 max-w-2xl">
                <WaitlistForm fixedInterest="agency" idPrefix="waitlist-agences" />
              </div>
            </div>
          </Container>
        </section>

        <section aria-labelledby="ag-brief-title" className="bg-canvas pt-20 sm:pt-24">
          <Container size="narrow">
            <SectionTitle id="ag-brief-title" title="En bref" />
            <dl className="mt-8 divide-y divide-line rounded-2xl bg-white px-5 shadow-[0_0_0_1px_rgba(27,31,46,.07)] sm:px-6">
              {brief.map((b) => (
                <div key={b.label} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                  <dt className="font-display font-semibold">{b.label}</dt>
                  <dd className="text-ink/80">{b.value}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        <section aria-labelledby="ag-faq-title" className="bg-canvas py-20 sm:py-24">
          <Container size="narrow">
            <SectionTitle id="ag-faq-title" title="Questions fréquentes" />
            <div className="mt-8">
              <Faq items={FAQ} idPrefix="faq-agences" />
            </div>
            <nav aria-labelledby="ag-more-title" className="mt-10">
              <h3 id="ag-more-title" className="font-display text-lg font-semibold">Pour aller plus loin</h3>
              <ul className="mt-3 space-y-1.5">
                {[
                  { href: "/methode#chaque-ia", label: "Comment chaque IA est mesurée" },
                  { href: "/fonctionnalites/agent-de-contenu", label: "L'agent de contenu et ses garde-fous" },
                  { href: "/fonctionnalites/rapports-et-partage", label: "Rapports, partage et marque blanche" },
                  { href: "/developpeurs", label: "Développeurs : API, MCP et webhooks" },
                  { href: "/comparatif", label: "Le comparatif honnête" },
                ].map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Container>
        </section>

        <section aria-labelledby="ag-cta-title" className="on-dark relative overflow-hidden bg-primary-deep py-20 text-white sm:py-24">
          <div aria-hidden="true" className="scope-grid-dark absolute inset-0 opacity-60" />
          <Container className="relative">
            <h2 id="ag-cta-title" className="max-w-3xl text-[2rem] font-bold leading-[1.06] text-white sm:text-[3rem]">
              Voyez ce que verraient vos clients, avant de décider.
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <DemoEntry account="demo-agence" className={buttonClasses({ size: "lg", variant: "light", className: "cursor-pointer" })}>
                Voir la démo agence
              </DemoEntry>
              <Link href="/analyse" className={buttonClasses({ size: "lg", variant: "ghost", className: "!text-white !min-h-12 justify-start" })}>
                Tester la marque d&apos;un client
              </Link>
            </div>
            <Reassure dark className="mt-6" items={["Aucune promesse de position", "Rien publié sans validation", "Pas d'échange de liens"]} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
