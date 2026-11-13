import { ogCard } from '@/lib/seo/og';
import { GUIDES, getGuide } from '@/lib/seo/guides';

export const alt = 'Guide Repéré du référencement IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuide((await params).slug);
  return ogCard(g?.title ?? 'Guides du référencement IA', 'Guide pratique');
}
