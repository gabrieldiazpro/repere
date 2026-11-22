'use server';
// Réglages › API (V8) : création et révocation des clés. Propriétaire ou administrateur de l'espace ; offres
// Accompagné et Agence. Comptes démo : refusé côté serveur (la clé de démonstration publique suffit).
import { revalidatePath } from 'next/cache';
import { HttpError, requireBusiness, requireSession } from '@/lib/auth';
import { getEntitlements } from '@/lib/entitlements';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { agencyContextFor } from '@/lib/agency/load';
import { loadWorkspace } from '@/components/app/workspace';
import { apiAllowed, PLAN_REQUIRED_MESSAGE } from '@/lib/publicapi/access';
import { ApiError } from '@/lib/publicapi/errors';
import { createApiKey, revokeApiKey, type ApiKeyView, type KeyAccess, type KeyScope } from '@/lib/publicapi/keys';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DEMO = 'Compte de démonstration : aucune clé n’est créée. Utilisez la clé de démonstration en lecture seule affichée sur cette page.';

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof HttpError) return { ok: false, error: e.code === 'demo_read_only' ? DEMO : e.status === 401 ? 'Connectez-vous pour continuer.' : e.status === 403 ? 'Seuls le propriétaire et les administrateurs gèrent les clés d’API.' : e.message };
  if (e instanceof ApiError) return { ok: false, error: e.message };
  console.error('[reglages/api]', e);
  return { ok: false, error: 'Action impossible. Réessayez dans un instant.' };
}

/** Portée demandée → portée vérifiée (rôle, offre). */
async function resolveScope(target: 'space' | 'agency', requirePlan = true): Promise<{ scope: KeyScope; userId: string; email: string | null }> {
  const ws = await loadWorkspace();
  if (ws.demo || isDemoBusinessId(ws.business.id)) throw new HttpError(403, DEMO, 'demo_read_only');
  const session = await requireSession();
  if (target === 'agency') {
    const ctx = await agencyContextFor(session);
    if (!ctx && requirePlan) throw new HttpError(402, 'Les clés d’agence sont réservées à l’offre Agence.', 'upgrade_required');
    return { scope: { kind: 'agency', userId: session.userId }, userId: session.userId, email: session.email ?? null };
  }
  const { business } = await requireBusiness(null, ws.business.id, { minRole: 'admin', session });
  if (requirePlan && !apiAllowed(getEntitlements(business))) throw new HttpError(402, PLAN_REQUIRED_MESSAGE, 'upgrade_required');
  return { scope: { kind: 'space', businessId: business.id }, userId: session.userId, email: session.email ?? null };
}

export async function createKeyAction(input: { target: 'space' | 'agency'; access: KeyAccess; label?: string }): Promise<Result<{ key: ApiKeyView; token: string }>> {
  try {
    const target = input.target === 'agency' ? 'agency' : 'space';
    const access: KeyAccess = input.access === 'write' ? 'write' : 'read';
    const { scope, userId, email } = await resolveScope(target);
    const r = await createApiKey({ scope, access, label: input.label, createdBy: { userId, email } });
    revalidatePath('/app/reglages/api');
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeKeyAction(input: { target: 'space' | 'agency'; id: string }): Promise<Result<{ id: string }>> {
  try {
    const { scope, email, userId } = await resolveScope(input.target === 'agency' ? 'agency' : 'space', false);
    const ok = await revokeApiKey(scope, String(input.id ?? ''), email || userId);
    if (!ok) return { ok: false, error: 'Clé introuvable.' };
    revalidatePath('/app/reglages/api');
    return { ok: true, data: { id: input.id } };
  } catch (e) {
    return fail(e);
  }
}
