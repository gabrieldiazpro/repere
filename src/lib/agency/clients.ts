/**
 * Accès client (V6) : l'agence invite son client sur l'espace de ce client. Le client :
 * - VOIT tout l'espace (rôle Lecteur, déjà existant : aucune écriture de réglage possible côté serveur) ;
 * - VALIDE ou REFUSE les propositions de l'agent (ChangeSets « proposé ») — rien d'autre. L'agence applique ensuite.
 *
 * Pas de nouveau rôle en base (contrainte `role in (owner, admin, member, viewer)`) : le client est un Lecteur marqué
 * « valideur » dans `agency.client_grants/<businessId>`, reconnu par son adresse e-mail (normalisée).
 * Droit `agency.clientPortal` (offre Agence) exigé à l'invitation ET à chaque validation.
 */
import { getDoc, putDoc } from '@/lib/store';
import { hasRole, type Role } from '@/lib/auth/roles';

export const CLIENT_GRANTS = 'agency.client_grants';

export interface ClientGrant {
  email: string;
  name?: string | null;
  invitedAt: string;
  invitedBy?: string | null;
  revokedAt?: string | null;
}

export interface ClientGrants {
  businessId: string;
  clients: ClientGrant[];
}

export const normEmail = (e: string) => e.trim().toLowerCase();

export async function getClientGrants(businessId: string): Promise<ClientGrants> {
  return (await getDoc<ClientGrants>(CLIENT_GRANTS, businessId))?.data ?? { businessId, clients: [] };
}

export function activeClients(g: ClientGrants): ClientGrant[] {
  return g.clients.filter((c) => !c.revokedAt);
}

export async function grantClient(businessId: string, email: string, by: string | null, name: string | null = null, now: Date = new Date()): Promise<ClientGrants> {
  const g = await getClientGrants(businessId);
  const e = normEmail(email);
  const rest = g.clients.filter((c) => c.email !== e);
  const next: ClientGrants = { businessId, clients: [...rest, { email: e, name: name?.slice(0, 80) || null, invitedAt: now.toISOString(), invitedBy: by, revokedAt: null }] };
  await putDoc<ClientGrants>(CLIENT_GRANTS, businessId, next, businessId);
  return next;
}

export async function revokeClient(businessId: string, email: string, now: Date = new Date()): Promise<boolean> {
  const g = await getClientGrants(businessId);
  const e = normEmail(email);
  let hit = false;
  const clients = g.clients.map((c) => {
    if (c.email !== e || c.revokedAt) return c;
    hit = true;
    return { ...c, revokedAt: now.toISOString() };
  });
  if (hit) await putDoc<ClientGrants>(CLIENT_GRANTS, businessId, { businessId, clients }, businessId);
  return hit;
}

export async function isClientApprover(businessId: string, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = normEmail(email);
  return activeClients(await getClientGrants(businessId)).some((c) => c.email === e);
}

export type ApprovalAction = 'validate' | 'reject';

/**
 * Qui peut valider ou refuser une proposition de l'agent (pur) :
 * - administrateur ou propriétaire (règle existante de src/app/api/v5/publish) ;
 * - client invité par l'agence (Lecteur marqué valideur), si l'offre comprend l'accès client.
 * Un contributeur ou un lecteur ordinaire : non.
 */
export function canApprove(role: Role | 'demo' | null, opts: { clientApprover: boolean; clientPortal: boolean }): boolean {
  if (!role || role === 'demo') return false;
  if (hasRole(role, 'admin')) return true;
  return role === 'viewer' && opts.clientApprover && opts.clientPortal;
}
