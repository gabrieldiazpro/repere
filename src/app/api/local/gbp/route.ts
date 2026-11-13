/**
 * GET  /api/local/gbp?businessId=…  → { ok, data: { audit, history, settings, policy }, demo? }
 * POST /api/local/gbp { businessId, placeId?, manual? } → { ok, data: { audit, warning? } }
 *   Source : API Places si GOOGLE_PLACES_KEY et placeId, sinon saisie guidée. Contenu Google jamais stocké
 *   (place_id + nos scores seulement). Comptes démo : calcul sans enregistrement.
 */
import { buildLocalDemo, DEMO_MANUAL, PLACE_ID_RE, PLACES_POLICY, placesEnabled } from '@/lib/local';
import { errorResponse } from '@/lib/local/auth';
import { access, businessIdFrom, limit, ok, readJson } from '@/lib/local/http';
import { gbpHistory, getLocalSettings, latestGbpAudit, saveGbpAudit, saveLocalSettings } from '@/lib/local/repo';
import { runGbpAudit } from '@/lib/local/service';
import type { ManualGbpInput } from '@/lib/local/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const policy = { placesEnabled: placesEnabled(), storable: PLACES_POLICY.storable, weStore: PLACES_POLICY.weStore, limits: PLACES_POLICY.limits, checkedAt: PLACES_POLICY.checkedAt };

export async function GET(req: Request) {
  try {
    const businessId = businessIdFrom(new URL(req.url).searchParams.get('businessId'));
    const { demo } = await access(req, businessId, 'read');
    if (demo) {
      const d = await buildLocalDemo(businessId);
      return ok({ audit: d?.gbp ?? null, history: [], settings: null, policy }, { demo: true });
    }
    const [audit, history, settings] = await Promise.all([latestGbpAudit(businessId), gbpHistory(businessId), getLocalSettings(businessId)]);
    return ok({ audit, history, settings: { placeId: settings.placeId ?? null, manual: settings.manual ?? null }, policy });
  } catch (e) {
    return errorResponse(e, 'gbp');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    const { business, demo } = await access(req, businessId, 'compute');
    const manual = body.manual && typeof body.manual === 'object' && !Array.isArray(body.manual) ? (body.manual as ManualGbpInput) : undefined;
    const placeId = typeof body.placeId === 'string' && PLACE_ID_RE.test(body.placeId.trim()) ? body.placeId.trim() : undefined;
    if (demo) {
      const { audit, warning } = await runGbpAudit(business, { manual: manual ?? DEMO_MANUAL });
      return ok({ audit: { ...audit, demo: true }, ...(warning ? { warning } : {}), saved: false }, { demo: true });
    }
    if (placeId && placesEnabled()) await limit(req, 'gbp', businessId, 20);
    const { audit, warning } = await runGbpAudit(business, { placeId, manual });
    await saveLocalSettings(businessId, { ...(placeId ? { placeId } : {}), ...(manual ? { manual } : {}) });
    await saveGbpAudit(audit);
    // Réponse : l'audit complet (affichage immédiat) ; le stockage n'en garde que la version sans contenu Google.
    return ok({ audit, ...(warning ? { warning } : {}), saved: true });
  } catch (e) {
    return errorResponse(e, 'gbp');
  }
}
