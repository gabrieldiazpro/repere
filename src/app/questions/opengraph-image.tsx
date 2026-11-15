import { ogCard } from '@/lib/seo/og';

export const alt = 'Questions sur le référencement IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Référencement SEO et IA : 35 questions, 35 réponses franches', 'Questions fréquentes');
}
