/**
 * Préférences d'alerte côté serveur (remplace le localStorage de Settings.tsx).
 * GET  /api/alerts/prefs?businessId=  → { prefs, labels, channels }
 * POST /api/alerts/prefs { businessId, types?: {type: {inApp,email,push,slack,webhook}}, threshold?, copyTo? } → { prefs }
 */
import { CHANNELS, NOTIF_LABELS, getAlertPrefs, saveAlertPrefs } from '@/lib/notify';
import { requireBusiness } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('alerts/prefs', async () => {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    await requireBusiness(req, businessId);
    return jsonOk({ prefs: await getAlertPrefs(businessId), labels: NOTIF_LABELS, channels: CHANNELS });
  });
}

export async function POST(req: Request) {
  return handle('alerts/prefs', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    await limit(req, 'prefs', 120);
    await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    const { businessId: _omit, ...patch } = body;
    void _omit;
    return jsonOk({ prefs: await saveAlertPrefs(businessId, patch) });
  });
}
