/**
 * Squelettes de chargement (jamais d'écran blanc). Composants serveur, utilisables dans loading.tsx.
 * <Skeleton variant="figure" />  ·  <Skeleton lines={3} />  ·  <SkeletonCard />
 */
export function Skeleton({
  variant = 'text',
  lines = 1,
  width,
  height,
  className = '',
}: {
  variant?: 'text' | 'title' | 'figure' | 'block';
  lines?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  const cls = variant === 'block' ? '' : `ui-skel-${variant}`;
  if (variant === 'text' && lines > 1)
    return (
      <span className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="ui-skel ui-skel-text" style={{ width: i === lines - 1 ? '62%' : '100%' }} />
        ))}
      </span>
    );
  return <span className={`ui-skel ${cls} ${className}`} style={{ width, height }} aria-hidden="true" />;
}

/** Carte squelette : titre, chiffre, deux lignes. Annonce « Chargement… » une seule fois. */
export function SkeletonCard({ label = 'Chargement…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`ui-card ${className}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="ui-card-body flex flex-col gap-3 pt-5">
        <Skeleton variant="title" />
        <Skeleton variant="figure" />
        <Skeleton lines={2} />
      </div>
    </div>
  );
}

export default Skeleton;
