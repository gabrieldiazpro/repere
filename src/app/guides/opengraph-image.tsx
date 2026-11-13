import { ogCard } from '@/lib/seo/og';

export const alt = 'Guides Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Guides pratiques du référencement IA', 'Guides');
}
