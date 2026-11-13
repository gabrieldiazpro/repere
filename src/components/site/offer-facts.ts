/**
 * Promesses du site lues dans la table des droits (src/lib/entitlements.ts), qui fait foi : fréquence de mesure,
 * nombre de questions et IA interrogées, par parcours et par offre. À utiliser côté serveur uniquement (le module
 * des droits tire les données démo). Les composants client reçoivent ces textes en props, ou sont vérifiés par test.
 */
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import type { ProviderId } from "@/lib/engine/types";

export type OfferSegment = "local" | "pme" | "ecommerce";
export type OfferTier = "decouverte" | "essentiel" | "accompagne";

const PLAN_OF: Record<OfferTier, string> = { decouverte: "free", essentiel: "essentiel", accompagne: "accompagne" };

export function offerEntitlements(segment: OfferSegment, tier: OfferTier): Entitlements {
  return getEntitlements({ id: `site-${segment}-${tier}`, plan: PLAN_OF[tier], segment, planId: null } as Parameters<typeof getEntitlements>[0]);
}

export const ENGINE_NAMES: Record<ProviderId, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
  mistral: "Mistral Le Chat",
};

/** Ordre d'affichage du site (ChatGPT, Gemini, Perplexity, Claude, Mistral). */
const ORDER: ProviderId[] = ["chatgpt", "gemini", "perplexity", "claude", "mistral"];

/** « ChatGPT, Gemini, Perplexity, Claude, plus Mistral Le Chat en option » (Mistral n'est interrogé qu'avec sa clé). */
export function enginesLabel(segment: OfferSegment, tier: OfferTier): string {
  const e = offerEntitlements(segment, tier).engines;
  const core = ORDER.filter((p) => p !== "mistral" && e.includes(p)).map((p) => ENGINE_NAMES[p]);
  return e.includes("mistral") ? `${core.join(", ")}, plus Mistral Le Chat en option` : core.join(", ");
}

export function enginesCount(segment: OfferSegment, tier: OfferTier): number {
  return offerEntitlements(segment, tier).engines.filter((p) => p !== "mistral").length;
}

const FREQ: Record<Entitlements["frequency"], { adverb: string; label: string }> = {
  monthly: { adverb: "chaque mois", label: "Chaque mois" },
  weekly: { adverb: "chaque semaine", label: "Chaque semaine" },
  daily: { adverb: "chaque jour", label: "Chaque jour" },
};

/** « chaque mois » / « chaque semaine ». */
export function frequencyAdverb(segment: OfferSegment, tier: OfferTier): string {
  return FREQ[offerEntitlements(segment, tier).frequency].adverb;
}

export function frequencyLabel(segment: OfferSegment, tier: OfferTier): string {
  return FREQ[offerEntitlements(segment, tier).frequency].label;
}

export function promptsCount(segment: OfferSegment, tier: OfferTier): number {
  return offerEntitlements(segment, tier).prompts;
}

/**
 * Phrase de fréquence pour tout le site, dérivée des droits, par exemple :
 * « chaque mois en Essentiel commerce local, chaque semaine en Accompagné et pour les PME et l'e-commerce ».
 */
export function frequencySummary(): string {
  const parts: string[] = [];
  const localEss = frequencyAdverb("local", "essentiel");
  const localAcc = frequencyAdverb("local", "accompagne");
  const pme = frequencyAdverb("pme", "essentiel");
  const ecom = frequencyAdverb("ecommerce", "essentiel");
  parts.push(`${localEss} en Essentiel commerce local`);
  if (localAcc === pme && pme === ecom) parts.push(`${pme} en Accompagné local et dans les offres PME et e-commerce`);
  else parts.push(`${localAcc} en Accompagné local`, `${pme} pour les PME`, `${ecom} pour l'e-commerce`);
  return parts.join(", ");
}

/** Liste « ChatGPT, Gemini, Perplexity » commune à toutes les offres (le socle). */
export function baseEnginesLabel(): string {
  return enginesLabel("local", "decouverte");
}

const SEG_NAMES: Record<OfferSegment, string> = { local: "commerce local", pme: "PME", ecommerce: "e-commerce" };
const TIER_NAMES: Record<OfferTier, string> = { decouverte: "Découverte", essentiel: "Essentiel", accompagne: "Accompagné" };

/**
 * Offres qui interrogent une IA, en clair : « toutes les offres », « Essentiel PME et e-commerce, Accompagné »,
 * « Accompagné PME et e-commerce ».
 */
export function offersIncluding(engine: ProviderId): string {
  const segs: OfferSegment[] = ["local", "pme", "ecommerce"];
  const tiers: OfferTier[] = ["decouverte", "essentiel", "accompagne"];
  const has = (s: OfferSegment, t: OfferTier) => offerEntitlements(s, t).engines.includes(engine);
  if (tiers.every((t) => segs.every((s) => has(s, t)))) return "toutes les offres";
  const parts: string[] = [];
  for (const t of tiers) {
    const inSegs = segs.filter((s) => has(s, t));
    if (inSegs.length === 0) continue;
    parts.push(inSegs.length === segs.length ? TIER_NAMES[t] : `${TIER_NAMES[t]} ${inSegs.map((s) => SEG_NAMES[s]).join(" et ")}`);
  }
  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/* V5 : SEO et agent, lus dans les droits (analysis, seoData, publish)  */
/* ------------------------------------------------------------------ */

const fmtInt = (n: number) => n.toLocaleString("fr-FR").replace(/ | /g, " ");
const REANALYSIS: Record<Entitlements["analysis"]["reanalysis"], string> = {
  none: "à la demande",
  monthly: "réanalysé chaque mois",
  weekly: "réanalysé chaque semaine",
};

export interface V5OfferFacts {
  pages: number;
  reanalysis: string;
  keywords: number;
  devices: string;
  backlinks: boolean;
  apply: boolean;
  changeSets: number;
  /** Lignes prêtes à afficher (tarifs, parcours). */
  seoLines: string[];
  agentLine: string;
}

/** Ce que chaque offre inclut en SEO et en agent (src/lib/entitlements.ts fait foi). */
export function v5OfferFacts(segment: OfferSegment, tier: OfferTier): V5OfferFacts {
  const e = offerEntitlements(segment, tier);
  const devices = e.seoData.devices.map((d) => (d === "mobile" ? "mobile" : "ordinateur")).join(" et ");
  const seoLines = [
    `Site exploré jusqu'à ${fmtInt(e.analysis.maxPages)} pages, ${REANALYSIS[e.analysis.reanalysis]}`,
    "Audit SEO complet et audit GEO, avec les 5 priorités",
    "Search Console et PageSpeed connectés",
  ];
  if (e.seoData.keywords > 0) seoLines.push(`${fmtInt(e.seoData.keywords)} mots-clés suivis chaque semaine sur Google (${devices})`);
  if (e.seoData.backlinks) seoLines.push("Liens entrants : domaines référents gagnés et perdus");
  const agentLine = e.publish.apply
    ? `Agent : jusqu'à ${fmtInt(e.publish.changeSetsPerMonth)} séries de corrections appliquées par mois, après validation`
    : "Agent : corrections à télécharger et à appliquer vous-même";
  return {
    pages: e.analysis.maxPages,
    reanalysis: REANALYSIS[e.analysis.reanalysis],
    keywords: e.seoData.keywords,
    devices,
    backlinks: e.seoData.backlinks,
    apply: e.publish.apply,
    changeSets: e.publish.changeSetsPerMonth,
    seoLines,
    agentLine,
  };
}
