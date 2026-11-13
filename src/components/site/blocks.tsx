/** Blocs partagés des pages publiques V2 (landing, sous-landings, tarifs). */
import Link from "next/link";
import type { ReactNode } from "react";
import { type Fact, MARKET_SOURCES } from "./facts";
import { euros, fromPrice } from "./plans-v2";
import { faqPageLd } from "@/lib/seo/jsonld";

/* ---------- Petits éléments ---------- */

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M5 10.4l3.2 3.2L15 6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Liste « réassurance » sous un bouton (remplace les chaînes « A · B · C »). */
export function Reassure({ items, className = "", dark = false }: { items: string[]; className?: string; dark?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1.5 text-[0.92rem] ${dark ? "text-on-deep" : "text-muted"} ${className}`}>
      {items.map((i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <CheckIcon className={dark ? "text-accent" : "text-success"} />
          {i}
        </li>
      ))}
    </ul>
  );
}

/** Espaces insécables avant « : ; ? ! » et après « « », sur du texte simple (les ReactNode sont laissés tels quels). */
export function frTypo<T>(s: T): T {
  if (typeof s !== "string") return s;
  return s.replace(/ ([:;?!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0") as T;
}

export function SectionTitle({
  id,
  title,
  intro,
  className = "",
  dark = false,
}: {
  id: string;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <h2 id={id} className={`text-[2rem] font-bold leading-[1.08] sm:text-[2.75rem] ${dark ? "text-white" : "text-ink"}`}>
        {frTypo(title)}
      </h2>
      {intro ? <p className={`mt-4 text-lg ${dark ? "text-on-deep" : "text-ink/75"}`}>{frTypo(intro)}</p> : null}
    </div>
  );
}

/* ---------- Sélecteur de parcours ---------- */

const SEGMENTS = [
  {
    href: "/local",
    seg: "local" as const,
    title: "Commerce ou artisan",
    when: "Quand on demande un bon plombier, un restaurant ou un coiffeur près de chez vous",
    query: "Un bon plombier dans le 11e, dispo ce soir ?",
  },
  {
    href: "/pme",
    seg: "pme" as const,
    title: "PME, cabinet, SaaS, services",
    when: "Quand vos prospects cherchent un prestataire ou un logiciel",
    query: "Quel cabinet de recrutement tech à Paris ?",
  },
  {
    href: "/e-commerce",
    seg: "ecommerce" as const,
    title: "E-commerce",
    when: "Quand l'IA conseille un produit à vos futurs clients",
    query: "Meilleure crème solaire bio pour le visage ?",
  },
];

export function SegmentPicker({
  headingLevel = 2,
  dark = false,
  to = "landing",
}: {
  headingLevel?: 2 | 3;
  dark?: boolean;
  /** « landing » : vers /local, /pme, /e-commerce ; « audit » : directement vers le test gratuit. */
  to?: "landing" | "audit";
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  if (to === "audit") {
    return (
      <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
        {SEGMENTS.map((s) => (
          <li key={s.href}>
            <Link
              href={`/audit?segment=${s.seg}`}
              className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-ink transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span>
                <H className="text-lg font-bold">{s.title}</H>
                <span className="text-[0.92rem] text-muted">Lancer mon test gratuit</span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-bg text-primary transition-colors group-hover:bg-accent group-hover:text-ink">
                <ArrowIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
      {SEGMENTS.map((s) => {
        const price = fromPrice(s.seg);
        return (
          <li key={s.href}>
            <Link
              href={s.href}
              className={`group flex h-full flex-col rounded-2xl p-5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 sm:p-6 ${
                dark
                  ? "bg-white/[0.06] ring-1 ring-inset ring-white/15 hover:bg-white/[0.1] hover:ring-white/30"
                  : "bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09),0_10px_30px_-18px_rgba(30,26,92,.35)] hover:shadow-[0_0_0_2px_#3730A3,0_18px_40px_-20px_rgba(30,26,92,.45)]"
              }`}
            >
              <p
                className={`self-start rounded-2xl rounded-bl-md px-3.5 py-2 text-[0.9rem] leading-snug ${
                  dark ? "bg-white/10 text-white" : "bg-primary-bg text-primary-deep"
                }`}
              >
                {`«\u00A0${s.query.replace(/ \?$/, "\u00A0?")}\u00A0»`}
              </p>
              <H className={`mt-5 text-xl font-bold sm:text-[1.4rem] ${dark ? "text-white" : "text-ink"}`}>{s.title}</H>
              <p className={`mt-1.5 text-[0.95rem] ${dark ? "text-on-deep" : "text-muted"}`}>{s.when}</p>
              <span className={`mt-auto flex items-center justify-between gap-3 pt-6 text-[0.95rem] font-semibold ${dark ? "text-white" : "text-primary"}`}>
                <span>Voir le parcours</span>
                <span className="inline-flex items-center gap-2">
                  {price !== undefined ? (
                    <span className={`text-sm font-medium ${dark ? "text-on-deep" : "text-muted"}`}>dès {euros(price)}/mois</span>
                  ) : null}
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      dark ? "bg-white/10 group-hover:bg-accent group-hover:text-ink" : "bg-primary-bg group-hover:bg-primary group-hover:text-white"
                    }`}
                  >
                    <ArrowIcon />
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Chiffres sourcés ---------- */

export function FactItem({ fact, dark = false, size = "md" }: { fact: Fact; dark?: boolean; size?: "md" | "lg" }) {
  return (
    <figure className="flex h-full flex-col">
      <p
        className={`tabular font-display font-bold leading-none tracking-tight ${size === "lg" ? "text-5xl sm:text-6xl" : "text-4xl sm:text-[2.75rem]"} ${
          dark ? "text-white" : "text-primary"
        }`}
      >
        {fact.figure}
      </p>
      <blockquote className={`mt-3 text-[0.98rem] ${dark ? "text-white/90" : "text-ink/85"}`}>
        <p>{fact.text}</p>
      </blockquote>
      <figcaption className={`mt-auto pt-3 text-[0.82rem] ${dark ? "text-on-deep" : "text-muted"}`}>
        Source :{" "}
        <a href={fact.href} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:decoration-2">
          {fact.source}
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </figcaption>
    </figure>
  );
}

export function FactsRow({ facts, dark = false }: { facts: Fact[]; dark?: boolean }) {
  return (
    <ul
      className={`grid gap-x-8 gap-y-10 sm:grid-cols-2 ${facts.length >= 3 ? "lg:grid-cols-3" : ""} ${facts.length === 4 ? "lg:grid-cols-4" : ""}`}
    >
      {facts.map((f) => (
        <li key={f.id} className={`border-t-2 pt-5 ${dark ? "border-white/20" : "border-ink/10"}`}>
          <FactItem fact={f} dark={dark} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Comparaison outils / agences / Repéré ---------- */

type Cmp = { label: string; tools: string; agency: string; us: string; usStrong?: boolean };

const COMPARE: Cmp[] = [
  { label: "Mesure dans les IA", tools: "Oui", agency: "Oui", us: "Oui, sur vos vraies questions clients" },
  { label: "Les sources que lisent les IA", tools: "Souvent, à analyser vous-même", agency: "Dans l'audit", us: "Classées par opportunité, à chaque mesure" },
  { label: "Le travail est fait pour vous", tools: "Non, ou un brouillon à relire et publier", agency: "Oui", us: "Oui, avec Accompagné, validé par vous", usStrong: true },
  { label: "Pour qui", tools: "Équipes marketing", agency: "Entreprises avec budget", us: "TPE, PME, e-commerces" },
  { label: "Langue", tools: "Souvent en anglais", agency: "Français", us: "Français, sources françaises" },
  { label: "Prix constatés", tools: "75 à 450 €/mois", agency: "950 à 2 500 €/mois, audit dès 1 500 €", us: "29 à 490 €/mois", usStrong: true },
];

export function ComparisonTable() {
  return (
    <div>
      {/* Mobile : trois colonnes empilées */}
      <div className="grid gap-3 md:hidden">
        {(
          [
            ["Outils de mesure", "tools"],
            ["Agences GEO", "agency"],
            ["Repéré", "us"],
          ] as const
        ).map(([name, key]) => (
          <section
            key={key}
            aria-label={name}
            className={`rounded-2xl p-5 ${key === "us" ? "bg-primary text-white" : "bg-white ring-1 ring-line"}`}
          >
            <h3 className={`text-lg font-bold ${key === "us" ? "text-white" : ""}`}>{name}</h3>
            <dl className="mt-3 space-y-2.5 text-[0.95rem]">
              {COMPARE.map((r) => (
                <div key={r.label}>
                  <dt className={`text-[0.82rem] ${key === "us" ? "text-on-deep" : "text-muted"}`}>{r.label}</dt>
                  <dd className="font-medium">{r[key]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {/* Bureau : tableau */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)] md:block">
        <table className="w-full border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">Comparaison entre outils de mesure, agences GEO et Repéré</caption>
          <thead>
            <tr>
              <td className="w-[22%] p-5" />
              <th scope="col" className="w-[24%] p-5 align-bottom font-display text-lg font-semibold text-ink/80">Outils de mesure</th>
              <th scope="col" className="w-[24%] p-5 align-bottom font-display text-lg font-semibold text-ink/80">Agences GEO</th>
              <th scope="col" className="w-[30%] bg-primary p-5 align-bottom font-display text-lg font-semibold text-white">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
                  Repéré
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((r, i) => (
              <tr key={r.label} className="border-t border-line/70">
                <th scope="row" className="p-5 font-semibold">{r.label}</th>
                <td className="p-5 text-ink/75">{r.tools}</td>
                <td className="p-5 text-ink/75">{r.agency}</td>
                <td className={`bg-primary p-5 text-white ${r.usStrong ? "font-semibold" : ""} ${i === COMPARE.length - 1 ? "" : "border-b border-white/10"}`}>
                  {r.us}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[0.82rem] text-muted">
        Prix constatés publiquement en novembre 2026, hors taxes. Sources :{" "}
        {MARKET_SOURCES.map((s, i) => (
          <span key={s.href}>
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {s.label}
            </a>
            {i < MARKET_SOURCES.length - 1 ? " ; " : "."}
          </span>
        ))}{" "}
        Certaines sont publiées par des acteurs du secteur.
      </p>
    </div>
  );
}

/* ---------- FAQ ---------- */

export type QA = { q: string; a: string };

export function Faq({ items, idPrefix }: { items: QA[]; idPrefix: string }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => (
        <details key={it.q} className="site-details group" id={`${idPrefix}-${i + 1}`}>
          <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-4 text-left font-display text-lg font-semibold leading-snug transition-colors duration-[var(--dur-base)] hover:text-primary">
            {frTypo(it.q)}
            <span
              aria-hidden="true"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-bg text-primary transition-transform duration-200 group-open:rotate-45"
            >
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="max-w-[68ch] pb-6 pr-12 text-[1.02rem] text-ink/80">{frTypo(it.a)}</p>
        </details>
      ))}
    </div>
  );
}

/** FAQPage avec @id stable (`${url}#faq`). Préférer l'intégrer au @graph de la page quand il y en a un. */
export function FaqJsonLd({ items, path }: { items: QA[]; path: string }) {
  return (
    <script
      type="application/ld+json"
      // Contenu statique écrit par nous (aucune donnée utilisateur) ; « < » échappé par précaution.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd(path, items)).replace(/</g, "\\u003c") }}
    />
  );
}

/* ---------- Les 4 piliers ---------- */

export const PILLARS = [
  { key: "mesurer", verb: "Mesurer" },
  { key: "comprendre", verb: "Comprendre" },
  { key: "agir", verb: "Agir" },
  { key: "prouver", verb: "Prouver" },
] as const;

export function PillarRow({
  index,
  verb,
  title,
  text,
  points,
  visual,
  flip = false,
}: {
  index: number;
  verb: string;
  title: string;
  text: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="flex items-center gap-3 font-display text-[1.05rem] font-semibold text-primary">
          <span className="tabular flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[0.95rem] text-white">{index}</span>
          {verb}
        </p>
        <h3 className="mt-4 text-[1.65rem] font-bold leading-tight sm:text-[2rem]">{title}</h3>
        <p className="mt-3 max-w-[60ch] text-[1.05rem] text-ink/75">{text}</p>
        <ul className="mt-5 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[0.98rem]">
              <CheckIcon className="mt-0.5 text-primary" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={`min-w-0 ${flip ? "lg:order-1" : ""}`}>{visual}</div>
    </div>
  );
}
