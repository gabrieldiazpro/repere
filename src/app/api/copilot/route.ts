/**
 * Copilote — POST /api/copilot
 * Corps : { businessId, message?: string, messages?: {role, content}[], threadId?: uuid, stream?: boolean }
 * - `stream: true` : réponse en texte brut diffusée (en-têtes x-copilot-thread, x-copilot-mode) ;
 * - sinon JSON : { answer: { content, mode, intent, deliverables… }, threadId }.
 * GET /api/copilot?businessId=…[&threadId=…][&context=<écran>] : fils récents (ou un fil), 4 questions suggérées
 *   selon l'écran d'origine (lundi, ia, verite, sources, concurrents, taches, trafic, rapports…) et l'état du compte, mode.
 * La réponse JSON contient aussi `tools` (outils appelés), `sources` (écrans d'origine des chiffres), `actions` (proposées).
 * Limites : 40 questions / heure / IP, COPILOT_PER_BUSINESS_PER_DAY (défaut 60) / jour / compte, plafond de coût journalier.
 */
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CopilotMessage } from '@/lib/engine/types-v2';
import { canAccessBusiness, getBusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { COPILOT_SUGGESTIONS, appendToThread, askCopilot, askCopilotStream, getThread, listThreads, loadCopilotContext, suggestionsFor, type InputMessage } from '@/lib/copilot';
import { copilotLlmConfig } from '@/lib/copilot/llm';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { DAY_MS, HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z
  .object({
    businessId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, { error: 'businessId invalide.' }),
    message: z.string().trim().min(1, { error: 'Question vide.' }).max(4000, { error: 'Question trop longue (4 000 caractères max).' }).optional(),
    messages: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }))
      .min(1)
      .max(40)
      .optional(),
    threadId: z.string().regex(UUID).optional(),
    stream: z.boolean().optional(),
    context: z.string().regex(/^[a-z-]{1,30}$/).optional(),
  })
  .refine((b) => b.message || b.messages, { error: 'message ou messages requis.' });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get('businessId');
  if (!businessId || !/^[A-Za-z0-9_-]{1,100}$/.test(businessId)) {
    return NextResponse.json({ error: 'businessId manquant ou invalide.' }, { status: 400 });
  }
  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  const threadId = url.searchParams.get('threadId');
  const mode = copilotLlmConfig() ? 'llm' : 'demo';
  const screen = url.searchParams.get('context');
  const ctx = await loadCopilotContext(businessId).catch(() => null);
  const suggestions = ctx ? suggestionsFor(ctx, screen && /^[a-z-]{1,30}$/.test(screen) ? screen : null) : [...COPILOT_SUGGESTIONS];
  // Comptes démo : aucun fil n'est conservé (les questions d'un visiteur ne sont jamais relues par un autre, E1).
  if (isDemoBusinessId(businessId)) {
    return threadId
      ? NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })
      : NextResponse.json({ threads: [], suggestions, mode: 'demo' });
  }
  if (threadId) {
    const thread = UUID.test(threadId) ? await getThread(businessId, threadId) : null;
    if (!thread) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
    return NextResponse.json({ thread, suggestions, mode });
  }
  const threads = await listThreads(businessId, 20);
  return NextResponse.json({
    threads: threads.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, messages: t.messages.length })),
    suggestions,
    mode,
  });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' }, { status: 400 });
  const { businessId, message, messages, threadId, stream } = parsed.data;

  const ipRl = await rateLimit('copilot', getClientIp(req), 40, HOUR_MS);
  if (!ipRl.ok) return NextResponse.json({ error: 'Trop de questions, réessayez dans un moment.' }, { status: 429 });

  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });

  // Quota du jour de l'offre (Découverte 3, Essentiel 10-20…), plafonné par COPILOT_PER_BUSINESS_PER_DAY.
  const biz = await getBusinessRecord(businessId).catch(() => null);
  const cap = Number(process.env.COPILOT_PER_BUSINESS_PER_DAY || 60);
  const perDay = biz ? Math.min(cap, getEntitlements(biz).copilotDaily) : cap;
  const bizRl = await rateLimit('copilot-biz', businessId, perDay, DAY_MS);
  if (!bizRl.ok) return NextResponse.json({ error: `Vous avez posé les ${perDay} questions du jour incluses dans votre offre. Rendez-vous demain.`, code: 'quota_exceeded' }, { status: 429 });

  const demo = isDemoBusinessId(businessId);
  const prior = threadId && !demo ? await getThread(businessId, threadId) : null;
  const now = () => new Date().toISOString();
  let history: InputMessage[];
  let userMsg: CopilotMessage;
  if (message) {
    userMsg = { role: 'user', content: message, at: now() };
    history = [...(prior?.messages ?? []), userMsg];
  } else {
    history = messages!;
    const last = [...history].reverse().find((m) => m.role === 'user');
    if (!last) return NextResponse.json({ error: 'Aucune question.' }, { status: 400 });
    userMsg = { role: 'user', content: last.content.slice(0, 4000), at: now() };
  }
  // Démo : le fil n'est pas conservé côté serveur, mais l'identifiant reste stable pour l'interface.
  const newId = prior?.id ?? (demo && threadId ? threadId : randomUUID());

  try {
    if (stream) {
      const s = await askCopilotStream(businessId, history, req.signal);
      const enc = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of s.stream) controller.enqueue(enc.encode(chunk));
            const answer = await s.done;
            if (!demo) await appendToThread(businessId, prior?.id, [userMsg, { role: 'assistant', content: answer.content, at: answer.at }], newId);
          } catch (e) {
            console.error('[api/copilot] flux', e);
            controller.enqueue(enc.encode('\n\n[Réponse interrompue. Réessayez.]'));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(body, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-copilot-thread': newId,
          'x-copilot-mode': copilotLlmConfig() && !demo ? 'llm' : 'demo',
        },
      });
    }
    const answer = await askCopilot(businessId, history, req.signal);
    if (demo) return NextResponse.json({ answer, threadId: newId });
    const thread = await appendToThread(businessId, prior?.id, [userMsg, { role: 'assistant', content: answer.content, at: answer.at }], newId);
    return NextResponse.json({ answer, threadId: thread.id });
  } catch (e) {
    console.error('[api/copilot]', e);
    return NextResponse.json({ error: 'Le copilote est momentanément indisponible.' }, { status: 500 });
  }
}
