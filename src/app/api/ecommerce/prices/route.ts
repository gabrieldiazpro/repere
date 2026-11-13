/**
 * GET /api/ecommerce/prices?businessId=…[&llm=1]
 * → { ok, report: PriceReport } : prix et notes cités par les IA comparés à la fiche ; `factItems` (erreurs de
 *   prix) au format de la vérification des faits. `llm=1` : extraction complémentaire par LLM (offre avec
 *   exécution, clé configurée ; jamais sur les comptes démo).
 */
import { assertEntitled, getEntitlements } from '@/lib/entitlements';
import { priceReport } from '@/lib/ecommerce';
import { businessIdOf, errorResponse, json, limit, readAccess, writeAccess } from '@/lib/ecommerce/http';
import { isDemoBusinessId } from '@/lib/demo-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const businessId = businessIdOf(sp.get('businessId'));
    const llm = sp.get('llm') === '1';
    // F6 : appel LLM réservé aux membres (pas aux lecteurs).
    const { business } = llm && !isDemoBusinessId(businessId) ? await writeAccess(req, businessId) : await readAccess(req, businessId);
    if (llm) {
      assertEntitled(getEntitlements(business), 'execution');
      await limit(req, 'prices-llm', 20);
    }
    return json({ ok: true, report: await priceReport(business, { llm }) });
  } catch (e) {
    return errorResponse(e, '/prices');
  }
}
