import { ogCard } from '@/lib/seo/og';

export const alt = 'Glossaire du référencement IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Glossaire du référencement IA et du SEO : 53 termes expliqués', 'Glossaire');
}
