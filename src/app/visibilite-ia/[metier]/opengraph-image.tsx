import { ogCard } from '@/lib/seo/og';
import { TRADES, getTrade } from '@/lib/seo';

export const alt = 'Visibilité IA par métier, Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return TRADES.map((t) => ({ metier: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ metier: string }> }) {
  const t = getTrade((await params).metier);
  return ogCard(t ? `${t.nom_pluriel} : qui ChatGPT recommande-t-il ?` : 'Visibilité IA par métier', 'Visibilité IA par métier');
}
