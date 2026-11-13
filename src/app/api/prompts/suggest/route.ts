/**
 * POST /api/prompts/suggest { businessId, category?, offering?, url?, limit? }
 * → { ok, suggestions: PromptSuggestion[] (20, étiquetées « suggestion »), siteRead }
 * Ne modifie rien : autorisé sur les comptes démo (le site n'est alors pas récupéré).
 */
import { requireBusiness } from '@/lib/prompts/adapters';
import { BUSINESS_ID_RE, errorResponse, fail, json, limit, readJson } from '@/lib/prompts/http';
import { suggestForBusiness } from '@/lib/prompts/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export async function POST(req: Request) {
  try {
    await limit(req, 'suggest', 60);
    const body = await readJson(req);
    if (!body) return fail(400, 'Requête invalide.');
    const businessId = typeof body.businessId === 'string' ? body.businessId : '';
    if (!BUSINESS_ID_RE.test(businessId)) return fail(400, 'Identifiant de commerce invalide.');
    const { business } = await requireBusiness(req, businessId);
    const res = await suggestForBusiness(business, {
      category: str(body.category, 80),
      offering: str(body.offering, 300),
      url: str(body.url, 500),
      fetchSite: body.fetchSite !== false,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    });
    return json({ ok: true, ...res });
  } catch (e) {
    return errorResponse(e, '/suggest');
  }
}
