/**
 * GET /api/prompts/[id]/history[?provider=chatgpt][&answers=0][&max=60]
 * → { ok, history: { series, answers (avec surlignage), summary, … , historyMonths } }
 * Lecture : comptes démo autorisés.
 */
import { ALL_PROVIDERS, type ProviderId } from '@/lib/engine/types';
import { HttpError, requireBusiness } from '@/lib/prompts/adapters';
import { errorResponse, json, limit } from '@/lib/prompts/http';
import { getPrompt, PROMPT_ID_RE } from '@/lib/prompts/repo';
import { historyForPrompt } from '@/lib/prompts/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await limit(req, 'read', 1200);
    const { id } = await params;
    if (!PROMPT_ID_RE.test(id)) throw new HttpError(400, 'Identifiant de question invalide.');
    const prompt = await getPrompt(id);
    if (!prompt) throw new HttpError(404, 'Question introuvable.');
    const { business } = await requireBusiness(req, prompt.businessId);
    const sp = new URL(req.url).searchParams;
    const p = sp.get('provider');
    if (p && !(ALL_PROVIDERS as string[]).includes(p)) throw new HttpError(400, 'IA inconnue.');
    const max = Number(sp.get('max') ?? 60);
    const history = await historyForPrompt(business, prompt, {
      provider: (p as ProviderId) || undefined,
      answers: sp.get('answers') !== '0',
      maxAnswers: Number.isFinite(max) ? max : 60,
    });
    return json({ ok: true, history });
  } catch (e) {
    return errorResponse(e, '/[id]/history');
  }
}
