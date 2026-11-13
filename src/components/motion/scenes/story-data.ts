/**
 * Types et instants de la scène « Absent, puis cité » (hero V4). Données : `demoHeroStory` de
 * src/components/site/demo-figures.ts (comptes démo, entreprises fictives), jamais de chiffres écrits à la main.
 */
import { typingDuration } from "../lib";

export type StoryAnswer = {
  when: string;
  intro: string;
  items: { name: string; note: string; you?: boolean }[];
  rank: number | null;
  score: number;
};

export type StoryData = {
  segment: string;
  business: string;
  ia: string;
  question: string;
  before: StoryAnswer;
  after: StoryAnswer;
  measures: number;
  engines: { ia: string; rank: number | null }[];
  answers: string;
};

export const STORY_Q_MS = 26;
export const STORY_STREAM_MS = 16;
export const STORY_STREAM_CHUNK = 3;

export function storyText(a: StoryAnswer): string {
  return [a.intro, ...a.items.map((it) => `${it.name} : ${it.note}`)].join("\n");
}

/**
 * Instants (ms) : 1 question tapée · 2 réponse de la 1re mesure · 3 « Absent » + score de départ
 * · 4 bascule vers la dernière mesure · 5 nom repéré + « Cité » · 6 score qui monte · 7 les autres IA.
 */
export function storyCues(d: StoryData): { cues: number[]; total: number } {
  const q = typingDuration(d.question.length, STORY_Q_MS);
  const s1 = typingDuration(storyText(d.before).length, STORY_STREAM_MS, STORY_STREAM_CHUNK);
  const s2 = typingDuration(storyText(d.after).length, STORY_STREAM_MS, STORY_STREAM_CHUNK);
  const c2 = 300 + q + 350;
  const c3 = c2 + s1 + 250;
  const c4 = c3 + 1500;
  const c5 = c4 + s2 + 250;
  const c6 = c5 + 700;
  const c7 = c6 + 1200;
  return { cues: [300, c2, c3, c4, c5, c6, c7], total: c7 + 600 };
}
