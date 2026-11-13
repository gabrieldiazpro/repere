import '@/components/app/mesure/mesure.css';
import { MesureSkeleton } from '@/components/app/mesure/Skeleton';

export default function Loading() {
  return <MesureSkeleton title="Trafic et ventes" kpis={true} />;
}
