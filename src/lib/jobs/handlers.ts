/**
 * Gestionnaires par défaut de la file. Tous idempotents, tous en imports dynamiques (le worker ne charge que ce
 * qu'il exécute). Les modules des autres agents sont appelés de façon tolérante : on cherche l'export attendu par
 * son nom ; s'il manque, la tâche échoue proprement (reprise avec backoff, puis `dead` et remontée Sentry).
 * Un module peut aussi enregistrer lui-même son gestionnaire (`registerHandler`) : il remplace celui d'ici.
 *
 * | type              | charge utile                                   | effet |
 * |-------------------|------------------------------------------------|-------|
 * | audit.run         | businessId, trigger?, input?                   | runAudit (questions suivies, IA de l'offre) + saveAudit, puis alertes/e-mail si planifié, puis tasks.generate |
 * | audit.scheduled   | now? (ISO)                                     | balaye les commerces actifs, enfile audit.run pour ceux dont la fréquence de l'offre est échue |
 * | tasks.generate    | businessId                                     | regenerateTasks (statuts conservés) |
 * | digest.send       | businessId, week                               | digest du lundi (alertes une fois par audit, e-mail, marquage envoyé) |
 * | report.scheduled  | (DONNEES)                                      | @/lib/notify/reports → sendScheduledReport(payload) |
 * | webhook.deliver   | (DONNEES)                                      | @/lib/integrations → deliverWebhook(payload) |
 * | measure.action    | (DONNEES)                                      | @/lib/measure → runMeasureCheckpoint(payload) |
 * | siteaudit.run     | (AUDIT-SITE)                                   | @/lib/siteaudit/runs → runSiteAuditJob(payload) |
 * | seodata.*         | (SEO-DATA) businessId, …                       | @/lib/seodata/jobs → handlers[type] (Search Console, positions) |
 * | publish.verify    | businessId, changeSetId                        | @/lib/publish → verifyChangeSet (relecture après mise en cache) |
 * | analysis.rerun    | businessId, reason?, changeSetId?              | @/lib/analysis/job → réanalyse SEO + GEO du site (pages selon l'offre) |
 * | analysis.scheduled| now?                                           | @/lib/analysis/job → balayage des réanalyses dues |
 * | barometre.run     | slugs?, period?                                | @/lib/barometre/job → passe mensuelle (mesures réelles seulement) |
 */
import { log } from '@/lib/log';
import { enqueue } from './index';
import { registerHandler, getHandler } from './registry';
import { entitlementsFor, isAuditDue, periodKey, type SchedulingEntitlements } from './platform';
import { PermanentJobError, type JobContext, type JobHandler, type JobType } from './types';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

/** Cherche une fonction exportée par son nom (tolérant aux modules en cours d'écriture). */
export function pickFn(mod: unknown, ...names: string[]): AnyFn | null {
  if (!mod || typeof mod !== 'object') return null;
  for (const n of names) {
    const f = (mod as Record<string, unknown>)[n];
    if (typeof f === 'function') return f as AnyFn;
  }
  return null;
}

function str(p: Record<string, unknown>, k: string): string | undefined {
  const v = p[k];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function requireBusinessId(p: Record<string, unknown>): string {
  const id = str(p, 'businessId');
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new PermanentJobError('businessId manquant ou invalide');
  return id;
}

function ctxOf(p: Record<string, unknown>): JobContext | null {
  return (p._job as JobContext | undefined) ?? null;
}

/** Marqueurs d'exécution (idempotence des étapes coûteuses quand une tâche est rejouée). */
const RUNS = 'jobs.runs';

async function getMarker(jobId: string | undefined): Promise<Record<string, unknown>> {
  if (!jobId) return {};
  const { getDoc } = await import('@/lib/store');
  return (await getDoc<Record<string, unknown>>(RUNS, jobId))?.data ?? {};
}

async function setMarker(jobId: string | undefined, patch: Record<string, unknown>, businessId: string): Promise<void> {
  if (!jobId) return;
  const { updateDoc } = await import('@/lib/store');
  await updateDoc<Record<string, unknown>>(RUNS, jobId, patch, businessId);
}

// ---------------------------------------------------------------------------
// audit.run
// ---------------------------------------------------------------------------

export type AuditTriggerKind = 'onboarding' | 'manual' | 'scheduled';

async function entitlements(business: import('@/lib/db').Business): Promise<SchedulingEntitlements> {
  return entitlementsFor(business as import('@/lib/db').BusinessRecord);
}

/** Entrée d'audit : dernier audit du commerce (garde les champs PME / e-commerce), complétée par la fiche. */
export function auditInputFor(
  b: import('@/lib/db').BusinessRecord,
  latest: { input?: Record<string, unknown> } | null,
  override?: Record<string, unknown>,
): Record<string, unknown> {
  // Ordre : entrée d'origine enregistrée sur le commerce (businesses.audit_input, si exposée), puis dernier audit.
  const stored = (b as { auditInput?: Record<string, unknown> | null }).auditInput ?? null;
  const prev: Record<string, unknown> = { ...(stored ?? {}), ...(latest?.input ?? {}) };
  delete prev.email;
  return {
    ...prev,
    businessName: b.name,
    trade: b.trade,
    city: b.city,
    district: b.district,
    website: b.website,
    segment: b.segment ?? (prev.segment as string | undefined) ?? 'local',
    ...(override ?? {}),
  };
}

const MILESTONES = [30, 60, 80];
const ALERT_STATE = 'digest.state';

export async function handleAuditRun(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = requireBusinessId(p);
  const trigger = (str(p, 'trigger') ?? 'manual') as AuditTriggerKind;
  const job = ctxOf(p);
  const { isDemoBusinessId } = await import('@/lib/demo-v2');
  if (isDemoBusinessId(businessId)) return { skipped: 'compte de démonstration (lecture seule)' };

  const db = await import('@/lib/db');
  const business = await db.getBusinessRecord(businessId);
  if (!business) throw new PermanentJobError('commerce introuvable');
  if (!business.isActive && trigger === 'scheduled') return { skipped: 'commerce inactif' };
  // Espace payé mais pas encore complété (« Mon entreprise », sans ville) : aucune mesure planifiée (coût IA pour un
  // audit sans objet) ; le premier audit part quand l'espace est complété sur /bienvenue.
  if (business.needsSetup && trigger === 'scheduled') return { skipped: 'espace à compléter' };

  const marker = await getMarker(job?.id);
  const previous = await db.getLatestAuditForBusiness(businessId);
  let auditId = typeof marker.auditId === 'string' ? marker.auditId : null;
  let current: import('@/lib/engine').AuditResult | null = auditId ? await db.getAudit(auditId) : null;

  if (!current) {
    const { runAudit } = await import('@/lib/engine');
    const ent = await entitlements(business);
    let queries: unknown[] | undefined;
    try {
      const repo = await import('@/lib/prompts/repo');
      const eng = await import('@/lib/prompts/engine');
      const list = pickFn(repo, 'listPrompts');
      const toQueries = (eng as Record<string, unknown>).promptsToQueries as ((x: unknown) => unknown[]) | undefined;
      if (list && toQueries) {
        const prompts = await list(businessId, { active: true });
        const qs = toQueries(prompts);
        // Au-delà du quota de l'offre (ex. retour à Découverte après le mois offert) : les questions restent listées,
        // seules les premières dans la limite sont mesurées.
        if (Array.isArray(qs) && qs.length) queries = qs.slice(0, Math.max(1, (await import('@/lib/entitlements')).getEntitlements(business).prompts));
      }
    } catch (e) {
      log.warn('job.audit.prompts_unavailable', { businessId, error: e instanceof Error ? e.message : String(e) });
    }
    const input = auditInputFor(
      business,
      previous as unknown as { input?: Record<string, unknown> } | null,
      p.input && typeof p.input === 'object' ? (p.input as Record<string, unknown>) : undefined,
    );
    current = await runAudit(input as unknown as Parameters<typeof runAudit>[0], {
      mode: 'paid',
      providers: ent.engines,
      ...(queries ? { queries: queries as NonNullable<Parameters<typeof runAudit>[1]>['queries'] } : {}),
    });
    if (job?.signal.aborted) throw new Error('annulé (délai dépassé) avant la sauvegarde');
    await db.saveAudit(current, { businessId, trigger: trigger === 'scheduled' ? 'monthly' : 'manual' });
    auditId = current.id;
    await setMarker(job?.id, { auditId }, businessId);
  }

  // Écart annoncé (e-mail mensuel, alertes, notification) seulement contre la dernière mesure COMPARABLE (mêmes
  // questions ≥ 80 %, ≥ 6 jours : previousComparable de @/lib/digest/stats) ; sinon « première mesure de référence ».
  const base = await comparableBase(businessId, current);
  const out: Record<string, unknown> = { auditId: current.id, score: current.score, previous: base?.score ?? null };
  if (!marker.post) {
    if (trigger === 'scheduled' && previous && previous.id !== current.id) {
      Object.assign(out, await afterScheduledAudit(business, base, current));
    }
    await setMarker(job?.id, { post: true }, businessId);
  }
  await enqueue('tasks.generate', { businessId, auditId: current.id }, { businessId, dedupeKey: `tasks.generate:${current.id}` });
  try {
    // Fin d'audit : centre de notifications + Slack / webhook / e-mail selon les préférences (@/lib/notify).
    const { notify } = await import('@/lib/notify');
    // Écart annoncé seulement entre deux mesures COMPARABLES (`base` ci-dessus) : jamais contre l'audit gratuit
    // d'un autre périmètre.
    await notify(businessId, {
      type: 'audit_done',
      title: `Nouvelle mesure : ${current.score}/100`,
      body: 'Les réponses des IA ont été relevées. Vos tâches sont mises à jour.',
      href: '/app',
      dedupeKey: `audit:${current.id}`,
      ...(base ? { delta: current.score - base.score } : {}),
    });
  } catch {
    /* centre de notifications indisponible : sans conséquence */
  }
  return out;
}

/** Mesure précédente comparable à `current` (null : première mesure ou périmètre différent). Jamais bloquant. */
export async function comparableBase(
  businessId: string,
  current: import('@/lib/engine').AuditResult,
): Promise<import('@/lib/engine').AuditResult | null> {
  try {
    const db = await import('@/lib/db');
    const { previousComparable } = await import('@/lib/digest/stats');
    const all = await db.listAuditsForBusiness(businessId);
    const list = all.some((a) => a.id === current.id) ? all : [...all, current];
    type A = Parameters<typeof previousComparable>[0][number];
    const sorted = (list as unknown as A[]).filter((a) => (a.measuredAt ?? a.createdAt) <= (current.measuredAt ?? current.createdAt) || a.id === current.id);
    return (previousComparable(sorted) as unknown as import('@/lib/engine').AuditResult | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ancien corps du cron mensuel : alertes V2, e-mail mensuel, alertes de score et paliers. `previous` est la dernière
 * mesure COMPARABLE (comparableBase) ou null : alors aucun écart n'est annoncé (« première mesure de référence »).
 */
export async function afterScheduledAudit(
  b: import('@/lib/db').BusinessRecord,
  previous: import('@/lib/engine').AuditResult | null,
  current: import('@/lib/engine').AuditResult,
): Promise<Record<string, unknown>> {
  const db = await import('@/lib/db');
  const { monthlyVariant, sendMonthlyAlertEmail } = await import('@/lib/email');
  const out: Record<string, unknown> = {};
  try {
    const { detectAndRecordAlerts } = await import('@/lib/alerts');
    const { getFacts, refreshFactCheck } = await import('@/lib/facts');
    const { getDoc, putDoc } = await import('@/lib/store');
    const facts = await getFacts(b.id);
    await refreshFactCheck(b.id, facts).catch((e) => log.warn('job.audit.factcheck_failed', { businessId: b.id, error: String(e) }));
    type AuditV2 = Parameters<typeof detectAndRecordAlerts>[2];
    const detected = await detectAndRecordAlerts(b.id, previous as AuditV2 | null, current as AuditV2, facts, { threshold: b.alertThreshold });
    out.detected = detected.length;
    const state = (await getDoc<{ lastAlertAuditId?: string }>(ALERT_STATE, b.id))?.data ?? {};
    await putDoc(ALERT_STATE, b.id, { ...state, lastAlertAuditId: current.id }, b.id);
  } catch (e) {
    log.error('job.audit.alerts_failed', e, { businessId: b.id });
  }
  const delta = previous ? current.score - previous.score : null;
  const variant = delta === null ? 'first' : monthlyVariant(delta, b.alertThreshold);
  Object.assign(out, { delta, variant });
  let emailSent = false;
  if (b.contactEmail) {
    const res = await sendMonthlyAlertEmail(b.contactEmail, { business: b, current, previous, threshold: b.alertThreshold });
    out.email = res.status;
    emailSent = res.status === 'sent' || res.status === 'logged';
  }
  await db.recordAlert({
    businessId: b.id,
    auditId: current.id,
    type: variant === 'up' ? 'score_up' : variant === 'down' ? 'score_down' : 'audit_done',
    title:
      variant === 'up' ? `+${delta} points ce mois-ci` : variant === 'down' ? `${delta} points ce mois-ci` : variant === 'first' ? `Première mesure de référence : ${current.score}/100` : `Audit mensuel : ${current.score}/100`,
    payload: { from: previous?.score ?? null, to: current.score },
    emailSent,
  });
  // Palier franchi : seulement par rapport à une mesure comparable (sinon ce serait un écart non mesuré).
  const crossed = previous ? MILESTONES.filter((m) => previous.score < m && current.score >= m) : [];
  if (crossed.length) {
    const m = crossed[crossed.length - 1];
    await db.recordAlert({ businessId: b.id, auditId: current.id, type: 'milestone', title: `Cap des ${m} points franchi`, payload: { milestone: m, score: current.score } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// audit.scheduled : balayage des ré-audits dus selon l'offre
// ---------------------------------------------------------------------------

export async function handleAuditScheduled(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const now = str(p, 'now') ? new Date(str(p, 'now')!) : new Date();
  const db = await import('@/lib/db');
  // Plus petit intervalle (hebdomadaire) : les commerces mensuels sont filtrés ensuite par leur offre.
  const candidates = await db.listBusinessesDueForAudit(6, 500);
  let notDue = 0;
  const jobIds: string[] = [];
  for (const b of candidates) {
    const ent = await entitlements(b);
    const latest = await db.getLatestAuditForBusiness(b.id);
    if (!isAuditDue(ent.frequency, latest?.createdAt, now)) {
      notDue++;
      continue;
    }
    const { id } = await enqueue(
      'audit.run',
      { businessId: b.id, trigger: 'scheduled' },
      { businessId: b.id, dedupeKey: `audit.run:scheduled:${b.id}:${periodKey(ent.frequency, now)}` },
    );
    jobIds.push(id);
  }
  // Mois d'Essentiel offert avec l'audit approfondi : rappel J-5 et retour à Découverte (idempotent, jamais bloquant).
  let offers: Record<string, number> | null = null;
  try {
    const { sweepAuditOffers } = await import('@/lib/entitlements');
    offers = await sweepAuditOffers(now);
  } catch (e) {
    log.warn('job.audit.offers_sweep_failed', { error: e instanceof Error ? e.message : String(e) });
  }
  return { candidates: candidates.length, queued: jobIds.length, notDue, jobIds, offers };
}

// ---------------------------------------------------------------------------
// tasks.generate
// ---------------------------------------------------------------------------

export async function handleTasksGenerate(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = requireBusinessId(p);
  const { isDemoBusinessId } = await import('@/lib/demo-v2');
  if (isDemoBusinessId(businessId)) return { skipped: 'compte de démonstration (lecture seule)' };
  const { regenerateTasks } = await import('@/lib/execution');
  const r = await regenerateTasks(businessId);
  if (!r) throw new PermanentJobError('contexte d’exécution introuvable');
  return { tasks: r.tasks.length, llm: r.llm };
}

// ---------------------------------------------------------------------------
// digest.send (ancien corps du cron hebdo, par commerce)
// ---------------------------------------------------------------------------

export async function handleDigestSend(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = requireBusinessId(p);
  const { isDemoBusinessId } = await import('@/lib/demo-v2');
  if (isDemoBusinessId(businessId)) return { skipped: 'compte de démonstration (lecture seule)' };
  const digestMod = await import('@/lib/digest');
  const week = str(p, 'week') ?? digestMod.weekOf(new Date());
  if (await digestMod.wasDigestSent(businessId, week)) return { skipped: 'déjà envoyé', week };
  const db = await import('@/lib/db');
  const b = await db.getBusinessRecord(businessId);
  if (!b) throw new PermanentJobError('commerce introuvable');
  const out: Record<string, unknown> = { week };

  const latest = await db.getLatestAuditForBusiness(b.id);
  const { getDoc, putDoc } = await import('@/lib/store');
  const st = (await getDoc<{ lastAlertAuditId?: string }>(ALERT_STATE, b.id))?.data ?? {};
  if (latest && st.lastAlertAuditId !== latest.id) {
    const { detectAndRecordAlerts } = await import('@/lib/alerts');
    const { getFacts } = await import('@/lib/facts');
    type AuditV2 = Parameters<typeof detectAndRecordAlerts>[2];
    const audits = (await db.listAuditsForBusiness(b.id)) as AuditV2[];
    // Alertes de score : contre la dernière mesure comparable seulement (même règle que l'e-mail et le digest).
    const { previousComparable } = await import('@/lib/digest/stats');
    const prev = previousComparable(audits);
    const alerts = await detectAndRecordAlerts(b.id, prev, latest as AuditV2, await getFacts(b.id), { threshold: b.alertThreshold });
    out.alerts = alerts.length;
    await putDoc(ALERT_STATE, b.id, { ...st, lastAlertAuditId: latest.id }, b.id);
  }

  const digest = await digestMod.buildWeeklyDigest(b.id, new Date());
  await digestMod.saveDigest(digest);
  if (b.contactEmail) {
    const { sendWeeklyDigestEmail } = await import('@/lib/email');
    const res = await sendWeeklyDigestEmail(b.contactEmail, digest, { done: (taskId: string) => digestMod.doneUrl(b.id, taskId) });
    out.email = res.status;
    if (res.status === 'error') throw new Error('envoi du digest en échec');
    await digestMod.markDigestSent(b.id, week, { status: res.status, to: b.contactEmail });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Délégations tolérantes (modules DONNEES, AUDIT-SITE)
// ---------------------------------------------------------------------------

type Loader = () => Promise<unknown>;

/**
 * Modules candidats par type. Seuls des modules existants peuvent figurer ici (import statique pour le bundler).
 * Les modules créés plus tard s'enregistrent eux-mêmes (`registerHandler`) ou sont ajoutés à cette liste.
 */
export const DELEGATES: Partial<Record<JobType, { loaders: Loader[]; names: string[] }>> = {
  'report.scheduled': {
    loaders: [() => import('@/lib/notify/reports')],
    names: ['sendScheduledReport'],
  },
  'webhook.deliver': {
    loaders: [() => import('@/lib/integrations')],
    names: ['deliverWebhook'],
  },
  'measure.action': {
    loaders: [() => import('@/lib/measure')],
    names: ['runMeasureCheckpoint', 'runActionMeasure', 'measureAction'],
  },
  'siteaudit.run': {
    loaders: [() => import('@/lib/siteaudit/runs')],
    names: ['runSiteAuditJob'],
  },
};

export function delegateHandler(type: JobType): JobHandler {
  return async (payload) => {
    const d = DELEGATES[type];
    for (const load of d?.loaders ?? []) {
      let mod: unknown;
      try {
        mod = await load();
      } catch {
        continue;
      }
      const f = pickFn(mod, ...(d?.names ?? []));
      if (f) {
        const r = await f(payload);
        return r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>) : undefined;
      }
    }
    throw new Error(`module de « ${type} » indisponible (export attendu : ${(d?.names ?? []).join(' ou ')})`);
  };
}

// ---------------------------------------------------------------------------
// V5 : SEO-DATA, PUBLICATION, ANALYSE (réanalyse), BAROMÈTRE
// ---------------------------------------------------------------------------

function seoDataHandler(type: 'seodata.gsc.sync' | 'seodata.rank.weekly' | 'seodata.rank.collect'): JobHandler {
  return async (p) => {
    const { handlers } = await import('@/lib/seodata/jobs');
    const r = await handlers[type](p);
    return r && typeof r === 'object' ? r : undefined;
  };
}

/** Relecture d'une série de modifications appliquée (cache du site, CDN) : jamais d'écriture chez le client. */
export async function handlePublishVerify(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = requireBusinessId(p);
  const id = str(p, 'changeSetId');
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new PermanentJobError('changeSetId manquant ou invalide');
  const { isDemoBusinessId } = await import('@/lib/demo-v2');
  if (isDemoBusinessId(businessId)) return { skipped: 'compte de démonstration (lecture seule)' };
  const svc = await import('@/lib/publish/service');
  const cs = await svc.getChangeSet(businessId, id);
  if (!cs) throw new PermanentJobError('série de modifications introuvable');
  if (cs.status !== 'applied') return { skipped: `statut ${cs.status}` };
  const after = await svc.verifyChangeSet(businessId, id, { id: 'system' });
  return { status: after.status };
}

const BUILTINS: Record<JobType, JobHandler> = {
  'audit.run': handleAuditRun,
  'audit.scheduled': handleAuditScheduled,
  'tasks.generate': handleTasksGenerate,
  'digest.send': handleDigestSend,
  'report.scheduled': delegateHandler('report.scheduled'),
  'webhook.deliver': delegateHandler('webhook.deliver'),
  'measure.action': delegateHandler('measure.action'),
  'siteaudit.run': delegateHandler('siteaudit.run'),
  'seodata.gsc.sync': seoDataHandler('seodata.gsc.sync'),
  'seodata.rank.weekly': seoDataHandler('seodata.rank.weekly'),
  'seodata.rank.collect': seoDataHandler('seodata.rank.collect'),
  'publish.verify': handlePublishVerify,
  'analysis.rerun': async (p) => (await import('@/lib/analysis/job')).handleAnalysisRerun(p),
  'analysis.scheduled': async (p) => (await import('@/lib/analysis/job')).handleAnalysisScheduled(p),
  'barometre.run': async (p) => (await import('@/lib/barometre/job')).barometreJobHandler(p),
};

/** Installe les gestionnaires par défaut sans écraser ceux déjà enregistrés par un module. */
export function installBuiltinHandlers(): void {
  for (const [type, h] of Object.entries(BUILTINS) as [JobType, JobHandler][]) {
    if (!getHandler(type)) registerHandler(type, h);
  }
}
