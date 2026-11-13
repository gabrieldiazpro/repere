"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { makeWait, observe, reducedMotion } from "./lib";
import { SceneContext } from "./SceneContext";
import { PlayPauseIcon } from "./Marquee";

export type SceneRender = (phase: number, playing: boolean) => ReactNode;

/**
 * Lecteur de scène (docs/v3/07 §5.1.2) : cadre + bouton Pause / Lecture / Rejouer + transcription sr-only.
 * - L'état final (phase = cues.length) est le rendu serveur : rien n'est perdu si le JavaScript échoue.
 * - Démarre quand 45 % de la scène est visible ; pause hors écran (< 25 %) et onglet masqué.
 * - Mouvement réduit (règle V4) : la scène joue quand même, sans déplacement (fondus, frappe, tracés, compteurs).
 * - aria-live désactivé : le lecteur d'écran lit la transcription, pas le « streaming ».
 */
export function ScenePlayer({
  cues,
  total,
  render,
  transcript,
  label,
  replayKey,
  className = "",
  controlsClassName = "",
  dark = false,
  autoplay = true,
}: {
  /** Instants (ms) où la scène passe à l'étape 1, 2, … ; croissants. */
  cues: readonly number[];
  /** Durée totale (ms) ; la scène se fige ensuite sur l'état final. */
  total: number;
  render: SceneRender;
  transcript: ReactNode;
  /** Nom de la scène pour les boutons (« la démonstration Mesurer »). */
  label: string;
  /** Changer cette valeur relance la scène (ex. onglet de parcours du hero). */
  replayKey?: string;
  className?: string;
  controlsClassName?: string;
  dark?: boolean;
  autoplay?: boolean;
}) {
  const final = cues.length;
  const [phase, setPhase] = useState(final);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [started, setStarted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const paused = userPaused || !visible;
  pausedRef.current = paused;

  const play = useCallback(() => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const wait = makeWait(ac.signal, () => pausedRef.current);
    setUserPaused(false);
    setPhase(0);
    setPlaying(true);
    setStarted(true);
    (async () => {
      let prev = 0;
      for (let i = 0; i < cues.length; i++) {
        await wait(cues[i] - prev);
        prev = cues[i];
        setPhase(i + 1);
      }
      await wait(Math.max(0, total - prev));
      setPlaying(false);
    })().catch(() => {});
  }, [cues, total]);

  // Préparation : état initial (invisible tant que hors écran) puis lecture à 45 %.
  // Mouvement réduit (règle V4) : la scène joue aussi — fondus, frappe, tracés, compteurs ; les déplacements sont
  // neutralisés en CSS (--rise: 0, keyframes redéfinies) et le curseur fantôme est masqué (GhostCursor).
  useEffect(() => {
    setReduced(reducedMotion());
    const el = root.current;
    if (!el || !autoplay) return;
    setPhase(0);
    let launched = false;
    const off = observe(
      el,
      (e) => {
        // Scène plus haute que l'écran (mobile) : on raisonne aussi en hauteur visible.
        const h = e.intersectionRect?.height ?? 0;
        const vh = window.innerHeight || 800;
        setVisible(e.intersectionRatio >= 0.2 || h >= vh * 0.3);
        if (!launched && (e.intersectionRatio >= 0.45 || h >= vh * 0.5)) {
          launched = true;
          play();
        }
      },
      { threshold: [0, 0.2, 0.25, 0.45, 0.6] },
    );
    return () => {
      off();
      abort.current?.abort();
    };
  }, [play, autoplay]);

  // Relance sur changement de clé (onglets du hero), sauf au premier rendu.
  const firstKey = useRef(replayKey);
  useEffect(() => {
    if (replayKey === firstKey.current) return;
    firstKey.current = replayKey;
    play();
  }, [replayKey, play]);

  const ended = started && !playing;
  const btnLabel = playing ? (userPaused ? "Reprendre" : "Mettre en pause") : started ? "Rejouer" : "Lire";
  const ink = dark ? "text-on-deep hover:text-white" : "text-muted hover:text-ink";

  return (
    <SceneContext.Provider value={{ paused, reduced, playing }}>
      <div ref={root} className={className}>
        <div className="sr-only">{transcript}</div>
        <div
          aria-hidden="true"
          data-scene-frame=""
          data-scene-playing={playing ? "" : undefined}
          data-scene-paused={playing && paused ? "" : undefined}
          className="relative"
        >
          {render(phase, playing)}
        </div>
        <div className={`mt-2 flex min-h-11 items-center justify-end gap-1 text-[0.85rem] ${controlsClassName}`}>
          <button
              type="button"
              aria-pressed={playing ? userPaused : undefined}
              onClick={() => (playing ? setUserPaused((p) => !p) : play())}
              className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-3 font-semibold ${ink}`}
            >
              {playing ? <PlayPauseIcon playing={!userPaused} /> : <ReplayIcon />}
              <span>
                {btnLabel}
                <span className="sr-only"> {label}</span>
              </span>
          </button>
          {ended ? <span className="sr-only">Fin de {label}.</span> : null}
        </div>
      </div>
    </SceneContext.Provider>
  );
}

function ReplayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5" />
    </svg>
  );
}

export default ScenePlayer;
