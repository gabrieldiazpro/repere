import { ogCard } from '@/lib/seo/og';
import { STUDIES, getStudy } from '@/lib/studies';

export const alt = 'Étude Repéré sur la visibilité IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return STUDIES.map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const s = getStudy((await params).slug);
  return ogCard(s?.title ?? 'Études sur la visibilité IA', 'Étude');
}
