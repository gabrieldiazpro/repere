/** POST /api/integrations/test { businessId, id } — envoi d'un message de test (hors file), résultat immédiat. */
import { sendTest } from '@/lib/integrations';
import { assertEntitled, getEntitlements, requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle('integrations/test', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    if (typeof body.id !== 'string' || !/^int_[A-Za-z0-9_-]{6,20}$/.test(body.id)) throw new HttpError(400, 'Intégration invalide.');
    await limit(req, 'integrations-test', 20);
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    assertEntitled(getEntitlements(business), 'integrations'); // F2 : droit revérifié (offre rétrogradée)
    const r = await sendTest(businessId, body.id, business.name);
    return jsonOk({ result: r });
  });
}
