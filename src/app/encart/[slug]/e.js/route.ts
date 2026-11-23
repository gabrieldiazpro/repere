/**
 * Script de l'encart : /encart/<slug>/e.js. < 5 Ko, aucune dépendance, aucun cookie, aucune requête de plus, aucun
 * traceur. Le JSON-LD n'est inclus que pour une vraie entreprise qui l'a activé (jamais pour une démo).
 */
import { embedData, embedScript, loadPublicFiche } from '@/lib/execution/fiche';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await loadPublicFiche(slug);
  const headers = {
    'content-type': 'text/javascript; charset=utf-8',
    'x-robots-tag': 'noindex',
    'cache-control': 'public, max-age=900, s-maxage=900',
    'cross-origin-resource-policy': 'cross-origin',
    'access-control-allow-origin': '*',
  };
  if (!p) return new Response('/* Fiche introuvable */\n', { status: 404, headers });
  return new Response(embedScript(embedData(p.view, p.name, p.pageUrl), p.clientJsonLd), { headers });
}
