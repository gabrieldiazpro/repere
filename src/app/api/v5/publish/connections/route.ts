/**
 * Connexions de publication (secrets chiffrés, jamais renvoyés).
 * GET    /api/v5/publish/connections?businessId=                     → { connections, platforms }
 * POST   /api/v5/publish/connections { businessId, platform, config, credentials }  (admin) → { connection, test }
 * DELETE /api/v5/publish/connections?businessId=&platform=           (admin)
 */
import { HttpError } from '@/lib/auth';
import { PLATFORM_LABEL, PLATFORMS, connectPlatform, disconnectPlatform, isPlatform, listConnectionViews } from '@/lib/publish';
import { gbpEnabled } from '@/lib/publish/connectors/gbp';
import { access, assertSameOrigin, body, handle, json, limit } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const strMap = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === 'string').slice(0, 10).map(([k, x]) => [k.slice(0, 40), (x as string).slice(0, 500)]))
    : {};

export async function GET(req: Request) {
  return handle(async () => {
    const { businessId } = await access(req, new URL(req.url).searchParams.get('businessId'));
    return json({
      connections: await listConnectionViews(businessId),
      platforms: PLATFORMS.filter((p) => p !== 'gbp' || gbpEnabled()).map((p) => ({ id: p, label: PLATFORM_LABEL[p] })),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const b = await body(req);
    await limit(req, 'publish-connect', 30);
    const { businessId, actor } = await access(req, b.businessId, { write: true, minRole: 'admin' });
    if (!isPlatform(b.platform)) throw new HttpError(400, 'Plateforme inconnue.');
    const r = await connectPlatform(businessId, b.platform, { config: strMap(b.config), credentials: strMap(b.credentials) }, actor);
    return json(r, { status: 201 });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const u = new URL(req.url);
    const { businessId, actor } = await access(req, u.searchParams.get('businessId'), { write: true, minRole: 'admin' });
    const platform = u.searchParams.get('platform');
    if (!isPlatform(platform)) throw new HttpError(400, 'Plateforme inconnue.');
    if (!(await disconnectPlatform(businessId, platform, actor))) throw new HttpError(404, 'Connexion introuvable.');
    return json({ removed: true });
  });
}
