/** Outils communs des routes /api/v5/publish (minces : toute la logique est dans @/lib/publish). */
import { HttpError, requireBusiness, toResponse, type Role } from '@/lib/auth';
import { assertSameOrigin, json, limit } from '@/lib/auth/http';
import { PublishError, type Actor } from '@/lib/publish';

export { json, assertSameOrigin, limit };

export const CS_ID_RE = /^cs_[A-Za-z0-9_-]{6,30}$/;

export async function body(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'Requête invalide.');
  return b as Record<string, unknown>;
}

/** Accès + acteur (pour la validation et le journal). Lecture : viewer ; écriture : member ; publier : admin. */
export async function access(req: Request, businessId: unknown, opts: { write?: boolean; minRole?: Role } = {}): Promise<{ businessId: string; actor: Actor; demo: boolean }> {
  if (typeof businessId !== 'string') throw new HttpError(400, 'Espace inconnu.');
  const a = await requireBusiness(req, businessId, opts);
  const actor: Actor = a.session ? { id: a.session.userId, email: a.session.email, role: String(a.role) } : { id: a.role === 'demo' ? 'demo' : 'sandbox-owner', role: String(a.role) };
  return { businessId, actor, demo: a.role === 'demo' };
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PublishError) return toResponse(new HttpError(e.status, e.message, e.code), 'publish');
    return toResponse(e, 'publish');
  }
}

export const strArr = (v: unknown, max = 200): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : undefined);
