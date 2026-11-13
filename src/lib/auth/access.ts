/**
 * Contrôle d'accès unique aux commerces (contrat docs/v3/12-CONTRATS-V3.md) :
 * - comptes démo (`demo`, `demo-pme`, `demo-ecom`) : lisibles sans session, jamais modifiables (403 demo_read_only) ;
 * - sinon : session (cookie httpOnly ou Bearer) + adhésion (`memberships`) avec un rôle suffisant ;
 * - production sans fournisseur de comptes : 503, jamais d'accès ouvert (A12) ;
 * - bac à sable local (hors production, sans Supabase) : un commerce sans aucun membre reste ouvert, comme en V2.
 */
import { addMembership, getBusinessRecord, getMembership, listMembers, type BusinessRecord } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { isHouseBusinessId } from '@/lib/house';
import { authMode, sandboxOpen } from './config';
import { HttpError, hasRole, type Role } from './roles';
import { getSession, type Session } from './session';

export const BUSINESS_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export interface RequireOptions {
  /** rôle minimum (défaut : viewer, ou member si `write`) */
  minRole?: Role;
  /** opération d'écriture : refusée sur les comptes démo et pour les lecteurs */
  write?: boolean;
  /** session déjà lue (évite une seconde vérification) */
  session?: Session | null;
}

export interface BusinessAccess {
  business: BusinessRecord;
  role: Role | 'demo';
  session: Session | null;
}

export async function requireBusiness(req: Request | null | undefined, businessId: string, opts: RequireOptions = {}): Promise<BusinessAccess> {
  if (typeof businessId !== 'string' || !BUSINESS_ID_RE.test(businessId)) throw new HttpError(400, 'Espace inconnu.');
  if (isDemoBusinessId(businessId)) {
    if (opts.write || (opts.minRole && opts.minRole !== 'viewer')) {
      throw new HttpError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.', 'demo_read_only');
    }
    const business = await getBusinessRecord(businessId);
    if (!business) throw new HttpError(404);
    return { business, role: 'demo', session: null };
  }
  // Compte maison (dogfooding) : jamais modifiable par une route publique.
  if (isHouseBusinessId(businessId)) throw new HttpError(403);
  if (authMode() === 'off') throw new HttpError(503, 'Connexion indisponible : configuration incomplète.', 'auth_unavailable');

  const business = await getBusinessRecord(businessId);
  if (!business) throw new HttpError(404, 'Espace introuvable.');

  const minRole: Role = opts.minRole ?? (opts.write ? 'member' : 'viewer');
  const session = opts.session !== undefined ? opts.session : await getSession(req ?? undefined);

  if (!session) {
    if (sandboxOpen() && !business.ownerId && (await listMembers(business.id)).length === 0) {
      return { business, role: 'owner', session: null };
    }
    throw new HttpError(401);
  }

  let role: Role | null = (await getMembership(business.id, session.userId))?.role ?? null;
  if (!role && business.ownerId === session.userId) {
    // Propriétaire historique (V2, colonne owner_id) : adhésion créée à la volée.
    role = 'owner';
    await addMembership(business.id, session.userId, 'owner', session.email).catch(() => undefined);
  }
  if (!role) throw new HttpError(403);
  if (!hasRole(role, minRole)) throw new HttpError(403, 'Votre rôle ne permet pas cette action.', 'role_required');
  return { business, role, session };
}

/** Session obligatoire (routes de compte). */
export async function requireSession(req?: Request): Promise<Session> {
  if (authMode() === 'off') throw new HttpError(503, 'Connexion indisponible : configuration incomplète.', 'auth_unavailable');
  const s = await getSession(req);
  if (!s) throw new HttpError(401);
  return s;
}
