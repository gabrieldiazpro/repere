/**
 * Équipe d'un commerce : membres, rôles, invitations. Règles :
 * - owner/admin invitent ; un admin n'invite ni ne nomme d'admin ou de propriétaire (assignableRoles) ;
 * - on ne retire ni ne rétrograde le dernier propriétaire ;
 * - nombre de sièges borné par l'offre (getEntitlements(business).seats), invitations en attente comprises.
 */
import {
  addMembership,
  createInvitation,
  getMembership,
  listMembers,
  listPendingInvitations,
  removeMembership,
  updateBusiness,
  updateInvitation,
  type BusinessRecord,
  type InvitationRecord,
  type MembershipRecord,
} from '@/lib/db';
import { appUrl } from '@/lib/email';
import { getEntitlements } from '@/lib/entitlements';
import { randomToken, sha256 } from './cookies';
import { sendInvitationEmail } from './mail';
import { HttpError, ROLE_RANK, assignableRoles, hasRole, type Role } from './roles';
import type { Session } from './session';
import { isEmail, normEmail } from './users';

export const INVITE_TTL_DAYS = 14;

export interface TeamView {
  members: (Pick<MembershipRecord, 'userId' | 'email' | 'role' | 'createdAt'> & { you: boolean })[];
  invitations: Pick<InvitationRecord, 'id' | 'email' | 'role' | 'expiresAt' | 'createdAt'>[];
  seats: { used: number; max: number };
  canManage: boolean;
  assignable: Role[];
}

export async function teamView(business: BusinessRecord, me: { userId: string; role: Role }): Promise<TeamView> {
  const [members, invites] = await Promise.all([listMembers(business.id), listPendingInvitations(business.id)]);
  const max = getEntitlements(business).seats;
  return {
    members: members.map((m) => ({ userId: m.userId, email: m.email, role: m.role, createdAt: m.createdAt, you: m.userId === me.userId })),
    invitations: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt })),
    seats: { used: members.length + invites.length, max },
    canManage: hasRole(me.role, 'admin'),
    assignable: assignableRoles(me.role),
  };
}

export function invitationUrl(rawToken: string, email: string): string {
  const u = new URL('/connexion', appUrl());
  u.searchParams.set('invitation', rawToken);
  u.searchParams.set('email', email);
  return u.toString();
}

export async function inviteMember(
  business: BusinessRecord,
  by: { session: Session; role: Role },
  input: { email: unknown; role: unknown },
): Promise<{ invitation: InvitationRecord; url: string }> {
  if (!isEmail(input.email)) throw new HttpError(400, 'Adresse e-mail invalide.');
  const email = normEmail(input.email);
  const role = input.role as Role;
  if (!assignableRoles(by.role).includes(role) || role === 'owner') {
    throw new HttpError(403, 'Vous ne pouvez pas attribuer ce rôle.', 'role_required');
  }
  const [members, pending] = await Promise.all([listMembers(business.id), listPendingInvitations(business.id)]);
  if (members.some((m) => normEmail(m.email ?? '') === email)) throw new HttpError(409, 'Cette personne fait déjà partie de l’équipe.');
  const max = getEntitlements(business).seats;
  const again = pending.find((i) => i.email === email);
  if (!again && members.length + pending.length >= max) {
    throw new HttpError(402, `Votre offre comprend ${max} accès. Retirez un membre ou changez d’offre.`, 'seats_exceeded');
  }
  // Nouvelle invitation à la même adresse : l'ancienne est révoquée (un seul lien valide).
  if (again) await updateInvitation(again.id, { revokedAt: new Date().toISOString() });
  const raw = randomToken(32);
  const invitation = await createInvitation({
    businessId: business.id,
    email,
    role: role as Exclude<Role, 'owner'>,
    tokenHash: sha256(raw),
    invitedBy: by.session.userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  });
  const url = invitationUrl(raw, email);
  await sendInvitationEmail(email, {
    businessName: business.name,
    role,
    invitedByEmail: by.session.email,
    url,
    expiresAt: invitation.expiresAt,
  });
  return { invitation, url };
}

export async function revokeInvitation(businessId: string, invitationId: string): Promise<void> {
  const pending = await listPendingInvitations(businessId);
  if (!pending.some((i) => i.id === invitationId)) throw new HttpError(404, 'Invitation introuvable.');
  await updateInvitation(invitationId, { revokedAt: new Date().toISOString() });
}

async function owners(businessId: string): Promise<MembershipRecord[]> {
  return (await listMembers(businessId)).filter((m) => m.role === 'owner');
}

export async function changeRole(business: BusinessRecord, by: { userId: string; role: Role }, userId: string, role: unknown): Promise<void> {
  const target = await getMembership(business.id, userId);
  if (!target) throw new HttpError(404, 'Membre introuvable.');
  const next = role as Role;
  if (!assignableRoles(by.role).includes(next)) throw new HttpError(403, 'Vous ne pouvez pas attribuer ce rôle.', 'role_required');
  // Un admin ne modifie pas un membre de rang égal ou supérieur.
  if (by.role !== 'owner' && ROLE_RANK[target.role] >= ROLE_RANK[by.role]) throw new HttpError(403, 'Vous ne pouvez pas modifier ce membre.');
  if (target.role === 'owner' && next !== 'owner' && (await owners(business.id)).length <= 1) {
    throw new HttpError(409, 'Il faut au moins un propriétaire. Nommez-en un autre avant.', 'last_owner');
  }
  await addMembership(business.id, userId, next, target.email);
}

export async function removeMember(business: BusinessRecord, by: { userId: string; role: Role }, userId: string): Promise<void> {
  const target = await getMembership(business.id, userId);
  if (!target) throw new HttpError(404, 'Membre introuvable.');
  const self = userId === by.userId;
  if (!self) {
    if (!hasRole(by.role, 'admin')) throw new HttpError(403);
    if (by.role !== 'owner' && ROLE_RANK[target.role] >= ROLE_RANK[by.role]) throw new HttpError(403, 'Vous ne pouvez pas retirer ce membre.');
  }
  if (target.role === 'owner' && (await owners(business.id)).length <= 1) {
    throw new HttpError(409, 'Il faut au moins un propriétaire. Nommez-en un autre avant.', 'last_owner');
  }
  await removeMembership(business.id, userId);
  // Propriétaire historique (owner_id) : transféré, sinon requireBusiness lui rendrait l'accès.
  if (business.ownerId === userId) {
    const heir = (await owners(business.id))[0];
    await updateBusiness(business.id, { ownerId: heir?.userId ?? null });
  }
}
