import { ogCard } from '@/lib/seo/og';

export const alt = 'Repéré pour les artisans et commerces';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Artisans et commerces : soyez dans la réponse de ChatGPT', 'Commerce local');
}
