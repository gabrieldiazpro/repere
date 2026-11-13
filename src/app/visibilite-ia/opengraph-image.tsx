import { ogCard } from '@/lib/seo/og';

export const alt = 'Visibilité IA par métier';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Visibilité IA par métier, secteur et catégorie', 'Visibilité IA');
}
