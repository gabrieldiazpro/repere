import { redirect } from 'next/navigation';

// V3 : l'écran Tâches est absorbé par le Centre d'actions. Lien direct vers une tâche conservé (?t=).
export default async function TachesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  redirect(t ? `/app/actions?t=${encodeURIComponent(t)}` : '/app/actions');
}
