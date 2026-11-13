/**
 * Vidéo de démo du site (V4), composant serveur : cherche /videos/<id>.* avec findDemoVideo ; sinon `fallback`
 * (la scène animée). La transcription courte reste dans le HTML pour les robots et les lecteurs d'écran.
 */
import type { ReactNode } from "react";
import { DEMO_VIDEO_LABELS, findDemoVideo, type DemoVideoId } from "@/components/motion/videos";
import { VideoShowcase } from "./VideoShowcase";

export function DemoClip({ id, fallback, title, duration = "0:30", className }: { id: DemoVideoId; fallback: ReactNode; title?: string; duration?: string; className?: string }) {
  const files = findDemoVideo(id);
  if (!files) return <>{fallback}</>;
  return <VideoShowcase files={files} label={DEMO_VIDEO_LABELS[id]} title={title} duration={duration} className={className} />;
}

export default DemoClip;
