import { ogCard } from '@/lib/seo/og';

export const alt = 'À propos de Repéré';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('À propos de Repéré, le référencement IA français', 'À propos');
}
