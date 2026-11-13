/**
 * Calculateur de rentabilité (/tarifs). Pur et testé. On ne promet aucun gain : on compare le coût de l'offre à la
 * valeur de clients que VOUS supposez gagner, et on calcule le seuil de rentabilité.
 */

export interface RoiInput {
  /** Valeur d'un client (panier moyen, marge ou valeur sur la durée), en euros. */
  clientValue: number;
  /** Clients supplémentaires par mois que vous supposez venir des IA (hypothèse). */
  clientsPerMonth: number;
  /** Prix mensuel de l'offre, en centimes. */
  monthlyPriceCents: number;
}

export interface RoiResult {
  /** Coût sur 12 mois, en euros. */
  yearlyCost: number;
  /** Valeur de l'hypothèse sur 12 mois, en euros. */
  yearlyValue: number;
  /** Valeur − coût sur 12 mois, en euros (peut être négatif). */
  balance: number;
  /** Clients par an nécessaires pour couvrir le coût (null si la valeur d'un client est nulle). */
  breakEvenClientsPerYear: number | null;
  /** Rapport valeur / coût (null si coût nul). */
  ratio: number | null;
}

export const ROI_LIMITS = {
  clientValue: { min: 0, max: 100_000 },
  clientsPerMonth: { min: 0, max: 500 },
} as const;

/** Nombre fini, borné ; tout le reste vaut `fallback`. */
export function sanitize(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function computeRoi(input: RoiInput): RoiResult {
  const value = sanitize(input.clientValue, ROI_LIMITS.clientValue.min, ROI_LIMITS.clientValue.max);
  const clients = sanitize(input.clientsPerMonth, ROI_LIMITS.clientsPerMonth.min, ROI_LIMITS.clientsPerMonth.max);
  const yearlyCost = Math.max(0, input.monthlyPriceCents) * 12 / 100;
  const yearlyValue = Math.round(value * clients * 12 * 100) / 100;
  return {
    yearlyCost,
    yearlyValue,
    balance: Math.round((yearlyValue - yearlyCost) * 100) / 100,
    breakEvenClientsPerYear: value > 0 ? Math.ceil(yearlyCost / value) : null,
    ratio: yearlyCost > 0 ? Math.round((yearlyValue / yearlyCost) * 10) / 10 : null,
  };
}

/** Valeurs de départ par parcours : de simples exemples à modifier, affichés comme tels. */
export const ROI_DEFAULTS: Record<"local" | "pme" | "ecommerce", { clientValue: number; clientsPerMonth: number; hint: string }> = {
  local: { clientValue: 180, clientsPerMonth: 1, hint: "par exemple le montant moyen d'une intervention" },
  pme: { clientValue: 3000, clientsPerMonth: 1, hint: "par exemple la marge sur la première année d'un client" },
  ecommerce: { clientValue: 45, clientsPerMonth: 10, hint: "par exemple la marge sur une commande" },
};

const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 1 188 € » avec espaces insécables. */
export function eur(v: number): string {
  return `${fmt.format(Math.round(v))} €`.replace(/[  ]/g, " ");
}
