import { describe, expect, it } from 'vitest';
import { getEntitlements } from '@/lib/entitlements';
import { DECOUVERTE_PLANS, PLANS, V2_PLANS, planTier, type Plan, type PlanId } from '@/lib/plans';
import type { ProviderId } from '@/lib/engine/types';
import type { Segment } from '@/lib/engine/types-v2';

const NAME: Record<string, ProviderId> = { chatgpt: 'chatgpt', gemini: 'gemini', perplexity: 'perplexity', claude: 'claude', mistral: 'mistral' };

/** IA annoncées par une ligne « N IA : A, B, C » des fonctionnalités (null si aucune ligne). */
function announced(p: Plan): ProviderId[] | null {
  const line = p.features.find((f) => /^\d IA : /.test(f));
  if (!line) return null;
  const [, n, list] = /^(\d) IA : (.+)$/.exec(line)!;
  const ids = list.split(/,\s*|\s+et\s+/).map((x) => NAME[x.trim().toLowerCase()]);
  expect(ids.every(Boolean), `${p.id} : IA inconnue dans « ${line} »`).toBe(true);
  expect(ids.length, `${p.id} : le nombre annoncé ne correspond pas à la liste`).toBe(Number(n));
  return ids;
}

/** Offre dont une offre « Tout Essentiel » / annuelle / Réseau hérite. */
function parentOf(p: Plan): Plan | undefined {
  const id = p.id.endsWith('_year') ? p.id.replace(/_year$/, '_month') : p.id.startsWith('local_reseau') ? 'local_essentiel_month' : null;
  return id ? PLANS.find((x) => x.id === id) : undefined;
}

const segOf = (p: Plan): Segment | undefined => (p.segment === 'agence' ? undefined : p.segment);

describe('plans.ts ↔ getEntitlements : IA annoncées = IA suivies', () => {
  const subscriptions = [...V2_PLANS, ...DECOUVERTE_PLANS].filter((p) => p.interval !== 'one_time' || p.id.endsWith('_decouverte'));
  const tiered = subscriptions.filter((p) => planTier(p.id as PlanId) !== 'free' || p.id.endsWith('_decouverte'));

  it.each(tiered.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    const tier = p.id.endsWith('_decouverte') ? 'free' : planTier(p.id as PlanId);
    const ent = getEntitlements({ id: 'b-test', plan: tier, segment: segOf(p), planId: p.id as PlanId, isActive: true });
    let own: ProviderId[] | null = null;
    for (let cur: Plan | undefined = p; cur && !own; cur = parentOf(cur)) own = announced(cur);
    expect(own, `${p.id} : aucune ligne « N IA : … » (ni héritée)`).not.toBeNull();
    expect([...own!].sort()).toEqual([...ent.engines].sort());
  });

  it('aucune offre n’annonce AI Overviews, AI Mode ni Copilot (décision 3 du contrat V3)', () => {
    for (const p of PLANS) for (const f of p.features) expect(f, p.id).not.toMatch(/overview|ai mode|copilot/i);
  });
});
