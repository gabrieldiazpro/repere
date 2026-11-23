/**
 * /tarifs (V10) : l'offre Agence, à part des 3 paliers (décision 5 de docs/v10/DECISIONS.md). Prix, clients inclus et
 * options lus dans src/lib/plans.ts (grille et PLAN_ADDONS) ; commission partenaire lue dans src/lib/partners. Serveur.
 */
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon } from "./blocks";
import { WaitlistForm } from "./WaitlistForm";
import { DemoEntry } from "./DemoEntry";
import { euros, plansFor } from "./plans-v2";
import { AGENCY_INCLUDED_CLIENTS, getAddon } from "@/lib/plans";
import { FAMILIES, pct } from "@/lib/partners/program";

/** Fonctions de l'offre Agence, construites et visibles dans la démo agence (AGENCES, V6). */
const AGENCY_FUNCTIONS = [
  "Tous vos clients sur une page (scores Google et IA, alertes, validations)",
  "Rapports à votre nom, logo et couleur, envoyés depuis votre domaine",
  "Votre client valide les corrections, vous les appliquez",
  "Exports CSV par client",
  "API publique, serveur MCP et webhooks",
  "Contenus rédigés : 6 par mois et par client, après validation",
];

export function AgencyPricing() {
  const list = plansFor("agence");
  const month = list.find((p) => p.id === "agency_month");
  const year = list.find((p) => p.id === "agency_year");
  const execs = list.filter((p) => p.id.startsWith("agency_exec_"));
  const open = list.some((p) => p.available && p.priceCents > 0);
  const extra = getAddon("agency_extra_client");
  const weekly = getAddon("agency_weekly_client");
  const moreAi = getAddon("agency_more_ai_client");
  const agencyRate = FAMILIES.agence.commission;

  return (
    <div>
      {!open ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-warning-bg px-3 py-1 text-[0.92rem] font-semibold text-warning-ink">
          Ouverture prochaine : inscrivez-vous à la liste d&apos;attente
        </p>
      ) : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {month ? (
          <article id="agency_month" className="on-dark flex scroll-mt-24 flex-col rounded-2xl bg-primary-deep p-6 text-white ring-2 ring-primary sm:p-7">
            <h3 className="text-xl font-bold text-white">{month.name}</h3>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
              <span className="tabular font-display text-[2.6rem] font-bold leading-none tracking-tight">{euros(month.priceCents)}</span>
              <span className="text-[0.95rem] text-on-deep">/mois pour {AGENCY_INCLUDED_CLIENTS} clients</span>
            </p>
            <p className="mt-1.5 text-[0.88rem] text-on-deep">
              {year ? `ou ${euros(year.priceCents)}/an, 2 mois offerts. ` : ""}+{euros(extra.priceCents)}/mois par client au-delà de {AGENCY_INCLUDED_CLIENTS}.
            </p>
            <ul className="mt-5 space-y-2.5 text-[0.95rem]">
              {month.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <CheckIcon className="mt-0.5 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row">
              <Link href="/rendez-vous?offre=agence" className={buttonClasses({ variant: "light", className: "w-full sm:w-auto" })}>
                Réserver une démo
              </Link>
              <a href="#waitlist-agence-email" className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold text-white ring-1 ring-inset ring-white/45 hover:bg-white/10">
                Liste d&apos;attente
              </a>
            </div>
          </article>
        ) : null}
        <div className="flex flex-col gap-5">
          <article className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
            <h3 className="text-lg font-bold">Options par client</h3>
            <ul className="mt-3 divide-y divide-line/70 text-[0.95rem]">
              {[extra, weekly, moreAi].map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span>{a.description}</span>
                  <span className="tabular shrink-0 font-display font-bold">+{euros(a.priceCents)}/mois</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
            <h3 className="text-lg font-bold">Exécution en marque blanche</h3>
            <p className="mt-1 text-[0.88rem] text-muted">Prix revendeur, par client et par mois</p>
            <ul className="mt-3 divide-y divide-line/70 text-[0.95rem]">
              {execs.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span>{p.name.replace(/^Exécution marque blanche — /, "Accompagné ")}</span>
                  <span className="tabular font-display text-lg font-bold">{euros(p.priceCents)}</span>
                </li>
              ))}
            </ul>
          </article>
          {agencyRate ? (
            <article className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
              <h3 className="text-lg font-bold">Sans abonnement : partenaire</h3>
              <p className="mt-1 text-[0.95rem] text-ink/75">
                {pct(agencyRate.rate)} des paiements hors taxes de chaque client apporté, pendant {agencyRate.months} mois, versés chaque trimestre sur facture.
              </p>
              <Link href="/partenaires#candidature" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:no-underline">
                Devenir partenaire
              </Link>
            </article>
          ) : null}
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-8">
        <h3 className="text-xl font-bold">Rejoindre la liste d&apos;attente agences</h3>
        <p className="mt-1.5 max-w-2xl text-[0.97rem] text-ink/75">
          Marque blanche, tableau de bord multi-clients, accès client et exports CSV sont prêts : voyez-les dans la démo agence (entreprises fictives).
          L&apos;offre ouvre prochainement : laissez votre e-mail, nous vous écrivons une seule fois, à l&apos;ouverture.
        </p>
        <ul className="mt-4 grid max-w-2xl gap-2 text-[0.95rem] sm:grid-cols-2">
          {AGENCY_FUNCTIONS.map((f) => (
            <li key={f} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <DemoEntry account="demo-agence" className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline underline-offset-4 hover:no-underline">
            Voir la démo agence
          </DemoEntry>
        </div>
        <div className="mt-5 max-w-2xl">
          <WaitlistForm fixedInterest="agency" idPrefix="waitlist-agence" />
        </div>
      </div>
    </div>
  );
}

export default AgencyPricing;
