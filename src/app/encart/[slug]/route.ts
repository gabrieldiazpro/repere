/**
 * Encart « Faits vérifiés » en cadre (iframe) : HTML statique, sans script, sans cookie. Intégrable sur tout site
 * (frame-ancestors *), jamais indexé.
 */
import { embedData, embedFramePage, loadPublicFiche } from '@/lib/execution/fiche';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await loadPublicFiche(slug);
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors *; base-uri 'none'; form-action 'none'",
    'cache-control': 'public, max-age=900, s-maxage=900',
    'referrer-policy': 'no-referrer',
  };
  if (!p) return new Response('<!doctype html><meta charset="utf-8"><p>Fiche introuvable.</p>', { status: 404, headers });
  return new Response(embedFramePage(embedData(p.view, p.name, p.pageUrl)), { headers });
}
