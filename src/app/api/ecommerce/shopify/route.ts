/**
 * GET    /api/ecommerce/shopify?businessId=… → { ok, enabled, connected, shop, connectedAt, scopes } (aucun jeton)
 * DELETE /api/ecommerce/shopify?businessId=… → déconnexion (jetons supprimés ; désinstallez aussi l'app côté Shopify)
 */
import { businessIdOf, errorResponse, json, readAccess, writeAccess } from '@/lib/ecommerce/http';
import { connectionStatus, disconnect } from '@/lib/ecommerce/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    await readAccess(req, businessId);
    return json({ ok: true, ...(await connectionStatus(businessId)) });
  } catch (e) {
    return errorResponse(e, '/shopify');
  }
}

export async function DELETE(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    await writeAccess(req, businessId, 'admin');
    await disconnect(businessId);
    return json({ ok: true, connected: false });
  } catch (e) {
    return errorResponse(e, '/shopify');
  }
}
