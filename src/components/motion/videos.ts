/** Vidéos de démo (contrat 12-CONTRATS-V3 §8) : /videos/<id>.mp4 | .webm, poster /videos/<id>.jpg. */
import { existsSync } from "node:fs";
import path from "node:path";

export const DEMO_VIDEO_IDS = ["hero", "explication", "mesurer", "comprendre", "agir", "prouver"] as const;
export type DemoVideoId = (typeof DEMO_VIDEO_IDS)[number];

export type DemoVideoFiles = { mp4: string | null; webm: string | null; poster: string | null; vtt: string | null };

export const DEMO_VIDEO_LABELS: Record<DemoVideoId, string> = {
  hero: "Démo : Repéré en 30 secondes, sur un compte démo",
  explication: "Démo : Repéré de A à Z en 2 minutes, l’analyse d’un site fictif puis l’application sur des comptes démo",
  mesurer: "Démo : ce que répondent les IA, question par question (compte démo, 30 s)",
  comprendre: "Démo : les sources des IA et pourquoi un concurrent passe devant (compte démo, 30 s)",
  agir: "Démo : les actions de la semaine, la fiche Google et les pages à corriger (compte démo, 30 s)",
  prouver: "Démo : les visites venues des IA et le rapport du mois (compte démo, 30 s)",
};

/**
 * Cherche les fichiers d'une vidéo dans public/videos (côté serveur, au rendu ou au build).
 * `exists` est injectable pour les tests. Sans .mp4 ni .webm : null (le composant affiche le repli).
 */
export function findDemoVideo(
  id: DemoVideoId,
  exists: (p: string) => boolean = existsSync,
  publicDir: string = path.join(process.cwd(), "public"),
): DemoVideoFiles | null {
  if (!DEMO_VIDEO_IDS.includes(id)) return null;
  const has = (ext: string) => {
    try {
      return exists(path.join(publicDir, "videos", `${id}.${ext}`)) ? `/videos/${id}.${ext}` : null;
    } catch {
      return null;
    }
  };
  const mp4 = has("mp4");
  const webm = has("webm");
  if (!mp4 && !webm) return null;
  return { mp4, webm, poster: has("jpg"), vtt: has("fr.vtt") };
}
