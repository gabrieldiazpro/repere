// '@/lib/plans' (BACKEND) existe désormais : ce module n'est plus qu'un ré-export + helpers d'affichage.
export { PLANS, getPlan } from "@/lib/plans";
export type { Plan, PlanId, PlanInterval } from "@/lib/plans";
import type { PlanInterval } from "@/lib/plans";

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** « 149 € », « 0 € » (espaces insécables). */
export function formatEuros(cents: number) {
  return eur.format(cents / 100).replace(/ /g, " ");
}

/** « par mois », « par an », « une seule fois » */
export function intervalLabel(i: PlanInterval) {
  return i === "month" ? "par mois" : i === "year" ? "par an" : "une seule fois";
}
