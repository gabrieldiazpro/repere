'use client';
// Barres avant / après d'un scénario (SCENARIOS, V9) : la barre « après » part du score actuel et glisse jusqu'au
// score simulé à l'entrée à l'écran ; le chiffre monte avec le compteur (primitive motion « Counter »).
// Valeurs finales dans le HTML serveur (accessibles), animation décorative seulement.
import { useEffect, useRef, useState } from 'react';
import { Counter } from '@/components/motion/Counter';
import { observe, reducedMotion } from '@/components/motion/lib';

export function ScoreBar({ name, before, after }: { name: string; before: number; after: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (!ref.current || reducedMotion()) return;
    setShown(false);
    const off = observe(ref.current, (e) => {
      if (e.isIntersecting) {
        // une image plus tard : la transition part bien de « avant »
        requestAnimationFrame(() => setShown(true));
        off();
      }
    }, { threshold: 0.4 });
    return off;
  }, [before, after]);
  const d = after - before;
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  const width = shown ? after : before;
  return (
    <div className="scn-bar" ref={ref}>
      <span className="scn-bar-name">{name}</span>
      <span className="scn-bar-val">
        <span className="sr-only">{`${name} : ${before} aujourd’hui, ${after} après ce scénario (sur 100).`}</span>
        <span aria-hidden="true">
          <Counter value={after} from={before} />
          <small data-d={dir}>{d === 0 ? 'inchangé' : `${d > 0 ? '+' : '−'}${Math.abs(d)} (${before} aujourd’hui)`}</small>
        </span>
      </span>
      <div className="scn-track" aria-hidden="true">
        <span className="scn-track-after" data-d={dir} style={{ width: `${Math.max(0, Math.min(100, width))}%` }} />
        <span className="scn-track-before" style={{ width: `${Math.max(0, Math.min(100, Math.min(before, after)))}%` }} />
      </div>
    </div>
  );
}

export function ScoreBars({ before, after }: { before: { seo: number; geo: number }; after: { seo: number; geo: number } }) {
  return (
    <div className="scn-bars">
      <ScoreBar name="Contrôles Google (SEO)" before={before.seo} after={after.seo} />
      <ScoreBar name="Contrôles IA (GEO)" before={before.geo} after={after.geo} />
      <p className="scn-bar-legend" aria-hidden="true">
        <span><i />aujourd’hui</span>
        <span><i data-k="after" />après les corrections</span>
      </p>
    </div>
  );
}
