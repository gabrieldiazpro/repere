import { ogCard } from '@/lib/seo/og';

export const alt = 'Méthode de mesure de Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Comment nous mesurons votre visibilité dans les IA', 'Méthode publique');
}
