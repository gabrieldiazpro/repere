import { ogCard } from '@/lib/seo/og';

export const alt = 'Comparatif Repéré, outils et agences';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Repéré, outils de mesure, agences GEO : le comparatif', 'Comparatif');
}
