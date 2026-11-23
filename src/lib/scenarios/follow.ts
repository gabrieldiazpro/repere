/**
 * Suivi « prévu vs mesuré » (SCENARIOS, V9) : après le lancement d'un scénario, la première exploration suivante
 * dit ce qui est réellement réglé. Pur (les explorations sont fournies par l'appelant).
 */
import { locate } from './engine';
import type { LaunchFollowUp, Reports, ScenarioLaunch } from './types';

export interface RunLike extends Reports {
  id: string;
  at: string;
}

/** Première exploration postérieure au lancement (null = en attente). */
export function nextRunAfter<T extends RunLike>(launch: Pick<ScenarioLaunch, 'at' | 'runId'>, runs: T[]): T | null {
  return [...runs].sort((a, b) => a.at.localeCompare(b.at)).find((r) => r.at > launch.at && r.id !== launch.runId) ?? null;
}

export function followUp(launch: ScenarioLaunch, runs: RunLike[]): LaunchFollowUp {
  const next = nextRunAfter(launch, runs);
  const predicted = { seo: launch.predicted.seo, geo: launch.predicted.geo };
  const present = next ? locate(next) : null;
  const findings = launch.keys.map((key) => ({
    key,
    title: launch.titles[key] ?? key,
    predictedResolved: launch.predicted.resolved.includes(key),
    measuredResolved: present ? !present.has(key) : null,
  }));
  if (!next) return { status: 'waiting', predicted, findings };
  return { status: 'measured', measuredAt: next.at, predicted, measured: { seo: next.seo.score, geo: next.geo.score }, findings };
}
