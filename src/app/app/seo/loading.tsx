import '@/components/app/seo/seo.css';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="rp-page" role="status" aria-live="polite">
      <span className="sr-only">Chargement de la partie SEO…</span>
      <div className="mb-6 grid max-w-2xl gap-3 pt-6">
        <Skeleton variant="title" />
        <Skeleton lines={2} />
      </div>
      <div className="seo-grid seo-grid-3">
        <SkeletonCard label="Chargement des scores…" />
        <SkeletonCard label="Chargement des données…" />
        <SkeletonCard label="Chargement des corrections…" />
      </div>
    </div>
  );
}
