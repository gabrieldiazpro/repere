/** Claude via Messages API + outil web_search_20250305 (docs/04-api-ia.md § 4). */
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

const URL_MESSAGES = 'https://api.anthropic.com/v1/messages';

export function anthropicModel(): string {
  return env('ANTHROPIC_MODEL') || 'claude-haiku-5-5';
}

function headers(apiKey: string): Record<string, string> {
  return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
}

export function createAnthropicProvider(): EngineProvider | null {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  const model = anthropicModel();
  return {
    id: 'claude',
    model,
    demo: false,
    costPerCallEur: 0.02 * USD_TO_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const country = toIsoCountry(ctx.country ?? 'FR');
      const loc: Record<string, string> = { type: 'approximate' };
      if (ctx.city) loc.city = ctx.city;
      if (country) loc.country = country;
      if (country === 'FR') loc.timezone = 'Europe/Paris';
      const tools = [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3, ...(Object.keys(loc).length > 1 ? { user_location: loc } : {}) },
      ];
      const messages: Json[] = [{ role: 'user', content: query }];
      const blocks: Json[] = [];
      for (let i = 0; i < 3; i++) {
        const data = await postJson('anthropic', URL_MESSAGES, headers(apiKey), { model, max_tokens: 1500, messages, tools });
        if (data?.type === 'error') throw new ProviderError('anthropic', data.error?.message ?? 'erreur inconnue');
        blocks.push(...(data?.content ?? []));
        if (data?.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: data.content });
      }
      const texts: string[] = [];
      const cited: unknown[] = [];
      const searched: unknown[] = [];
      const raw: RawSource[] = [];
      const retrieved: RawSource[] = [];
      let offset = 0;
      let searchError: string | null = null;
      for (const b of blocks) {
        if (b?.type === 'text' && typeof b.text === 'string') {
          for (const c of b.citations ?? []) {
            if (!c?.url) continue;
            cited.push(c.url);
            raw.push({ url: c.url, title: c.title, snippet: typeof c.cited_text === 'string' ? c.cited_text.slice(0, 300) : undefined, kind: 'cited', startIndex: offset });
          }
          texts.push(b.text);
          offset += b.text.length;
        } else if (b?.type === 'web_search_tool_result') {
          if (Array.isArray(b.content)) {
            for (const r of b.content)
              if (r?.type === 'web_search_result') {
                searched.push(r.url);
                if (r.url) retrieved.push({ url: r.url, title: r.title, kind: 'retrieved' });
              }
          } else if (b.content?.type === 'web_search_tool_result_error') {
            searchError = String(b.content.error_code ?? 'inconnue');
          }
        }
      }
      const joined = texts.join('');
      const lead = joined.length - joined.trimStart().length;
      const text = joined.trim();
      for (const r of raw) if (r.startIndex != null) r.startIndex = Math.max(0, r.startIndex - lead);
      if (!text && searchError) throw new ProviderError('anthropic', `recherche web : ${searchError}`, 200, true);
      if (!text) throw new ProviderError('anthropic', 'réponse vide');
      const c = uniqueUrls(cited);
      return {
        text,
        citations: c.length ? c : uniqueUrls(searched),
        sources: uniqueSources(raw.length ? [...raw, ...retrieved] : retrieved.map((r) => ({ ...r, kind: 'cited' as const }))),
      };
    },
  };
}

export function createAnthropicExtractor(): Extractor | null {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  const model = env('ANTHROPIC_EXTRACT_MODEL') || anthropicModel();
  return {
    vendor: 'anthropic',
    model,
    costPerCallEur: 0.0003 * USD_TO_EUR,
    async completeJson(system: string, user: string): Promise<string> {
      const data = await postJson('anthropic', URL_MESSAGES, headers(apiKey), {
        model,
        max_tokens: 800,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });
      if (data?.type === 'error') throw new ProviderError('anthropic', data.error?.message ?? 'erreur inconnue');
      const text = (data?.content ?? [])
        .filter((b: Json) => b?.type === 'text')
        .map((b: Json) => String(b.text))
        .join('')
        .trim();
      if (!text) throw new ProviderError('anthropic', 'extraction vide');
      return text;
    },
  };
}
