import { DraftEditor } from '@/components/app/contenu/DraftEditor';
import { SimBand } from '@/components/app/contenu/Chrome';

export const metadata = { title: 'Brouillon' };

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="rp-page pt-4">
      <SimBand />
      <DraftEditor id={id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)} />
    </div>
  );
}
