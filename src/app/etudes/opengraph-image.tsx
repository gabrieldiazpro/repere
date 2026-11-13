import { ogCard } from '@/lib/seo/og';

export const alt = 'Études Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Études et baromètre de la visibilité IA en France', 'Études');
}
