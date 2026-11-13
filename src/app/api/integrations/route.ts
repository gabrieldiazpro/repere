/**
 * Intégrations (Slack, webhook signé), droit `integrations`.
 * GET    /api/integrations?businessId=            → { targets, events, deliveries }
 * POST   /api/integrations { businessId, kind: 'slack'|'webhook', url, label?, events? } → { target, secret? } (secret montré une fois)
 * PATCH  /api/integrations { businessId, id, active?, events?, label? }
 * DELETE /api/integrations?businessId=&id=
 */
import { EVENTS, EVENT_LABELS, addTarget, listDeliveries, listTargets, removeTarget, updateTarget } from '@/lib/integrations';
import { assertEntitled, getEntitlements, requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_RE = /^int_[A-Za-z0-9_-]{6,20}$/;

export async function GET(req: Request) {
  return handle('integrations', async () => {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    const { business } = await requireBusiness(req, businessId, { minRole: 'admin' });
    return jsonOk({
      targets: await listTargets(businessId),
      events: EVENTS.map((e) => ({ id: e, label: EVENT_LABELS[e] })),
      deliveries: (await listDeliveries(businessId, 20)).map(({ businessId: _b, ...d }) => d),
      allowed: getEntitlements(business).integrations,
    });
  });
}

export async function POST(req: Request) {
  return handle('integrations', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    await limit(req, 'integrations', 30);
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    assertEntitled(getEntitlements(business), 'integrations');
    if (body.kind !== 'slack' && body.kind !== 'webhook') throw new HttpError(400, 'Type invalide (slack ou webhook).');
    if (typeof body.url !== 'string') throw new HttpError(400, 'Adresse manquante.');
    const res = await addTarget(businessId, {
      kind: body.kind,
      url: body.url,
      label: typeof body.label === 'string' ? body.label : undefined,
      events: Array.isArray(body.events) ? body.events.filter((x): x is string => typeof x === 'string') : undefined,
    });
    return jsonOk(res as unknown as Record<string, unknown>, 201);
  });
}

export async function PATCH(req: Request) {
  return handle('integrations', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    const id = typeof body.id === 'string' && ID_RE.test(body.id) ? body.id : '';
    if (!id) throw new HttpError(400, 'Intégration invalide.');
    await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    const t = await updateTarget(businessId, id, {
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      ...(Array.isArray(body.events) ? { events: body.events.filter((x): x is string => typeof x === 'string') } : {}),
      ...(typeof body.label === 'string' ? { label: body.label } : {}),
    });
    if (!t) throw new HttpError(404, 'Intégration introuvable.');
    return jsonOk({ target: t });
  });
}

export async function DELETE(req: Request) {
  return handle('integrations', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    const id = u.searchParams.get('id') ?? '';
    if (!ID_RE.test(id)) throw new HttpError(400, 'Intégration invalide.');
    await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    if (!(await removeTarget(businessId, id))) throw new HttpError(404, 'Intégration introuvable.');
    return jsonOk({ removed: true });
  });
}
