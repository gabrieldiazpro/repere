/** Données d'un baromètre en CSV. 404 tant qu'aucune édition réelle n'est publiée (aperçu simulé en local seulement). */
import { editionToCsv, getPageData, getPublicEdition } from '@/lib/barometre/public';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const period = new URL(req.url).searchParams.get('periode') ?? undefined;
  if (period && !/^\d{4}-\d{2}$/.test(period)) return new Response('Période invalide', { status: 400 });
  try {
    const e = period ? await getPublicEdition(slug, period) : (await getPageData(slug))?.edition ?? null;
    if (!e) return new Response('Baromètre introuvable', { status: 404 });
    return new Response(editionToCsv(e), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="barometre-${e.slug}-${e.period}${e.demo ? '-simulation' : ''}.csv"`,
        'Cache-Control': e.demo ? 'no-store' : 'public, max-age=3600',
        ...(e.demo ? { 'X-Robots-Tag': 'noindex' } : {}),
      },
    });
  } catch {
    return new Response('Données indisponibles', { status: 503 });
  }
}
