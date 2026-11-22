/**
 * V8 — Les IA réellement mesurables par Repéré, pour le site (accueil, /methode, /comparatif, /tarifs, /agences).
 * Serveur uniquement (lit la table des droits). Sources uniques : PROVIDER_LABELS (src/lib/engine/types.ts),
 * providerMethod() (src/lib/engine/providers/methods.ts) et getEntitlements() via offersIncluding().
 *
 * Règle (MOTEURS-IA, décision 3 du contrat V3, test plans-engines) : une IA qu'aucune offre n'annonce est dite
 * « en option » et n'est jamais comptée dans le « N IA » d'une offre. Noms en texte, jamais de logos.
 */
import { PROVIDER_LABELS, type ProviderId } from "@/lib/engine/types";
import { providerMethod, serpDevice } from "@/lib/engine/providers/methods";
import { offersIncluding } from "./offer-facts";

/** Ordre d'affichage du site : les IA les plus utilisées en France d'abord, Grok en dernier (sur demande). */
export const SITE_AI_ORDER: readonly ProviderId[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "google_aio",
  "google_ai_mode",
  "deepseek",
  "copilot",
  "mistral",
  "grok",
];

export type AiCoverageStatus = "offres" | "option" | "demande";

export interface AiCoverage {
  id: ProviderId;
  name: string;
  /** « API officielle, avec recherche web » / « Relevé sur la page de résultats Google en France (mobile) » */
  mode: string;
  via: "api" | "serp";
  /** limite honnête (providerMethod().caveat) */
  caveat: string;
  status: AiCoverageStatus;
  /** « Toutes les offres », « Essentiel PME et e-commerce, Accompagné », « En option », « Sur demande » */
  offers: string;
}

const DEVICE = { mobile: "mobile", desktop: "ordinateur" } as const;

function modeOf(id: ProviderId): string {
  const m = providerMethod(id);
  if (id === "google_aio") return `Relevé sur la page de résultats Google en France (${DEVICE[serpDevice()]})`;
  if (id === "google_ai_mode") return "Relevé sur la page de résultats Google en France";
  if (id === "copilot") return "Réponse Copilot dans la recherche Bing en France (pas l'application)";
  return m.webSearch ? "API officielle, avec recherche web" : "API officielle, sans recherche web (donc sans sources)";
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function aiCoverage(): AiCoverage[] {
  return SITE_AI_ORDER.map((id) => {
    const m = providerMethod(id);
    const inOffers = offersIncluding(id);
    let status: AiCoverageStatus;
    let offers: string;
    if (id === "grok") {
      status = "demande";
      offers = "Sur demande";
    } else if (!inOffers) {
      status = "option";
      offers = "En option";
    } else if (id === "mistral") {
      // Interrogé seulement si la plateforme a sa clé : « en option » même dans les offres qui l'annoncent.
      status = "option";
      offers = `En option (${inOffers})`;
    } else {
      status = "offres";
      offers = cap(inOffers);
    }
    return { id, name: PROVIDER_LABELS[id], mode: modeOf(id), via: m.via, caveat: m.caveat, status, offers };
  });
}

/** Chiffres pour les phrases du site : « 10 IA mesurables, dont 4 dans les offres ». */
export function aiCoverageCounts(): { total: number; inOffers: number; optional: number } {
  const all = aiCoverage();
  const inOffers = all.filter((a) => a.status === "offres").length;
  return { total: all.length, inOffers, optional: all.length - inOffers };
}

/** « ChatGPT, Gemini, Perplexity, Claude, Google AI Overviews, … et Grok » (toutes les IA mesurables). */
export function aiCoverageNames(): string {
  const n = aiCoverage().map((a) => a.name);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}` : n.join("");
}
