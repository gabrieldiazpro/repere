/**
 * Types et instants de la scène du hero. Les données viennent des comptes démo (entreprises fictives), calculées
 * côté serveur par src/components/site/demo-figures.ts (`demoHeroScene`) : plus aucun chiffre écrit à la main ici.
 */
import type { HeroAnswerData } from "@/components/site/hero-answers";
import { typingDuration } from "../lib";

export type HeroSegment = "local" | "pme" | "ecommerce";

export type EngineAnswer = { ia: string; names: string[]; /** rang de l'entreprise, null si absente */ rank: number | null };

export type HeroSceneData = {
  segment: HeroSegment;
  business: string;
  main: HeroAnswerData;
  /** Les IA du compte démo, dans l'ordre d'affichage ; celle de `main.ia` est la réponse au premier plan. */
  engines: EngineAnswer[];
  answers: string;
  confidence: string;
  score: number;
};

export const QUESTION_MS = 28;
export const STREAM_MS = 18;
export const STREAM_CHUNK = 2;

export function mainAnswerText(d: HeroSceneData): string {
  return [d.main.intro, ...d.main.items.map((it) => `${it.name} : ${it.note}`)].join("\n");
}

/**
 * Instants de la scène du hero (ms) — docs/v3/07 §5.2, ajustés à la longueur de la question.
 * 1 question tapée · 2 onglets des IA · 3 réflexion · 4 réponses en streaming · 5 nom repéré + « Absent »
 * · 6 synthèse · 7 jauge · 8 « Et vous ? »
 */
export function heroCues(d: HeroSceneData): { cues: number[]; total: number } {
  const q = typingDuration(d.main.question.length, QUESTION_MS);
  const tabs = 400 + q + 200;
  const stream = typingDuration(mainAnswerText(d).length, STREAM_MS, STREAM_CHUNK);
  const answers = tabs + 1100;
  const found = answers + stream + 250;
  const cues = [400, tabs, tabs + 400, answers, found, found + 1100, found + 1800, found + 3000];
  return { cues, total: found + 3700 };
}

export const citedCount = (d: HeroSceneData) => d.engines.filter((e) => e.rank !== null).length;
