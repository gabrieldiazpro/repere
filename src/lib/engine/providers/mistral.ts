/**
 * Mistral (Le Chat) via la Conversations API (`POST https://api.mistral.ai/v1/conversations`) et l'outil intégré
 * `web_search` (vérifié le 9 nov. 2026 sur docs.mistral.ai/agents/connectors/websearch : l'outil n'existe pas sur
 * /v1/chat/completions). Réponse : `outputs[]`, entrées `message.output` dont le `content` alterne des morceaux
 * `text` et `tool_reference` (url, title, source) placés juste après le passage qu'ils sourcent.
 *
 * Modèle bon marché par défaut : `mistral-small-latest` (MISTRAL_MODEL pour changer, ex. `mistral-medium-latest`).
 * Coût estimé par appel (pire cas) : recherche web 30 $ / 1 000 appels + ≈ 8 000 jetons d'entrée et 600 de sortie
 * (0,10 $ / 0,30 $ par million pour Small) ≈ 0,033 $ ≈ 0,030 €.
 * Extracteur JSON (repli) : /v1/chat/completions avec `response_format: { type: 'json_object' }`.
 */
import type { RawSource } from '../types';
import { env } from '../util';
import {
  type AskContext,
  type AskResult,
  type EngineProvider,
  type Extractor,
  type Json,
  ProviderError,
  USD_TO_EUR,
  postJson,
  uniqueSources,
  uniqueUrls,
} from './http';

export const MISTRAL_CONVERSATIONS_URL = 'https://api.mistral.ai/v1/conversations';
export const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';
/** Coût estimé d'un appel avec recherche web, en euros. */
export const MISTRAL_COST_PER_CALL_EUR = 0.033 * USD_TO_EUR;

export function mistralModel(): string {
  return env('MISTRAL_MODEL') || 'mistral-small-latest';
}

/** Consigne courte : réponse en français, comme le ferait Le Chat pour un utilisateur situé en France. */
export function mistralInstructions(ctx: Pick<AskContext, 'city' | 'country'>): string {
  const where = [ctx.city, ctx.country === 'FR' || !ctx.country ? 'France' : ctx.country].filter(Boolean).join(', ');
  return `Réponds en français à un utilisateur situé à ${where}. Utilise la recherche web pour des recommandations à jour et cite tes sources.`;
}

/**
 * Lit la réponse de la Conversations API : texte final et sources (avec la position, dans le texte, du passage
 * qui précède chaque référence). Tolère `content` en chaîne simple et les références de `tool.execution`.
 */
export function parseMistralConversation(data: Json): AskResult {
  const outputs: Json[] = Array.isArray(data?.outputs) ? data.outputs : Array.isArray(data?.entries) ? data.entries : [];
  let text = '';
  const raw: RawSource[] = [];
  const retrieved: RawSource[] = [];
  for (const o of outputs) {
    if (o?.type === 'message.output' || (o?.role === 'assistant' && o?.content != null)) {
      const content = o.content;
      if (typeof content === 'string') {
        text += content;
        continue;
      }
      for (const c of Array.isArray(content) ? content : []) {
        if (c?.type === 'text' && typeof c.text === 'string') {
          text += c.text;
        } else if (c?.type === 'tool_reference' && typeof c.url === 'string') {
          // Position : début de la dernière phrase écrite avant la référence.
          const before = text.trimEnd();
          const cut = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('. '));
          raw.push({ url: c.url, title: typeof c.title === 'string' ? c.title : undefined, snippet: typeof c.description === 'string' ? c.description : undefined, kind: 'cited', startIndex: Math.max(0, cut + 1) });
        }
      }
    } else if (o?.type === 'tool.execution') {
      for (const r of Array.isArray(o?.info?.results) ? o.info.results : []) {
        if (typeof r?.url === 'string') retrieved.push({ url: r.url, title: r.title, kind: 'retrieved' });
      }
    }
  }
  // Ancien format chat (choices) : par sécurité.
  if (!text && typeof data?.choices?.[0]?.message?.content === 'string') text = data.choices[0].message.content;
  const lead = text.length - text.trimStart().length;
  const clean = text.trim();
  for (const r of raw) if (r.startIndex != null) r.startIndex = Math.max(0, Math.min(clean.length, r.startIndex - lead));
  const citations = uniqueUrls(raw.map((r) => r.url));
  const sources = uniqueSources([...raw, ...retrieved]);
  return { text: clean, citations: citations.length ? citations : uniqueUrls(retrieved.map((r) => r.url)), sources };
}

export function createMistralProvider(): EngineProvider | null {
  const apiKey = env('MISTRAL_API_KEY');
  if (!apiKey) return null;
  const model = mistralModel();
  return {
    id: 'mistral',
    model,
    demo: false,
    costPerCallEur: MISTRAL_COST_PER_CALL_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const data = await postJson('mistral', MISTRAL_CONVERSATIONS_URL, { Authorization: `Bearer ${apiKey}` }, {
        model,
        inputs: query,
        instructions: mistralInstructions(ctx),
        tools: [{ type: 'web_search' }],
        completion_args: { temperature: 0.3, max_tokens: 1200 },
        store: false,
      });
      if (data?.error || data?.object === 'error') {
        throw new ProviderError('mistral', data?.error?.message ?? data?.message ?? JSON.stringify(data).slice(0, 300));
      }
      const r = parseMistralConversation(data);
      if (!r.text) throw new ProviderError('mistral', 'réponse vide');
      return r;
    },
  };
}

/** Extracteur JSON Mistral (dernier repli de getExtractor). */
export function createMistralExtractor(): Extractor | null {
  const apiKey = env('MISTRAL_API_KEY');
  if (!apiKey) return null;
  const model = env('MISTRAL_EXTRACTOR_MODEL') || 'mistral-small-latest';
  return {
    vendor: 'mistral',
    model,
    costPerCallEur: 0.0004 * USD_TO_EUR,
    async completeJson(system: string, user: string): Promise<string> {
      const data = await postJson('mistral', MISTRAL_CHAT_URL, { Authorization: `Bearer ${apiKey}` }, {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 1500,
      });
      const c = data?.choices?.[0]?.message?.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.map((x: Json) => (typeof x?.text === 'string' ? x.text : '')).join('');
      throw new ProviderError('mistral', 'extraction : réponse vide');
    },
  };
}
