"use client";

import { useEffect, useRef, useState } from "react";
import { observe, reducedMotion } from "./lib";
import { PlayPauseIcon } from "./Marquee";
import type { DemoVideoFiles } from "./videos";

/**
 * Lecteur des clips de démo : autoplay muet en boucle quand visible à 50 %, pause hors écran,
 * bouton Pause/Lecture (44 px, aria-pressed). Mouvement réduit : pas de lecture automatique.
 */
export function VideoPlayer({ files, label, caption }: { files: DemoVideoFiles; label: string; caption?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduced = reducedMotion();
    if (reduced) userPaused.current = true;
    const off = observe(
      v,
      (e) => {
        if (e.intersectionRatio >= 0.5 && !userPaused.current) v.play().catch(() => {});
        else if (!e.isIntersecting || e.intersectionRatio < 0.05) v.pause();
      },
      { threshold: [0, 0.05, 0.5] },
    );
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      off();
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  return (
    <figure className="app-frame relative overflow-hidden">
      <video
        ref={ref}
        className="block aspect-video h-auto w-full bg-canvas object-contain"
        muted
        loop
        playsInline
        preload="none"
        poster={files.poster ?? undefined}
        aria-label={label}
      >
        {files.webm ? <source src={files.webm} type="video/webm" /> : null}
        {files.mp4 ? <source src={files.mp4} type="video/mp4" /> : null}
        {files.vtt ? <track kind="captions" srcLang="fr" label="Français" src={files.vtt} /> : null}
      </video>
      <span className="absolute right-3 top-3 rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Démo</span>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!playing}
        className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-ink/75 text-white backdrop-blur hover:bg-ink"
      >
        <span className="sr-only">{playing ? "Mettre la vidéo en pause" : "Lire la vidéo"}</span>
        <PlayPauseIcon playing={playing} />
      </button>
      <button
        type="button"
        onClick={() => ref.current?.requestFullscreen?.().catch(() => {})}
        className="absolute bottom-3 right-16 flex h-11 items-center justify-center rounded-full bg-ink/75 px-4 text-[0.82rem] font-semibold text-white backdrop-blur hover:bg-ink"
      >
        Plein écran
      </button>
      {caption ? <figcaption className="border-t border-line/80 px-4 py-2.5 text-[0.82rem] text-muted">{caption}</figcaption> : null}
    </figure>
  );
}

export default VideoPlayer;
