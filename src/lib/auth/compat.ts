/**
 * Compatibilité V2 : anciens helpers d'accès, désormais adossés à `requireBusiness`.
 *
 * src/lib/execution/auth.ts (hors périmètre COMPTES) doit devenir :
 *   export { bearer, canEditBusiness, BUSINESS_ID_RE } from '@/lib/auth/compat';
 * Ainsi les routes /api/exec/*, prompts, local… passent par la session cookie httpOnly, les rôles et la démo en lecture.
 */
import { BUSINESS_ID_RE, requireBusiness } from './access';
import { HttpError, type Role } from './roles';
import { bearerToken, getSession } from './session';

export { BUSINESS_ID_RE };

export function bearer(req: Request): string | null {
  return bearerToken(req);
}

export interface CanEditResult {
  ok: boolean;
  status?: number;
  demo?: boolean;
  role?: Role | 'demo';
  userId?: string;
}

/**
 * Même signature que la V2. `write: true` exige au moins le rôle contributeur (member) et refuse les comptes démo.
 * `minRole` permet d'exiger davantage (admin pour les réglages, owner pour la facturation).
 */
export async function canEditBusiness(req: Request, businessId: string, opts: { write?: boolean; minRole?: Role } = {}): Promise<CanEditResult> {
  try {
    const { role, session } = await requireBusiness(req, businessId, opts);
    return role === 'demo' ? { ok: true, demo: true, role } : { ok: true, role, userId: session?.userId };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, status: e.status, demo: e.code === 'demo_read_only' ? true : undefined };
    throw e;
  }
}

/** Identifiant de l'utilisateur de la requête (cookie ou Bearer), ou null. */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  return (await getSession(req))?.userId ?? null;
}
