/**
 * PATCH  /api/prompts/[id]  { text?, theme?, tags?, intent?, active?, providers? } → { ok, prompt, quota }
 * DELETE /api/prompts/[id]  → { ok }
 * Le commerce est celui de la question ; accès vérifié par requireBusiness (écriture, démo refusée).
 */
import { HttpError, requireBusiness } from '@/lib/prompts/adapters';
import { errorResponse, fail, json, limit, readJson } from '@/lib/prompts/http';
import { deletePrompt, demandContext, getPrompt, PROMPT_ID_RE, quotaOf, toView, updatePrompt } from '@/lib/prompts/repo';
import type { PromptPatch } from '@/lib/prompts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function load(req: Request, id: string) {
  if (!PROMPT_ID_RE.test(id)) throw new HttpError(400, 'Identifiant de question invalide.');
  const prompt = await getPrompt(id);
  if (!prompt) throw new HttpError(404, 'Question introuvable.');
  const { business } = await requireBusiness(req, prompt.businessId, { write: true, minRole: 'member' });
  return { prompt, business };
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await limit(req, 'write', 300);
    const { id } = await params;
    const body = await readJson(req);
    if (!body) return fail(400, 'Requête invalide.');
    const { business } = await load(req, id);
    const patch: PromptPatch = {};
    if (body.text !== undefined) patch.text = body.text as string;
    if (body.theme !== undefined) patch.theme = body.theme as string;
    if (body.tags !== undefined) patch.tags = body.tags as string[];
    if (body.intent !== undefined) patch.intent = body.intent as PromptPatch['intent'];
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return fail(400, '« active » doit valoir true ou false.');
      patch.active = body.active;
    }
    if (body.providers !== undefined) patch.providers = (Array.isArray(body.providers) ? body.providers : []) as PromptPatch['providers'];
    if (!Object.keys(patch).length) return fail(400, 'Aucune modification demandée.');
    const prompt = await updatePrompt(business, id, patch);
    return json({ ok: true, prompt: toView(prompt, demandContext(business)), quota: await quotaOf(business) });
  } catch (e) {
    return errorResponse(e, '/[id]');
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await limit(req, 'write', 300);
    const { id } = await params;
    const { business } = await load(req, id);
    await deletePrompt(business, id);
    return json({ ok: true, quota: await quotaOf(business) });
  } catch (e) {
    return errorResponse(e, '/[id]');
  }
}
