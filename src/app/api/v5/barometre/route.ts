/** GET /api/v5/barometre : baromètres publiés (éditions réelles uniquement ; liste vide tant que rien n'est mesuré). */
import { listPublished } from '@/lib/barometre/public';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await listPublished();
    return Response.json({ items, count: items.length }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'indisponible' }, { status: 503 });
  }
}
