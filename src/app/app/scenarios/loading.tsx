import './_parts/scenarios.css';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="rp-page" role="status" aria-live="polite">
      <span className="sr-only">Calcul des scénarios…</span>
      <div className="mb-6 grid max-w-2xl gap-3 pt-6">
        <Skeleton variant="title" />
        <Skeleton lines={2} />
      </div>
      <div className="scn-cols" data-n="3">
        <SkeletonCard label="Calcul du premier scénario…" />
        <SkeletonCard label="Calcul du deuxième scénario…" />
        <SkeletonCard label="Calcul du troisième scénario…" />
      </div>
    </div>
  );
}
