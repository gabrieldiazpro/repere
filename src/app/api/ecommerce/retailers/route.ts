/**
 * GET /api/ecommerce/retailers?businessId=…
 * → { ok, report: RetailerReport } : où les IA envoient l'acheteur (votre site, marketplace, revendeur,
 *   comparatif…), part par type, domaines cités, recommandations.
 */
import { retailerReport } from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, readAccess } from '@/lib/ecommerce/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    const { business } = await readAccess(req, businessId);
    return json({ ok: true, report: await retailerReport(business) });
  } catch (e) {
    return errorResponse(e, '/retailers');
  }
}
