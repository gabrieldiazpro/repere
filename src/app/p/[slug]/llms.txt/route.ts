/** llms.txt de l'entreprise (format https://llmstxt.org) : /p/<slug>/llms.txt. */
import { ficheLlmsTxt, loadPublicFiche } from '@/lib/execution/fiche';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await loadPublicFiche(slug);
  if (!p) return new Response('Fiche introuvable.\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  return new Response(ficheLlmsTxt({ fiche: p.view, name: p.name, pageUrl: p.pageUrl, activity: p.activity, demo: p.demo }), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=600', ...(p.indexable ? {} : { 'x-robots-tag': 'noindex' }) },
  });
}
