import { redirect } from 'next/navigation';

/** Lien des rappels de posts (`/app/local/posts?post=<id>`, module LOCAL) → calendrier de l'écran Avis et posts. */
export default async function LocalPosts({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  const { post } = await searchParams;
  const id = typeof post === 'string' && /^[A-Za-z0-9_:-]{1,80}$/.test(post) ? post : null;
  redirect(id ? `/app/local/avis?post=${encodeURIComponent(id)}#posts` : '/app/local/avis#posts');
}
