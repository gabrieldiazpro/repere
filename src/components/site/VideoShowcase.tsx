"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoVideoFiles } from "@/components/motion/videos";
import { motionAllowed } from "@/components/motion/lib";

/**
 * Vidéo de démo mise en valeur (V4) : affiche nette d'abord (rien n'est téléchargé avant l'intention), aperçu muet
 * au survol à la souris, lecture au clic avec les contrôles, bouton plein écran. Mouvement réduit : pas d'aperçu au
 * survol, la lecture ne part qu'au clic. Clavier : le grand bouton est focalisable, Échap quitte le plein écran.
 */
export function VideoShowcase({
  files,
  label,
  title,
  duration,
  className = "",
}: {
  files: DemoVideoFiles;
  label: string;
  /** titre visible sur l'affiche (« Repéré en 30 secondes ») */
  title?: string;
  /** « 0:33 » */
  duration?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"poster" | "preview" | "playing" | "paused">("poster");
  const hoverOk = useRef(false);

  useEffect(() => {
    // Aperçu au survol = lecture automatique : coupé en mouvement réduit (règle V4, SYSTEME-API § 0).
    hoverOk.current = !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches && motionAllowed("autoplay-video");
  }, []);

  const preview = () => {
    if (!hoverOk.current || state !== "poster") return;
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setState((s) => (s === "poster" ? "preview" : s))).catch(() => {});
  };
  const stopPreview = () => {
    if (state !== "preview") return;
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setState("poster");
  };
  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.controls = true;
    v.play().catch(() => {});
    setState("playing");
  };
  const fullscreen = () => {
    const v = ref.current;
    if (!v) return;
    if (state === "poster" || state === "preview") play();
    const anyV = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
    else anyV.webkitEnterFullscreen?.();
  };

  const idle = state === "poster" || state === "preview";
  return (
    <figure className={`group relative overflow-hidden rounded-[1.25rem] bg-white shadow-[0_0_0_1px_rgba(27,31,46,.1),0_30px_60px_-30px_rgba(30,26,92,.55)] ${className}`}>
      <div className="relative aspect-video" onMouseEnter={preview} onMouseLeave={stopPreview}>
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full bg-canvas object-cover"
          muted
          playsInline
          loop={state === "preview"}
          preload="none"
          poster={files.poster ?? undefined}
          aria-label={label}
          onPause={() => setState((s) => (s === "playing" ? "paused" : s))}
          onPlay={() => setState((s) => (s === "paused" ? "playing" : s))}
        >
          {files.webm ? <source src={files.webm} type="video/webm" /> : null}
          {files.mp4 ? <source src={files.mp4} type="video/mp4" /> : null}
          {files.vtt ? <track kind="captions" srcLang="fr" label="Français" src={files.vtt} default /> : null}
        </video>
        {idle ? (
          <button
            type="button"
            onClick={play}
            className="absolute inset-0 flex items-center justify-center bg-ink/10 transition-colors duration-[var(--dur-base)] hover:bg-ink/0"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-[0_12px_30px_-10px_rgba(30,26,92,.7)] transition-transform duration-[var(--dur-base)] group-hover:scale-110 motion-reduce:transition-none">
              <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" fill="currentColor">
                <path d="M4.5 2.8v10.4L13 8z" />
              </svg>
              <span className="sr-only">Lire la vidéo : {label}</span>
            </span>
          </button>
        ) : null}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Démo</span>
        <button
          type="button"
          onClick={fullscreen}
          className="absolute right-3 top-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink/70 px-3 text-[0.8rem] font-semibold text-white backdrop-blur hover:bg-ink"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
          </svg>
          Plein écran
        </button>
      </div>
      {title ? (
        <figcaption className="flex items-baseline justify-between gap-3 bg-white px-4 py-3 text-ink">
          <span className="font-display font-semibold leading-snug">{title}</span>
          <span className="shrink-0 text-[0.8rem] text-muted">
            {state === "preview" ? "Aperçu muet" : `Compte démo${duration ? `, ${duration}` : ""}`}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}

export default VideoShowcase;
