/** Gabarit commun des sous-landings /local, /pme, /e-commerce (docs/v2/07-positionnement.md § 3.2 à 3.4). */
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, Faq, FactsRow, Reassure, SectionTitle, type QA } from "./blocks";
import { FACTS, type Fact } from "./facts";
import type { HeroAnswerData } from "./mockups";
import { AiStrip } from "./AiStrip";
import { ProofWall } from "./ProofWall";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { QuickAuditForm } from "@/components/motion/QuickAuditForm";
import { HeroScene } from "@/components/motion/scenes/HeroScene";
import { euros, planLink, tiersFor, VAT_NOTICE, type SitePlan } from "./plans-v2";
import { JsonLd } from "@/lib/seo/shell";
import { fmtDate } from "@/lib/seo";

import { PAGE_UPDATED } from "@/lib/seo/site";
import { breadcrumbListLd, faqPageLd, graph, pageIds, softwareAppLd, webPageLd, ORG_ID, SOFTWARE_ID } from "@/lib/seo/jsonld";
import { demoHeroScene, demoHeroStory } from "./demo-figures";
import { StoryScene } from "@/components/motion/scenes/StoryScene";

/** Chiffres du mur de preuves : jamais ceux déjà montrés dans le bloc « chiffres » de la même landing. */
const PROOF_FACTS = {
  local: [FACTS.credoc, FACTS.trust],
  pme: [FACTS.credoc, FACTS.g2Switch],
  ecommerce: [FACTS.credoc, FACTS.weeklyUse],
} as const satisfies Record<string, readonly [Fact, Fact]>;

export type LandingSegment = "local" | "pme" | "ecommerce";

export const LANDING_PATH: Record<LandingSegment, "/local" | "/pme" | "/e-commerce"> = {
  local: "/local",
  pme: "/pme",
  ecommerce: "/e-commerce",
};
const CRUMB: Record<LandingSegment, string> = { local: "Commerce local", pme: "PME et services B2B", ecommerce: "E-commerce" };

export type SegmentLandingProps = {
  segment: LandingSegment;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta?: { label: string; href: string };
  reassure: string[];
  /** V2 : réponse statique du hero. V3 : la scène animée du parcours (HeroScene) la remplace ; conservé pour compatibilité. */
  hero?: HeroAnswerData;
  queries: { intent: string; items: string[] }[];
  queriesTitle: string;
  problems: { title: string; text: string }[];
  facts: Fact[];
  factsNote?: string;
  proofNote: ReactNode;
  steps: { verb: string; text: string }[];
  stepsVisual: ReactNode;
  /** V4 : le visuel propre au parcours (carte de quartier, matrice concurrents, produits cités), sous les requêtes. */
  signature?: { title: string; intro: string; visual: ReactNode; points: string[] };
  features: string[];
  pricingNote?: ReactNode;
  faq: QA[];
  finalTitle: string;
  /** Title et description de la page (repris dans le JSON-LD WebPage). */
  seo: { title: string; description: string };
  /** Bloc « En bref » : réponses factuelles et autonomes (citables par les IA). */
  brief: { label: string; value: ReactNode }[];
  /** Liens contextuels vers les guides et pages de référence. */
  related: { href: string; label: string }[];
  /** V5 : le travail SEO + IA propre au parcours (chaque point dit pour quel lecteur il compte). */
  seoGeo?: { title: string; intro: string; items: { reader: "google" | "ia" | "both"; title: string; text: string }[]; guide?: { href: string; label: string } };
};

const READER: Record<"google" | "ia" | "both", { label: string; cls: string }> = {
  google: { label: "Google", cls: "bg-[var(--tone-brand-bg)] text-[var(--tone-brand)]" },
  ia: { label: "IA", cls: "bg-[var(--tone-warn-bg)] text-[var(--tone-warn)]" },
  both: { label: "Google et IA", cls: "bg-[var(--tone-up-bg)] text-[var(--tone-up)]" },
};

function TierCard({ plan, tagline, recommended, sub }: { plan: SitePlan; tagline: string; recommended?: boolean; sub?: string }) {
  const free = plan.priceCents === 0;
  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl p-5 sm:p-6 ${
        recommended ? "on-dark bg-primary text-white shadow-[0_24px_50px_-26px_rgba(30,26,92,.9)]" : "bg-white ring-1 ring-line"
      }`}
    >
      {recommended ? (
        <p className="absolute -top-3 left-5 rounded-full bg-accent px-2.5 py-0.5 text-[0.82rem] font-semibold text-ink">Recommandé</p>
      ) : null}
      <h3 className={`text-lg font-bold ${recommended ? "text-white" : ""}`}>{plan.name}</h3>
      <p className={`text-[0.9rem] ${recommended ? "text-on-deep" : "text-muted"}`}>{tagline}</p>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
        <span className="tabular font-display text-[2.1rem] font-bold leading-none">{free ? "0 €" : euros(plan.priceCents)}</span>
        <span className={`text-[0.9rem] ${recommended ? "text-on-deep" : "text-muted"}`}>
          {free ? "" : plan.interval === "month" ? "/mois" : "une fois"}
        </span>
      </p>
      {sub ? <p className={`mt-1 text-[0.85rem] ${recommended ? "text-on-deep" : "text-muted"}`}>{sub}</p> : null}
      <ul className="mt-4 space-y-2 text-[0.92rem]">
        {plan.features.slice(0, 4).map((f) => (
          <li key={f} className="flex gap-2">
            <CheckIcon className={`mt-0.5 ${recommended ? "text-accent" : "text-primary"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <Link
          href={planLink(plan)}
          className={buttonClasses({ variant: recommended ? "light" : free ? "primary" : "secondary", className: "w-full" })}
        >
          {plan.cta}
        </Link>
      </div>
    </article>
  );
}

export function SegmentLanding(p: SegmentLandingProps) {
  const t = tiersFor(p.segment);
  const tiers: { plan: SitePlan; tagline: string; recommended?: boolean; sub?: string }[] = [];
  if (t.free) tiers.push({ plan: t.free, tagline: "Vous voyez le problème" });
  if (t.deep) tiers.push({ plan: t.deep, tagline: "Vous avez le plan", sub: "Déduit de l'Accompagné sous 30 jours" });
  if (t.essentielMonth)
    tiers.push({
      plan: t.essentielMonth,
      tagline: "Vous faites, on vous guide",
      sub: t.essentielYear ? `ou ${euros(t.essentielYear.priceCents)}/an, 2 mois offerts` : undefined,
    });
  if (t.accompagne) tiers.push({ plan: t.accompagne, tagline: "On le fait pour vous", recommended: true, sub: "3 mois minimum, puis sans engagement" });

  const story = demoHeroStory(p.segment);
  const path = LANDING_PATH[p.segment];
  const updated = PAGE_UPDATED[path];
  const ld = graph([
    webPageLd(path, { name: p.seo.title, description: p.seo.description, dateModified: updated, about: SOFTWARE_ID }, { withContext: false }),
    softwareAppLd(path, [p.segment], { withContext: false }),
    {
      "@type": "Service",
      "@id": pageIds(path).service,
      name: `Référencement IA (GEO) : ${CRUMB[p.segment]}`,
      serviceType: "Référencement IA (GEO)",
      provider: { "@id": ORG_ID },
      areaServed: { "@type": "Country", name: "France" },
      url: pageIds(path).url,
      isRelatedTo: { "@id": SOFTWARE_ID },
    },
    faqPageLd(path, p.faq, { withContext: false }),
    breadcrumbListLd(path, [{ name: "Accueil", path: "/" }, { name: CRUMB[p.segment], path }], { withContext: false }),
  ]);

  return (
    <>
      <JsonLd data={ld} />
      <Header segment={p.segment} />
      <main id="contenu">
        <MotionRoot />
        {/* Hero : action au premier écran + scène du parcours (docs/v3/07 §5.2) */}
        <section aria-labelledby="seg-hero-title" className="relative overflow-hidden bg-canvas">
          <Parallax className="scope-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_30%,transparent_95%)]" />
          <Container className="relative pb-14 pt-8 sm:pb-20 sm:pt-16">
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[0.82rem] sm:text-[0.9rem] font-medium text-ink/80 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                  {p.eyebrow}
                </p>
                <h1 id="seg-hero-title" className="mt-5 text-[2.1rem] font-bold leading-[1.04] tracking-[-0.03em] sm:mt-6 sm:text-[3.1rem] lg:text-[3.3rem]">
                  {p.title}
                </h1>
                <p className="mt-4 max-w-[60ch] text-[1.02rem] text-ink/75 sm:mt-6 sm:text-lg">{p.subtitle}</p>
                <QuickAuditForm segment={p.segment} idPrefix="seg-hero" submitLabel={p.primaryCta} className="mt-7" />
                <Reassure className="mt-4" items={p.reassure} />
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
                  {p.secondaryCta ? (
                    <Link href={p.secondaryCta.href} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
                      {p.secondaryCta.label}
                    </Link>
                  ) : null}
                  <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 text-ink/75 underline-offset-4 hover:text-primary hover:underline">
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
                      <path d="M4.5 2.8v10.4L13 8z" />
                    </svg>
                    Voir la démo en vidéo
                  </Link>
                </div>
              </div>
              <div className="relative mx-auto w-full max-w-xl lg:mt-2 lg:max-w-none">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-[radial-gradient(60%_55%_at_60%_40%,rgba(55,48,163,.13),transparent_70%),radial-gradient(40%_40%_at_25%_85%,rgba(245,165,36,.14),transparent_70%)]"
                />
                <div className="relative">
                  {story ? <StoryScene segment={p.segment} data={story} /> : <HeroScene segment={p.segment} data={demoHeroScene(p.segment)} />}
                </div>
              </div>
            </div>
          </Container>
        </section>

        {p.seoGeo ? (
          <section aria-labelledby="seg-seogeo-title" className="border-t border-line/70 bg-white py-20 sm:py-24">
            <Container>
              <SectionTitle id="seg-seogeo-title" title={p.seoGeo.title} intro={p.seoGeo.intro} />
              <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {p.seoGeo.items.map((it, i) => (
                  <Reveal as="li" i={i} key={it.title} className="flex flex-col rounded-2xl bg-canvas p-5">
                    <span className={`self-start rounded-[var(--r-xs,6px)] px-1.5 py-0.5 text-[0.72rem] font-semibold ${READER[it.reader].cls}`}>
                      Compte pour : {READER[it.reader].label}
                    </span>
                    <h3 className="mt-2 text-lg font-bold leading-snug">{it.title}</h3>
                    <p className="mt-1.5 text-[0.95rem] text-ink/75">{it.text}</p>
                  </Reveal>
                ))}
              </ul>
              {p.seoGeo.guide ? (
                <p className="mt-8 text-[1rem]">
                  <Link href={p.seoGeo.guide.href} className="font-semibold text-primary underline underline-offset-4">
                    {p.seoGeo.guide.label}
                  </Link>
                </p>
              ) : null}
            </Container>
          </section>
        ) : null}

        <AiStrip />

        {/* Exemples de requêtes */}
        <section aria-labelledby="seg-queries-title" className={`bg-white pt-20 sm:pt-24 ${p.signature ? "pb-16 sm:pb-20" : "pb-20 sm:pb-24"}`}>
          <Container>
            <SectionTitle
              id="seg-queries-title"
              title={p.queriesTitle}
              intro="Quelques exemples des questions que nous posons aux IA pour vous. Votre liste est faite sur mesure."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {p.queries.map((g, gi) => (
                <Reveal key={g.intent} i={gi} className="rounded-2xl bg-canvas p-5 sm:p-6">
                  <h3 className="text-[1.05rem] font-semibold text-muted">{g.intent}</h3>
                  <ul className="mt-3 space-y-2">
                    {g.items.map((q) => (
                      <li key={q} className="w-fit max-w-full rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[0.95rem] shadow-[0_0_0_1px_rgba(27,31,46,.07)]">
                        {`«\u00A0${q.replace(/ \?$/, "\u00A0?")}\u00A0»`}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {p.signature ? (
          <section aria-labelledby="seg-sig-title" className="bg-white pb-20 sm:pb-24">
            <Container>
              <div className="grid items-center gap-10 border-t border-line pt-16 sm:pt-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
                <div>
                  <SectionTitle id="seg-sig-title" title={p.signature.title} intro={p.signature.intro} />
                  <ul className="mt-8 space-y-3 text-[1rem]">
                    {p.signature.points.map((t, i) => (
                      <Reveal as="li" i={i} key={t} className="flex gap-2.5">
                        <CheckIcon className="mt-0.5 text-primary" />
                        {t}
                      </Reveal>
                    ))}
                  </ul>
                </div>
                <div className="min-w-0">{p.signature.visual}</div>
              </div>
            </Container>
          </section>
        ) : null}


        {/* Problèmes + preuve */}
        <section aria-labelledby="seg-pb-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <SectionTitle id="seg-pb-title" title="Ce qui se joue, sans que vous le voyiez" />
            <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
              {p.problems.map((pb) => (
                <li key={pb.title} className="border-t-2 border-ink/10 pt-5">
                  <h3 className="text-xl font-bold">{pb.title}</h3>
                  <p className="mt-2 text-ink/75">{pb.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-16 rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.07)] sm:p-10">
              <FactsRow facts={p.facts} />
              {p.factsNote ? <p className="mt-6 text-[0.85rem] text-muted">{p.factsNote}</p> : null}
              <p className="mt-6 border-t border-line pt-5 text-[0.95rem] text-ink/80">{p.proofNote}</p>
            </div>
          </Container>
        </section>

        {/* Comment ça marche */}
        <section aria-labelledby="seg-how-title" className="bg-white py-20 sm:py-24">
          <Container>
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
              <div>
                <SectionTitle id="seg-how-title" title="Comment ça marche" />
                <ol className="mt-8 space-y-0">
                  {p.steps.map((s, i) => (
                    <li key={s.verb} className="relative flex gap-5 pb-8 last:pb-0">
                      {i < p.steps.length - 1 ? (
                        <span aria-hidden="true" className="absolute left-[1.05rem] top-10 bottom-0 w-px bg-line" />
                      ) : null}
                      <span className="tabular relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[0.95rem] font-semibold text-white">
                        {i + 1}
                      </span>
                      <div className="pt-1">
                        <h3 className="text-xl font-bold">{s.verb}</h3>
                        <p className="mt-1.5 text-ink/75">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="min-w-0 space-y-6 lg:sticky lg:top-24">{p.stepsVisual}</div>
            </div>
            <div className="mt-16">
              <h3 className="font-display text-xl font-semibold">Inclus</h3>
              <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[0.98rem]">
                    <CheckIcon className="mt-0.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {/* Tarifs */}
        <section aria-labelledby="seg-price-title" className="bg-canvas py-20 sm:py-24">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle id="seg-price-title" title="Tarifs" intro={`Prix nets : ${VAT_NOTICE}.`} />
              <Link href={`/tarifs?segment=${p.segment}`} className={buttonClasses({ variant: "secondary", className: "shrink-0" })}>
                Comparer en détail
              </Link>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((x) => (
                <TierCard key={x.plan.id} {...x} />
              ))}
            </div>
            {p.pricingNote ? <p className="mt-6 text-[0.95rem] text-ink/80">{p.pricingNote}</p> : null}
            <p className="mt-3 text-[0.88rem] text-muted">
              Prix en vigueur au <time dateTime={updated}>{fmtDate(updated)}</time>.
            </p>
          </Container>
        </section>

        {/* Mur de preuves honnêtes */}
        <section aria-labelledby="seg-proof-title" className="bg-white py-20 sm:py-24">
          <Container>
            <SectionTitle
              id="seg-proof-title"
              title="Pourquoi nous croire"
              intro="Une méthode ouverte, des marges d'erreur publiées et des engagements écrits. Pas de faux avis."
            />
            <div className="mt-10">
              <ProofWall facts={PROOF_FACTS[p.segment]} />
            </div>
          </Container>
        </section>

        {/* En bref : faits autonomes, citables */}
        <section aria-labelledby="seg-brief-title" className="bg-canvas pt-20 sm:pt-24">
          <Container size="narrow">
            <SectionTitle id="seg-brief-title" title="En bref" />
            <dl className="mt-8 divide-y divide-line rounded-2xl bg-white px-5 shadow-[0_0_0_1px_rgba(27,31,46,.07)] sm:px-6">
              {p.brief.map((b) => (
                <div key={b.label} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                  <dt className="font-display font-semibold">{b.label}</dt>
                  <dd className="text-ink/80">{b.value}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        {/* FAQ */}
        <section aria-labelledby="seg-faq-title" className="bg-canvas py-20 sm:py-24">
          <Container size="narrow">
            <SectionTitle id="seg-faq-title" title="Questions fréquentes" />
            <div className="mt-8">
              <Faq items={p.faq} idPrefix={`faq-${p.segment}`} />
            </div>
            <nav aria-labelledby="seg-more-title" className="mt-10">
              <h3 id="seg-more-title" className="font-display text-lg font-semibold">Pour aller plus loin</h3>
              <ul className="mt-3 space-y-1.5">
                {p.related.map((r) => (
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

        {/* CTA final */}
        <section aria-labelledby="seg-cta-title" className="on-dark relative overflow-hidden bg-primary-deep py-20 text-white sm:py-24">
          <div aria-hidden="true" className="scope-grid-dark absolute inset-0 opacity-60" />
          <Container className="relative">
            <h2 id="seg-cta-title" className="max-w-3xl text-[2rem] font-bold leading-[1.06] text-white sm:text-[3rem]">
              {p.finalTitle}
            </h2>
            <QuickAuditForm segment={p.segment} idPrefix="seg-cta" submitLabel={p.primaryCta} dark className="mt-8" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href={`/app?visite=1&segment=${p.segment}`} rel="nofollow" className={buttonClasses({ size: "lg", variant: "ghost", className: "!text-white !min-h-12 justify-start" })}>
                Visiter le compte démo
              </Link>
              {p.secondaryCta ? (
                <Link
                  href={p.secondaryCta.href}
                  className={buttonClasses({ size: "lg", variant: "ghost", className: "!text-white !min-h-12 justify-start" })}
                >
                  {p.secondaryCta.label}
                </Link>
              ) : null}
            </div>
            <Reassure dark className="mt-6" items={p.reassure} />
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default SegmentLanding;
