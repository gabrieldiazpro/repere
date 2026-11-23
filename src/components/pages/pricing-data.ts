/**
 * Comparatif des fonctionnalités Découverte / Essentiel / Accompagné par parcours (/tarifs, V10). Tout ce qui est
 * chiffré est lu dans la table des droits (src/lib/entitlements.ts, qui fait foi) ou dans la grille (src/lib/plans.ts) ;
 * rien n'est recopié à la main. Serveur uniquement : le composant client /tarifs reçoit les lignes en props.
 */
import {
  enginesLabel,
  frequencyLabel,
  offerEntitlements,
  optionalEnginesLabel,
  promptsCount,
  runsCount,
  v5OfferFacts,
  type OfferTier,
} from "@/components/site/offer-facts";
import { getAddon } from "@/lib/plans";
import { formatPrice } from "@/lib/plans";

export type Seg = "local" | "pme" | "ecommerce";
export type Cell = string | boolean;
export interface CompareRow {
  label: string;
  /** groupe d'affichage (« Mesure des IA », « SEO », …) */
  group: string;
  decouverte: Cell;
  essentiel: Cell;
  accompagne: Cell;
}

const q = (seg: Seg, t: OfferTier) => String(promptsCount(seg, t));
const freq = (seg: Seg, t: OfferTier) => frequencyLabel(seg, t);
const runs = (seg: Seg, t: OfferTier) => `${runsCount(seg, t)} passages`;
const RIVALS: Record<Seg, string> = { local: "3", pme: "5", ecommerce: "5" };
const nf = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ");
const api = (seg: Seg, t: OfferTier) => offerEntitlements(seg, t).api;
const contents = (seg: Seg, t: OfferTier) => {
  const n = offerEntitlements(seg, t).contentsPerMonth;
  return n > 0 ? `${n} par mois` : "Propositions visibles";
};
const seo = (seg: Seg, t: OfferTier) => v5OfferFacts(seg, t);

const DONE: Record<Seg, string> = {
  local: "Fiches Google, Bing et Apple tenues à jour, réponses aux avis, campagne d'avis, 2 annuaires par mois",
  pme: "Mise en place technique, 2 pages citables par mois, 3 fiches comparateurs, 3 démarches vers les sources",
  ecommerce: "Balisage Product et flux Merchant, 20 fiches produit par mois, 1 guide d'achat, 3 démarches",
};

export const COMPARE_GROUPS = ["Mesure des IA", "SEO et site", "Agent et contenus", "Accompagnement et conditions"] as const;

export function compareRows(seg: Seg): CompareRow[] {
  const optionPrice = formatPrice(getAddon("option_more_ai").priceCents);
  const T: OfferTier[] = ["decouverte", "essentiel", "accompagne"];
  const row = (group: string, label: string, f: (t: OfferTier) => Cell): CompareRow => ({ group, label, decouverte: f(T[0]), essentiel: f(T[1]), accompagne: f(T[2]) });
  return [
    row("Mesure des IA", "Analyse du site en 60 s et test de marque, sans inscription", () => true),
    row("Mesure des IA", "Questions suivies", (t) => q(seg, t)),
    row("Mesure des IA", "Fréquence des mesures", (t) => freq(seg, t)),
    row("Mesure des IA", "Passages par question et par IA", (t) => runs(seg, t)),
    row("Mesure des IA", "IA interrogées", (t) => enginesLabel(seg, t)),
    row("Mesure des IA", "IA en option", (t) => (offerEntitlements(seg, t).optionalEngines.length ? `${optionalEnginesLabel()} (+${optionPrice}/mois)` : false)),
    row("Mesure des IA", "Concurrents suivis", (t) => (t === "decouverte" ? false : RIVALS[seg])),
    row("Mesure des IA", "Sources citées et opportunités", (t) => (t === "decouverte" ? "Sur vos 5 questions" : true)),
    row("SEO et site", "Analyse du site", (t) => `${nf(seo(seg, t).pages)} pages, ${seo(seg, t).reanalysis}`),
    row("SEO et site", "Audit SEO et GEO, Search Console, PageSpeed", () => true),
    row("SEO et site", "Positions Google suivies", (t) => (seo(seg, t).keywords > 0 ? `${nf(seo(seg, t).keywords)} mots-clés` : false)),
    row("SEO et site", "Liens entrants", (t) => seo(seg, t).backlinks),
    row("Agent et contenus", "Tâches de la semaine, textes prêts", (t) => t !== "decouverte"),
    row("Agent et contenus", "Corrections appliquées sur votre site, après validation", (t) => (seo(seg, t).apply ? `${nf(seo(seg, t).changeSets)} séries par mois` : "À télécharger")),
    row("Agent et contenus", "Contenus rédigés, publiés après validation", (t) => contents(seg, t)),
    row("Agent et contenus", "API publique, serveur MCP et webhooks", (t) => api(seg, t)),
    row("Accompagnement et conditions", "Qui fait le travail", (t) => ({ decouverte: "Vous", essentiel: "Vous, avec les textes prêts", accompagne: "Nous, après votre accord" })[t]),
    row("Accompagnement et conditions", "Travail fait pour vous", (t) => (t === "accompagne" ? DONE[seg] : false)),
    row("Accompagnement et conditions", "Rapport mensuel", (t) => (t === "decouverte" ? false : t === "accompagne" ? "Avec point visio" : true)),
    row("Accompagnement et conditions", "Engagement", (t) => ({ decouverte: "Aucun, gratuit", essentiel: "Aucun", accompagne: "3 mois, puis sans engagement" })[t]),
  ];
}

export const SEG_NAMES: Record<Seg, string> = { local: "Commerce local", pme: "PME et services", ecommerce: "E-commerce" };

/** Les lignes des 3 parcours, pour le composant client de /tarifs. */
export function allCompareRows(): Record<Seg, CompareRow[]> {
  return { local: compareRows("local"), pme: compareRows("pme"), ecommerce: compareRows("ecommerce") };
}
