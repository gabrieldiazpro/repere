"use client";

import { useEffect, useRef, useState } from "react";
import { cursorDuration, EASE } from "./lib";
import { useScene } from "./SceneContext";

/**
 * Curseur fantôme (primitive 11) : « utilise » le produit dans une scène. Toujours aria-hidden, jamais au-dessus
 * de vrai contenu cliquable (uniquement dans [data-scene-frame]). Absent en mouvement réduit et hors lecture.
 * - `target` : valeur de l'attribut data-ghost de l'élément visé, dans le même cadre de scène.
 * - `click` : changer cette valeur déclenche un clic (onde + légère pression de la cible).
 */
export function GhostCursor({ target, click }: { target: string | null; click?: string | number | null }) {
  const { playing, reduced } = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef<{ x: number; y: number } | null>(null);
  const [ripple, setRipple] = useState(0);

  const locate = (name: string) => {
    const el = ref.current;
    const frame = el?.closest("[data-scene-frame]");
    const t = frame?.querySelector<HTMLElement>(`[data-ghost="${name}"]`);
    if (!el || !frame || !t) return null;
    const f = frame.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { x: r.left - f.left + Math.min(r.width * 0.6, r.width - 6), y: r.top - f.top + r.height * 0.6, el: t };
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !playing || reduced || !target) return;
    const p = locate(target);
    if (!p) return;
    const from = pos.current ?? { x: p.x + 60, y: p.y + 70 };
    const anim = el.animate(
      [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${p.x}px, ${p.y}px)` }],
      { duration: cursorDuration(p.x - from.x, p.y - from.y), easing: EASE.inOut, fill: "forwards" },
    );
    pos.current = { x: p.x, y: p.y };
    return () => anim.commitStyles?.();
  }, [target, playing, reduced]);

  useEffect(() => {
    if (click === undefined || click === null || !playing || reduced || !target) return;
    setRipple((n) => n + 1);
    const p = locate(target);
    p?.el.animate([{ transform: "scale(1)" }, { transform: "scale(.94)" }, { transform: "scale(1)" }], { duration: 200, easing: EASE.ui });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [click]);

  useEffect(() => {
    if (!playing) pos.current = null;
  }, [playing]);

  if (reduced) return null;
  return (
    <div ref={ref} aria-hidden="true" className="ghost-cursor" data-on={playing && target ? "" : undefined}>
      {ripple ? <span key={ripple} className="ghost-ripple" /> : null}
      <svg width="20" height="20" viewBox="0 0 22 22" className="relative -translate-x-[3px] -translate-y-[2px]">
        <path d="M3 2l15 8-6.5 1.6L9 18z" fill="#1B1F2E" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default GhostCursor;
