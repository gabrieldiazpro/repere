"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, CrossIcon } from "./blocks";
import { WaitlistForm } from "./WaitlistForm";
import { euros, planLink, plansFor, tiersFor, type SitePlan, type SiteSegment } from "./plans-v2";

type Billing = "month" | "year";

const TABS: { id: SiteSegment; label: string; short: string }[] = [
  { id: "local", label: "Commerce local", short: "Local" },
  { id: "pme", label: "PME et services", short: "PME" },
  { id: "ecommerce", label: "E-commerce", short: "E-commerce" },
  { id: "agence", label: "Agences", short: "Agences" },
];

type Cell = boolean | string;
type Row = { label: string; v: [Cell, Cell, Cell, Cell] };

export const DETAILS: Record<Exclude<SiteSegment, "agence">, Row[]> = {
  local: [
    { label: "Questions clients suivies", v: ["Questions types", "Questions types", "20, chaque mois", "30, chaque semaine"] },
    { label: "IA couvertes", v: ["ChatGPT, Gemini, Perplexity", "ChatGPT, Gemini, Perplexity", "ChatGPT, Gemini, Perplexity", "Les 3, plus Claude"] },
    { label: "Concurrents", v: ["Cités à votre place", "Cités à votre place", "3 suivis", "3 suivis"] },
    { label: "Sources que lisent les IA", v: [false, "Sources locales", "Classées par opportunité", "Classées par opportunité"] },
    { label: "Pourquoi eux, pas vous", v: [false, true, true, true] },
    { label: "Actions avec textes prêts", v: ["1 conseil détaillé", "10 à 15 actions", "Chaque semaine", "Chaque semaine"] },
    { label: "Travail fait par nous", v: [false, false, false, "Fiches Google, Bing, Apple, avis, annuaires"] },
    { label: "Trafic venu des IA", v: [false, false, "Lien de suivi", "Lien de suivi"] },
    { label: "Rapport", v: ["PDF", "PDF", "Mensuel et alertes", "Mensuel, avant/après"] },
    { label: "Engagement", v: ["Aucun", "Paiement unique", "Sans engagement", "3 mois, puis libre"] },
  ],
  pme: [
    { label: "Questions d'acheteurs suivies", v: ["10", "50", "50, chaque semaine", "100, chaque semaine"] },
    { label: "IA couvertes", v: ["ChatGPT, Gemini, Perplexity", "3 IA, plusieurs passages", "4 IA : ChatGPT, Gemini, Perplexity, Claude", "4 IA, plus Mistral Le Chat en option"] },
    { label: "Concurrents", v: ["3 cités", "5", "5", "5"] },
    { label: "Sources que lisent les IA", v: ["Les 5 premières", "Toutes", "Classées par opportunité", "Classées par opportunité"] },
    { label: "Pourquoi eux, pas vous", v: [false, true, true, true] },
    { label: "Actions prêtes", v: [false, "Plan sur 90 jours", "Chaque semaine", "Chaque semaine"] },
    { label: "Travail fait par nous", v: [false, false, false, "2 pages citables, 3 fiches comparateurs, 3 démarches sources par mois"] },
    { label: "Trafic venu des IA", v: [false, false, "Google Analytics", "Google Analytics"] },
    { label: "Rapport", v: ["Par e-mail", "Rapport complet", "Mensuel exportable", "Mensuel"] },
    { label: "Visio", v: [false, "45 min", false, "30 min par mois"] },
    { label: "Engagement", v: ["Aucun", "Paiement unique", "Sans engagement", "3 mois, puis libre"] },
  ],
  ecommerce: [
    { label: "Requêtes produit suivies", v: ["10", "50", "50, chaque semaine", "100, chaque semaine"] },
    { label: "IA couvertes", v: ["ChatGPT, Gemini, Perplexity", "3 IA, plusieurs passages", "4 IA : ChatGPT, Gemini, Perplexity, Claude", "4 IA, plus Mistral Le Chat en option"] },
    { label: "Marques concurrentes", v: ["Citées à votre place", "5", "5", "5"] },
    { label: "Sources que lisent les IA", v: ["5 sources", "Toutes", "Comparatifs, Reddit, marketplaces", "Comparatifs, Reddit, marketplaces"] },
    { label: "Audit du balisage et du flux", v: [false, true, true, true] },
    { label: "Fiches et balisage prêts", v: [false, "Plan sur 90 jours", "Prêts à copier", "Faits pour vous"] },
    { label: "Travail fait par nous", v: [false, false, false, "20 fiches réécrites, 1 guide d'achat, 3 démarches par mois"] },
    { label: "Trafic et ventes IA", v: [false, false, "GA4 ou Shopify", "GA4 ou Shopify"] },
    { label: "Visio", v: [false, "45 min", false, "30 min par mois"] },
    { label: "Engagement", v: ["Aucun", "Paiement unique", "Sans engagement", "3 mois, puis libre"] },
  ],
};

const FOR_WHOM: Record<Exclude<SiteSegment, "agence">, string> = {
  local: "pour un commerce",
  pme: "pour une PME",
  ecommerce: "pour une boutique",
};

const TAGLINES = ["Vous voyez le problème", "Vous avez le plan", "Vous faites, on vous guide", "On le fait pour vous"];

function CellView({ v, label }: { v: Cell; label: string }) {
  if (v === true)
    return (
      <span className="inline-flex items-center gap-1.5 text-success-ink">
        <CheckIcon />
        <span>Oui</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <CrossIcon />
        <span>
          Non<span className="sr-only"> ({label})</span>
        </span>
      </span>
    );
  return <span>{v}</span>;
}

function PriceLine({ plan, suffix, dark }: { plan: SitePlan; suffix?: string; dark?: boolean }) {
  const free = plan.priceCents === 0;
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
      <span className="tabular font-display text-[2.6rem] font-bold leading-none tracking-tight">{free ? "0 €" : euros(plan.priceCents)}</span>
      <span className={`text-[0.95rem] ${dark ? "text-on-deep" : "text-muted"}`}>
        {suffix ?? (free ? "" : plan.interval === "month" ? "/mois" : plan.interval === "year" ? "/an" : "une fois")}
      </span>
    </p>
  );
}

function Tier({
  plan,
  index,
  sub,
  note,
  recommended,
  first,
  forWhom,
}: {
  plan: SitePlan;
  index: number;
  sub?: string;
  note?: string;
  recommended?: boolean;
  /** « pour un commerce local » : précise l'offre recommandée selon le parcours */
  forWhom?: string;
  /** placé en premier sur mobile */
  first?: boolean;
}) {
  const free = plan.priceCents === 0;
  return (
    <article
      id={plan.id}
      className={`relative flex h-full scroll-mt-24 flex-col rounded-2xl p-6 ${first ? "order-first md:order-none" : ""} ${
        recommended
          ? "on-dark bg-primary-deep text-white shadow-[0_30px_60px_-30px_rgba(30,26,92,.9)] ring-2 ring-primary"
          : "bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]"
      }`}
    >
      {recommended ? (
        <p key={forWhom} className="site-swap absolute -top-3.5 left-5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[0.82rem] font-semibold text-ink">
          Recommandé{forWhom ? ` ${forWhom}` : ""}
        </p>
      ) : null}
      <h3 className={`text-xl font-bold ${recommended ? "text-white" : ""}`}>{plan.name}</h3>
      <p className={`mt-0.5 text-[0.95rem] ${recommended ? "text-on-deep" : "text-muted"}`}>{TAGLINES[index]}</p>
      <PriceLine plan={plan} dark={recommended} />
      <p key={sub} className={`site-swap mt-1.5 min-h-[1.4rem] text-[0.88rem] ${recommended ? "text-on-deep" : "text-muted"}`}>{sub ?? ""}</p>
      <ul className="mt-5 space-y-2.5 text-[0.95rem]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <CheckIcon className={`mt-0.5 ${recommended ? "text-accent" : "text-primary"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <Link
          href={planLink(plan)}
          className={buttonClasses({ variant: recommended ? "light" : free ? "primary" : "secondary", className: "w-full" })}
        >
          {free ? "Lancer le test gratuit" : plan.cta}
        </Link>
        <p className={`mt-3 text-center text-[0.85rem] xl:min-h-[2.6rem] ${note ? "" : "hidden xl:block"} ${recommended ? "text-on-deep" : "text-muted"}`}>{note ?? ""}</p>
      </div>
    </article>
  );
}

function MobileCompare({ cols, rows }: { cols: string[]; rows: Row[] }) {
  const [ci, setCi] = useState(3);
  return (
    <div className="border-t border-line p-4 md:hidden">
      <div role="group" aria-label="Palier affiché" className="relative grid grid-cols-4 gap-1 rounded-xl bg-canvas p-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-white shadow-[0_0_0_1px_rgba(27,31,46,.1)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ transform: `translateX(${ci * 100}%)` }}
        />
        {cols.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-pressed={ci === i}
            onClick={() => setCi(i)}
            className={`relative min-h-11 rounded-lg px-1 text-[0.78rem] font-semibold leading-tight ${ci === i ? (i === 3 ? "text-primary" : "text-ink") : "text-muted"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <dl key={ci} className="site-tab-in mt-3 divide-y divide-line/70 text-[0.93rem]">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[45%_1fr] gap-3 py-2.5">
            <dt className="text-muted">{r.label}</dt>
            <dd>
              <CellView v={r.v[ci]} label={`${cols[ci]}, ${r.label}`} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SegmentTiers({ segment, billing }: { segment: Exclude<SiteSegment, "agence">; billing: Billing }) {
  const t = tiersFor(segment);
  const ess = billing === "year" && t.essentielYear ? t.essentielYear : t.essentielMonth;
  const rows = DETAILS[segment];
  const cols = [t.free?.name ?? "Test gratuit", t.deep?.name ?? "Audit approfondi", "Essentiel", "Accompagné"];
  const reseau = billing === "year" && t.reseauYear ? t.reseauYear : t.reseauMonth;

  return (
    <>
      <div className="grid gap-5 pt-4 md:grid-cols-2 xl:grid-cols-4">
        {t.free ? <Tier plan={t.free} index={0} sub="Sans carte bancaire" /> : null}
        {t.deep ? <Tier plan={t.deep} index={1} sub="Déduit de l'Accompagné sous 30 jours" note="Remboursé sous 14 jours si non satisfait" /> : null}
        {ess ? (
          <Tier
            plan={ess}
            index={2}
            sub={
              billing === "year" && t.essentielMonth
                ? `soit ${euros(Math.round(ess.priceCents / 12))}/mois, 2 mois offerts`
                : t.essentielYear
                  ? `ou ${euros(t.essentielYear.priceCents)}/an, 2 mois offerts`
                  : undefined
            }
          />
        ) : null}
        {t.accompagne ? (
          <Tier
            plan={t.accompagne}
            index={3}
            recommended
            forWhom={FOR_WHOM[segment]}
            // Local : sur mobile, Essentiel (29 €) reste avant Accompagné ; ailleurs l'offre recommandée passe en tête.
            first={segment !== "local"}
            sub="3 mois minimum, puis mensuel sans engagement"
            note="Places limitées chaque mois : nous faisons le travail nous-mêmes."
          />
        ) : null}
      </div>

      {segment === "local" && reseau ? (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-bold">Plusieurs établissements ? Réseau</h3>
            <p className="mt-1 text-[0.95rem] text-ink/75">
              Essentiel jusqu&apos;à 5 établissements : {euros(reseau.priceCents)}
              {reseau.interval === "year" ? "/an" : "/mois"}. Accompagné : +69 € par mois et par établissement supplémentaire.
            </p>
          </div>
          <Link href={planLink(reseau)} className={buttonClasses({ variant: "secondary", className: "shrink-0" })}>
            {reseau.cta}
          </Link>
        </div>
      ) : null}
      {segment !== "local" ? (
        <p className="mt-6 text-[0.95rem] text-ink/80">
          Plus de 200 questions suivies ou plusieurs pays ?{" "}
          <a href="mailto:contact@repere-ia.fr?subject=Devis%20Rep%C3%A9r%C3%A9" className="font-semibold text-primary underline underline-offset-4">
            Parlons-en
          </a>
          , nous établissons un devis.
        </p>
      ) : null}

      <details className="group mt-10 rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
        <summary className="flex min-h-16 items-center justify-between gap-4 px-5 py-4 font-display text-lg font-semibold sm:px-6">
          Comparer les paliers en détail
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-bg text-primary transition-transform group-open:rotate-45">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </summary>
        {/* Bureau */}
        <div className="hidden border-t border-line md:block">
          <table className="w-full table-fixed border-collapse text-left text-[0.93rem]">
            <caption className="sr-only">Comparaison détaillée des paliers</caption>
            <thead>
              <tr className="bg-canvas">
                <td className="w-[22%] px-5 py-3" />
                {cols.map((c, i) => (
                  <th key={c} scope="col" className={`px-4 py-3 font-display font-semibold ${i === 3 ? "text-primary" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line/70 align-top">
                  <th scope="row" className="px-5 py-3 font-semibold">{r.label}</th>
                  {r.v.map((v, i) => (
                    <td key={i} className={`px-4 py-3 ${i === 3 ? "bg-primary-bg/50" : ""}`}>
                      <CellView v={v} label={`${cols[i]}, ${r.label}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile : un palier à la fois, choisi par pastilles (le tableau complet reste dans le HTML pour le bureau). */}
        <MobileCompare cols={cols} rows={rows} />
      </details>
    </>
  );
}

function AgencyTiers({ billing }: { billing: Billing }) {
  const list = plansFor("agence");
  const partner = list.find((p) => p.id === "agency_partner");
  const agency = list.find((p) => p.id === (billing === "year" ? "agency_year" : "agency_month")) ?? list.find((p) => p.id === "agency_month");
  const agencyMonth = list.find((p) => p.id === "agency_month");
  const agencyYear = list.find((p) => p.id === "agency_year");
  const execs = list.filter((p) => p.id.startsWith("agency_exec_"));
  const open = list.some((p) => p.available);

  return (
    <div className="pt-4">
      <div className="max-w-3xl">
        <h3 className="text-2xl font-bold sm:text-3xl">
          Vendez le référencement IA à vos clients. On fait la mesure et le travail, sous votre marque.
        </h3>
        {!open ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-warning-bg px-3 py-1 text-[0.92rem] font-semibold text-warning-ink">
            Ouverture prochaine : inscrivez-vous à la liste d&apos;attente
          </p>
        ) : null}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {partner ? (
          <article className="flex flex-col rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
            <h4 className="text-xl font-bold">{partner.name}</h4>
            <p className="mt-4 font-display text-[2.1rem] font-bold leading-none">30 %</p>
            <p className="mt-1.5 text-[0.88rem] text-muted">de commission, sans abonnement</p>
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
        {agency ? (
          <article className="on-dark flex flex-col rounded-2xl bg-primary-deep p-6 text-white ring-2 ring-primary">
            <h4 className="text-xl font-bold text-white">{agencyMonth?.name ?? agency.name}</h4>
            <PriceLine plan={agency} dark />
            <p className="mt-1.5 text-[0.88rem] text-on-deep">{billing === "year" || !agencyYear ? "2 mois offerts sur l'annuel" : `ou ${euros(agencyYear.priceCents)}/an, 2 mois offerts`}</p>
            <ul className="mt-5 space-y-2.5 text-[0.95rem]">
              {(agencyMonth ?? agency).features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <CheckIcon className="mt-0.5 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
        <article className="flex flex-col rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
          <h4 className="text-xl font-bold">Exécution en marque blanche</h4>
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
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-8">
        <h3 className="text-xl font-bold">Rejoindre la liste d&apos;attente agences</h3>
        <p className="mt-1.5 max-w-2xl text-[0.97rem] text-ink/75">
          La marque blanche est en cours de construction. Laissez votre e-mail : nous vous écrivons une seule fois, à
          l&apos;ouverture, avec les conditions des premières agences partenaires.
        </p>
        <div className="mt-5 max-w-2xl">
          <WaitlistForm fixedInterest="agency" idPrefix="waitlist-agence" />
        </div>
      </div>
    </div>
  );
}

export function PricingExplorer({ initial }: { initial: SiteSegment }) {
  const [seg, setSeg] = useState<SiteSegment>(initial);
  const [billing, setBilling] = useState<Billing>("month");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("segment", seg);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* sans conséquence */
    }
  }, [seg]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length;
    if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = TABS.length - 1;
    if (n >= 0) {
      e.preventDefault();
      setSeg(TABS[n].id);
      tabRefs.current[n]?.focus();
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Votre activité"
          className="relative grid w-full grid-cols-4 gap-0 rounded-2xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:w-[36rem]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/4)] rounded-xl bg-primary shadow-[0_6px_14px_-8px_rgba(55,48,163,.9)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ transform: `translateX(${Math.max(0, TABS.findIndex((t) => t.id === seg)) * 100}%)` }}
          />
          {TABS.map((t, i) => {
            const active = t.id === seg;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setSeg(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`relative min-h-11 whitespace-nowrap rounded-xl px-1 text-[0.85rem] font-semibold transition-colors duration-[var(--dur-base)] sm:px-3 sm:text-[0.95rem] ${
                  active ? "text-white" : "text-ink/75 hover:text-primary"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        <fieldset className="relative grid w-full grid-cols-2 rounded-2xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:w-[22rem]">
          <legend className="sr-only">Facturation</legend>
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/2)] rounded-xl bg-ink transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ transform: billing === "year" ? "translateX(100%)" : "none" }}
          />
          {(
            [
              ["month", "Mensuel", null],
              ["year", "Annuel", "2 mois offerts"],
            ] as const
          ).map(([v, l, extra]) => (
            <label
              key={v}
              className={`relative inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-[0.92rem] font-semibold transition-colors duration-[var(--dur-base)] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary ${
                billing === v ? "text-white" : "text-ink/75 hover:text-ink"
              }`}
            >
              <input type="radio" name="billing" value={v} checked={billing === v} onChange={() => setBilling(v)} className="sr-only" />
              {l}
              {extra ? (
                <span className={`rounded-full px-1.5 py-px text-[0.72rem] font-semibold ${billing === v ? "bg-success-bg text-success-ink" : "bg-success-bg/70 text-success-ink"}`}>{extra}</span>
              ) : null}
            </label>
          ))}
        </fieldset>
      </div>
      {billing === "year" ? (
        <p className="mt-3 text-[0.9rem] text-muted">L&apos;annuel s&apos;applique à Essentiel, Réseau et Agence. Accompagné reste mensuel.</p>
      ) : null}

      {/* Les 4 parcours sont rendus côté serveur (présents dans le HTML, lisibles sans JavaScript par les robots des IA) ;
          seul le panneau actif est affiché. */}
      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== seg}
          tabIndex={0}
          className="mt-8 focus-visible:outline-offset-8"
        >
          <h2 className="sr-only">Offres {t.label}</h2>
          {t.id === "agence" ? <AgencyTiers billing={billing} /> : <SegmentTiers segment={t.id} billing={billing} />}
        </div>
      ))}
    </div>
  );
}

export default PricingExplorer;
