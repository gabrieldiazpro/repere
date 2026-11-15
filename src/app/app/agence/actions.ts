'use server';
// Actions de l'agence (V6) : marque, domaine d'envoi, accès client. Comptes démo : refusé côté serveur.
import { revalidatePath } from 'next/cache';
import { HttpError, requireBusiness, requireSession } from '@/lib/auth';
import { inviteMember } from '@/lib/auth/team';
import { assertAgency, getEntitlements } from '@/lib/entitlements';
import { agencyContextFor } from '@/lib/agency/load';
import { AgencyError, getAgencyProfile, putSenderDomain, saveAgencyProfile, type AgencyProfile, type ProfileInput } from '@/lib/agency/profile';
import { checkDomain, registerDomain, resendDomainApi } from '@/lib/agency/sender';
import { grantClient, revokeClient } from '@/lib/agency/clients';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DEMO = 'Compte de démonstration : rien n’est enregistré. Sur votre compte Agence, cette action fonctionne telle quelle.';

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof HttpError) return { ok: false, error: e.code === 'demo_read_only' ? DEMO : e.status === 401 ? 'Connectez-vous pour continuer.' : e.message };
  if (e instanceof AgencyError) return { ok: false, error: e.message };
  if (e instanceof Error && /Domaine invalide/.test(e.message)) return { ok: false, error: e.message };
  console.error('[agence]', e);
  return { ok: false, error: 'Enregistrement impossible. Réessayez dans un instant.' };
}

async function agencyOf() {
  const session = await requireSession().catch(() => null);
  if (!session) throw new HttpError(403, DEMO, 'demo_read_only');
  const ctx = await agencyContextFor(session);
  if (!ctx) throw new HttpError(402, 'Ces réglages sont réservés à l’offre Agence.', 'upgrade_required');
  return { session, ctx };
}

export async function saveBrandAction(input: ProfileInput): Promise<Result<AgencyProfile>> {
  try {
    const { session, ctx } = await agencyOf();
    const p = await saveAgencyProfile(ctx.agencyId, input, session.email || session.userId);
    revalidatePath('/app', 'layout');
    return { ok: true, data: p };
  } catch (e) {
    return fail(e);
  }
}

export async function registerDomainAction(input: { domain: string; localPart?: string }): Promise<Result<AgencyProfile>> {
  try {
    const { ctx } = await agencyOf();
    const prev = await getAgencyProfile(ctx.agencyId);
    if (!prev) throw new AgencyError(409, 'Enregistrez d’abord le nom de votre agence.');
    const d = await registerDomain(input, prev.senderDomain ?? null, await resendDomainApi());
    return { ok: true, data: await putSenderDomain(ctx.agencyId, d) };
  } catch (e) {
    return fail(e);
  }
}

export async function checkDomainAction(): Promise<Result<AgencyProfile>> {
  try {
    const { ctx } = await agencyOf();
    const prev = await getAgencyProfile(ctx.agencyId);
    if (!prev?.senderDomain) throw new AgencyError(409, 'Indiquez d’abord votre domaine d’envoi.');
    const d = await checkDomain(prev.senderDomain, await resendDomainApi());
    return { ok: true, data: await putSenderDomain(ctx.agencyId, d) };
  } catch (e) {
    return fail(e);
  }
}

export async function removeDomainAction(): Promise<Result<AgencyProfile>> {
  try {
    const { ctx } = await agencyOf();
    return { ok: true, data: await putSenderDomain(ctx.agencyId, null) };
  } catch (e) {
    return fail(e);
  }
}

/** Invite le client sur SON espace : rôle Lecteur + droit de valider les propositions de l'agent. */
export async function inviteClientAction(businessId: string, input: { email: string; name?: string }): Promise<Result<{ email: string }>> {
  try {
    const a = await requireBusiness(null, businessId, { write: true, minRole: 'admin' });
    assertAgency(getEntitlements(a.business), 'clientPortal');
    if (!a.session || a.role === 'demo') throw new HttpError(403, DEMO, 'demo_read_only');
    const { invitation } = await inviteMember(a.business, { session: a.session, role: a.role }, { email: input.email, role: 'viewer' });
    await grantClient(businessId, invitation.email, a.session.email || a.session.userId, input.name ?? null);
    revalidatePath('/app/agence');
    return { ok: true, data: { email: invitation.email } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeClientAction(businessId: string, email: string): Promise<Result<{ revoked: boolean }>> {
  try {
    await requireBusiness(null, businessId, { write: true, minRole: 'admin' });
    const revoked = await revokeClient(businessId, email);
    revalidatePath('/app/agence');
    return { ok: true, data: { revoked } };
  } catch (e) {
    return fail(e);
  }
}
