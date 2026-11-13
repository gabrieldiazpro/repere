import type { Metadata } from 'next';
import { CategoryPage, categoryMetadata } from '@/lib/seo/segment-pages';
import { categoriesFor } from '@/lib/seo/segments';

export const dynamicParams = false;

export function generateStaticParams() {
  return categoriesFor('pme').map((c) => ({ categorie: c.slug }));
}

type Props = { params: Promise<{ categorie: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return categoryMetadata('pme', (await params).categorie);
}

export default async function Page({ params }: Props) {
  return <CategoryPage segment="pme" slug={(await params).categorie} />;
}
