'use client';

import { useEffect, useState } from 'react';
import s from './analysis.module.css';
import { scoreTone } from './format';

/**
 * Jauge de score (0–100) : l'arc se trace jusqu'à la valeur (tracé = autorisé en mouvement réduit), le chiffre monte.
 * `value` null : en attente (arc vide, mention « en cours » ou « non mesuré »).
 */
export function ScoreDial({
  value,
  name,
  sub,
  size = 132,
  waiting = 'en cours',
  tone,
}: {
  value: number | null | undefined;
  name: string;
  sub?: string;
  size?: number;
  waiting?: string;
  tone?: 'brand';
}) {
  const shown = useCount(value ?? null);
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  // Démarre vide puis se trace jusqu'à la valeur (une image après le montage).
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const offset = c * (1 - (armed ? p : 0));
  const t = tone ?? scoreTone(value);
  const label = value == null ? `${name} : ${waiting}` : `${name} : ${value} sur 100`;
  return (
    <div className={s.dial}>
      <svg className={s.dialSvg} viewBox="0 0 110 110" width={size} height={size} role="img" aria-label={label}>
        <circle className={s.dialTrack} cx="55" cy="55" r={r} strokeWidth="9" />
        <circle
          className={s.dialArc}
          data-tone={t}
          cx="55"
          cy="55"
          r={r}
          strokeWidth="9"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
        />
        {value == null ? (
          <text x="55" y="60" textAnchor="middle" className={s.dialWait}>
            {waiting}
          </text>
        ) : (
          <text x="55" y="65" textAnchor="middle" className={s.dialValue}>
            {shown}
          </text>
        )}
      </svg>
      <span className={s.dialName}>{name}</span>
      {sub ? <span className={s.dialSub}>{sub}</span> : null}
    </div>
  );
}

/** Compteur qui monte vers la valeur (autorisé en mouvement réduit : aucun déplacement). */
function useCount(target: number | null, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    let raf = 0;
    const from = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (target - from) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target == null ? 0 : v;
}

export default ScoreDial;
