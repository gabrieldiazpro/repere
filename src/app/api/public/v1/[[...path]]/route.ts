/**
 * API publique v1 — point d'entrée unique. Toute la logique (routes, droits, pagination, erreurs, OpenAPI) vit dans
 * src/lib/publicapi ; référence : /developpeurs et GET /api/public/v1/openapi.json.
 */
import { handlePublicApi } from '@/lib/publicapi/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  return handlePublicApi(req, ['v1', ...(path ?? [])]);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PUT = handle;
export const PATCH = handle;
export const OPTIONS = handle;
