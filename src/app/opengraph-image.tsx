import { ogCard } from '@/lib/seo/og';

export const alt = 'Repéré, le référencement IA des entreprises françaises';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Les IA recommandent. On travaille pour que ce soit vous.', 'Le référencement IA des entreprises françaises');
}
