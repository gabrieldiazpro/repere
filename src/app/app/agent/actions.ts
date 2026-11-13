'use server';
// Réglages de l'agent (administrateur ou propriétaire). Comptes démo : refusé côté serveur (simulation côté interface).
import { HttpError, requireBusiness } from '@/lib/auth';
import { putDoc } from '@/lib/store';
import { sanitizeSettings, type AgentSettings } from '@/components/app/agent/model';
import { SETTINGS_COLLECTION } from '@/components/app/agent/server';

export async function saveAgentSettings(businessId: string, input: unknown): Promise<{ ok: true; settings: AgentSettings } | { ok: false; error: string }> {
  try {
    const a = await requireBusiness(null, businessId, { write: true, minRole: 'admin' });
    const settings: AgentSettings = { ...sanitizeSettings(input), updatedAt: new Date().toISOString(), updatedBy: a.session?.email ?? a.session?.userId ?? 'owner' };
    await putDoc<AgentSettings>(SETTINGS_COLLECTION, businessId, settings, businessId);
    return { ok: true, settings };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.status === 403 ? (e.message || 'Votre rôle ne permet pas de modifier ces réglages.') : e.message || 'Enregistrement impossible.' };
    return { ok: false, error: 'Enregistrement impossible. Réessayez dans un instant.' };
  }
}
