/**
 * Grok via l'API officielle xAI (Responses, `POST https://api.x.ai/v1/responses`) et l'outil `web_search`
 * (vérifié le 22 nov. 2026 : docs.x.ai/developers/tools/web-search et /tools/citations) :
 * - citations : `output[].content[].annotations[]` (`url_citation` : url, start_index, end_index, title = numéro)
 *   et `citations[]` (toutes les URL consultées) ; `include: ['no_inline_citations']` retire les liens [[N]](url)
 *   du texte (les positions ne sont alors plus fournies) ;
 * - pas de paramètre de position : consigne « utilisateur en France » et ville dans la question.
 * Coût (docs.x.ai/developers/pricing) : web_search 5 $ / 1 000 appels ; grok-4.3 1,25 $ / M en entrée, 2,50 $ / M en
 * sortie. Pire cas ≈ 3 recherches + 10 000 jetons d'entrée + 1 500 de sortie ≈ 0,031 $ ; on compte 0,035 $.
 * Peu utilisé en France : désactivé tant que XAI_API_KEY n'est pas fourni.
 */
import type { RawSource } from '../types';
import { env } from '../util';
import { frenchUserInstructions } from './deepseek';
import {
  type AskContext,
  type AskResult,
  type EngineProvider,
  type Json,
  ProviderError,
  USD_TO_EUR,
  engineEndpoints,
  postJson,
  uniqueSources,
  uniqueUrls,
} from './http';
import { parseOutput } from './openai';

export const GROK_COST_PER_CALL_EUR = 0.035 * USD_TO_EUR;

export function grokModel(): string {
  return env('XAI_MODEL') || 'grok-4.3';
}

export function parseGrok(data: Json): AskResult {
  const base = parseOutput(data);
  const retrieved: RawSource[] = (Array.isArray(data?.citations) ? data.citations : [])
    .filter((u: unknown): u is string => typeof u === 'string')
    .map((url: string) => ({ url, kind: 'retrieved' as const }));
  // Le titre d'une annotation xAI est le numéro de citation (« 1 ») : pas un titre de page.
  const cited = (base.sources ?? []).map((s) => (s.title && /^\d+$/.test(s.title) ? { ...s, title: undefined } : s));
  const sources = uniqueSources(cited.length ? [...cited, ...retrieved] : retrieved.map((r) => ({ ...r, kind: 'cited' as const })));
  return { text: base.text, citations: base.citations.length ? base.citations : uniqueUrls(retrieved.map((r) => r.url)), sources };
}

export function createGrokProvider(): EngineProvider | null {
  const apiKey = env('XAI_API_KEY');
  if (!apiKey) return null;
  const model = grokModel();
  return {
    id: 'grok',
    model,
    demo: false,
    costPerCallEur: GROK_COST_PER_CALL_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const data = await postJson('xai', `${engineEndpoints().xai}/responses`, { Authorization: `Bearer ${apiKey}` }, {
        model,
        input: [
          { role: 'system', content: frenchUserInstructions(ctx) },
          { role: 'user', content: query },
        ],
        tools: [{ type: 'web_search' }],
        include: ['no_inline_citations'],
        max_output_tokens: 1500,
        store: false,
      });
      if (data?.error) throw new ProviderError('xai', data.error?.message ?? JSON.stringify(data.error).slice(0, 300));
      const r = parseGrok(data);
      if (!r.text) throw new ProviderError('xai', `réponse vide (status=${data?.status ?? '?'})`);
      return r;
    },
  };
}
