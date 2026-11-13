/**
 * Mesure avant / après d'une action (docs/v3/01-teardown-enterprise.md : centre d'actions avec relance et gain).
 *
 * À la complétion d'une tâche (`onTaskDone`) :
 * 1. état « avant » sur les questions liées à la tâche (source visée, sinon questions où vous n'êtes pas cité),
 *    tiré du dernier audit : réponses, mentions, taux, rang ;
 * 2. relances ciblées planifiées à J+14 et J+30 (`enqueue('measure.action')`) sur ces seules questions ;
 * 3. `getActionImpact(taskId)` : avant, après, écart, marge d'erreur (IC 95 % sur une différence de proportions)
 *    et verdict honnête (« dans la marge d'erreur » le cas échéant ; corrélation, pas preuve).
 * Collection `measure.actions` (id = taskId). Comptes démo : mesures calculées à la volée sur les audits démo.
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { fmtMargin } from '@/lib/text';
import { isDemoBusinessId, buildDemoWorkspaceById } from '@/lib/demo-v2';
import { listAuditsForBusiness } from '@/lib/db';
import type { AuditResult, ProviderId, QuerySpec } from '@/lib/engine/types';
import type { ExecTask } from '@/lib/engine/types-v2';
import { enqueue, registerHandler } from '@/lib/notify/platform';

export const MEASURES = 'measure.actions';
export const CHECKPOINT_DAYS = [14, 30] as const;
export const MAX_LINKED = 6;

export interface QuerySnapshot {
  queryId: string;
  text: string;
  answers: number;
  mentioned: number;
  bestRank: number | null;
}

export interface Snapshot {
  at: string;
  source: 'audit' | 'relance';
  auditId?: string | null;
  answers: number;
  mentioned: number;
  rate: number;
  avgRank: number | null;
  perQuery: QuerySnapshot[];
  demo?: boolean;
}

export interface Checkpoint {
  day: number;
  dueAt: string;
  status: 'pending' | 'done' | 'failed';
  snapshot?: Snapshot | null;
  error?: string;
}

export interface ActionMeasure {
  taskId: string;
  businessId: string;
  taskTitle: string;
  sourceDomain?: string | null;
  doneAt: string;
  queries: QuerySpec[];
  providers: ProviderId[];
  linkReason: 'source' | 'gaps' | 'all';
  before: Snapshot | null;
  checkpoints: Checkpoint[];
  createdAt: string;
  demo?: boolean;
}

export type Verdict = 'hausse' | 'baisse' | 'stable' | 'en_attente' | 'insuffisant';

export interface ActionImpact {
  taskId: string;
  taskTitle: string;
  doneAt: string;
  queries: { id: string; text: string }[];
  linkReason: ActionMeasure['linkReason'];
  before: Snapshot | null;
  after: Snapshot | null;
  checkpoints: Checkpoint[];
  /** écart du taux de mention, en points de pourcentage (après − avant) */
  delta: number | null;
  /** demi-largeur de l'intervalle de confiance à 95 %, en points */
  margin: number | null;
  verdict: Verdict;
  label: string;
  note: string;
  demo: boolean;
}

// ---------------------------------------------------------------------------
// Calculs purs
// ---------------------------------------------------------------------------
const isBrand = (a: Pick<AuditResult, 'queries'>, id: string) => a.queries.find((q) => q.id === id)?.kind === 'brand' || /^B\d/.test(id);

/** Questions liées à une tâche : celles où la source visée est citée, sinon celles où vous n'êtes pas cité. */
export function linkedQueries(task: Pick<ExecTask, 'sourceDomain'>, audit: AuditResult): { queries: QuerySpec[]; reason: ActionMeasure['linkReason'] } {
  const reco = audit.queries.filter((q) => !isBrand(audit, q.id));
  const dom = task.sourceDomain?.toLowerCase().replace(/^www\./, '');
  if (dom) {
    const d = (audit.sources?.domains ?? []).find((x) => x.domain.toLowerCase() === dom || x.domain.toLowerCase().endsWith(`.${dom}`));
    const ids = new Set(d?.queries ?? []);
    const qs = reco.filter((q) => ids.has(q.id));
    if (qs.length) return { queries: qs.slice(0, MAX_LINKED), reason: 'source' };
  }
  const rate = (id: string) => {
    const ms = audit.mentions.filter((m) => m.queryId === id && !m.noRec);
    return ms.length ? ms.filter((m) => m.mentioned).length / ms.length : 0;
  };
  const gaps = reco.filter((q) => rate(q.id) < 0.5).sort((a, b) => rate(a.id) - rate(b.id));
  if (gaps.length) return { queries: gaps.slice(0, MAX_LINKED), reason: 'gaps' };
  return { queries: reco.slice(0, MAX_LINKED), reason: 'all' };
}

export function snapshotOf(audit: AuditResult, queryIds: string[], source: Snapshot['source'] = 'audit', providers?: ProviderId[]): Snapshot {
  const ids = new Set(queryIds);
  const qText = new Map(audit.queries.map((q) => [q.id, q.text]));
  const ms = audit.mentions.filter((m) => ids.has(m.queryId) && !m.noRec && (!providers?.length || providers.includes(m.provider)));
  const cited = ms.filter((m) => m.mentioned);
  const ranks = cited.map((m) => m.rank).filter((r): r is number => typeof r === 'number');
  const perQuery = queryIds.map((id) => {
    const qm = ms.filter((m) => m.queryId === id);
    const qc = qm.filter((m) => m.mentioned);
    const qr = qc.map((m) => m.rank).filter((r): r is number => typeof r === 'number');
    return { queryId: id, text: qText.get(id) ?? id, answers: qm.length, mentioned: qc.length, bestRank: qr.length ? Math.min(...qr) : null };
  });
  return {
    at: audit.measuredAt || audit.createdAt,
    source,
    auditId: source === 'audit' ? audit.id : null,
    answers: ms.length,
    mentioned: cited.length,
    rate: ms.length ? cited.length / ms.length : 0,
    avgRank: ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : null,
    perQuery,
    ...(audit.demo ? { demo: true } : {}),
  };
}

/**
 * Écart et marge d'erreur (IC 95 %) sur la différence de deux taux de mention.
 * Proportions lissées (k+1)/(n+2) pour ne pas annoncer une marge nulle à 0 % ou 100 %.
 */
export function compareSnapshots(before: Pick<Snapshot, 'answers' | 'mentioned'>, after: Pick<Snapshot, 'answers' | 'mentioned'>): { delta: number; margin: number; verdict: Verdict } {
  if (!before.answers || !after.answers) return { delta: 0, margin: 0, verdict: 'insuffisant' };
  const p1 = before.mentioned / before.answers;
  const p2 = after.mentioned / after.answers;
  const s1 = (before.mentioned + 1) / (before.answers + 2);
  const s2 = (after.mentioned + 1) / (after.answers + 2);
  const se = Math.sqrt((s1 * (1 - s1)) / before.answers + (s2 * (1 - s2)) / after.answers);
  const delta = Math.round((p2 - p1) * 1000) / 10;
  const margin = Math.round(1.96 * se * 1000) / 10;
  const verdict: Verdict = before.answers < 6 || after.answers < 6 ? 'insuffisant' : delta > margin ? 'hausse' : delta < -margin ? 'baisse' : 'stable';
  return { delta, margin, verdict };
}

/** Écart en points, au format français et arrondi (jamais « 13.7 ») : « +4 points », « −2 points ». */
const pts = (x: number) => {
  const n = Math.round(x);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} point${Math.abs(n) >= 2 ? 's' : ''}`;
};

export function impactOf(m: ActionMeasure): ActionImpact {
  const done = m.checkpoints.filter((c) => c.status === 'done' && c.snapshot).sort((a, b) => b.day - a.day);
  const after = done[0]?.snapshot ?? null;
  const base = {
    taskId: m.taskId, taskTitle: m.taskTitle, doneAt: m.doneAt, queries: m.queries.map((q) => ({ id: q.id, text: q.text })), linkReason: m.linkReason,
    before: m.before, after, checkpoints: m.checkpoints, demo: !!m.demo,
  };
  const note = 'Corrélation, pas preuve : les réponses des IA varient d’une fois à l’autre et d’autres facteurs jouent (concurrents, mises à jour des IA).';
  if (!m.before || !m.before.answers) {
    return { ...base, delta: null, margin: null, verdict: 'insuffisant', label: 'Pas de mesure « avant » exploitable : l’effet de cette action ne peut pas être isolé.', note };
  }
  if (!after) {
    const next = m.checkpoints.find((c) => c.status === 'pending');
    const when = next ? new Date(next.dueAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) : null;
    return { ...base, delta: null, margin: null, verdict: 'en_attente', label: when ? `Relance ciblée prévue le ${when} (J+${next!.day}).` : 'Relance ciblée en attente.', note };
  }
  const { delta, margin, verdict } = compareSnapshots(m.before, after);
  const n = m.queries.length;
  const scope = `sur ${n} question${n > 1 ? 's' : ''} liée${n > 1 ? 's' : ''}`;
  const label =
    verdict === 'insuffisant'
      ? `Trop peu de réponses pour conclure (${after.answers} réponses ${scope}).`
      : verdict === 'stable'
        ? `Dans la marge d’erreur : ${pts(delta)} de taux de mention ${scope} (marge ${fmtMargin(margin)}). Pas d’effet mesurable à ce stade.`
        : `${verdict === 'hausse' ? 'Hausse' : 'Baisse'} de ${pts(Math.abs(delta)).replace(/^[+−]/, '')} du taux de mention ${scope}, au-delà de la marge d’erreur (${fmtMargin(margin)}) : ${Math.round(m.before.rate * 100)} % → ${Math.round(after.rate * 100)} %.`;
  return { ...base, delta, margin, verdict, label, note };
}

// ---------------------------------------------------------------------------
// Démarrage (complétion d'une tâche)
// ---------------------------------------------------------------------------
const DAY = 86_400_000;

export function buildMeasure(task: Pick<ExecTask, 'id' | 'businessId' | 'title' | 'sourceDomain' | 'doneAt'>, audit: AuditResult | null, now: Date = new Date()): ActionMeasure {
  const doneAt = task.doneAt ?? now.toISOString();
  const link = audit ? linkedQueries(task, audit) : { queries: [], reason: 'all' as const };
  const providers = (audit?.providersUsed?.length ? audit.providersUsed : []) as ProviderId[];
  return {
    taskId: task.id,
    businessId: task.businessId,
    taskTitle: task.title,
    sourceDomain: task.sourceDomain ?? null,
    doneAt,
    queries: link.queries,
    providers,
    linkReason: link.reason,
    before: audit && link.queries.length ? snapshotOf(audit, link.queries.map((q) => q.id), 'audit') : null,
    checkpoints: CHECKPOINT_DAYS.map((day) => ({ day, dueAt: new Date(Date.parse(doneAt) + day * DAY).toISOString(), status: 'pending' as const, snapshot: null })),
    createdAt: now.toISOString(),
  };
}

/** Enregistre l'état « avant » et planifie les relances J+14 / J+30 (idempotent). */
export async function startActionMeasure(businessId: string, task: Pick<ExecTask, 'id' | 'title' | 'sourceDomain' | 'doneAt'>, now: Date = new Date()): Promise<ActionMeasure | null> {
  if (isDemoBusinessId(businessId)) return null;
  const prev = await getDoc<ActionMeasure>(MEASURES, task.id);
  if (prev && prev.data.businessId === businessId) return prev.data;
  const audits = await listAuditsForBusiness(businessId);
  const m = buildMeasure({ ...task, businessId }, audits[audits.length - 1] ?? null, now);
  await putDoc<ActionMeasure>(MEASURES, task.id, m, businessId);
  if (m.queries.length) {
    for (const c of m.checkpoints) {
      await enqueue('measure.action', { businessId, taskId: task.id, day: c.day }, { runAt: new Date(c.dueAt), businessId, dedupeKey: `measure:${task.id}:${c.day}` });
    }
  }
  return m;
}

/**
 * À appeler quand une tâche passe à « faite » (route des tâches, digest) : repère sur les courbes,
 * mesure avant/après, notification `task_done` (centre + Slack/webhook `task.done`). Ne lève jamais.
 */
export async function onTaskDone(businessId: string, task: Pick<ExecTask, 'id' | 'title' | 'sourceDomain' | 'doneAt'>, now: Date = new Date()): Promise<void> {
  if (isDemoBusinessId(businessId)) return;
  const safe = async (tag: string, f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      console.warn(`[measure] ${tag}`, e);
    }
  };
  await safe('annotation', async () => (await import('@/lib/annotations')).annotateTaskDone(businessId, task, now));
  await safe('mesure', () => startActionMeasure(businessId, task, now));
  await safe('notification', async () =>
    (await import('@/lib/notify')).notify(businessId, {
      type: 'task_done',
      title: `Tâche faite : ${task.title}`,
      body: 'Repéré relancera les questions liées dans 14 puis 30 jours pour mesurer l’effet.',
      href: '/app/taches',
      dedupeKey: `task_done:${task.id}`,
      data: { taskId: task.id },
    }),
  );
}

// ---------------------------------------------------------------------------
// Relance ciblée (traitant `measure.action`)
// ---------------------------------------------------------------------------
type Relaunch = (audit: AuditResult, queries: QuerySpec[], providers: ProviderId[]) => Promise<AuditResult>;
let relaunch: Relaunch = async (audit, queries, providers) => {
  const { runAudit } = await import('@/lib/engine');
  return runAudit(audit.input, { queries, queriesMode: 'replace', mode: 'free', ...(providers.length ? { providers } : {}) });
};
/** Tests : remplace la relance (évite tout appel d'IA). */
export function __setRelaunch(f: Relaunch | null): void {
  relaunch = f ?? (async (audit, queries, providers) => {
    const { runAudit } = await import('@/lib/engine');
    return runAudit(audit.input, { queries, queriesMode: 'replace', mode: 'free', ...(providers.length ? { providers } : {}) });
  });
}

export async function runMeasureCheckpoint(payload: Record<string, unknown>, now: Date = new Date()): Promise<Checkpoint | null> {
  const businessId = String(payload.businessId ?? '');
  const taskId = String(payload.taskId ?? '');
  const day = Number(payload.day);
  if (!businessId || isDemoBusinessId(businessId)) return null;
  const doc = await getDoc<ActionMeasure>(MEASURES, taskId);
  if (!doc || doc.data.businessId !== businessId) return null;
  const m = doc.data;
  const cp = m.checkpoints.find((c) => c.day === day);
  if (!cp || cp.status === 'done' || !m.queries.length) return cp ?? null;
  const audits = await listAuditsForBusiness(businessId);
  const latest = audits[audits.length - 1];
  if (!latest) return cp;
  const res = await relaunch(latest, m.queries, m.providers);
  const qIds = m.queries.map((q) => q.id);
  // Les identifiants peuvent être renormalisés par le moteur : on se rabat sur toutes les questions de la relance.
  const known = res.queries.some((q) => qIds.includes(q.id)) ? qIds : res.queries.filter((q) => !isBrand(res, q.id)).map((q) => q.id);
  cp.snapshot = { ...snapshotOf(res, known, 'relance'), at: now.toISOString() };
  cp.status = 'done';
  await putDoc<ActionMeasure>(MEASURES, taskId, m, businessId);
  const impact = impactOf(m);
  try {
    const { notify } = await import('@/lib/notify');
    await notify(businessId, {
      type: 'measure_result',
      title: `Effet de « ${m.taskTitle.slice(0, 80)} » à J+${day}`,
      body: `${impact.label} ${impact.note}`,
      href: '/app/taches',
      dedupeKey: `measure:${taskId}:${day}`,
      data: { taskId, day, verdict: impact.verdict, delta: impact.delta, margin: impact.margin },
    });
  } catch (e) {
    console.warn('[measure] notification', e);
  }
  return cp;
}

registerHandler('measure.action', async (p) => {
  await runMeasureCheckpoint(p);
});

// ---------------------------------------------------------------------------
// Démonstration : mesures calculées sur les audits démo (étiquetées)
// ---------------------------------------------------------------------------
const DEMO_ACTIONS: Record<string, string> = {
  demo: 'Fiche Google complétée : description, services et horaires',
  'demo-pme': 'Page de questions-réponses publiée sur le site',
  'demo-ecom': 'Guide d’achat publié et lié depuis les fiches produits',
};

export function demoMeasures(businessId: string): ActionMeasure[] {
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws || ws.audits.length < 3) return [];
  const audits = ws.audits as AuditResult[];
  const [b, a1, a2] = audits.slice(-3);
  const doneAt = new Date(Date.parse(b.measuredAt || b.createdAt) + 2 * DAY).toISOString();
  const link = linkedQueries({ sourceDomain: undefined }, b);
  const ids = link.queries.map((q) => q.id);
  const cp = (a: AuditResult): Checkpoint => {
    const at = a.measuredAt || a.createdAt;
    return { day: Math.round((Date.parse(at) - Date.parse(doneAt)) / DAY), dueAt: at, status: 'done', snapshot: snapshotOf(a, ids, 'audit') };
  };
  return [
    {
      taskId: `demo-action-${businessId}`,
      businessId,
      taskTitle: DEMO_ACTIONS[businessId] ?? 'Action de démonstration',
      sourceDomain: null,
      doneAt,
      queries: link.queries,
      providers: (b.providersUsed ?? []) as ProviderId[],
      linkReason: link.reason,
      before: snapshotOf(b, ids, 'audit'),
      checkpoints: [cp(a1), cp(a2)],
      createdAt: doneAt,
      demo: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------
export async function getActionImpact(taskId: string, opts: { businessId?: string } = {}): Promise<ActionImpact | null> {
  if (opts.businessId && isDemoBusinessId(opts.businessId)) {
    const m = demoMeasures(opts.businessId).find((x) => x.taskId === taskId);
    if (m) return impactOf(m);
    // tâche démo faite récemment : avant = dernier audit démo, relances encore à venir
    const { listTasks } = await import('@/lib/execution');
    const t = (await listTasks(opts.businessId)).find((x) => x.id === taskId && x.status === 'done');
    if (!t) return null;
    const ws = buildDemoWorkspaceById(opts.businessId);
    const last = (ws?.audits[ws.audits.length - 1] as AuditResult | undefined) ?? null;
    return impactOf({ ...buildMeasure(t, last, new Date(t.doneAt ?? Date.now())), demo: true });
  }
  const doc = await getDoc<ActionMeasure>(MEASURES, taskId);
  if (!doc || (opts.businessId && doc.data.businessId !== opts.businessId)) return null;
  return impactOf(doc.data);
}

export async function listActionImpacts(businessId: string): Promise<ActionImpact[]> {
  if (isDemoBusinessId(businessId)) {
    const out = demoMeasures(businessId).map(impactOf);
    const { listTasks } = await import('@/lib/execution');
    for (const t of (await listTasks(businessId)).filter((x) => x.status === 'done')) {
      const i = await getActionImpact(t.id, { businessId });
      if (i) out.push(i);
    }
    return out.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  }
  const docs = await listDocs<ActionMeasure>(MEASURES, { businessId, limit: 500 });
  return docs.map((d) => d.data).filter((m) => m.businessId === businessId).map(impactOf).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
}
