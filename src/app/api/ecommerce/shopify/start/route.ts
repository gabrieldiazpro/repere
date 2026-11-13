/**
 * POST /api/ecommerce/shopify/start { businessId, shop } → { ok, url }
 * L'app redirige ensuite le navigateur vers l'écran d'autorisation Shopify. Pose un nonce HttpOnly qui lie le retour
 * à ce navigateur. 503 sans SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET. Administrateur requis ; offre avec intégrations.
 */
import { HttpError } from '@/lib/auth';
import { assertEntitled, getEntitlements } from '@/lib/entitlements';
import { businessIdOf, errorResponse, json, limit, readJson, writeAccess } from '@/lib/ecommerce/http';
import { buildAuthorizeUrl, newNonce, nonceCookie, normalizeShop, shopifyEnabled, signState } from '@/lib/ecommerce/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!shopifyEnabled()) return json({ ok: false, enabled: false, error: 'Connecteur Shopify non configuré.' }, 503);
    await limit(req, 'shopify-start', 30);
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    const { business } = await writeAccess(req, businessId, 'admin');
    assertEntitled(getEntitlements(business), 'integrations');
    const shop = normalizeShop(typeof body.shop === 'string' ? body.shop : '');
    if (!shop) throw new HttpError(400, 'Adresse de boutique invalide (ex. ma-boutique.myshopify.com).');
    const nonce = newNonce();
    return json({ ok: true, enabled: true, url: buildAuthorizeUrl(shop, signState(businessId, shop, nonce)) }, 200, { 'set-cookie': nonceCookie(nonce) });
  } catch (e) {
    return errorResponse(e, '/shopify/start');
  }
}
