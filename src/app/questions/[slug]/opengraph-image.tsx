import { ogCard } from '@/lib/seo/og';
import { TARGET_QUESTIONS, getTargetQuestion } from '../_lib/target-questions';

export const alt = 'Question sur le référencement SEO et IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return TARGET_QUESTIONS.map((x) => ({ slug: x.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const x = getTargetQuestion((await params).slug);
  return ogCard(x?.q ?? 'Questions sur le référencement IA', 'Question');
}
