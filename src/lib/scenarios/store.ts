/**
 * Stockage du simulateur (SCENARIOS, V9) :
 * - `scenarios.snapshot` : la DERNIÈRE exploration complète de l'espace (HTML compris) et les mesures de vitesse
 *   utilisées pour son audit — sans elles, impossible de rejouer exactement les contrôles. Une seule par espace,
 *   remplacée à chaque exploration ; jamais exposée au navigateur.
 * - `scenarios.launch` : scénarios lancés (suivi « prévu vs mesuré » à l'exploration suivante).
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import type { PerfData } from '@/lib/seodata/types';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import type { ScenarioLaunch } from './types';

export const SNAPSHOT_COLLECTION = 'scenarios.snapshot';
export const LAUNCH_COLLECTION = 'scenarios.launch';
/** Au-delà, l'exploration n'est pas conservée (la page le dit) : 25 millions de caractères sérialisés. */
export const SNAPSHOT_MAX_CHARS = 25_000_000;

export interface CrawlSnapshot {
  runId: string;
  runAt: string;
  crawl: SiteCrawl | null;
  perf?: PerfData | PerfData[];
  /** raison si l'exploration n'a pas été conservée */
  skipped?: string;
}

/** Conserve l'exploration qui a servi à l'audit `runId`. Ne lève pas (l'exploration ne doit pas échouer pour ça). */
export async function saveSnapshot(businessId: string, runId: string, runAt: string, crawl: SiteCrawl, perf?: PerfData | PerfData[]): Promise<CrawlSnapshot> {
  let snap: CrawlSnapshot = { runId, runAt, crawl, ...(perf ? { perf } : {}) };
  try {
    const size = JSON.stringify(snap).length;
    if (size > SNAPSHOT_MAX_CHARS) snap = { runId, runAt, crawl: null, skipped: `Exploration trop volumineuse pour être rejouée (${Math.round(size / 1_000_000)} millions de caractères).` };
    await putDoc(SNAPSHOT_COLLECTION, businessId, snap, businessId);
  } catch {
    /* stockage indisponible : la page des scénarios le dira */
  }
  return snap;
}

export async function getSnapshot(businessId: string): Promise<CrawlSnapshot | null> {
  const d = await getDoc<CrawlSnapshot>(SNAPSHOT_COLLECTION, businessId).catch(() => null);
  return d && d.businessId === businessId ? d.data : null;
}

export async function saveLaunch(l: ScenarioLaunch): Promise<void> {
  await putDoc(LAUNCH_COLLECTION, l.id, l, l.businessId);
}

export async function listLaunches(businessId: string, limit = 10): Promise<ScenarioLaunch[]> {
  const docs = await listDocs<ScenarioLaunch>(LAUNCH_COLLECTION, { businessId, limit }).catch(() => []);
  return docs
    .map((d) => d.data)
    .filter((l) => l && l.businessId === businessId)
    .sort((a, b) => b.at.localeCompare(a.at));
}
