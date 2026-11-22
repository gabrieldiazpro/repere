/** Sélection des IA : provider réel si la clé existe, sinon mock (demo:true). */
import { ALL_PROVIDERS, EXTENDED_PROVIDERS, type AuditInput, type ExtendedProviderId, type ProviderId } from '../types';
import { env } from '../util';
import { createAnthropicExtractor, createAnthropicProvider } from './anthropic';
import { createGeminiExtractor, createGeminiProvider } from './gemini';
import type { EngineProvider, Extractor } from './http';
import { createMockProviderV2 } from './mock-v2';
import { createOpenAIExtractor, createOpenAIProvider } from './openai';
import { createMistralExtractor, createMistralProvider } from './mistral';
import { createPerplexityProvider } from './perplexity';
import { createDeepseekProvider } from './deepseek';
import { createGrokProvider } from './grok';
import { createSerpProvider } from './serp';

export * from './http';
export { createMistralProvider, createMistralExtractor, parseMistralConversation, mistralModel, MISTRAL_COST_PER_CALL_EUR } from './mistral';
export { createDeepseekProvider, parseDeepseek, deepseekModel, DEEPSEEK_COST_PER_CALL_EUR } from './deepseek';
export { createGrokProvider, parseGrok, grokModel, GROK_COST_PER_CALL_EUR } from './grok';
export { createSerpProvider, parseSerpAi, serpTaskFor, enabledSerpEngines, SERP_ENGINES, SERP_COST_USD, type SerpEngineId } from './serp';
export { providerMethod, methodNote, serpDevice, type ProviderMethod } from './methods';
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
    const alias: Record<string, ProviderId> = {
      openai: 'chatgpt', anthropic: 'claude', google: 'gemini', lechat: 'mistral', 'le-chat': 'mistral', vibe: 'mistral',
      aio: 'google_aio', ai_overviews: 'google_aio', ai_mode: 'google_ai_mode', bing: 'copilot', xai: 'grok',
    };
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
  const base: ProviderId[] = env('MISTRAL_API_KEY') ? [...DEFAULT_PROVIDERS, 'claude', 'mistral'] : [...DEFAULT_PROVIDERS, 'claude'];
  return [...base, ...configuredExtended()];
}

/** V8 : IA en option réellement configurées (clé ou activation présente), dans l'ordre d'affichage. */
export function configuredExtended(): ExtendedProviderId[] {
  return EXTENDED_PROVIDERS.filter((p) => isConfigured(p));
}

/** Vrai si l'IA peut être interrogée pour de vrai (clé ou activation présente). */
export function isConfigured(id: ProviderId): boolean {
  try {
    return !!createRealProvider(id);
  } catch {
    return false;
  }
}

/**
 * V8 : IA en option ajoutées aux mesures PAYANTES dont la liste d'IA vient des droits de l'offre
 * (AUDIT_PAID_EXTRA_ENGINES, ex. « google_aio,google_ai_mode,copilot,deepseek » ; vide par défaut). Interrupteur
 * plateforme en attendant que les offres (plans.ts + entitlements.ts) les annoncent : seules les IA configurées comptent.
 */
export function paidExtraEngines(): ExtendedProviderId[] {
  const raw = (env('AUDIT_PAID_EXTRA_ENGINES') || '').trim().toLowerCase();
  if (!raw) return [];
  const all = raw === 'all' || raw === 'on' || raw === '1';
  const alias: Record<string, ExtendedProviderId> = { aio: 'google_aio', ai_overviews: 'google_aio', ai_mode: 'google_ai_mode', bing: 'copilot', xai: 'grok' };
  const ids = raw.split(/[\s,;]+/).map((s) => alias[s] ?? s);
  return configuredExtended().filter((p) => all || ids.includes(p));
}

/** V8 : IA en option (non historiques) : désactivées, donc retirées d'un audit réel, si non configurées. */
export function isExtended(id: ProviderId): id is ExtendedProviderId {
  return (EXTENDED_PROVIDERS as string[]).includes(id);
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
    case 'deepseek':
      return createDeepseekProvider();
    case 'grok':
      return createGrokProvider();
    case 'google_aio':
    case 'google_ai_mode':
    case 'copilot':
      return createSerpProvider(id);
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
