/**
 * GET  /api/local/map?businessId=…  → { ok, data: { map, caps, plan } } (dernière carte + plafonds de l'offre)
 * POST /api/local/map { businessId, questions?, zones?, providers?, district? } → { ok, data: { map } }
 *   SIMULATION par zone (quartier injecté dans la question), budget plafonné par l'offre. Comptes démo : carte de
 *   démonstration déterministe, aucun appel aux IA.
 */
import { getEntitlements } from '@/lib/entitlements';
import { buildLocalDemo, localTier, MAP_CAPS, planMap } from '@/lib/local';
import { errorResponse } from '@/lib/local/auth';
import { access, businessIdFrom, limit, ok, readJson } from '@/lib/local/http';
import { latestMap, mapsThisMonth, saveMap } from '@/lib/local/repo';
import { runMapFor } from '@/lib/local/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const businessId = businessIdFrom(new URL(req.url).searchParams.get('businessId'));
    const { business, demo } = await access(req, businessId, 'read');
    const tier = localTier(business);
    const plan = planMap({ city: business.city, district: business.district, trade: business.trade }, tier, { engines: getEntitlements(business).engines });
    const preview = { zones: plan.zones.map((z) => ({ id: z.id, label: z.label, home: !!z.home })), questions: plan.questions, providers: plan.providers, budget: plan.budget };
    if (demo) {
      const d = await buildLocalDemo(businessId);
      return ok({ map: d?.map ?? null, caps: MAP_CAPS[tier], usedThisMonth: 0, plan: preview }, { demo: true });
    }
    const [map, used] = await Promise.all([latestMap(businessId), mapsThisMonth(businessId)]);
    return ok({ map, caps: MAP_CAPS[tier], usedThisMonth: used, plan: preview });
  } catch (e) {
    return errorResponse(e, 'map');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    const { business, demo } = await access(req, businessId, 'compute');
    if (demo) {
      const d = await buildLocalDemo(businessId);
      return ok({ map: d?.map ?? null, saved: false }, { demo: true });
    }
    await limit(req, 'map', businessId, 5);
    const map = await runMapFor(business, {
      questions: body.questions,
      zones: typeof body.zones === 'number' ? body.zones : undefined,
      providers: Array.isArray(body.providers) ? body.providers.filter((p): p is string => typeof p === 'string') : undefined,
      district: typeof body.district === 'string' ? body.district : undefined,
    }, { signal: AbortSignal.timeout(280_000) });
    await saveMap(map);
    return ok({ map, saved: true });
  } catch (e) {
    return errorResponse(e, 'map');
  }
}
