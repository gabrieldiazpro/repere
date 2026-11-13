/** ChatGPT via OpenAI Responses API + outil web_search (docs/04-api-ia.md § 1). */
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
  toIsoCountry,
  uniqueSources,
  uniqueUrls,
} from './http';
import type { RawSource } from '../types';

const URL_RESPONSES = 'https://api.openai.com/v1/responses';

export function openaiModel(): string {
  return env('OPENAI_MODEL') || 'gpt-5.6-luna';
}

/**
 * Parse la sortie Responses : texte, url_citation (url, title, start_index) → sources « cited »,
 * web_search_call.action.sources → sources « retrieved » (docs/v2/03-sources.md § 3.2).
 */
export function parseOutput(data: Json): AskResult {
  const texts: string[] = [];
  const urls: string[] = [];
  const sources: RawSource[] = [];
  const retrieved: RawSource[] = [];
  let offset = 0;
  for (const item of data?.output ?? []) {
    if (item?.type === 'web_search_call') {
      for (const src of item?.action?.sources ?? []) if (src?.url) retrieved.push({ url: src.url, title: src.title, kind: 'retrieved' });
      continue;
    }
    if (item?.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') {
        if (texts.length) offset += 1; // séparateur '\n'
        texts.push(c.text);
        const anns = [...(c.annotations ?? [])].filter((a: Json) => a?.type === 'url_citation');
        anns.sort((a: Json, b: Json) => (a.start_index ?? 0) - (b.start_index ?? 0));
        for (const a of anns) {
          urls.push(a.url);
          const start = typeof a.start_index === 'number' ? a.start_index : undefined;
          sources.push({ url: a.url, title: typeof a.title === 'string' ? a.title : undefined, kind: 'cited', startIndex: start != null ? offset + start : undefined });
        }
        offset += c.text.length;
      }
    }
  }
  const text = texts.join('\n').trim() || (typeof data?.output_text === 'string' ? data.output_text : '');
  return { text, citations: uniqueUrls(urls), sources: uniqueSources([...sources, ...retrieved]) };
}

export function createOpenAIProvider(): EngineProvider | null {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) return null;
  const model = openaiModel();
  return {
    id: 'chatgpt',
    model,
    demo: false,
    costPerCallEur: 0.014 * USD_TO_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const country = toIsoCountry(ctx.country ?? 'FR');
      const loc: Record<string, string> = { type: 'approximate' };
      if (country) loc.country = country;
      if (ctx.city) loc.city = ctx.city;
      if (country === 'FR') loc.timezone = 'Europe/Paris';
      const data = await postJson('openai', URL_RESPONSES, { Authorization: `Bearer ${apiKey}` }, {
        model,
        input: query,
        tools: [{ type: 'web_search', search_context_size: 'low', ...(Object.keys(loc).length > 1 ? { user_location: loc } : {}) }],
        include: ['web_search_call.action.sources'],
        reasoning: { effort: 'low' },
        max_output_tokens: 1500,
        store: false,
      });
      if (data?.error) throw new ProviderError('openai', data.error.message ?? 'erreur inconnue');
      const out = parseOutput(data);
      if (!out.text) throw new ProviderError('openai', `réponse vide (status=${data?.status ?? '?'})`);
      return out;
    },
  };
}

/** Extracteur JSON (sortie structurée json_schema). Modèle : OPENAI_EXTRACT_MODEL, sinon gpt-6-luna. */
export function createOpenAIExtractor(): Extractor | null {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) return null;
  const model = env('OPENAI_EXTRACT_MODEL') || 'gpt-6-luna';
  return {
    vendor: 'openai',
    model,
    costPerCallEur: 0.0003 * USD_TO_EUR,
    async completeJson(system: string, user: string): Promise<string> {
      const data = await postJson('openai', URL_RESPONSES, { Authorization: `Bearer ${apiKey}` }, {
        model,
        instructions: system,
        input: user,
        text: { format: { type: 'json_object' } },
        max_output_tokens: 800,
        store: false,
      });
      if (data?.error) throw new ProviderError('openai', data.error.message ?? 'erreur inconnue');
      const out = parseOutput(data);
      if (!out.text) throw new ProviderError('openai', 'extraction vide');
      return out.text;
    },
  };
}
