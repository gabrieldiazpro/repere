/**
 * Pilote automatique — gestes du client : annuler une série (retour à la valeur d'avant, à l'identique), bloquer un
 * contenu en relecture, mettre le pilote en pause. Depuis l'app (session) ou depuis un lien signé d'e-mail.
 */
import type { Actor } from '@/lib/publish/types';
import { AutopilotError, appendAutopilotJournal, getState, pauseMandate, saveState, withAutopilotLock } from './store';

export async function undoSeries(businessId: string, csId: string, who: Actor, now = new Date()): Promise<{ status: string }> {
  return withAutopilotLock(`state:${businessId}`, async () => {
    const state = await getState(businessId);
    const rec = state.series.find((s) => s.csId === csId);
    if (!rec) throw new AutopilotError(404, 'Série introuvable dans le pilote.', 'not_found');
    if (rec.status === 'undone') return { status: 'already' };
    const { revertChangeSet } = await import('@/lib/publish/service');
    const cs = await revertChangeSet(businessId, csId, who, { now });
    rec.status = cs.status === 'reverted' ? 'undone' : rec.status;
    if (rec.status === 'undone') rec.undoneAt = now.toISOString();
    await saveState(state, now);
    await appendAutopilotJournal(businessId, who, 'series.undone', { ref: csId, detail: cs.status === 'reverted' ? `${rec.title} : valeurs d’avant remises` : `${rec.title} : annulation partielle (statut ${cs.status})` }, now);
    if (cs.status !== 'reverted') throw new AutopilotError(409, 'Une partie n’a pas pu être annulée (modifiée depuis sur le site). Le détail est dans l’agent.', 'partial');
    return { status: 'undone' };
  });
}

export async function blockContent(businessId: string, draftId: string, who: Actor, now = new Date()): Promise<{ status: string }> {
  return withAutopilotLock(`state:${businessId}`, async () => {
    const state = await getState(businessId);
    const c = state.contents.find((x) => x.draftId === draftId);
    if (!c) throw new AutopilotError(404, 'Contenu introuvable dans le pilote.', 'not_found');
    if (c.status === 'blocked') return { status: 'already' };
    if (c.status !== 'scheduled') throw new AutopilotError(409, c.status === 'published' ? 'Ce contenu est déjà en ligne : retirez-le depuis Contenus (un clic).' : 'Ce contenu n’est plus programmé.', 'bad_state');
    c.status = 'blocked';
    c.blockedAt = now.toISOString();
    await saveState(state, now);
    await appendAutopilotJournal(businessId, who, 'content.blocked', { ref: draftId, detail: `${c.title} : mise en ligne annulée ; le brouillon reste chez vous, non visible du public` }, now);
    return { status: 'blocked' };
  });
}

export async function pauseFromLink(businessId: string, who: Actor, now = new Date()) {
  return pauseMandate(businessId, who, { reason: 'client', detail: 'Pause demandée depuis un e-mail' }, now);
}
