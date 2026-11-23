// Données de /app/scenarios (serveur uniquement) — SCENARIOS (V9).
// Exploration : démo = exploration de démonstration (même fonction que /app/seo) ; compte réel = instantané conservé
// à la dernière exploration (src/lib/scenarios/store.ts). Audit : auditBoth, la fonction de /app/seo, telle quelle.
import { cache } from 'react';
import type { SiteCrawl } from '@/lib/crawl/types';
import type { PerfData } from '@/lib/seodata/types';
import { DEMO_CRAWL_STAGES, demoSiteCrawl } from '@/lib/seoaudit/demo-crawl';
import type { DemoId } from '@/lib/demo-v2';
import { providersForBusiness } from '@/lib/seodata/providers';
import { auditBoth, loadSeoSuite, type SeoSuite } from '@/components/app/seo/data';
import type { SeoRun } from '@/components/app/seo/model';
import { buildScenarios, candidatesOf, locate, rankCandidates, simulate, lean, followUp, type Auditor, type Candidate, type LaunchFollowUp, type Reports, type Scenario, type ScenarioLaunch } from '@/lib/scenarios';
import { getSnapshot, listLaunches } from '@/lib/scenarios/store';

export type ScenarioState =
  | { kind: 'ready' }
  | { kind: 'no_run' }
  | { kind: 'no_snapshot'; reason: string };

export interface ScenarioContext {
  suite: SeoSuite;
  state: ScenarioState;
  latest: SeoRun | null;
  crawl: SiteCrawl | null;
  auditor: Auditor | null;
  base: Reports | null;
  /** le recalcul de l'exploration redonne-t-il les scores affichés dans « SEO et GEO » ? */
  consistent: boolean;
}

/** Plafond de constats dont l'effet seul est mesuré, selon la taille du site (une relance d'audit chacun). */
function aloneBudget(pages: number): number {
  return pages > 400 ? 6 : pages > 150 ? 10 : pages > 60 ? 16 : 24;
}

async function demoPerf(id: string): Promise<PerfData | undefined> {
  // Même mesure que les explorations de démonstration de /app/seo (src/components/app/seo/data.ts).
  try {
    const { ctx, p } = await providersForBusiness(id);
    return p.perf && ctx.domain ? await p.perf.measure(`https://${id === 'demo-ecom' ? 'www.' : ''}${ctx.domain}/`).catch(() => undefined) : undefined;
  } catch {
    return undefined;
  }
}

export const loadScenarioContext = cache(async (): Promise<ScenarioContext> => {
  const suite = await loadSeoSuite();
  const latest = suite.latest;
  const empty = { suite, latest, crawl: null, auditor: null, base: null, consistent: false };
  if (!latest) return { ...empty, state: { kind: 'no_run' } };

  let crawl: SiteCrawl | null = null;
  let perf: PerfData | PerfData[] | undefined;
  if (suite.demo) {
    crawl = demoSiteCrawl(suite.ws.business.id as DemoId, DEMO_CRAWL_STAGES - 1);
    perf = await demoPerf(suite.ws.business.id);
  } else {
    const snap = await getSnapshot(suite.ws.business.id);
    if (!snap) return { ...empty, state: { kind: 'no_snapshot', reason: 'Votre dernière exploration date d’avant le simulateur : relancez-la une fois pour que Repéré puisse rejouer ses contrôles.' } };
    if (snap.runId !== latest.id) return { ...empty, state: { kind: 'no_snapshot', reason: 'L’exploration conservée ne correspond pas à la dernière : relancez l’exploration pour simuler à partir de l’état actuel.' } };
    if (!snap.crawl) return { ...empty, state: { kind: 'no_snapshot', reason: snap.skipped ?? 'L’exploration n’a pas pu être conservée.' } };
    crawl = snap.crawl;
    perf = snap.perf;
  }
  const ws = suite.ws;
  const auditor: Auditor = (c) => {
    const r = auditBoth(c, ws, perf);
    return { seo: r.seo, geo: r.geo };
  };
  const base = auditor(crawl);
  const consistent = base.seo.score === latest.seo.score && base.geo.score === latest.geo.score;
  return { suite, latest, crawl, auditor, base, consistent, state: { kind: 'ready' } };
});

export interface ScenarioPageData {
  ranked: Candidate[];
  scenarios: Scenario[];
  aloneMeasured: number;
}

export const loadScenarioPage = cache(async (): Promise<ScenarioPageData | null> => {
  const c = await loadScenarioContext();
  if (!c.crawl || !c.auditor || !c.base) return null;
  const ranked = rankCandidates(c.crawl, c.auditor, c.base, candidatesOf(c.base), aloneBudget(c.crawl.pages.length));
  const scenarios = buildScenarios(c.crawl, c.auditor, c.base, ranked);
  return { ranked, scenarios, aloneMeasured: ranked.filter((r) => r.alone).length };
});

export interface FollowView {
  launch: ScenarioLaunch;
  follow: LaunchFollowUp;
}

/**
 * Suivi des scénarios lancés. Démo : un lancement de démonstration calculé par le même moteur sur l'exploration
 * précédente (corrections réellement faites entre les deux explorations de démo), comparé à la dernière exploration.
 */
export const loadFollowUps = cache(async (): Promise<FollowView[]> => {
  const c = await loadScenarioContext();
  const runs = c.suite.runs.map((r) => ({ id: r.id, at: r.at, seo: r.seo, geo: r.geo }));
  if (!c.suite.demo) {
    const launches = await listLaunches(c.suite.ws.business.id);
    return launches.map((l) => ({ launch: l, follow: followUp(l, runs) }));
  }
  if (!c.auditor || c.suite.runs.length < 2) return [];
  const prevRun = c.suite.runs[c.suite.runs.length - 2];
  const last = c.suite.runs[c.suite.runs.length - 1];
  const prevCrawl = demoSiteCrawl(c.suite.ws.business.id as DemoId, DEMO_CRAWL_STAGES - 2);
  const prevBase = c.auditor(prevCrawl);
  const now = locate({ seo: last.seo, geo: last.geo });
  const fixedKeys = [...locate(prevBase).values()].filter((x) => x.f.severity !== 'info' && !now.has(x.key)).map((x) => x.key);
  const sim = simulate(prevCrawl, c.auditor, prevBase, fixedKeys);
  const keys = sim.applied.map((a) => a.key);
  if (!keys.length) return [];
  const at = new Date(Date.parse(prevRun.at) + 86_400_000).toISOString();
  const r = lean(sim);
  const launch: ScenarioLaunch = {
    id: 'demo-launch',
    businessId: c.suite.ws.business.id,
    at,
    runId: prevRun.id,
    runAt: prevRun.at,
    title: 'Scénario de démonstration : corrections faites entre les deux dernières explorations',
    keys,
    titles: Object.fromEntries(sim.applied.map((a) => [a.key, a.title])),
    predicted: { seo: r.after.seo, geo: r.after.geo, resolved: r.resolved, sections: r.sections.filter((s) => s.after !== s.before) },
    before: r.before,
    changeSetIds: [],
    taskIds: [],
    demo: true,
  };
  return [{ launch, follow: followUp(launch, runs) }];
});
