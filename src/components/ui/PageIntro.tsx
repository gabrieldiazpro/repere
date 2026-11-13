import type { ReactNode } from 'react';
import type { Tone } from './tone';

/**
 * En-tête de page standard (clarté V4) : le titre-résultat (ce que l'écran établit, pas sa fonction), un sous-titre
 * d'une phrase, UNE action principale (+ une secondaire discrète au plus). Composant serveur.
 * Dans l'app, passez plutôt `result` / `subtitle` / `primary` à <PageHeader> (components/app/PageHeader), qui le rend.
 * <PageIntro result="Gemini se trompe sur vos horaires" tone="down" subtitle="1 erreur sur 12 faits vérifiés."
 *   primary={<Link className="ui-btn" data-variant="primary" href="…">Corriger en 15 min</Link>} />
 */
export function PageIntro({
  result,
  subtitle,
  primary,
  secondary,
  status,
  tone,
  id,
  as: Tag = 'h2',
  className = '',
}: {
  result: ReactNode;
  subtitle?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  /** Badge court au-dessus (ex. <StatusBadge live tone="brand">Mesure en cours</StatusBadge>). */
  status?: ReactNode;
  /** Colore le titre-résultat : 'down' (problème), 'up' (progrès) ; neutre par défaut. */
  tone?: Tone;
  id?: string;
  as?: 'h1' | 'h2' | 'p';
  className?: string;
}) {
  const color = tone === 'down' ? 'var(--tone-down)' : tone === 'up' ? 'var(--tone-up)' : tone === 'warn' ? 'var(--tone-warn)' : 'var(--ink)';
  return (
    <div className={`ui-intro ${className}`}>
      {status ? <div className="mb-3">{status}</div> : null}
      <Tag id={id} className="ui-result max-w-[28ch]" style={{ color }}>
        {result}
      </Tag>
      {subtitle ? <p className="ui-body mt-2 max-w-[62ch] text-[var(--muted)]">{subtitle}</p> : null}
      {primary || secondary ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {primary}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

export default PageIntro;
