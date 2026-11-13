/**
 * GET /api/ecommerce/revenue?businessId=…[&days=30]
 * → { ok, report: RevenueReport } : commandes et CA attribués aux IA (par moteur), panier moyen, conversion
 *   comparée aux autres sources. Source : Shopify si connecté, sinon t.js ; démo étiquetée pour `demo-ecom`.
 */
import { revenueReport } from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, limit, readAccess } from '@/lib/ecommerce/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const businessId = businessIdOf(sp.get('businessId'));
    const { business } = await readAccess(req, businessId);
    await limit(req, 'revenue', 240);
    return json({ ok: true, report: await revenueReport(business, Number(sp.get('days') ?? 30)) });
  } catch (e) {
    return errorResponse(e, '/revenue');
  }
}
