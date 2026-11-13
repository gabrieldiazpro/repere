import type { ReactNode } from 'react';

/**
 * État vide : une phrase + l'action suivante. Composant serveur.
 * <EmptyState title="Aucune erreur détectée" action={<Link className="ui-btn" href="…">Lancer une mesure</Link>}>Les IA disent juste.</EmptyState>
 */
export function EmptyState({
  title,
  icon,
  action,
  compact = false,
  className = '',
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`ui-empty ${className}`} data-compact={compact ? '' : undefined}>
      {icon ? (
        <span className="ui-empty-ico" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="ui-empty-title">{title}</p>
      {children ? <p className="ui-empty-text">{children}</p> : null}
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
