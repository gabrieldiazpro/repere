'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/components/app/shell/client';

type State = 'idle' | 'busy' | 'done';

/**
 * Bouton avec retour de pression (scale .97), état « en cours » (roue) et état « fait » (coche qui se dessine,
 * fond vert). La coche se dessine aussi en mouvement réduit (tracé sans déplacement).
 * <ActionButton onAction={() => markDone(id)} doneLabel="Fait" toastText="Tâche marquée comme faite.">C’est fait</ActionButton>
 * `onAction` peut être async ; s'il lève une erreur, retour à « idle » et toast d'erreur.
 */
export function ActionButton({
  onAction,
  children,
  doneLabel = 'Fait',
  done: doneProp,
  toastText,
  errorText = 'L’action n’a pas abouti. Réessayez.',
  variant = 'secondary',
  size = 'md',
  resetAfter,
  disabled,
  className = '',
  'aria-label': ariaLabel,
}: {
  onAction?: () => unknown | Promise<unknown>;
  children: ReactNode;
  doneLabel?: ReactNode;
  /** Contrôlé : forcer l'état fait (ex. tâche déjà faite au chargement). */
  done?: boolean;
  toastText?: string;
  errorText?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Revient à l'état initial après n ms (ex. « Copié »). */
  resetAfter?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [state, setState] = useState<State>(doneProp ? 'done' : 'idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (doneProp !== undefined) setState(doneProp ? 'done' : 'idle');
  }, [doneProp]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = async () => {
    if (state !== 'idle') return;
    setState('busy');
    try {
      await onAction?.();
      setState('done');
      if (toastText) toast({ text: toastText, tone: 'success' });
      if (resetAfter) timer.current = setTimeout(() => setState('idle'), resetAfter);
    } catch {
      setState('idle');
      toast({ text: errorText, tone: 'error' });
    }
  };

  return (
    <button
      type="button"
      className={`ui-btn ${className}`}
      data-variant={variant === 'secondary' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      data-state={state === 'idle' ? undefined : state}
      aria-busy={state === 'busy' || undefined}
      aria-pressed={state === 'done'}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={run}
    >
      {state === 'busy' ? <span className="ui-btn-spin" aria-hidden="true" /> : null}
      {state === 'done' ? (
        <svg className="ui-check-draw" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} />
        </svg>
      ) : null}
      <span>{state === 'done' ? doneLabel : children}</span>
    </button>
  );
}

export default ActionButton;
