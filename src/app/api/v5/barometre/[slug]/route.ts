/** GET /api/v5/barometre/[slug]?periode=AAAA-MM : édition réelle publiée (404 sinon ; jamais de simulation). */
import { getPublicEdition } from '@/lib/barometre/public';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const period = new URL(req.url).searchParams.get('periode') ?? undefined;
  if (!/^[a-z0-9-]{2,80}$/.test(slug) || (period && !/^\d{4}-\d{2}$/.test(period))) return Response.json({ error: 'paramètres invalides' }, { status: 400 });
  try {
    const e = await getPublicEdition(slug, period);
    if (!e) return Response.json({ error: 'baromètre non publié' }, { status: 404 });
    return Response.json(e, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'indisponible' }, { status: 503 });
  }
}
