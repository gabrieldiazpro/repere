import { ogCard } from '@/lib/seo/og';

export const alt = 'Repéré pour les agences';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Le référencement IA en marque blanche, pour vos clients', 'Agences');
}
