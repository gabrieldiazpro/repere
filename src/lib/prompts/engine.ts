/**
 * Lien avec le moteur : les questions suivies actives deviennent les QuerySpec de `runAudit(input, { queries })`.
 */
import { ANGLE_INTENT } from '@/lib/engine/queries-v2';
import type { QueryIntent, QuerySpec } from '@/lib/engine/types';
import { shortHash } from '@/lib/engine/util';
import { normalizeQuestion } from './text';
import { ANGLE_PROMPT_INTENT, PROMPT_ANGLE, type PromptIntent, type TrackedPrompt } from './types';

const V1_INTENT_TO_PROMPT: Record<QueryIntent, PromptIntent> = {
  best: 'recommandation',
  nearby: 'proximite',
  urgent: 'urgence',
  specific: 'service',
  review: 'avis',
};

/** Intention Repéré d'une requête du moteur (angle V2 si présent, sinon intention V1). */
export function intentOfQuery(q: Pick<QuerySpec, 'intent' | 'angle' | 'kind' | 'id'>): PromptIntent {
  if (q.angle) return ANGLE_PROMPT_INTENT[q.angle];
  if (q.kind === 'brand' || /^B\d/.test(q.id)) return 'marque';
  return V1_INTENT_TO_PROMPT[q.intent] ?? 'recommandation';
}

/**
 * Identifiant de requête stable d'une question :
 * - question issue d'un gabarit du moteur : son identifiant d'origine (« T1-fd2c »), l'historique reste continu ;
 * - sinon `U<n>-<hash du texte normalisé>` (le préfixe ne commence jamais par « B », réservé aux requêtes de marque,
 *   sauf pour une question de marque, préfixée « BU »).
 */
export function queryIdOf(p: Pick<TrackedPrompt, 'text' | 'queryId' | 'intent'>): string {
  if (p.queryId) return p.queryId;
  const h = shortHash(normalizeQuestion(p.text), 6);
  return p.intent === 'marque' ? `BU-${h}` : `U-${h}`;
}

/** QuerySpec d'une question suivie. */
export function promptToQuery(p: TrackedPrompt): QuerySpec {
  const angle = PROMPT_ANGLE[p.intent];
  return {
    id: queryIdOf(p),
    text: p.text,
    intent: ANGLE_INTENT[angle],
    angle,
    kind: p.intent === 'marque' ? 'brand' : 'reco',
  };
}

/** Questions actives → requêtes du moteur (ordre conservé, doublons de texte retirés). */
export function promptsToQueries(prompts: readonly TrackedPrompt[]): QuerySpec[] {
  const seen = new Set<string>();
  const out: QuerySpec[] = [];
  for (const p of prompts) {
    if (!p.active) continue;
    const key = normalizeQuestion(p.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(promptToQuery(p));
  }
  return out;
}
