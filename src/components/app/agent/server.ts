// Données de l'agent de publication, côté serveur uniquement (pages /app/agent/**).
// Compte réel : @/lib/publish (connexions, propositions, journal immuable) + remesure J+7 (file de tâches).
// Compte démo : parcours simulé construit à partir de l'espace démo (lecture seule côté serveur).
import { cache } from 'react';
import { requireBusiness } from '@/lib/auth';
import { getJob } from '@/lib/jobs';
import { compareSnapshots } from '@/lib/measure';
import { PLATFORMS, changeSetJournal, getChangeSet, listChangeSets, listConnectionViews, listJournal } from '@/lib/publish';
import { summarizeChange } from '@/lib/publish/model';
import { gbpEnabled } from '@/lib/publish/connectors/gbp';
import type { PublishConnectionView } from '@/lib/publish/connections';
import { listRuns } from '@/lib/siteaudit/runs';
import { getDoc } from '@/lib/store';
import { adaptTasks } from '../adapters';
import { auditDate, loadWorkspace, type Workspace } from '../workspace';
import { buildDemoAgent } from './demo';
import type { AgentEffect } from './effect';
import { DEFAULT_SETTINGS, linkTasksToChangeSets, sanitizeSettings, type AgentSettings, type ChangeSet, type JournalEntry, type Platform, type ViewerRole } from './model';

export const SETTINGS_COLLECTION = 'publish.agent_settings';

export interface AgentData {
  businessId: string;
  demo: boolean;
  role: ViewerRole;
  meId: string | null;
  name: string;
  site: string;
  connections: PublishConnectionView[];
  /** plateformes proposées à la connexion (la fiche Google tant que l'accès API n'est pas ouvert : « bientôt ») */
  platforms: { id: Platform; available: boolean }[];
  changeSets: ChangeSet[];
  journal: JournalEntry[];
  effects: Record<string, AgentEffect>;
  taskLinks: Record<string, string>;
  settings: AgentSettings;
  loadError: boolean;
}

async function roleOf(businessId: string): Promise<{ role: ViewerRole; meId: string | null }> {
  try {
    const a = await requireBusiness(null, businessId);
    return { role: a.role as ViewerRole, meId: a.session?.userId ?? null };
  } catch {
    return { role: 'viewer', meId: null };
  }
}

const trim = (cs: ChangeSet): ChangeSet => ({ ...cs, changes: cs.changes.map((c) => summarizeChange(c, 6000)) });

function curveFor(ws: Workspace, appliedAt: string): AgentEffect['curve'] {
  const pts = ws.audits.map((a) => ({ at: auditDate(a), v: Math.round(a.score) }));
  if (pts.length < 2) return undefined;
  const idx = pts.findIndex((p) => p.at >= appliedAt);
  const marker = idx < 0 ? pts.length - 1 : idx;
  return { values: pts.map((p) => p.v), marker, label: `Score de visibilité : ${pts.map((p) => p.v).join(', ')} ; repère à la publication` };
}

/** Effet d'une publication réelle : remesure J+7 de la page (score déterministe) + repère sur la courbe. */
async function realEffect(ws: Workspace, cs: ChangeSet, runs: Awaited<ReturnType<typeof listRuns>>): Promise<AgentEffect | null> {
  if (!cs.appliedAt) return null;
  const dueAt = new Date(new Date(cs.appliedAt).getTime() + 7 * 86_400_000).toISOString();
  const e: AgentEffect = { csId: cs.id, appliedAt: cs.appliedAt, dueAt, status: cs.status === 'reverted' ? 'none' : 'scheduled', curve: curveFor(ws, cs.appliedAt) };
  const url = cs.changes.find((c) => c.target.url)?.target.url ?? cs.site;
  const before = runs.filter((r) => r.url === url && r.createdAt < cs.appliedAt! && r.readiness).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (cs.remeasureJobId && e.status !== 'none') {
    const job = await getJob(cs.remeasureJobId).catch(() => null);
    if (job?.status === 'done') {
      const after = typeof job.result?.readiness === 'number' ? (job.result.readiness as number) : null;
      e.status = 'done';
      e.page = { before: before?.readiness?.score ?? null, after, label: 'Préparation de la page pour les IA (sur 100)' };
      if (job.result?.error) e.error = String(job.result.error);
    } else if (job?.status === 'dead') {
      e.status = 'failed';
      e.error = job.lastError ?? undefined;
    }
  }
  return e;
}

export const loadAgent = cache(async (): Promise<AgentData> => {
  const ws = await loadWorkspace();
  const businessId = ws.business.id;
  const site = ws.business.website ? `https://${ws.business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
  const platforms = PLATFORMS.filter((p) => p !== 'export').map((p) => ({ id: p, available: p !== 'gbp' || gbpEnabled() }));

  if (ws.demo) {
    const tasks = await adaptTasks(businessId, ws.fb).catch(() => []);
    const d = buildDemoAgent({
      businessId,
      segment: ws.segment,
      name: ws.business.name,
      website: ws.business.website || 'exemple-demo.fr',
      facts: (ws.facts.facts ?? {}) as Record<string, unknown>,
      tasks,
      scores: ws.audits.map((a) => a.score),
      now: new Date(),
    });
    for (const e of Object.values(d.effects)) if (e.ai) e.ai.result = compareSnapshots(e.ai.before, e.ai.after) as NonNullable<AgentEffect['ai']>['result'];
    return { businessId, demo: true, role: 'demo', meId: null, name: ws.business.name, site, platforms, ...d, settings: DEFAULT_SETTINGS, loadError: false };
  }

  const { role, meId } = await roleOf(businessId);
  let loadError = false;
  const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => {
    try {
      return await p;
    } catch {
      loadError = true;
      return fb;
    }
  };
  const [connections, list, journal, runs, settingsDoc, tasks] = await Promise.all([
    safe(listConnectionViews(businessId), []),
    safe(listChangeSets(businessId), []),
    safe(listJournal(businessId, 300), []),
    listRuns(businessId, 100).catch(() => []),
    getDoc<AgentSettings>(SETTINGS_COLLECTION, businessId).catch(() => null),
    adaptTasks(businessId, ws.fb).catch(() => []),
  ]);
  const effects: Record<string, AgentEffect> = {};
  for (const cs of list) {
    const e = await realEffect(ws, cs, runs).catch(() => null);
    if (e) effects[cs.id] = e;
  }
  return {
    businessId,
    demo: false,
    role,
    meId,
    name: ws.business.name,
    site,
    connections,
    platforms,
    changeSets: list.map(trim),
    journal,
    effects,
    // Centre d'actions → proposition réelle (par type de modification).
    taskLinks: linkTasksToChangeSets(tasks, list),
    settings: settingsDoc ? sanitizeSettings(settingsDoc.data) : DEFAULT_SETTINGS,
    loadError,
  };
});

/** Une proposition et son journal (démo : depuis le parcours simulé). */
export async function loadChangeSet(id: string): Promise<{ data: AgentData; cs: ChangeSet | null; journal: JournalEntry[] }> {
  const data = await loadAgent();
  if (data.demo) return { data, cs: data.changeSets.find((c) => c.id === id) ?? null, journal: data.journal.filter((j) => j.subject === id) };
  const cs = await getChangeSet(data.businessId, id).catch(() => null);
  const journal = cs ? await changeSetJournal(data.businessId, id).catch(() => []) : [];
  return { data, cs: cs ? trim(cs) : null, journal: [...journal].reverse() };
}
