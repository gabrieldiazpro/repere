"use client";

import { useEffect, useRef, useState } from "react";
import { useScene } from "./SceneContext";

/**
 * Temps écoulé (ms) depuis `active`, qui s'arrête pendant les pauses de la scène et onglet masqué.
 * S'arrête de lui-même à `until` ms. Renvoie `until` (état final) si inactif depuis le début et `final` vrai.
 */
export function useClock(active: boolean, until: number): number {
  const { paused } = useScene();
  const [t, setT] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) {
      setT(0);
      return;
    }
    let raf = 0;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!pausedRef.current && !document.hidden) elapsed += now - last;
      last = now;
      setT(Math.min(elapsed, until));
      if (elapsed < until) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, until]);

  return t;
}
