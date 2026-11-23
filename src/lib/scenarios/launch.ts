/**
 * « Lancer ce scénario » (SCENARIOS, V9) :
 * - corrections que Repéré peut préparer → BROUILLONS dans l'agent de publication (createChangeSets) : rien n'est
 *   publié, la validation humaine reste obligatoire (src/lib/publish/service.ts) ;
 * - corrections « vous » → tâches dans le Centre d'actions (createCustomTask), sans doublon d'une tâche ouverte ;
 * - le lancement est enregistré avec la prévision, pour le suivi « prévu vs mesuré » à l'exploration suivante.
 * Comptes démo : rien n'est créé (lecture seule), l'appelant le refuse avant.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import type { ExecTask } from '@/lib/engine/types-v2';
import type { Actor, ChangeSet, Finding } from '@/lib/publish/types';
import type { Plan, PlanSite } from '@/lib/publish/planner';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { locate, minutesOf, simulate, whoOf } from './engine';
import type { Auditor, Reports, ScenarioLaunch } from './types';

export interface LaunchDeps {
  createChangeSets: (businessId: string, findings: Finding[], site: PlanSite, actor: Actor) => Promise<Plan>;
  createCustomTask: (businessId: string, t: { title: string; why?: string; minutes?: number; impact?: 1 | 2 | 3; steps?: string[] }) => Promise<ExecTask>;
  listTasks: (businessId: string) => Promise<ExecTask[]>;
  saveLaunch: (l: ScenarioLaunch) => Promise<void>;
  siteFromCrawl: (crawl: SiteCrawl, extra: { businessId: string; name?: string; city?: string }) => PlanSite;
}

async function defaultDeps(): Promise<LaunchDeps> {
  const [pub, planner, exec, store] = await Promise.all([import('@/lib/publish/service'), import('@/lib/publish/planner'), import('@/lib/execution'), import('./store')]);
  return {
    createChangeSets: (b, f, s, a) => pub.createChangeSets(b, f, s, a),
    createCustomTask: exec.createCustomTask,
    listTasks: exec.listTasks,
    saveLaunch: store.saveLaunch,
    siteFromCrawl: planner.siteFromCrawl,
  };
}

export interface LaunchInput {
  businessId: string;
  crawl: SiteCrawl;
  auditor: Auditor;
  base: Reports;
  run: { id: string; at: string };
  keys: string[];
  title: string;
  actor: Actor;
  name?: string;
  city?: string;
  now?: Date;
}

export interface LaunchResult {
  launch: ScenarioLaunch;
  changeSets: number;
  tasks: number;
  /** corrections que l'agent n'a pas pu préparer (raison lisible) */
  skipped: string[];
}

export async function launchScenario(input: LaunchInput, deps?: Partial<LaunchDeps>): Promise<LaunchResult> {
  if (isDemoBusinessId(input.businessId)) throw new Error('Compte de démonstration : rien n’est créé.');
  const d = { ...(await defaultDeps()), ...deps } as LaunchDeps;
  const now = input.now ?? new Date();
  const found = locate(input.base);
  const chosen = [...new Set(input.keys)].map((k) => found.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
  if (!chosen.length) throw new Error('Aucune correction choisie.');
  const sim = simulate(input.crawl, input.auditor, input.base, chosen.map((c) => c.key));

  const forAgent = chosen.filter((c) => whoOf(c.f) !== 'vous').map((c) => c.f);
  const forYou = chosen.filter((c) => whoOf(c.f) === 'vous');
  const skipped: string[] = [];

  let changeSets: ChangeSet[] = [];
  if (forAgent.length) {
    try {
      const site = d.siteFromCrawl(input.crawl, { businessId: input.businessId, name: input.name, city: input.city });
      const plan = await d.createChangeSets(input.businessId, forAgent, site, input.actor);
      changeSets = plan.changeSets;
      for (const s of plan.skipped ?? []) skipped.push(`${s.findingId}${s.url ? ` (${s.url})` : ''} : ${s.reason}`);
    } catch (e) {
      skipped.push(`L’agent n’a pas pu préparer les corrections : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const taskIds: string[] = [];
  if (forYou.length) {
    const open = (await d.listTasks(input.businessId).catch(() => [] as ExecTask[])).filter((t) => t.status !== 'done');
    for (const c of forYou) {
      const same = open.find((t) => t.title === c.f.title);
      if (same) {
        taskIds.push(same.id);
        continue;
      }
      const pages = c.f.affected.slice(0, 5).map((a) => `Page concernée : ${a.url}${a.detail ? ` (${a.detail})` : ''}`);
      const t = await d.createCustomTask(input.businessId, {
        title: c.f.title,
        why: c.f.why,
        minutes: minutesOf(c.f),
        impact: c.f.impact,
        steps: [c.f.fix, ...pages, 'Après la correction, relancez l’exploration dans « SEO et GEO » : le scénario comparera le prévu et le mesuré.'],
      });
      taskIds.push(t.id);
    }
  }

  const launch: ScenarioLaunch = {
    id: `${input.businessId}:${now.toISOString()}`,
    businessId: input.businessId,
    at: now.toISOString(),
    runId: input.run.id,
    runAt: input.run.at,
    title: input.title.slice(0, 120),
    keys: chosen.map((c) => c.key),
    titles: Object.fromEntries(chosen.map((c) => [c.key, c.f.title])),
    predicted: { seo: sim.after.seo, geo: sim.after.geo, resolved: sim.resolved, sections: sim.sections.filter((s) => s.after !== s.before) },
    before: sim.before,
    changeSetIds: changeSets.map((c) => c.id),
    taskIds,
  };
  await d.saveLaunch(launch);
  return { launch, changeSets: changeSets.length, tasks: taskIds.length, skipped };
}
