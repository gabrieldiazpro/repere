/**
 * Comparaison Découverte / Essentiel / Accompagné par parcours, tirée de la grille (docs/v2/07-plans-v2.json et
 * décision 2 du contrat V3 pour Découverte). Les prix viennent de la grille au rendu, jamais d'ici.
 */
import { enginesLabel, frequencyLabel, promptsCount, type OfferTier } from "@/components/site/offer-facts";

export type Seg = "local" | "pme" | "ecommerce";
export type Cell = string | boolean;
export interface CompareRow {
  label: string;
  decouverte: Cell;
  essentiel: Cell;
  accompagne: Cell;
}

/** Questions, fréquence et IA par offre : lues dans getEntitlements (src/lib/entitlements.ts), qui fait foi. */
const q = (seg: Seg, t: OfferTier) => String(promptsCount(seg, t));
const freq = (seg: Seg, t: OfferTier) => (t === "decouverte" ? "1 par mois" : frequencyLabel(seg, t));
const RIVALS: Record<Seg, string> = { local: "3", pme: "5", ecommerce: "5" };

const DONE: Record<Seg, string> = {
  local: "Fiches Google, Bing et Apple tenues à jour, réponses aux avis, campagne d'avis, 2 annuaires par mois",
  pme: "Mise en place technique, 2 pages citables par mois, 3 fiches comparateurs, 3 démarches vers les sources",
  ecommerce: "Balisage Product et flux Merchant, 20 fiches produit par mois, 1 guide d'achat, 3 démarches",
};

export function compareRows(seg: Seg): CompareRow[] {
  return [
    { label: "Qui fait le travail", decouverte: "Vous", essentiel: "Vous, avec les textes prêts", accompagne: "Nous, après votre accord" },
    { label: "Questions suivies", decouverte: q(seg, "decouverte"), essentiel: q(seg, "essentiel"), accompagne: q(seg, "accompagne") },
    { label: "Fréquence des mesures", decouverte: freq(seg, "decouverte"), essentiel: freq(seg, "essentiel"), accompagne: freq(seg, "accompagne") },
    { label: "IA interrogées", decouverte: enginesLabel(seg, "decouverte"), essentiel: enginesLabel(seg, "essentiel"), accompagne: enginesLabel(seg, "accompagne") },
    { label: "Concurrents suivis", decouverte: false, essentiel: RIVALS[seg], accompagne: RIVALS[seg] },
    { label: "Sources citées et opportunités", decouverte: "Sur vos 5 questions", essentiel: true, accompagne: true },
    { label: "Tâches de la semaine, textes prêts", decouverte: false, essentiel: true, accompagne: true },
    { label: "Travail fait pour vous", decouverte: false, essentiel: false, accompagne: DONE[seg] },
    { label: "Rapport mensuel", decouverte: false, essentiel: true, accompagne: "Avec point visio" },
    { label: "Engagement", decouverte: "Aucun, gratuit", essentiel: "Aucun", accompagne: "3 mois, puis sans engagement" },
  ];
}

export const SEG_NAMES: Record<Seg, string> = { local: "Commerce local", pme: "PME et services", ecommerce: "E-commerce" };
