import { ogCard } from '@/lib/seo/og';

export const alt = "Qu'est-ce que le GEO ?";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('GEO : la définition et les 7 leviers du référencement IA', 'Guide de référence');
}
