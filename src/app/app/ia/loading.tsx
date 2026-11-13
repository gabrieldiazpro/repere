import '@/components/app/mesure/mesure.css';
import { MesureSkeleton } from '@/components/app/mesure/Skeleton';

export default function Loading() {
  return <MesureSkeleton title="Ce que disent les IA" kpis={true} />;
}
