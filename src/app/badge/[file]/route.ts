import { badgeViewForBusiness, renderBadgeSvg } from '@/lib/growth/badge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /badge/<businessId>.svg — badge dynamique « Visibilité IA mesurée par Repéré — mois année ».
 * 404 tant que le client n'a pas activé le badge ; « Mesure expirée » si la mesure réelle a plus de 45 jours ou n'existe pas.
 * (Le dossier est [file] et non [id].svg : Next n'accepte pas de suffixe dans un segment dynamique.)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([A-Za-z0-9_-]{1,100})\.svg$/.exec(file);
  if (!m) return new Response('Not found', { status: 404 });
  let view = null;
  try {
    view = await badgeViewForBusiness(m[1]);
  } catch {
    return new Response('Indisponible', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!view) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });
  return new Response(renderBadgeSvg(view), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
