/** Sélection des IA : provider réel si la clé existe, sinon mock (demo:true). */
import { ALL_PROVIDERS, type AuditInput, type ProviderId } from '../types';
import { env } from '../util';
import { createAnthropicExtractor, createAnthropicProvider } from './anthropic';
import { createGeminiExtractor, createGeminiProvider } from './gemini';
import type { EngineProvider, Extractor } from './http';
import { createMockProviderV2 } from './mock-v2';
import { createOpenAIExtractor, createOpenAIProvider } from './openai';
import { createMistralExtractor, createMistralProvider } from './mistral';
import { createPerplexityProvider } from './perplexity';

export * from './http';
export { createMistralProvider, createMistralExtractor, parseMistralConversation, mistralModel, MISTRAL_COST_PER_CALL_EUR } from './mistral';
export { mockAnswer, createMockProvider, competitorPool, defaultSeed } from './mock';
export {
  mockAnswerV2,
  createMockProviderV2,
  createMockFacts,
  segmentCompetitorPool,
  wrongValue,
  DEMO_ERROR_FIELD,
  DEMO_ERROR_PROVIDER,
} from './mock-v2';

export const DEFAULT_PROVIDERS: ProviderId[] = ['chatgpt', 'perplexity', 'gemini'];

/**
 * Liste des IA : AUDIT_PROVIDERS (ex. « chatgpt,perplexity,claude,mistral ») sinon défaut ; + Claude en suivi payant ;
 * + Mistral (Le Chat) en suivi payant quand MISTRAL_API_KEY est présente (option, décision 3 des contrats V3).
 * L'audit gratuit reste à 3 IA (budget).
 */
export function selectedProviders(mode: 'free' | 'paid' = 'free'): ProviderId[] {
  const raw = env('AUDIT_PROVIDERS');
  if (raw && raw.trim()) {
    const alias: Record<string, ProviderId> = { openai: 'chatgpt', anthropic: 'claude', google: 'gemini', lechat: 'mistral', 'le-chat': 'mistral' };
    const ids = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((s) => alias[s] ?? s)
      .filter((s): s is ProviderId => (ALL_PROVIDERS as string[]).includes(s));
    const uniq = [...new Set(ids)];
    if (uniq.length) return uniq;
  }
  if (mode !== 'paid') return [...DEFAULT_PROVIDERS];
  return env('MISTRAL_API_KEY') ? [...DEFAULT_PROVIDERS, 'claude', 'mistral'] : [...DEFAULT_PROVIDERS, 'claude'];
}

export function createRealProvider(id: ProviderId): EngineProvider | null {
  switch (id) {
    case 'chatgpt':
      return createOpenAIProvider();
    case 'perplexity':
      return createPerplexityProvider();
    case 'gemini':
      return createGeminiProvider();
    case 'claude':
      return createAnthropicProvider();
    case 'mistral':
      return createMistralProvider();
    default:
      return null;
  }
}

/** Provider réel, ou mock si la clé manque (ou si forceMock). */
export function getProvider(id: ProviderId, input: AuditInput, seed: string, forceMock = false): EngineProvider {
  return (!forceMock && createRealProvider(id)) || createMockProviderV2(id, input, seed);
}

/** Extracteur le moins cher disponible (OpenAI json_object, puis Claude Haiku, puis Gemini, puis Mistral), ou null. */
export function getExtractor(): Extractor | null {
  if ((env('AUDIT_EXTRACTOR') || '').toLowerCase() === 'heuristic') return null;
  return createOpenAIExtractor() ?? createAnthropicExtractor() ?? createGeminiExtractor() ?? createMistralExtractor();
}
