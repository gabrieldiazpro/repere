import type { ReactNode } from 'react';
import type { Tone } from './tone';

export type Elevation = 'flat' | 'base' | 'raised' | 'hero';

/**
 * Carte standard de l'app (et du site). La hiérarchie se lit dans l'élévation : un seul « hero » par page,
 * quelques « raised » (l'essentiel), le reste « base » ou « flat » (détails). Composant serveur.
 * <Surface title="Vos 3 tâches" aside={<a>Tout voir</a>}>…</Surface>
 */
export function Surface({
  title,
  id,
  aside,
  elevation = 'base',
  tone,
  as: Tag = 'section',
  pad = true,
  className = '',
  children,
}: {
  title?: ReactNode;
  /** id du titre (aria-labelledby). */
  id?: string;
  aside?: ReactNode;
  elevation?: Elevation;
  /** Liseré gauche sémantique (à réserver aux cartes d'alerte ou de résultat). */
  tone?: Exclude<Tone, 'neutral'>;
  as?: 'section' | 'div' | 'article' | 'li';
  pad?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`ui-card ${className}`}
      data-elevation={elevation === 'base' ? undefined : elevation}
      data-tone={tone}
      aria-labelledby={Tag === 'section' && title && id ? id : undefined}
    >
      {title ? (
        <div className="ui-card-head">
          <h2 id={id} className="ui-h2 min-w-0 flex-1">
            {title}
          </h2>
          {aside ? <div className="ui-small">{aside}</div> : null}
        </div>
      ) : null}
      {pad ? <div className="ui-card-body">{children}</div> : children}
    </Tag>
  );
}

export default Surface;
