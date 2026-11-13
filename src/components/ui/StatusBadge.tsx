import type { ReactNode } from 'react';
import type { Tone } from './tone';

const GLYPH: Record<Tone, ReactNode> = {
  up: <path d="m6 12.5 4 4 8-9" />,
  down: <><path d="M12 7v6" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></>,
  warn: <><path d="M12 4 21 19H3z" /><path d="M12 10v4M12 16.8v.2" /></>,
  neutral: <circle cx="12" cy="12" r="3.5" />,
  brand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
};

/**
 * Badge de statut : ton sémantique + icône (ou point « en direct »). Composant serveur.
 * <StatusBadge tone="down">2 erreurs</StatusBadge>  ·  <StatusBadge tone="brand" live>Mesure en cours</StatusBadge>
 */
export function StatusBadge({
  tone = 'neutral',
  live = false,
  icon = true,
  size = 'md',
  className = '',
  children,
}: {
  tone?: Tone;
  /** Point qui pulse 3 fois (mesure en cours, données fraîches). */
  live?: boolean;
  icon?: boolean;
  size?: 'md' | 'lg';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`ui-badge ${className}`} data-tone={tone} data-size={size === 'lg' ? 'lg' : undefined} data-live={live ? '' : undefined}>
      {live ? (
        <span className="ui-live-dot" aria-hidden="true" />
      ) : icon ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {GLYPH[tone]}
        </svg>
      ) : null}
      {children}
    </span>
  );
}

export default StatusBadge;
