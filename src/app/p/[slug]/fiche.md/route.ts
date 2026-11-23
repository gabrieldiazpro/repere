/**
 * Fiche officielle en Markdown pour les IA : /p/<slug>.md (réécrit vers cette route, next.config.ts).
 * Mêmes faits que la page HTML. noindex si la page n'est pas indexable (démo ou pas d'opt-in).
 */
import { ficheMarkdown, loadPublicFiche } from '@/lib/execution/fiche';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await loadPublicFiche(slug.replace(/\.md$/, ''));
  if (!p) return new Response('Fiche introuvable.\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  const body = ficheMarkdown({ fiche: p.view, name: p.name, pageUrl: p.pageUrl, activity: p.activity, demo: p.demo });
  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
      link: `<${p.pageUrl}>; rel="canonical"`,
      ...(p.indexable ? {} : { 'x-robots-tag': 'noindex' }),
    },
  });
}
