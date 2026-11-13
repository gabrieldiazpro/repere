/** Aides communes des routes minces /api/v5/seodata/** et /api/v5/connect/google/** (agent SEO-DATA). */
import { HttpError, requireBusiness, toResponse, type Role } from '@/lib/auth';
import { SeoDataError } from '@/lib/seodata/http';
import { providersFor, contextFor, type ProviderSet, type SeoDataContext } from '@/lib/seodata/providers';

export const BUSINESS_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

export function errorResponse(e: unknown, where: string): Response {
  if (e instanceof SeoDataError) return json({ error: e.message, code: e.code }, e.httpStatus);
  return toResponse(e, where);
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 64 * 1024) throw new HttpError(413, 'Requête trop volumineuse.');
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'Corps JSON invalide.');
  }
}

export function businessIdOf(v: unknown): string {
  const id = typeof v === 'string' ? v : '';
  if (!BUSINESS_RE.test(id)) throw new HttpError(400, 'businessId invalide.');
  return id;
}

/** Contrôle d'accès (lecture : membre lecteur ; écriture : `minRole`), puis contexte et fournisseurs du compte. */
export async function access(req: Request, businessId: string, opts: { write?: boolean; minRole?: Role } = {}): Promise<{ ctx: SeoDataContext; p: ProviderSet }> {
  const { business } = await requireBusiness(req, businessId, opts);
  const ctx = await contextFor(businessId, business);
  return { ctx, p: await providersFor(ctx) };
}

export function stringList(v: unknown, max = 1000): string[] {
  if (!Array.isArray(v)) throw new HttpError(400, 'Liste attendue.');
  return v.filter((x): x is string => typeof x === 'string').slice(0, max);
}
