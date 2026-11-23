"use client";

/**
 * /tarifs (V10, docs/v10/DECISIONS.md) : 3 paliers par parcours (Découverte, Essentiel, Accompagné), bascule
 * mensuel / annuel, audit approfondi et Réseau à la carte, comparatif des fonctionnalités. L'offre Agence est à part
 * (AgencyPricing, sous ce composant). Les lignes du comparatif viennent du serveur (src/components/pages/pricing-data.ts,
 * lues dans la table des droits) : rien n'est recopié ici.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, CrossIcon } from "./blocks";
import { euros, planLink, tiersFor, type SitePlan } from "./plans-v2";
import type { CompareRow, Seg } from "@/components/pages/pricing-data";

type Billing = "month" | "year";
type Cell = CompareRow["decouverte"];

const TABS: { id: Seg; label: string; short: string }[] = [
  { id: "local", label: "Commerce local", short: "Local" },
  { id: "pme", label: "PME et services", short: "PME" },
  { id: "ecommerce", label: "E-commerce", short: "E-commerce" },
];

const FOR_WHOM: Record<Seg, string> = { local: "pour un commerce", pme: "pour une PME", ecommerce: "pour une boutique" };
const TAGLINES = ["Vous voyez où vous en êtes", "Vous faites, on vous guide", "On le fait pour vous"];
const COLS = ["Découverte", "Essentiel", "Accompagné"] as const;
const KEYS = ["decouverte", "essentiel", "accompagne"] as const;

/** Anciennes ancres (« Test gratuit ») → onglet du parcours ; `#local_audit_free` mène à la carte Découverte. */
const HASH_SEG: [RegExp, Seg][] = [
  [/^#?(local_|audit_free)/, "local"],
  [/^#?pme_/, "pme"],
  [/^#?ecom_/, "ecommerce"],
];

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

function PriceLine({ plan, dark }: { plan: SitePlan; dark?: boolean }) {
  const free = plan.priceCents === 0;
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
      <span className="tabular font-display text-[2.6rem] font-bold leading-none tracking-tight">{free ? "0 €" : euros(plan.priceCents)}</span>
      <span className={`text-[0.95rem] ${dark ? "text-on-deep" : "text-muted"}`}>
        {free ? "pour toujours" : plan.interval === "month" ? "/mois" : plan.interval === "year" ? "/an" : "une fois"}
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
  demoHref,
  secondary,
  anchors,
}: {
  plan: SitePlan;
  index: number;
  sub?: string;
  note?: string;
  recommended?: boolean;
  forWhom?: string;
  /** placé en premier sur mobile */
  first?: boolean;
  /** « Réserver une démo » (Accompagné), à côté de l'appel principal, jamais à sa place */
  demoHref?: string;
  /** lien secondaire (Découverte : l'analyse sans inscription) */
  secondary?: { href: string; label: string };
  /** anciennes ancres conservées (redirection des liens « Test gratuit ») */
  anchors?: string[];
}) {
  return (
    <article
      id={plan.id}
      className={`relative flex h-full scroll-mt-24 flex-col rounded-2xl p-6 ${first ? "order-first md:order-none" : ""} ${
        recommended
          ? "on-dark bg-primary-deep text-white shadow-[0_30px_60px_-30px_rgba(30,26,92,.9)] ring-2 ring-primary"
          : "bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]"
      }`}
    >
      {anchors?.map((a) => <span key={a} id={a} aria-hidden="true" className="absolute -top-24" />)}
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
            <CheckIcon className={`mt-0.5 shrink-0 ${recommended ? "text-accent" : "text-primary"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <Link href={planLink(plan)} className={buttonClasses({ variant: recommended ? "light" : index === 0 ? "primary" : "secondary", className: "w-full" })}>
          {plan.cta}
        </Link>
        {demoHref ? (
          <Link
            href={demoHref}
            className={
              recommended
                ? "mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-2.5 font-semibold text-white ring-1 ring-inset ring-white/45 transition-colors hover:bg-white/10"
                : buttonClasses({ variant: "secondary", className: "mt-2 w-full" })
            }
          >
            Réserver une démo
          </Link>
        ) : null}
        {secondary ? (
          <Link href={secondary.href} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-center text-[0.92rem] font-semibold text-primary underline underline-offset-4 hover:no-underline">
            {secondary.label}
          </Link>
        ) : null}
        <p className={`mt-3 text-center text-[0.85rem] ${note ? "" : "hidden"} ${recommended ? "text-on-deep" : "text-muted"}`}>{note ?? ""}</p>
      </div>
    </article>
  );
}

function MobileCompare({ rows }: { rows: CompareRow[] }) {
  const [ci, setCi] = useState(2);
  return (
    <div className="border-t border-line p-4 md:hidden">
      <div role="group" aria-label="Palier affiché" className="relative grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-white shadow-[0_0_0_1px_rgba(27,31,46,.1)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{ transform: `translateX(${ci * 100}%)` }}
        />
        {COLS.map((c, i) => (
          <button
            key={c}
            type="button"
            aria-pressed={ci === i}
            onClick={() => setCi(i)}
            className={`relative min-h-11 rounded-lg px-1 text-[0.82rem] font-semibold leading-tight ${ci === i ? (i === 2 ? "text-primary" : "text-ink") : "text-muted"}`}
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
              <CellView v={r[KEYS[ci]]} label={`${COLS[ci]}, ${r.label}`} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Comparatif des fonctionnalités, par groupes (ouvert par défaut : c'est la question la plus posée). */
function Compare({ segment, rows, active }: { segment: Seg; rows: CompareRow[]; active: boolean }) {
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <details open id={active ? "comparer" : undefined} className="group relative mt-10 scroll-mt-24 rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
      {/* Ancienne ancre de la section SEO et agent, fondue dans ce comparatif (V10). */}
      {active ? <span id="seo-agent" aria-hidden="true" className="absolute -top-24" /> : null}
      <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-5 py-4 font-display text-lg font-semibold sm:px-6">
        <span>
          Comparatif des fonctionnalités <span className="font-normal text-muted">({TABS.find((t) => t.id === segment)?.label})</span>
        </span>
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-bg text-primary transition-transform group-open:rotate-45">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="hidden border-t border-line md:block">
        <table className="w-full table-fixed border-collapse text-left text-[0.93rem]">
          <caption className="sr-only">Comparatif des fonctionnalités Découverte, Essentiel et Accompagné</caption>
          <thead>
            <tr className="bg-canvas">
              <td className="w-[31%] px-5 py-3" />
              {COLS.map((c, i) => (
                <th key={c} scope="col" className={`px-4 py-3 font-display font-semibold ${i === 2 ? "text-primary" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr className="border-t border-line">
                <th scope="colgroup" colSpan={4} className="bg-canvas/60 px-5 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">
                  {g}
                </th>
              </tr>
              {rows
                .filter((r) => r.group === g)
                .map((r) => (
                  <tr key={r.label} className="border-t border-line/70 align-top">
                    <th scope="row" className="px-5 py-3 font-semibold">{r.label}</th>
                    {KEYS.map((k, i) => (
                      <td key={k} className={`px-4 py-3 ${i === 2 ? "bg-primary-bg/50" : ""}`}>
                        <CellView v={r[k]} label={`${COLS[i]}, ${r.label}`} />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
      <MobileCompare rows={rows} />
    </details>
  );
}

function SegmentTiers({ segment, billing, rows, active }: { segment: Seg; billing: Billing; rows: CompareRow[]; active: boolean }) {
  const t = tiersFor(segment);
  // En annuel, la carte garde le détail de l'offre mensuelle (même contenu) avec le prix annuel.
  const ess =
    billing === "year" && t.essentielYear && t.essentielMonth
      ? { ...t.essentielYear, features: [...t.essentielMonth.features.filter((f) => !/^Sans engagement/.test(f)), ...t.essentielYear.features.filter((f) => !/^Tout /.test(f))] }
      : t.essentielMonth;
  const reseau = billing === "year" && t.reseauYear ? t.reseauYear : t.reseauMonth;
  const oldFree = `${segment === "ecommerce" ? "ecom" : segment}_audit_free`;

  return (
    <>
      <div className="grid gap-5 pt-4 md:grid-cols-3">
        {t.free ? (
          <Tier
            plan={t.free}
            index={0}
            sub="Sans carte bancaire, sans limite de durée"
            secondary={{ href: `/analyse?segment=${segment}`, label: "Ou analyser mon site en 60 s, sans inscription" }}
            anchors={[oldFree, ...(segment === "local" ? ["test-gratuit", "audit_free"] : [])]}
          />
        ) : null}
        {ess ? (
          <Tier
            plan={ess}
            index={1}
            sub={
              billing === "year" && t.essentielMonth
                ? `soit ${euros(Math.round(ess.priceCents / 12))}/mois, 2 mois offerts`
                : t.essentielYear
                  ? `ou ${euros(t.essentielYear.priceCents)}/an, 2 mois offerts`
                  : undefined
            }
            note="Sans engagement, résiliable en 1 clic"
          />
        ) : null}
        {t.accompagne ? (
          <Tier
            plan={t.accompagne}
            index={2}
            recommended
            forWhom={FOR_WHOM[segment]}
            first={segment !== "local"}
            demoHref={`/rendez-vous?offre=accompagne&segment=${segment}`}
            sub={billing === "year" ? "Mensuel uniquement : 3 mois minimum, puis sans engagement" : "3 mois minimum, puis mensuel sans engagement"}
            note="Places limitées chaque mois : nous faisons le travail nous-mêmes."
          />
        ) : null}
      </div>

      {t.pilote ? (
        <div
          id={t.pilote.id}
          className="relative mt-6 flex scroll-mt-24 flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] ring-1 ring-inset ring-primary/25 sm:p-6 lg:flex-row lg:items-center"
        >
          {active ? <span id="pilote-automatique" aria-hidden="true" className="absolute -top-24" /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-primary">Tout fait pour vous, sans rendez-vous</p>
            <h3 className="mt-1 text-lg font-bold">
              {t.pilote.name} : <span className="tabular">{euros(t.pilote.priceCents)}</span>/mois
              <span className="font-normal text-muted"> · sans engagement{billing === "year" ? ", mensuel uniquement" : ""}</span>
            </h3>
            <p className="mt-1 text-[0.95rem] text-ink/75">
              Tout Essentiel, et Repéré applique lui-même les corrections et publie les contenus que vous autorisez une fois, par écrit. Prévenu après
              coup, annulable en 1 clic, contenus relisibles 72 h avant leur mise en ligne. Aucun appel, aucun rendez-vous.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link href={`/tout-fait-pour-vous?segment=${segment}#commencer`} className={buttonClasses({ variant: "primary", className: "w-full sm:w-auto" })}>
              {t.pilote.cta}
            </Link>
            <Link href={`/tout-fait-pour-vous?segment=${segment}`} className="inline-flex min-h-11 items-center justify-center text-[0.92rem] font-semibold text-primary underline underline-offset-4 hover:no-underline">
              Ce que fait le pilote, et ce qu&apos;il ne fait jamais
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {t.deep ? (
          <div id={t.deep.id} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-6">
            <div>
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">À la carte</p>
              <h3 className="mt-1 text-lg font-bold">
                {t.deep.name} : <span className="tabular">{euros(t.deep.priceCents)}</span>, une fois
              </h3>
              <p className="mt-1 text-[0.95rem] text-ink/75">
                Un plan d&apos;action complet, remboursé sous 14 jours si vous n&apos;êtes pas satisfait, déduit de l&apos;Accompagné sous 30 jours.
                Un mois d&apos;Essentiel offert, puis retour à Découverte sans paiement.
              </p>
            </div>
            <Link href={planLink(t.deep)} className={buttonClasses({ variant: "secondary", className: "mt-auto w-full sm:w-auto sm:self-start" })}>
              {t.deep.cta}
            </Link>
          </div>
        ) : null}
        {segment === "local" && reseau ? (
          <div id="reseau" className="flex scroll-mt-24 flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-6">
            <div>
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted">Plusieurs établissements</p>
              <h3 className="mt-1 text-lg font-bold">
                Réseau : <span className="tabular">{euros(reseau.priceCents)}</span>
                {reseau.interval === "year" ? "/an" : "/mois"}
              </h3>
              <p className="mt-1 text-[0.95rem] text-ink/75">Essentiel pour 5 établissements, tableau de bord commun. Accompagné pour plusieurs établissements : sur devis.</p>
            </div>
            <Link href={planLink(reseau)} className={buttonClasses({ variant: "secondary", className: "mt-auto w-full sm:w-auto sm:self-start" })}>
              {reseau.cta}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col justify-center rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-6">
            <h3 className="text-lg font-bold">Plus de 200 questions ou plusieurs pays ?</h3>
            <p className="mt-1 text-[0.95rem] text-ink/75">
              <a href="mailto:contact@repere-ia.fr?subject=Devis%20Rep%C3%A9r%C3%A9" className="font-semibold text-primary underline underline-offset-4">
                Parlons-en
              </a>
              , nous établissons un devis. Grok est mesurable sur demande.
            </p>
          </div>
        )}
      </div>

      <Compare segment={segment} rows={rows} active={active} />
    </>
  );
}

export function PricingExplorer({ initial, rows }: { initial: Seg | "agence"; rows: Record<Seg, CompareRow[]> }) {
  const [seg, setSeg] = useState<Seg>(initial === "agence" ? "local" : initial);
  const [billing, setBilling] = useState<Billing>("month");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrivée par une ancienne ancre (#pme_audit_free, #test-gratuit) ou par ?segment=agence : bon onglet, bonne carte.
  useEffect(() => {
    try {
      const h = window.location.hash;
      const hit = HASH_SEG.find(([re]) => re.test(h));
      if (hit && /audit_free|test-gratuit/.test(h)) {
        setSeg(hit[1]);
        requestAnimationFrame(() => document.getElementById(h.slice(1))?.scrollIntoView({ block: "start" }));
      } else if (initial === "agence" && !h) {
        requestAnimationFrame(() => document.getElementById("agence")?.scrollIntoView({ block: "start" }));
      }
    } catch {
      /* sans conséquence */
    }
  }, [initial]);

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
          className="relative grid w-full grid-cols-3 gap-0 rounded-2xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:w-[30rem]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/3)] rounded-xl bg-primary shadow-[0_6px_14px_-8px_rgba(55,48,163,.9)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
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
                className={`relative min-h-11 whitespace-nowrap rounded-xl px-1 text-[0.88rem] font-semibold transition-colors duration-[var(--dur-base)] sm:px-3 sm:text-[0.95rem] ${
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

      {/* Les 3 parcours sont rendus côté serveur (présents dans le HTML, lisibles sans JavaScript par les robots des IA) ;
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
          <SegmentTiers segment={t.id} billing={billing} rows={rows[t.id]} active={t.id === seg} />
        </div>
      ))}
    </div>
  );
}

export default PricingExplorer;
