/**
 * POST /api/prompts/import
 *   JSON : { businessId, content: "<CSV ou une question par ligne>", dryRun? }
 *   ou corps texte/CSV brut avec ?businessId=…[&dryRun=1]
 * → { ok, created, rejected, pausedForQuota, dryRun }
 * Écriture refusée sur les comptes démo ; l'aperçu (dryRun) y est autorisé.
 */
import { HttpError, requireBusiness } from '@/lib/prompts/adapters';
import { BUSINESS_ID_RE, errorResponse, fail, json, limit, readJson } from '@/lib/prompts/http';
import { MAX_IMPORT_BYTES } from '@/lib/prompts/io';
import { demandContext, quotaOf, toView } from '@/lib/prompts/repo';
import { importPrompts } from '@/lib/prompts/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await limit(req, 'import', 30);
    const sp = new URL(req.url).searchParams;
    const ct = req.headers.get('content-type') ?? '';
    let businessId = sp.get('businessId') ?? '';
    let content = '';
    let dryRun = sp.get('dryRun') === '1' || sp.get('dryRun') === 'true';
    if (/json/i.test(ct)) {
      const body = await readJson(req, MAX_IMPORT_BYTES + 2_000);
      if (!body) return fail(400, 'Requête invalide.');
      if (typeof body.businessId === 'string') businessId = body.businessId;
      content = typeof body.content === 'string' ? body.content : '';
      if (body.dryRun === true) dryRun = true;
    } else {
      content = await req.text();
    }
    if (content.length > MAX_IMPORT_BYTES) throw new HttpError(413, 'Fichier trop volumineux (200 Ko au plus).');
    if (!BUSINESS_ID_RE.test(businessId)) return fail(400, 'Identifiant de commerce invalide.');
    if (!content.trim()) return fail(400, 'Fichier vide : une question par ligne, ou un CSV avec une colonne « question ».');
    const { business } = await requireBusiness(req, businessId, dryRun ? {} : { write: true, minRole: 'member' });
    const res = await importPrompts(business, content, { dryRun });
    const ctx = demandContext(business);
    return json({ ok: true, ...res, created: res.created.map((p) => toView(p, ctx)), quota: await quotaOf(business) }, dryRun ? 200 : 201);
  } catch (e) {
    return errorResponse(e, '/import');
  }
}
