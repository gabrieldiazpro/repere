/** POST /api/v5/publish/connections/test { businessId, platform } (admin) → { test } — droits réels, extension SEO, capacités. */
import { HttpError } from '@/lib/auth';
import { isPlatform, testPlatform } from '@/lib/publish';
import { access, assertSameOrigin, body, handle, json, limit } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const b = await body(req);
    await limit(req, 'publish-test', 60);
    const { businessId, actor } = await access(req, b.businessId, { write: true, minRole: 'admin' });
    if (!isPlatform(b.platform) || b.platform === 'export') throw new HttpError(400, 'Plateforme inconnue.');
    return json({ test: await testPlatform(businessId, b.platform, actor) });
  });
}
