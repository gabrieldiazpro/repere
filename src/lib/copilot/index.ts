/**
 * Copilote Repéré (V3) : répond uniquement à partir des données du client, via 15 outils typés (./tools.ts).
 * - LLM : Anthropic (ANTHROPIC_MODEL_COPILOT) ou OpenAI (OPENAI_MODEL_COPILOT), boucle d'appels d'outils (./agent.ts) ;
 * - sans clé, comptes démo, plafond journalier atteint ou LLM en erreur : routeur d'intention (./router.ts) qui
 *   appelle les mêmes outils et compose la réponse à partir de leurs données ;
 * - historique : collection `copilot.threads`.
 */
import { randomUUID } from 'node:crypto';
import type { CopilotMessage } from '@/lib/engine/types-v2';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { contextToText, loadCopilotContext, type CopilotContext } from './context';
import { detectIntent, scriptedAnswer, closeQuestions } from './router';
import type { CopilotAction, CopilotIntent, Deliverable, SourceRef, ToolCall } from './types';
import { copilotLlmConfig, type LlmMessage } from './llm';
import { BudgetExceededError, runAgent } from './agent';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { auditStats } from '@/lib/digest/stats';
import { providerRate } from './explain';
import { COPILOT_SUGGESTIONS, contextSuggestions, copilotSuggestions } from './prompt';
import type { ProviderId } from '@/lib/engine';
import { PROVIDER_LABEL } from '@/lib/alerts';

export { COPILOT_SUGGESTIONS, copilotSuggestions, contextSuggestions, detectIntent, scriptedAnswer, closeQuestions, loadCopilotContext, contextToText };
export { TOOLS, TOOL_DEFS, runTool } from './tools';
export type { CopilotIntent, Deliverable, CopilotContext, CopilotAction, SourceRef, ToolCall };

export const THREADS_COLLECTION = 'copilot.threads';
const MAX_HISTORY = 12;
const MAX_CHARS = 4000;

export interface CopilotAnswer {
  content: string;
  /** llm : réponse générée ; demo : sans clé ; fallback : plafond atteint ou LLM indisponible */
  mode: 'llm' | 'demo' | 'fallback';
  intent: CopilotIntent;
  deliverables: Deliverable[];
  provider?: 'anthropic' | 'openai';
  model?: string;
  costEur?: number;
  /** outils appelés (démo comme LLM), dans l'ordre */
  tools?: ToolCall[];
  /** écrans d'où viennent les chiffres */
  sources?: SourceRef[];
  /** actions proposées (jamais exécutées sans confirmation) */
  actions?: CopilotAction[];
  at: string;
}

export type InputMessage = Pick<CopilotMessage, 'role' | 'content'> & { at?: string };

/** Historique propre pour l'API : alterné, commence par l'utilisateur, tronqué. */
export function normalizeHistory(messages: InputMessage[]): LlmMessage[] {
  const out: LlmMessage[] = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    const content = String(m.content ?? '').slice(0, MAX_CHARS).trim();
    if (!content || (m.role !== 'user' && m.role !== 'assistant')) continue;
    if (!out.length && m.role !== 'user') continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${content}`;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[out.length - 1].role !== 'user') out.pop();
  return out;
}

/** Livrables extraits des blocs de code d'une réponse LLM. */
export function extractDeliverables(text: string): Deliverable[] {
  const out: Deliverable[] = [];
  const re = /```(html|json|jsonld|text|csv)?\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const lang = (m[1] ?? 'text').toLowerCase();
    const content = m[2].trim();
    if (!content) continue;
    if (lang === 'html') {
      // Défense en profondeur (E4) : le client colle ce code sur son site ; aucun contenu actif n'est proposé tel quel.
      if (/<\s*(script|iframe|object|embed|style|link|meta|form|base)\b|\son\w+\s*=|javascript:|data:text\/html/i.test(content)) {
        out.push({ type: 'text', label: 'HTML refusé (contenu actif détecté) : à vérifier', content });
      } else out.push({ type: 'html', label: 'HTML', content });
    }
    else if (lang === 'json' || lang === 'jsonld') out.push({ type: 'jsonld', label: content.includes('FAQPage') ? 'Balisage FAQPage (JSON-LD)' : 'JSON-LD', content });
    else if (lang === 'csv') out.push({ type: 'csv', label: 'Tableau', content });
    else out.push({ type: 'text', label: 'Texte à copier', content });
  }
  return out;
}

interface Prepared {
  ctx: CopilotContext;
  question: string;
  history: LlmMessage[];
}

async function prepare(businessId: string, messages: InputMessage[]): Promise<Prepared> {
  const ctx = await loadCopilotContext(businessId);
  if (!ctx) throw new Error(`Commerce inconnu : ${businessId}`);
  const history = normalizeHistory(messages);
  const question = history.at(-1)?.content ?? '';
  if (!question) throw new Error('Question vide.');
  return { ctx, question, history };
}

function scripted(p: Prepared, mode: 'demo' | 'fallback', note?: string): CopilotAnswer {
  const s = scriptedAnswer(p.ctx, p.question);
  return {
    content: note ? `${s.content}\n\n_${note}_` : s.content,
    mode,
    intent: s.intent,
    deliverables: s.deliverables,
    tools: s.tools ?? [],
    sources: s.sources ?? [],
    actions: s.actions ?? [],
    at: new Date().toISOString(),
  };
}

export interface CopilotStream {
  /** texte au fil de l'eau */
  stream: AsyncIterable<string>;
  /** réponse complète, disponible quand le flux est consommé */
  done: Promise<CopilotAnswer>;
}

/** Réponse en flux (texte). En mode démo / repli, le flux contient la réponse scriptée en un seul morceau. */
export async function askCopilotStream(businessId: string, messages: InputMessage[], signal?: AbortSignal): Promise<CopilotStream> {
  const p = await prepare(businessId, messages);
  const cfg = copilotLlmConfig();
  const once = (a: CopilotAnswer): CopilotStream => ({
    stream: (async function* () {
      yield a.content;
    })(),
    done: Promise.resolve(a),
  });
  // Comptes démo publics : réponses scriptées uniquement (coût nul, budget des clients préservé — E2).
  if (!cfg || isDemoBusinessId(businessId) || p.ctx.demo) return once(scripted(p, 'demo'));

  let resolve!: (a: CopilotAnswer) => void;
  const done = new Promise<CopilotAnswer>((r) => (resolve = r));
  const stream = (async function* () {
    let answer: CopilotAnswer;
    try {
      const r = await runAgent(cfg, p.ctx, p.history, { signal });
      const note = r.unverified.length ? `\n\n_Certains chiffres (${r.unverified.slice(0, 3).join(', ')}) ne figurent pas tels quels dans vos données : vérifiez-les avant de les réutiliser._` : '';
      const textDeliverables = extractDeliverables(r.text);
      answer = {
        content: r.text + note,
        mode: 'llm',
        intent: detectIntent(p.question),
        deliverables: [...r.deliverables, ...textDeliverables],
        provider: cfg.provider,
        model: cfg.model,
        costEur: Math.round(r.costEur * 10000) / 10000,
        tools: r.tools,
        sources: r.sources,
        actions: scriptedAnswer(p.ctx, p.question).actions ?? [],
        at: new Date().toISOString(),
      };
    } catch (e) {
      const budget = e instanceof BudgetExceededError;
      if (!budget) console.warn('[copilot] LLM indisponible', e instanceof Error ? e.message : e);
      answer = scripted(
        p,
        'fallback',
        budget ? 'Plafond journalier de l’assistant atteint : réponse préparée automatiquement à partir de vos données.' : 'Assistant momentanément indisponible : réponse préparée automatiquement à partir de vos données.',
      );
    }
    yield answer.content;
    resolve(answer);
  })();
  return { stream, done };
}

/** Suggestions contextuelles : 4 questions selon l'écran d'origine et l'état du compte. */
export function suggestionsFor(ctx: CopilotContext, screen?: string | null): string[] {
  const a = ctx.latest;
  const s = a ? auditStats(a) : null;
  const me = s?.citations ?? 0;
  const top = a?.gaps?.find((g) => g.mentions > me)?.competitor ?? s?.rows.find((r) => !r.isMe && r.mentions > me)?.name ?? null;
  const weakest = a ? [...a.providersUsed].map((p) => ({ p, r: providerRate(a, p) ?? 1 })).sort((x, y) => x.r - y.r)[0]?.p : null;
  return contextSuggestions(screen, {
    segment: ctx.segment,
    topCompetitor: top,
    factErrors: ctx.factCheck?.items.filter((i) => i.verdict === 'faux').length ?? 0,
    audits: ctx.history.length,
    trafficInstalled: Boolean(ctx.traffic && (ctx.traffic.installed || ctx.traffic.demo)),
    salesConnected: Boolean(ctx.traffic?.commerce),
    openTasks: ctx.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length,
    weakestProvider: weakest ? PROVIDER_LABEL[weakest as ProviderId] : null,
  });
}

/** Réponse complète (non diffusée). */
export async function askCopilot(businessId: string, messages: InputMessage[], signal?: AbortSignal): Promise<CopilotAnswer> {
  const s = await askCopilotStream(businessId, messages, signal);
  for await (const _chunk of s.stream) {
    /* consommation du flux */
  }
  return s.done;
}

// ---------------------------------------------------------------------------
// Fils de conversation (copilot.threads)
// ---------------------------------------------------------------------------

export interface CopilotThread {
  id: string;
  businessId: string;
  title: string;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export async function getThread(businessId: string, threadId: string): Promise<CopilotThread | null> {
  const doc = await getDoc<CopilotThread>(THREADS_COLLECTION, threadId);
  return doc && doc.data.businessId === businessId ? doc.data : null;
}

export async function listThreads(businessId: string, limit = 20): Promise<CopilotThread[]> {
  return (await listDocs<CopilotThread>(THREADS_COLLECTION, { businessId, limit })).map((d) => d.data);
}

/** Ajoute des messages à un fil (créé s'il n'existe pas ou n'appartient pas au commerce). */
export async function appendToThread(
  businessId: string,
  threadId: string | null | undefined,
  add: CopilotMessage[],
  newId: string = randomUUID(),
): Promise<CopilotThread> {
  const prev = threadId ? await getThread(businessId, threadId) : null;
  const now = new Date().toISOString();
  const firstUser = add.find((m) => m.role === 'user')?.content ?? 'Conversation';
  const thread: CopilotThread = prev
    ? { ...prev, messages: [...prev.messages, ...add].slice(-100), updatedAt: now }
    : { id: newId, businessId, title: firstUser.slice(0, 80), messages: add, createdAt: now, updatedAt: now };
  await putDoc(THREADS_COLLECTION, thread.id, thread, businessId);
  return thread;
}
