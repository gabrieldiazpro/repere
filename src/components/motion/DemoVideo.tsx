/**
 * Vidéo de démo (contrat V3 §8). Composant serveur : vérifie avec fs que /videos/<id>.mp4 ou .webm existe ;
 * sinon affiche `fallback` (la scène animée). Lecture muette en boucle seulement quand la vidéo est visible,
 * pause hors écran, bouton lecture/pause accessible, preload="none", poster obligatoire si présent.
 */
import type { ReactNode } from "react";
import { DEMO_VIDEO_LABELS, findDemoVideo, type DemoVideoId } from "./videos";
import { VideoPlayer } from "./VideoPlayer";

export type DemoVideoProps = { id: DemoVideoId; fallback: ReactNode; caption?: string };

export function DemoVideo({ id, fallback, caption }: DemoVideoProps) {
  const files = findDemoVideo(id);
  if (!files) return <>{fallback}</>;
  return <VideoPlayer files={files} label={DEMO_VIDEO_LABELS[id]} caption={caption} />;
}

export default DemoVideo;
