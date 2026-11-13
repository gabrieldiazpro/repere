/**
 * Petit client LLM du module EXÉCUTION : le fournisseur le moins cher disponible.
 * Ordre : OpenAI (modèle « mini ») puis Anthropic (Haiku). Sans clé : null → gabarits.
 * Modèles surchargeables : EXEC_OPENAI_MODEL, EXEC_ANTHROPIC_MODEL. Désactivation : EXEC_LLM=off.
 */

import { getDoc, incrDoc } from '@/lib/store';

/** Plafond quotidien d'appels LLM d'exécution, tous comptes confondus (EXEC_LLM_DAILY_CALLS, défaut 300 — E2). */
export async function underDailyCap(now: Date = new Date()): Promise<boolean> {
  const day = `day:${now.toISOString().slice(0, 10)}`;
  await incrDoc('exec.usage', day, { calls: 1 });
  const n = (await getDoc<{ calls?: number }>('exec.usage', day))?.data.calls ?? 0;
  const cap = Number(process.env.EXEC_LLM_DAILY_CALLS || 300);
  return n <= (Number.isFinite(cap) && cap >= 0 ? cap : 300);
}

export interface LlmRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** réponse JSON attendue */
  json?: boolean;
  timeoutMs?: number;
}

export type LlmProvider = 'openai' | 'anthropic';

function env(k: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[k] : undefined;
}

export function llmProvider(): LlmProvider | null {
  if (env('EXEC_LLM') === 'off' || env('VITEST')) return null;
  if (env('OPENAI_API_KEY')) return 'openai';
  if (env('ANTHROPIC_API_KEY')) return 'anthropic';
  return null;
}

export function llmAvailable(): boolean {
  return llmProvider() !== null;
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`[exec/llm] HTTP ${res.status}`);
  return res.json();
}

/** Texte généré, ou null (pas de clé, erreur, délai dépassé). Ne lève jamais. */
export async function complete(req: LlmRequest): Promise<string | null> {
  const p = llmProvider();
  if (!p) return null;
  if (!(await underDailyCap().catch(() => false))) return null; // plafond atteint : gabarits
  const timeoutMs = req.timeoutMs ?? 25_000;
  const maxTokens = req.maxTokens ?? 900;
  try {
    if (p === 'openai') {
      const data = (await post(
        'https://api.openai.com/v1/chat/completions',
        { Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
        {
          model: env('EXEC_OPENAI_MODEL') || 'gpt-5-mini',
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
          max_completion_tokens: maxTokens * 3, // marge pour le raisonnement des modèles récents
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        },
        timeoutMs,
      )) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    const data = (await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': env('ANTHROPIC_API_KEY') as string, 'anthropic-version': '2023-06-01' },
      {
        model: env('EXEC_ANTHROPIC_MODEL') || 'claude-haiku-4-5',
        max_tokens: maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
      },
      timeoutMs,
    )) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim();
    return text || null;
  } catch (e) {
    console.warn('[exec/llm]', (e as Error).message);
    return null;
  }
}

/** Extrait le premier objet JSON d'une réponse (tolère les blocs ```json). */
export function parseJsonObject<T>(s: string | null): T | null {
  if (!s) return null;
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export const SYSTEM_FR = [
  'Tu rédiges pour Repéré, service français de référencement IA, des textes prêts à coller pour une entreprise cliente.',
  'Règles : français, vouvoiement envers le lecteur, ton factuel et sobre, aucun superlatif invérifiable,',
  "aucune promesse de résultat, n'invente AUCUN fait (prix, date, chiffre, certification) absent du contexte fourni ;",
  "si une information manque, écris [à compléter]. Pas d'emoji. Pas de mots-clés empilés.",
].join(' ');
