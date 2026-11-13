import type { Tone } from './tone';
import { deltaTone, signed } from './tone';

/**
 * Variation avec signe, flèche et couleur (jamais la couleur seule). Composant serveur.
 * <Delta value={9} unit=" pts" label="sur un mois" />  ·  <Delta value={-2} unit=" places" pill />
 */
export function Delta({
  value,
  unit = '',
  invert = false,
  pill = false,
  label,
  decimals = 0,
  tone,
  className = '',
}: {
  value: number;
  unit?: string;
  /** Une hausse est un recul (erreurs, délai…). */
  invert?: boolean;
  pill?: boolean;
  /** Contexte lu par les lecteurs d'écran et affiché en infobulle (« sur un mois »). */
  label?: string;
  decimals?: number;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? deltaTone(value, invert);
  const word = value > 0 ? 'en hausse' : value < 0 ? 'en baisse' : 'stable';
  return (
    <span className={`ui-delta ${className}`} data-tone={t} data-pill={pill ? '' : undefined} title={label}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {value > 0 ? <path d="M12 19V5M6 11l6-6 6 6" /> : value < 0 ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M5 12h14" />}
      </svg>
      {signed(value, decimals)}
      {unit}
      <span className="sr-only">
        {' '}
        {word}
        {label ? ` ${label}` : ''}
      </span>
    </span>
  );
}

export default Delta;
