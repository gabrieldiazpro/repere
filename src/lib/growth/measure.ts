import { getLatestAuditForBusiness, isDemoBusinessId, type BusinessRecord } from '@/lib/db';
import { isHouseBusinessId } from '@/lib/house';
import type { AuditResult } from '@/lib/engine';
import { DAY_MS } from './constants';

/** Mesure réelle la plus récente d'un commerce : jamais un compte démo ni un audit simulé. */
export async function latestRealMeasure(businessId: string): Promise<{ audit: AuditResult; measuredAt: string } | null> {
  if (isDemoBusinessId(businessId) || isHouseBusinessId(businessId)) return null;
  const audit = await getLatestAuditForBusiness(businessId).catch(() => null);
  if (!audit || audit.demo) return null;
  const measuredAt = audit.measuredAt || audit.createdAt;
  return Number.isFinite(Date.parse(measuredAt)) ? { audit, measuredAt } : null;
}

/** Âge en jours (fractionnaire) d'une date ISO ; Infinity si la date est invalide. */
export function ageInDays(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now.getTime() - t) / DAY_MS) : Infinity;
}

export function isFresh(iso: string, maxDays: number, now: Date = new Date()): boolean {
  return ageInDays(iso, now) < maxDays;
}

export const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « novembre 2026 » (UTC, sans dépendre de l'ICU du serveur). */
export function monthYearFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type { BusinessRecord };
