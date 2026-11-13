"use client";

import { useState, type ReactNode } from "react";

/**
 * Défilement horizontal (primitive 6) : deux copies, la seconde inerte et masquée aux lecteurs d'écran.
 * Pause au survol, au focus et par bouton (WCAG 2.2.2). Mouvement réduit : liste statique centrée.
 */
export function Marquee({
  children,
  duration = 40,
  label,
  className = "",
}: {
  children: ReactNode;
  duration?: number;
  label: string;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="marquee min-w-0 flex-1"
        data-paused={paused ? "" : undefined}
        style={{ ["--marquee-dur" as string]: `${duration}s` }}
      >
        <div className="marquee-track">
          <ul aria-label={label} className="flex shrink-0 items-center gap-3 pr-3" data-copy="1">
            {children}
          </ul>
          <ul aria-hidden="true" inert className="flex shrink-0 items-center gap-3 pr-3" data-copy="2">
            {children}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink motion-reduce:hidden"
      >
        <span className="sr-only">{paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}</span>
        <PlayPauseIcon playing={!paused} />
      </button>
    </div>
  );
}

export function PlayPauseIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
      {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4.5 2.8v10.4L13 8z" />}
    </svg>
  );
}

export default Marquee;
