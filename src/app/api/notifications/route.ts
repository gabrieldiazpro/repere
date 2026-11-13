/**
 * Centre de notifications.
 * GET  /api/notifications?businessId=&unread=1&limit=  → { items, unread }
 * POST /api/notifications { businessId, ids: string[] | 'all', read?: boolean } → { changed }
 */
import { listNotifications, markNotifications } from '@/lib/notify';
import { requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, readJson } from '@/lib/notify/http';
import { isDemoBusinessId } from '@/lib/demo-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('notifications', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    await requireBusiness(req, businessId);
    const res = await listNotifications(businessId, { unreadOnly: u.searchParams.get('unread') === '1', limit: Number(u.searchParams.get('limit')) || 50 });
    return jsonOk({ ...res, demo: isDemoBusinessId(businessId) });
  });
}

export async function POST(req: Request) {
  return handle('notifications', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    // Lu / non lu : action personnelle autorisée même au lecteur ; démo refusée (lecture seule).
    await requireBusiness(req, businessId, { write: true, minRole: 'viewer' });
    const ids = body.ids === 'all' ? 'all' : Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 500) : null;
    if (!ids) throw new HttpError(400, 'Champ « ids » attendu (liste ou « all »).');
    const changed = await markNotifications(businessId, ids, body.read !== false);
    return jsonOk({ changed });
  });
}
