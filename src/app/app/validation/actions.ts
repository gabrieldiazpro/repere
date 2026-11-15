'use server';
// Validation des propositions de l'agent par le CLIENT invité par son agence (V6), ou par un administrateur.
// Seules actions possibles : valider, refuser. L'application chez le client reste à l'agence (admin).
import { revalidatePath } from 'next/cache';
import { HttpError, requireBusiness } from '@/lib/auth';
import { getEntitlements } from '@/lib/entitlements';
import { canApprove, isClientApprover } from '@/lib/agency/clients';
import { PublishError, rejectChangeSet, validateChangeSet } from '@/lib/publish';

export async function decideProposal(
  businessId: string,
  changeSetId: string,
  decision: 'validate' | 'reject',
  note?: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  try {
    if (!/^cs_[A-Za-z0-9_-]{4,40}$/.test(changeSetId)) throw new HttpError(400, 'Proposition inconnue.');
    // Lecture d'abord (un lecteur passe), puis la règle de validation propre à l'accès client.
    const a = await requireBusiness(null, businessId, { minRole: 'viewer' });
    if (a.role === 'demo') throw new HttpError(403, 'Compte de démonstration : rien n’est enregistré.', 'demo_read_only');
    const ent = getEntitlements(a.business);
    const approver = await isClientApprover(businessId, a.session?.email);
    if (!canApprove(a.role, { clientApprover: approver, clientPortal: ent.agency.clientPortal })) {
      throw new HttpError(403, 'Votre accès permet de consulter ces propositions, pas de les valider.', 'role_required');
    }
    const actor = { id: a.session?.userId ?? 'owner', email: a.session?.email, role: approver && a.role === 'viewer' ? 'client' : a.role };
    const text = typeof note === 'string' ? note.slice(0, 300) : undefined;
    const cs = decision === 'validate' ? await validateChangeSet(businessId, changeSetId, actor, { note: text }) : await rejectChangeSet(businessId, changeSetId, actor, text);
    revalidatePath('/app/validation');
    return { ok: true, status: cs.status };
  } catch (e) {
    if (e instanceof HttpError || e instanceof PublishError) return { ok: false, error: e.message };
    console.error('[validation]', e);
    return { ok: false, error: 'Enregistrement impossible. Réessayez dans un instant.' };
  }
}
