import { z } from 'zod';
import { HttpError, requireBusiness } from '@/lib/auth';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { handleError, jsonError, jsonOk } from '@/lib/siteaudit/api';
import { listRuns, runSiteAudit } from '@/lib/siteaudit/runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BusinessId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const Body = z.object({
  businessId: BusinessId,
  url: z.string().trim().min(1).max(2048),
  kind: z.enum(['full', 'readiness', 'citability', 'product']).optional(),
  question: z.string().trim().max(200).optional(),
  /** Réécriture par IA du paragraphe d'ouverture (si une clé est configurée). */
  ai: z.boolean().optional(),
});

function authError(e: unknown): Response | null {
  if (e instanceof HttpError) return jsonError(e.status, e.message, e.code);
  return null;
}

/** POST /api/siteaudit — audit de page pour un commerce (session requise), enregistré dans l'historique. */
export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, 'Requête invalide.', 'bad_request');
  const b = parsed.data;
  const demo = isDemoBusinessId(b.businessId);
  try {
    // Comptes démo : audit lancé mais jamais enregistré (lecture seule côté serveur).
    await requireBusiness(req, b.businessId, demo ? {} : { write: true });
  } catch (e) {
    return authError(e) ?? handleError(e, 'siteaudit');
  }
  const rl = await rateLimit('siteaudit-run', `${b.businessId}:${getClientIp(req)}`, 30, HOUR_MS);
  if (!rl.ok) return jsonError(429, 'Trop d’analyses : réessayez dans une heure.', 'rate_limited', { 'Retry-After': String(rl.retryAfter) });
  try {
    const run = await runSiteAudit(b.businessId, b.url, { kind: b.kind, question: b.question, ai: demo ? false : b.ai, persist: !demo });
    return jsonOk(run);
  } catch (e) {
    return handleError(e, 'siteaudit');
  }
}

/** GET /api/siteaudit?businessId=… — historique des audits de page du commerce. */
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const id = BusinessId.safeParse(searchParams.get('businessId'));
  if (!id.success) return jsonError(400, 'Requête invalide.', 'bad_request');
  try {
    await requireBusiness(req, id.data);
  } catch (e) {
    return authError(e) ?? handleError(e, 'siteaudit');
  }
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
  try {
    return jsonOk({ runs: await listRuns(id.data, limit), demo: isDemoBusinessId(id.data) });
  } catch (e) {
    return handleError(e, 'siteaudit');
  }
}
