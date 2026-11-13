/**
 * GET /api/ecommerce/products?businessId=…[&answers=1]
 * → { ok, report: ProductTrackingReport } : produits et marques cités, rang, présence ; agrégats par produit,
 *   catégorie et question. `answers=1` inclut le détail réponse par réponse (sinon omis pour alléger).
 */
import { productTracking } from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, readAccess } from '@/lib/ecommerce/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const businessId = businessIdOf(sp.get('businessId'));
    const { business } = await readAccess(req, businessId);
    const report = await productTracking(business);
    return json({ ok: true, report: sp.get('answers') === '1' ? report : { ...report, answers: [] } });
  } catch (e) {
    return errorResponse(e, '/products');
  }
}
