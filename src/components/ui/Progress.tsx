import type { ReactNode } from 'react';
import type { Tone } from './tone';

/**
 * Barre de progression : se remplit à l'affichage (scaleX, aussi en mouvement réduit). Composant serveur.
 * <ProgressBar value={1} max={3} label="1 tâche sur 3 faite" tone="up" />
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone,
  size = 'md',
  grow = true,
  className = '',
}: {
  value: number;
  max?: number;
  /** Texte accessible (obligatoire : la barre seule ne dit rien). */
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  grow?: boolean;
  className?: string;
}) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div
      className={`ui-progress ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      data-tone={tone}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-grow={grow ? '' : undefined}
      style={{ ['--p' as string]: p }}
    >
      <span className="ui-progress-fill" />
    </div>
  );
}

/**
 * Jauge circulaire : l'arc se trace de 0 à la valeur. Composant serveur.
 * <Gauge value={61} label="Score de visibilité : 61 sur 100">61</Gauge>
 */
export function Gauge({
  value,
  max = 100,
  size = 72,
  stroke = 7,
  tone,
  label,
  grow = true,
  children,
  className = '',
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  label: string;
  grow?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const p = Math.max(0, Math.min(1, max ? value / max : 0)) * 100;
  const r = (size - stroke) / 2;
  return (
    <div className={`ui-gauge ${className}`} data-tone={tone} data-grow={grow ? '' : undefined} role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ui-gauge-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ui-gauge-arc" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDashoffset={100 - Math.max(p, 0.5)} />
      </svg>
      {children ? <span className="ui-gauge-label" aria-hidden="true">{children}</span> : null}
    </div>
  );
}

export default ProgressBar;
