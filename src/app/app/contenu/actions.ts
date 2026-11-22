'use server';
// Actions de l'agent de contenu. Rôles : rédiger / modifier / faits clés = membre ; valider, envoyer sur le site,
// mettre en ligne, retirer, exporter = administrateur ou propriétaire. Comptes démo : refusé côté serveur (la
// simulation se fait dans le navigateur), sauf l'aperçu des contrôles après une modification (aucune écriture).
import { HttpError, requireBusiness } from '@/lib/auth';
import { finalizeDraft, ContentError, type Actor, type ContentDraft, type ContentSettings, type MentionStatus, type MentionTracking, type StoredFacts } from '@/lib/content';
import * as svc from '@/lib/content/service';
import { safeFetch } from '@/lib/siteaudit/fetch';
import { parseHtml } from '@/lib/siteaudit/html';
import { htmlBlocksToMarkdown } from '@/lib/content/markdown';
import { PublishError } from '@/lib/publish/types';
import { loadContentContext } from '@/components/app/contenu/server';

type Res<T> = ({ ok: true } & T) | { ok: false; error: string };

async function actorFor(businessId: string, minRole: 'member' | 'admin'): Promise<Actor> {
  const a = await requireBusiness(null, businessId, { write: true, minRole });
  return { id: a.session?.userId ?? 'owner', email: a.session?.email ?? undefined, role: a.role };
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof ContentError || e instanceof PublishError) return { ok: false, error: e.message };
  if (e instanceof HttpError) return { ok: false, error: e.status === 403 ? e.message || 'Votre rôle ne permet pas cette action.' : e.message || 'Action impossible.' };
  return { ok: false, error: 'Action impossible pour le moment. Réessayez dans un instant.' };
}

async function ctxFor(businessId: string) {
  const c = await loadContentContext();
  if (c.data.businessId !== businessId) throw new ContentError(403, 'Espace différent de celui affiché : rechargez la page.');
  return c;
}

/** Texte actuel d'une page (réécriture) : intertitres et paragraphes du contenu principal. */
async function existingText(url: string): Promise<{ url: string; title?: string; text: string } | undefined> {
  try {
    const r = await safeFetch(url, { timeoutMs: 10_000, cache: false });
    if (r.status !== 200 || !/html/i.test(r.contentType)) return undefined;
    const p = parseHtml(r.body);
    const text = htmlBlocksToMarkdown(p.blocks);
    return text ? { url, title: p.title || undefined, text } : undefined;
  } catch {
    return undefined;
  }
}

export async function createDraftAction(businessId: string, opId: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    const c = await ctxFor(businessId);
    if (c.data.demo) {
      // Démo : brouillon rédigé par le modèle structuré avec les faits de démo, renvoyé sans être enregistré.
      const op = c.data.opportunities.find((o) => o.id === opId);
      if (!op) throw new ContentError(404, 'Proposition introuvable.');
      const { buildDraft } = await import('@/lib/content');
      return { ok: true, draft: await buildDraft(op, { ...c.draftCtx, businessId, now: new Date(), writer: null, demo: true, id: `ct_demo_new_${op.id.slice(3)}` }) };
    }
    const actor = await actorFor(businessId, 'member');
    const op = c.data.opportunities.find((o) => o.id === opId);
    if (!op) throw new ContentError(404, 'Cette proposition n’est plus d’actualité : rechargez la page.');
    const existing = op.action === 'rewrite' && op.existingUrl ? await existingText(op.existingUrl) : undefined;
    const draft = await svc.createDraft(businessId, op, { ...c.draftCtx, existing, now: new Date(), writer: (await import('@/lib/content')).defaultContentWriter() }, actor);
    return { ok: true, draft };
  } catch (e) {
    return fail(e);
  }
}

export interface EditInput {
  title?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  body?: string;
}

/** Démo : recalcul des contrôles après modification, sans rien enregistrer. */
export async function previewDraftAction(draft: ContentDraft, edit: EditInput): Promise<Res<{ draft: ContentDraft }>> {
  try {
    const c = await loadContentContext();
    if (!c.data.demo || draft.businessId !== c.data.businessId) throw new ContentError(403, 'Aperçu réservé à la démo.');
    const next: ContentDraft = {
      ...draft,
      ...(edit.title !== undefined ? { title: String(edit.title).slice(0, 140) } : {}),
      ...(edit.metaTitle !== undefined ? { metaTitle: String(edit.metaTitle).slice(0, 80) } : {}),
      ...(edit.metaDescription !== undefined ? { metaDescription: String(edit.metaDescription).slice(0, 200) } : {}),
      ...(edit.body !== undefined ? { body: String(edit.body).slice(0, 60_000) } : {}),
      status: draft.status === 'validated' ? 'draft' : draft.status,
      validation: draft.status === 'validated' ? undefined : draft.validation,
      history: [...draft.history, { at: new Date().toISOString(), by: 'vous (démo)', body: edit.body ?? draft.body }].slice(-20),
      version: draft.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return { ok: true, draft: finalizeDraft(next, { ...c.draftCtx, now: new Date() }) };
  } catch (e) {
    return fail(e);
  }
}

export async function editDraftAction(businessId: string, id: string, edit: EditInput): Promise<Res<{ draft: ContentDraft }>> {
  try {
    const actor = await actorFor(businessId, 'member');
    const c = await ctxFor(businessId);
    return { ok: true, draft: await svc.editDraft(businessId, id, edit, actor, c.draftCtx) };
  } catch (e) {
    return fail(e);
  }
}

export async function validateDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    return { ok: true, draft: await svc.validateDraft(businessId, id, await actorFor(businessId, 'admin')) };
  } catch (e) {
    return fail(e);
  }
}

export async function rejectDraftAction(businessId: string, id: string, reason?: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    return { ok: true, draft: await svc.rejectDraft(businessId, id, await actorFor(businessId, 'admin'), reason) };
  } catch (e) {
    return fail(e);
  }
}

export async function pushDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft; changeSetId?: string }>> {
  try {
    const actor = await actorFor(businessId, 'admin');
    const c = await ctxFor(businessId);
    const r = await svc.pushDraft(businessId, id, actor, { tier: c.data.tier, author: c.data.name });
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

export async function publishDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    const actor = await actorFor(businessId, 'admin');
    const c = await ctxFor(businessId);
    return { ok: true, draft: await svc.publishDraft(businessId, id, actor, { effect: { ...c.effectInputs, at: new Date().toISOString() } }) };
  } catch (e) {
    return fail(e);
  }
}

export async function unpublishDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    return { ok: true, draft: await svc.unpublishDraft(businessId, id, await actorFor(businessId, 'admin')) };
  } catch (e) {
    return fail(e);
  }
}

export async function removeDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    return { ok: true, draft: await svc.removeDraft(businessId, id, await actorFor(businessId, 'admin')) };
  } catch (e) {
    return fail(e);
  }
}

export async function exportDraftAction(businessId: string, id: string): Promise<Res<{ draft: ContentDraft; filename: string; base64: string }>> {
  try {
    const actor = await actorFor(businessId, 'admin');
    const c = await ctxFor(businessId);
    const r = await svc.exportDraft(businessId, id, actor, { tier: c.data.tier, author: c.data.name });
    return { ok: true, draft: r.draft, filename: r.filename, base64: r.zip.toString('base64') };
  } catch (e) {
    return fail(e);
  }
}

export async function declareLiveAction(businessId: string, id: string, url: string): Promise<Res<{ draft: ContentDraft }>> {
  try {
    const actor = await actorFor(businessId, 'admin');
    const c = await ctxFor(businessId);
    return { ok: true, draft: await svc.declareLive(businessId, id, url, actor, { effect: { ...c.effectInputs, at: new Date().toISOString() } }) };
  } catch (e) {
    return fail(e);
  }
}

export async function saveFactsAction(businessId: string, facts: Record<string, string>): Promise<Res<{ facts: StoredFacts }>> {
  try {
    return { ok: true, facts: await svc.saveFacts(businessId, facts, await actorFor(businessId, 'member')) };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettingsAction(businessId: string, settings: ContentSettings): Promise<Res<{ settings: ContentSettings }>> {
  try {
    return { ok: true, settings: await svc.saveSettings(businessId, settings, await actorFor(businessId, 'admin')) };
  } catch (e) {
    return fail(e);
  }
}

export async function dismissOpportunityAction(businessId: string, opId: string): Promise<Res<{ dismissed: string[] }>> {
  try {
    return { ok: true, dismissed: await svc.dismissOpportunity(businessId, opId, await actorFor(businessId, 'member')) };
  } catch (e) {
    return fail(e);
  }
}

export async function mentionStatusAction(businessId: string, mentionId: string, status: MentionStatus, extra: { url?: string; note?: string } = {}): Promise<Res<{ tracking: MentionTracking }>> {
  try {
    return { ok: true, tracking: await svc.setMentionStatus(businessId, mentionId, status, extra, await actorFor(businessId, 'member')) };
  } catch (e) {
    return fail(e);
  }
}
