"use client";

import { useEffect, useRef, useState } from "react";
import { counterValue, formatFr, observe } from "./lib";
import { useClock } from "./useClock";
import { useScene } from "./SceneContext";

/**
 * Compteur (primitive 3) : la valeur finale est dans le HTML serveur (sr-only) ; la valeur animée est aria-hidden.
 * Sans `play` : démarre à l'entrée à l'écran. Avec `play` : piloté par la scène.
 */
export function Counter({
  value,
  from = 0,
  duration = 900,
  decimals = 0,
  play,
  suffix = "",
  className = "",
}: {
  value: number;
  from?: number;
  duration?: number;
  decimals?: number;
  play?: boolean;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (play !== undefined) return;
    // Mouvement réduit : le compteur monte quand même (pas de déplacement) — règle V4, lib.ts motionAllowed.
    if (!ref.current) return;
    setSeen(false);
    const off = observe(ref.current, (e) => {
      if (e.isIntersecting) {
        setSeen(true);
        off();
      }
    }, { threshold: 0.4 });
    return off;
  }, [play]);

  const scene = useScene();
  const inScene = play !== undefined;
  const active = inScene ? scene.playing && play : seen === true;
  const t = useClock(!!active, duration);
  let shown = value;
  if (inScene) shown = !scene.playing ? value : active ? counterValue(from, value, t, duration, decimals) : from;
  else if (seen !== null) shown = active ? counterValue(from, value, t, duration, decimals) : from;
  const final = `${formatFr(value, decimals)}${suffix}`;
  return (
    <span ref={ref} className={`tabular ${className}`}>
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" className="relative inline-block">
        {/* La largeur est réservée par la valeur finale invisible : pas de saut de mise en page. */}
        <span className="invisible">{final}</span>
        <span className="absolute inset-0 text-right">{`${formatFr(shown, decimals)}${suffix}`}</span>
      </span>
    </span>
  );
}

export default Counter;
