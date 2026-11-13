/**
 * Benchmark (docs/v2/06-indispensable.md § 6).
 * - Rang dans l'audit : le client parmi les acteurs que les IA citent pour les mêmes questions (dès le 1er client).
 * - Benchmark sectoriel anonymisé : moyennes de cohorte (métier × zone) publiées seulement à partir de 5 entreprises.
 */
import type { AuditResult } from '@/lib/engine';
import type { AuditResultV2Ext, BenchmarkPosition } from '@/lib/engine/types-v2';
import { auditStats, benchmarkOfAudit } from './stats';

export const MIN_COHORT = 5;

type AuditV2 = AuditResult & AuditResultV2Ext;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();




/** Nombre de réponses qui citent le client (même unité que les citations des concurrents). Voir ./stats.ts. */
export function clientMentions(a: AuditResult): number {
  return auditStats(a as AuditV2).citations;
}

/** Rang du client parmi les acteurs cités dans l'audit (1 = le plus cité). Calcul unique : ./stats.ts. */
export function rankInAudit(a: AuditV2): BenchmarkPosition {
  return benchmarkOfAudit(a);
}

export interface SectorBenchmark {
  cohort: { trade: string; city: string; district?: string };
  businesses: number;
  medianScore: number;
  averageScore: number;
  /** part des entreprises de la cohorte avec un score inférieur au client (0–1) */
  percentile: number;
  topQuartileScore: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Benchmark anonymisé : null tant que la cohorte compte moins de MIN_COHORT entreprises (le client inclus). */
export function sectorBenchmark(client: AuditV2, cohortAudits: AuditResult[]): SectorBenchmark | null {
  const own = norm(client.input.businessName);
  const peers = cohortAudits.filter((a) => norm(a.input.businessName) !== own);
  const scores = [...peers.map((a) => a.score), client.score];
  if (scores.length < MIN_COHORT) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  return {
    cohort: { trade: client.input.trade, city: client.input.city, district: client.input.district },
    businesses: scores.length,
    medianScore: median(scores),
    averageScore: Math.round(scores.reduce((s, x) => s + x, 0) / scores.length),
    percentile: Math.round((peers.filter((a) => a.score < client.score).length / scores.length) * 100) / 100,
    topQuartileScore: sorted[Math.floor(sorted.length * 0.75)],
  };
}
