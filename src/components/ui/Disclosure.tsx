import type { ReactNode } from 'react';

/**
 * Section dépliable (divulgation progressive) : <details> natif, hauteur animée là où le navigateur le permet.
 * Composant serveur, fonctionne sans JavaScript.
 * <Disclosure title="Expliquer ce changement" summary="Votre score progresse de 9 points">…</Disclosure>
 */
export function Disclosure({
  title,
  summary,
  icon,
  defaultOpen = false,
  plain = false,
  className = '',
  children,
  ...rest
}: {
  title: ReactNode;
  /** Une ligne de résumé sous le titre (visible fermé). */
  summary?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  /** Sans cadre (dans une carte). */
  plain?: boolean;
  className?: string;
  children: ReactNode;
  'data-visite'?: string;
}) {
  return (
    <details className={`ui-disclosure ${className}`} open={defaultOpen || undefined} data-plain={plain ? '' : undefined} {...rest}>
      <summary>
        {icon ? <span className="flex-none text-[var(--primary)]">{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="ui-disclosure-title block">{title}</span>
          {summary ? <span className="ui-small block">{summary}</span> : null}
        </span>
        <svg className="ui-disclosure-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </summary>
      <div className="ui-disclosure-body">{children}</div>
    </details>
  );
}

export default Disclosure;
