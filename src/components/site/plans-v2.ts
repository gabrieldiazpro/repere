/**
 * Adaptateur SITE de la grille (src/lib/plans.ts, seule source des prix). V10 : plus de copie de secours (elle aurait
 * pu afficher des prix périmés) ; les offres `legacy` (V1, anciens « Test gratuit ») ne sont jamais affichées.
 */
import * as planLib from "@/lib/plans";

export type SiteSegment = "local" | "pme" | "ecommerce" | "agence";
export type SiteInterval = "one_time" | "month" | "year";

export interface SitePlan {
  id: string;
  segment: SiteSegment;
  name: string;
  priceCents: number;
  interval: SiteInterval;
  features: string[];
  highlighted: boolean;
  cta: string;
  /** false = liste d'attente (Agence tant que la marque blanche n'est pas livrée). */
  available: boolean;
}

type RawPlan = {
  id: string;
  segment?: string;
  name: string;
  priceCents: number;
  interval: string;
  features: readonly string[];
  highlighted?: boolean;
  cta: string;
  available?: boolean;
  legacy?: boolean;
};

function normSegment(s: string | undefined): SiteSegment | null {
  if (s === "local" || s === "pme" || s === "ecommerce") return s;
  if (s === "agence" || s === "agency") return "agence";
  if (s === "e-commerce") return "ecommerce";
  return null;
}

/** Typographie française : espaces insécables avant « : ; ? ! » et à l'intérieur des guillemets. */
export function frTypo(t: string): string {
  return t
    .replace(/«\s+/g, "«\u00A0")
    .replace(/\s+»/g, "\u00A0»")
    .replace(/\s+([:;?!])/g, "\u00A0$1")
    .replace(/(\d)\s+(€|%)/g, "$1\u00A0$2");
}

function normalize(p: RawPlan): SitePlan | null {
  const segment = normSegment(p.segment);
  if (!segment) return null;
  const interval: SiteInterval = p.interval === "month" || p.interval === "year" ? p.interval : "one_time";
  return {
    id: p.id,
    segment,
    name: frTypo(p.name),
    priceCents: p.priceCents,
    interval,
    features: p.features.map(frTypo),
    highlighted: !!p.highlighted,
    cta: p.cta,
    // Décision orchestrateur : Agence en liste d'attente tant que la marque blanche n'est pas livrée.
    available: typeof p.available === "boolean" ? p.available : segment !== "agence",
  };
}

const libPlans = planLib.PLANS as readonly RawPlan[];

/** Source des prix affichés : toujours '@/lib/plans'. */
export const PLANS_SOURCE = "lib" as const;

export const SITE_PLANS: readonly SitePlan[] = libPlans
  .filter((p) => !p.legacy)
  .map(normalize)
  .filter((p): p is SitePlan => p !== null);

export const VAT_NOTICE: string =
  (planLib as { VAT_NOTICE?: string }).VAT_NOTICE ?? "TVA non applicable, art. 293 B du CGI";

export function plansFor(segment: SiteSegment): SitePlan[] {
  return SITE_PLANS.filter((p) => p.segment === segment);
}

export function findSitePlan(id: string | undefined | null): SitePlan | undefined {
  if (!id) return undefined;
  return SITE_PLANS.find((p) => p.id === id);
}

/**
 * Paliers d'un parcours (V10) : Découverte (gratuit, `free`), Essentiel mensuel/annuel, Accompagné ; l'audit approfondi
 * (`deep`) et Réseau sont proposés à part, à la carte.
 */
export function tiersFor(segment: Exclude<SiteSegment, "agence">) {
  const list = plansFor(segment);
  const pick = (re: RegExp) => list.find((p) => re.test(p.id));
  return {
    free: pick(/_decouverte$/),
    deep: pick(/_audit_deep$/),
    essentielMonth: pick(/_essentiel_month$/),
    essentielYear: pick(/_essentiel_year$/),
    accompagne: pick(/_accompagne_month$/),
    reseauMonth: pick(/_reseau_month$/),
    reseauYear: pick(/_reseau_year$/),
  };
}

/** Prix d'appel d'un parcours (Essentiel mensuel). */
export function fromPrice(segment: Exclude<SiteSegment, "agence">): number | undefined {
  return tiersFor(segment).essentielMonth?.priceCents;
}

const eur = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** « 1 490 € » avec espaces insécables. */
export function euros(cents: number): string {
  return `${eur.format(cents / 100)} €`.replace(/ | /g, " ");
}

/** Lien de commande : Découverte → inscription gratuite ; offres payantes → parcours /audit (segment et offre). */
export function planLink(p: SitePlan): string {
  const seg = p.segment === "agence" ? "" : `segment=${p.segment}`;
  if (p.priceCents === 0) return p.segment === "agence" ? "/partenaires#candidature" : `/inscription?parcours=${p.segment}`;
  return `/audit?${seg ? `${seg}&` : ""}plan=${encodeURIComponent(p.id)}`;
}
