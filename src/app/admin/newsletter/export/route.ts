import { listSubscribers, subscribersCsv } from '@/lib/newsletter/store';
import { adminFromRequest } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /admin/newsletter/export — CSV des abonnés (admin uniquement). */
export async function GET(req: Request) {
  if (!adminFromRequest(req)) return new Response('Non autorisé', { status: 401 });
  const csv = subscribersCsv(await listSubscribers());
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="abonnes-lettre-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
