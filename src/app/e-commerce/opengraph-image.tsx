import { ogCard } from '@/lib/seo/og';

export const alt = "Repéré pour l'e-commerce";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return ogCard('Faites recommander vos produits par ChatGPT et Perplexity', 'E-commerce');
}
