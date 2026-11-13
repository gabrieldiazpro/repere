import { ogCard } from '@/lib/seo/og';
import { euros, fromPrice } from '@/components/site/plans-v2';

export const alt = 'Tarifs de Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const from = fromPrice('local');
  return ogCard(`Tarifs : test gratuit, Essentiel dès ${from ? euros(from) : '29 €'}/mois, le travail inclus`, 'Tarifs');
}
