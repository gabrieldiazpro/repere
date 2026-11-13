/**
 * GET  /api/local/nap?businessId=…  → { ok, data: { directories, audit, entries } }
 * POST /api/local/nap { businessId, entries: [{ directoryId, present?, url?, listed? }], verify? } → { ok, data: { audit } }
 *   Statuts : vérifié (page lue via safeFetch, robots.txt respecté), déclaré présent, absent, inconnu. Comptes démo :
 *   audit de démonstration, aucun appel réseau.
 */
import { buildLocalDemo, directoriesFor, parseNapEntries } from '@/lib/local';
import { errorResponse } from '@/lib/local/auth';
import { access, businessIdFrom, limit, ok, readJson } from '@/lib/local/http';
import { getLocalSettings, latestNap, saveLocalSettings, saveNap } from '@/lib/local/repo';
import { runNapFor } from '@/lib/local/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const businessId = businessIdFrom(new URL(req.url).searchParams.get('businessId'));
    const { business, demo } = await access(req, businessId, 'read');
    const directories = directoriesFor(business.trade, businessId);
    if (demo) {
      const d = await buildLocalDemo(businessId);
      return ok({ directories, audit: d?.nap ?? null, entries: [] }, { demo: true });
    }
    const [audit, settings] = await Promise.all([latestNap(businessId), getLocalSettings(businessId)]);
    return ok({ directories, audit, entries: settings.napEntries ?? [] });
  } catch (e) {
    return errorResponse(e, 'nap');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    const { business, demo } = await access(req, businessId, 'compute');
    if (demo) {
      const d = await buildLocalDemo(businessId);
      return ok({ audit: d?.nap ?? null, saved: false }, { demo: true });
    }
    const entries = parseNapEntries(body.entries, directoriesFor(business.trade, businessId));
    const verify = body.verify !== false;
    if (verify && entries.some((e) => e.url)) await limit(req, 'nap', businessId, 10);
    const audit = await runNapFor(business, entries, { verify });
    await saveLocalSettings(businessId, { napEntries: entries });
    await saveNap(audit);
    return ok({ audit, saved: true });
  } catch (e) {
    return errorResponse(e, 'nap');
  }
}
