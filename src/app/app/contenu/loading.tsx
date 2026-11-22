import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="rp-page flex flex-col gap-4" aria-busy="true" aria-label="Chargement des contenus">
      <Skeleton variant="figure" />
      <Skeleton lines={2} />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
