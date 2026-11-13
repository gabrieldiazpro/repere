/**
 * Gemini via l'Interactions API + google_search (docs/04-api-ia.md § 3).
 * Rappel CGU (§ 5) : les Grounded Results ne doivent être ni mis en cache ni revendus.
 * Ancrage Google Search DÉSACTIVÉ par défaut (qa/ARBITRAGES.md n° 9) tant que les CGU de l'ancrage
 * ne sont pas validées : il faut GEMINI_GROUNDING=on explicitement pour l'activer.
 */
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
  uniqueUrls,
} from './http';

const URL_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export function geminiModel(): string {
  return env('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
}

function parse(data: Json): AskResult {
  const texts: string[] = [];
  const urls: unknown[] = [];
  for (const step of data?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const c of step.content ?? []) {
      if (c?.type === 'text' && typeof c.text === 'string') {
        texts.push(c.text);
        for (const a of c.annotations ?? []) {
          if (a?.type !== 'url_citation') continue;
          // Les URL peuvent être des redirections : le titre porte alors le domaine.
          const redirect = typeof a.url === 'string' && a.url.includes('grounding-api-redirect');
          urls.push(redirect && typeof a.title === 'string' && /\./.test(a.title) ? `https://${a.title}` : a.url);
        }
      }
    }
  }
  if (!texts.length && data?.candidates?.length) {
    const cand = data.candidates[0];
    for (const p of cand?.content?.parts ?? []) if (typeof p.text === 'string') texts.push(p.text);
    for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) urls.push(ch?.web?.uri);
  }
  return { text: texts.join('\n').trim(), citations: uniqueUrls(urls) };
}

function headers(apiKey: string): Record<string, string> {
  return { 'x-goog-api-key': apiKey, 'Api-Revision': env('GEMINI_API_REVISION') || '2026-05-20' };
}

export function createGeminiProvider(): EngineProvider | null {
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) return null;
  const model = geminiModel();
  const grounding = (env('GEMINI_GROUNDING') || 'off').toLowerCase() === 'on';
  return {
    id: 'gemini',
    model,
    demo: false,
    costPerCallEur: 0.016 * USD_TO_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const where = [ctx.city, ctx.country ?? 'France'].filter(Boolean).join(', ');
      const input = where ? `${query}\n\n(Contexte : l'utilisateur se trouve à ${where}.)` : query;
      const data = await postJson('gemini', URL_INTERACTIONS, headers(apiKey), {
        model,
        input,
        ...(grounding ? { tools: [{ type: 'google_search' }] } : {}),
      });
      if (data?.error) throw new ProviderError('gemini', data.error.message ?? 'erreur inconnue', data.error.code);
      const out = parse(data);
      if (!out.text) throw new ProviderError('gemini', 'réponse vide (blocage sécurité ou format inattendu)');
      return out;
    },
  };
}

export function createGeminiExtractor(): Extractor | null {
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) return null;
  const model = env('GEMINI_EXTRACT_MODEL') || geminiModel();
  return {
    vendor: 'gemini',
    model,
    costPerCallEur: 0.0004 * USD_TO_EUR,
    async completeJson(system: string, user: string): Promise<string> {
      const data = await postJson('gemini', URL_INTERACTIONS, headers(apiKey), {
        model,
        input: `${system}\n\n${user}`,
      });
      if (data?.error) throw new ProviderError('gemini', data.error.message ?? 'erreur inconnue');
      const out = parse(data);
      if (!out.text) throw new ProviderError('gemini', 'extraction vide');
      return out.text;
    },
  };
}
