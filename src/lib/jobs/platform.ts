/**
 * Droits utiles à la file (fréquence des ré-audits, IA incluses), lus dans `@/lib/entitlements` (agent COMPTES).
 */
import type { Business } from '@/lib/db';
import type { ProviderId } from '@/lib/engine';
import { getEntitlements } from '@/lib/entitlements';

export type Frequency = 'monthly' | 'weekly' | 'daily';

export interface SchedulingEntitlements {
  tier: 'decouverte' | 'essentiel' | 'accompagne' | 'agence' | 'demo';
  frequency: Frequency;
  engines: ProviderId[];
}

export function entitlementsFor(business: Pick<Business, 'id' | 'plan' | 'segment' | 'planId'> & { isActive?: boolean }): SchedulingEntitlements {
  const e = getEntitlements(business);
  return { tier: e.tier, frequency: e.frequency, engines: e.engines };
}

/** Écart minimal entre deux mesures planifiées. */
export const MIN_INTERVAL_MS: Record<Frequency, number> = {
  monthly: 28 * 86_400_000,
  weekly: 6 * 86_400_000 + 12 * 3600_000,
  daily: 20 * 3600_000,
};

/** Clé de période (dédoublonnage des ré-audits) : 2026-11 / 2026-W46 / 2026-11-09. */
export function periodKey(freq: Frequency, d: Date): string {
  const iso = d.toISOString();
  if (freq === 'monthly') return iso.slice(0, 7);
  if (freq === 'daily') return iso.slice(0, 10);
  // Semaine ISO
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Un ré-audit est-il dû ? (dernier audit trop ancien pour la fréquence de l'offre). */
export function isAuditDue(freq: Frequency, lastAuditAt: string | null | undefined, now: Date): boolean {
  if (!lastAuditAt) return true;
  const t = Date.parse(lastAuditAt);
  return !Number.isFinite(t) || now.getTime() - t >= MIN_INTERVAL_MS[freq];
}
