/**
 * Liens de partage.
 * GET    /api/share?businessId=            → liens (jamais le jeton ni son hachage)
 * POST   /api/share { businessId, scope, auditId?, label?, expiresInDays?, password?, branding? } → { token, url, link } (jeton montré une fois)
 * DELETE /api/share?businessId=&id=        → révocation
 */
import { createShareLink, listShareLinks, revokeShareLink, type ShareScope } from '@/lib/share';
import { assertEntitled, getEntitlements, requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('share', async () => {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    const { business } = await requireBusiness(req, businessId);
    const e = getEntitlements(business);
    return jsonOk({ links: await listShareLinks(businessId), whiteLabel: e.whiteLabel, allowed: e.shareLinks });
  });
}

export async function POST(req: Request) {
  return handle('share', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    await limit(req, 'share', 60);
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    const e = getEntitlements(business);
    assertEntitled(e, 'shareLinks');
    const scope = body.scope === 'report' || body.scope === 'dashboard' ? (body.scope as ShareScope) : null;
    if (!scope) throw new HttpError(400, 'Portée invalide (report ou dashboard).');
    const res = await createShareLink({
      businessId,
      scope,
      auditId: typeof body.auditId === 'string' ? body.auditId : undefined,
      label: typeof body.label === 'string' ? body.label : undefined,
      expiresInDays: typeof body.expiresInDays === 'number' ? body.expiresInDays : undefined,
      password: typeof body.password === 'string' ? body.password : null,
      branding: body.branding && typeof body.branding === 'object' ? (body.branding as Record<string, unknown> as never) : null,
      whiteLabel: e.whiteLabel,
    });
    return jsonOk(res as unknown as Record<string, unknown>, 201);
  });
}

export async function DELETE(req: Request) {
  return handle('share', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    const id = u.searchParams.get('id') ?? '';
    if (!/^sh_[A-Za-z0-9_-]{6,30}$/.test(id)) throw new HttpError(400, 'Lien invalide.');
    await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
    if (!(await revokeShareLink(businessId, id))) throw new HttpError(404, 'Lien introuvable.');
    return jsonOk({ revoked: true });
  });
}
