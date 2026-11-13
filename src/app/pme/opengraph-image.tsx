import { ogCard } from '@/lib/seo/og';

export const alt = 'Repéré pour les PME';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('PME : soyez dans la short-list que donne ChatGPT', 'PME et services B2B');
}
