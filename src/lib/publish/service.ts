/**
 * Service de publication : connexions, cycle des ChangeSets (brouillon → proposé → validé → appliqué → vérifié →
 * annulé), journal, relecture, repère sur les courbes et remesure ciblée.
 *
 * Garanties :
 * - aucune écriture chez le client sans `validation` (qui, quand) ET statut permis — vérifié ici, pas seulement par
 *   les routes ;
 * - lecture de l'état réel avant chaque écriture : si la valeur a changé depuis la proposition, le changement échoue
 *   (« conflit ») au lieu d'écraser ; si elle vaut déjà « après », rien n'est réécrit (idempotence) ;
 * - échecs partiels : chaque changement a son statut ; relancer « appliquer » ne reprend que les échecs ;
 * - retour arrière par changement, uniquement si la valeur actuelle est encore celle que Repéré a écrite.
 * Comptes démo : lecture seule (ChangeSets d'exemple, aucune écriture).
 */
import { ANNOTATIONS, cleanLabel, type Annotation } from '@/lib/annotations';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { enqueue } from '@/lib/jobs';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { credentialsOf, getConnection, listConnections, recordTest, removeConnection, saveConnection, toView, type PublishConnectionView } from './connections';
import { TO_COMPLETE_RE } from './autofix';
import { buildExportBundle, connectorFor } from './connectors';
import { demoChangeSets } from './demo';
import { publishHttp } from './http';
import { appendJournal, readJournal, type JournalEntry } from './journal';
import { assertTransition, computeAfter, riskOf, sameValue, statusAfterApply, statusAfterRevert } from './model';
import { planChanges, type Plan, type PlanOptions, type PlanSite, type PlanTarget } from './planner';
import { checkPublic } from './verify';
import { PLATFORM_LABEL, PublishError, type Actor, type Change, type ChangeSet, type ChangeSetStatus, type ConnectInput, type ConnectorContext, type Finding, type Platform, type TestResult } from './types';

export const CHANGESETS = 'publish.changesets';
const CONTENT_KINDS = new Set(['jsonld', 'faq', 'rewrite']);
/** Délai de la remesure ciblée après application. */
export const REMEASURE_DELAY_DAYS = 7;

const DEMO_MSG = 'Compte de démonstration : les modifications ne sont pas enregistrées.';

function assertNotDemo(businessId: string): void {
  if (isDemoBusinessId(businessId)) throw new PublishError(403, DEMO_MSG, 'demo_read_only');
}

const g = globalThis as unknown as { __reperePublishLocks?: Map<string, Promise<unknown>> };
const locks = (g.__reperePublishLocks ??= new Map());
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

/** Changement de contenu toujours en place même si d'autres changements de Repéré ont suivi sur la même page. */
function stillApplied(cur: string | null, ch: Change): boolean {
  try {
    return cur !== null && computeAfter(cur, ch.patch) === cur && (ch.patch.op !== 'replace' || cur.includes(ch.patch.value));
  } catch {
    return false;
  }
}

const msg = (e: unknown) => (e instanceof PublishError ? e.message : 'Erreur inattendue pendant l’opération.');

// ---------------------------------------------------------------------------
// Connexions
// ---------------------------------------------------------------------------

export async function contextFor(businessId: string, platform: Platform, now: () => Date = () => new Date()): Promise<ConnectorContext> {
  if (platform === 'export') return { businessId, http: publishHttp(), credentials: {}, config: {}, now };
  const c = await getConnection(businessId, platform);
  if (!c) throw new PublishError(409, `${PLATFORM_LABEL[platform]} n’est pas connecté.`, 'not_connected');
  return { businessId, http: publishHttp(), credentials: credentialsOf(c), config: { ...(c.lastTest?.info ?? {}), ...c.config }, now };
}

export async function connectPlatform(businessId: string, platform: Platform, input: ConnectInput, actor: Actor, now = new Date()): Promise<{ connection: PublishConnectionView; test: TestResult }> {
  assertNotDemo(businessId);
  if (platform === 'export') throw new PublishError(400, 'L’export ne nécessite pas de connexion.');
  const conn = connectorFor(platform);
  const clean = conn.connect(input);
  await saveConnection(businessId, platform, clean.config, clean.credentials, now);
  await appendJournal(businessId, `conn:${platform}`, actor, 'connection.added', { detail: PLATFORM_LABEL[platform] }, now);
  const test = await testPlatform(businessId, platform, actor, now);
  const saved = await getConnection(businessId, platform);
  return { connection: toView(saved!), test };
}

export async function testPlatform(businessId: string, platform: Platform, actor: Actor, now = new Date()): Promise<TestResult> {
  assertNotDemo(businessId);
  const ctx = await contextFor(businessId, platform);
  let r: TestResult;
  try {
    r = await connectorFor(platform).test(ctx);
  } catch (e) {
    r = { ok: false, detail: msg(e), capabilities: [] };
  }
  await recordTest(businessId, platform, r, now);
  await appendJournal(businessId, `conn:${platform}`, actor, 'connection.tested', { detail: `${r.ok ? 'OK' : 'échec'} : ${r.detail}` }, now);
  return r;
}

export async function disconnectPlatform(businessId: string, platform: Platform, actor: Actor): Promise<boolean> {
  assertNotDemo(businessId);
  const ok = await removeConnection(businessId, platform);
  if (ok) await appendJournal(businessId, `conn:${platform}`, actor, 'connection.removed', { detail: PLATFORM_LABEL[platform] });
  return ok;
}

export async function listConnectionViews(businessId: string): Promise<PublishConnectionView[]> {
  return (await listConnections(businessId)).map(toView);
}

/** Plateformes connectées ET testées avec succès (pour le routage du planificateur). */
export async function planTargets(businessId: string): Promise<PlanTarget[]> {
  return (await listConnections(businessId)).filter((c) => c.lastTest?.ok).map((c) => ({ platform: c.platform, capabilities: c.lastTest!.capabilities }));
}

// ---------------------------------------------------------------------------
// Persistance des ChangeSets
// ---------------------------------------------------------------------------

async function save(cs: ChangeSet, now = new Date()): Promise<ChangeSet> {
  cs.version += 1;
  cs.updatedAt = now.toISOString();
  cs.risk = riskOf(cs.changes);
  await putDoc<ChangeSet>(CHANGESETS, cs.id, cs, cs.businessId);
  return cs;
}

export async function getChangeSet(businessId: string, id: string): Promise<ChangeSet | null> {
  if (isDemoBusinessId(businessId)) return demoChangeSets(businessId).find((c) => c.id === id) ?? null;
  const d = await getDoc<ChangeSet>(CHANGESETS, id);
  return d && d.data.businessId === businessId ? d.data : null;
}

async function mustGet(businessId: string, id: string): Promise<ChangeSet> {
  const cs = await getChangeSet(businessId, id);
  if (!cs) throw new PublishError(404, 'Modifications introuvables.', 'not_found');
  return cs;
}

export async function listChangeSets(businessId: string, opts: { status?: ChangeSetStatus[]; limit?: number } = {}): Promise<ChangeSet[]> {
  const all = isDemoBusinessId(businessId)
    ? demoChangeSets(businessId)
    : (await listDocs<ChangeSet>(CHANGESETS, { businessId, limit: Math.min(opts.limit ?? 200, 500) })).map((d) => d.data).filter((c) => c.businessId === businessId);
  return all.filter((c) => !opts.status || opts.status.includes(c.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function changeSetJournal(businessId: string, id: string): Promise<JournalEntry[]> {
  if (isDemoBusinessId(businessId)) return [];
  return readJournal(businessId, id);
}

// ---------------------------------------------------------------------------
// Création (planification)
// ---------------------------------------------------------------------------

const OPEN: ChangeSetStatus[] = ['draft', 'proposed', 'validated', 'applying', 'partially_applied', 'failed'];

/**
 * Planifie et enregistre les brouillons. Un constat déjà en cours de traitement (ChangeSet ouvert pour la même
 * plateforme) n'est pas dupliqué : le ChangeSet existant est renvoyé.
 */
export async function createChangeSets(businessId: string, findings: Finding[], site: PlanSite, actor: Actor, opts: PlanOptions & { targets?: PlanTarget[] } = {}): Promise<Plan> {
  assertNotDemo(businessId);
  if (site.businessId !== businessId) throw new PublishError(400, 'Site d’un autre espace.');
  const targets = opts.targets ?? (await planTargets(businessId));
  const plan = await planChanges(findings, site, targets, { ...opts, actor });
  const open = await listChangeSets(businessId, { status: OPEN });
  const out: ChangeSet[] = [];
  for (const cs of plan.changeSets) {
    const dup = open.find((o) => o.origin.findingId === cs.origin.findingId && o.platform === cs.platform && o.site === cs.site);
    if (dup) {
      out.push(dup);
      continue;
    }
    await putDoc<ChangeSet>(CHANGESETS, cs.id, cs, businessId);
    await appendJournal(businessId, cs.id, actor, 'created', { detail: `${cs.changes.length} modification(s) · ${PLATFORM_LABEL[cs.platform]} · constat ${cs.origin.findingId}` });
    out.push(cs);
  }
  return { changeSets: out, skipped: plan.skipped };
}

// ---------------------------------------------------------------------------
// Proposition : lecture de l'état réel (avant exact) et calcul de « après »
// ---------------------------------------------------------------------------

export async function proposeChangeSet(businessId: string, id: string, actor: Actor, now = new Date()): Promise<ChangeSet> {
  assertNotDemo(businessId);
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'propose');
    const conn = connectorFor(cs.platform);
    const ctx = await contextFor(businessId, cs.platform);
    for (const ch of cs.changes) {
      try {
        if (cs.platform !== 'export') ch.target.resource = await conn.locate(ctx, ch);
        const current = await conn.read(ctx, ch);
        if (cs.platform !== 'export' || current !== ch.before) {
          ch.before = current;
          ch.beforeSource = cs.platform === 'export' ? (current === null ? 'none' : 'crawl') : 'platform';
        }
        ch.after = computeAfter(ch.before, ch.patch);
        if (sameValue(ch.before, ch.after)) {
          ch.status = 'skipped';
          ch.error = 'Déjà en place sur le site : rien à modifier.';
        }
      } catch (e) {
        ch.status = 'skipped';
        ch.error = msg(e);
      }
    }
    if (!cs.changes.some((c) => c.status === 'pending')) {
      await save(cs, now);
      throw new PublishError(409, 'Aucune modification applicable (voir le détail de chaque changement).', 'nothing_to_apply');
    }
    cs.status = 'proposed';
    cs.proposedAt = now.toISOString();
    await save(cs, now);
    await appendJournal(businessId, id, actor, 'proposed', { detail: `${cs.changes.filter((c) => c.status === 'pending').length} modification(s) prêtes à valider` }, now);
    return cs;
  });
}

/** Modification d'un texte proposé par le client : la validation précédente tombe. */
export async function editChange(businessId: string, id: string, changeId: string, value: string, actor: Actor, now = new Date()): Promise<ChangeSet> {
  assertNotDemo(businessId);
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'edit');
    const ch = cs.changes.find((c) => c.id === changeId);
    if (!ch || ch.status !== 'pending') throw new PublishError(404, 'Modification introuvable ou non modifiable.');
    const v = String(value ?? '').slice(0, 50_000);
    if (!v.trim()) throw new PublishError(400, 'Texte vide.');
    ch.patch = { ...ch.patch, value: v };
    ch.after = ch.patch.op === 'set' || ch.beforeSource === 'platform' ? computeAfter(ch.before, ch.patch) : null;
    ch.generatedBy = 'user';
    if (cs.status === 'validated') {
      delete cs.validation;
      cs.status = 'proposed';
    }
    await save(cs, now);
    await appendJournal(businessId, id, actor, 'edited', { changeId, after: ch.after ?? ch.patch.value }, now);
    return cs;
  });
}

// ---------------------------------------------------------------------------
// Validation explicite
// ---------------------------------------------------------------------------

export async function validateChangeSet(businessId: string, id: string, actor: Actor, opts: { exclude?: string[]; note?: string } = {}, now = new Date()): Promise<ChangeSet> {
  assertNotDemo(businessId);
  if (!actor.id || actor.id === 'agent' || actor.id === 'system') throw new PublishError(403, 'La validation doit être faite par une personne.', 'human_required');
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'validate');
    for (const ch of cs.changes) {
      if (opts.exclude?.includes(ch.id) && ch.status === 'pending') {
        ch.status = 'skipped';
        ch.error = 'Écarté lors de la validation.';
      }
    }
    if (!cs.changes.some((c) => c.status === 'pending')) throw new PublishError(409, 'Aucune modification retenue.', 'nothing_to_apply');
    if (cs.changes.some((c) => c.status === 'pending' && TO_COMPLETE_RE.test(`${c.after ?? ''}\n${c.patch.value}`))) {
      throw new PublishError(409, 'Certaines modifications contiennent « [à compléter] » : complétez-les (ou écartez-les) avant de valider.', 'incomplete');
    }
    cs.status = 'validated';
    cs.validation = { by: actor, at: now.toISOString(), ...(opts.note ? { note: opts.note.slice(0, 300) } : {}) };
    await save(cs, now);
    await appendJournal(businessId, id, actor, 'validated', { detail: `${cs.changes.filter((c) => c.status === 'pending').length} modification(s) validée(s)${opts.exclude?.length ? `, ${opts.exclude.length} écartée(s)` : ''}` }, now);
    return cs;
  });
}

export async function rejectChangeSet(businessId: string, id: string, actor: Actor, reason?: string, now = new Date()): Promise<ChangeSet> {
  assertNotDemo(businessId);
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'reject');
    cs.status = 'rejected';
    delete cs.validation;
    cs.rejection = { by: actor, at: now.toISOString(), ...(reason ? { reason: reason.slice(0, 300) } : {}) };
    await save(cs, now);
    await appendJournal(businessId, id, actor, 'rejected', { detail: reason }, now);
    return cs;
  });
}

// ---------------------------------------------------------------------------
// Application, vérification
// ---------------------------------------------------------------------------

export interface ApplyOptions {
  /** relire la page publique (défaut : oui) */
  pageCheck?: boolean;
  now?: Date;
}

async function verifyChanges(cs: ChangeSet, ctx: ConnectorContext, actor: Actor, opts: ApplyOptions, now: Date): Promise<void> {
  const conn = connectorFor(cs.platform);
  for (const ch of cs.changes.filter((c) => c.status === 'applied' || c.status === 'verified')) {
    const at = now.toISOString();
    const checks: NonNullable<Change['verification']> = [];
    if (cs.platform !== 'export') {
      try {
        const cur = await conn.read(ctx, ch);
        const ok = sameValue(cur, ch.after) || (CONTENT_KINDS.has(ch.kind) && ch.patch.op !== 'set' && stillApplied(cur, ch));
        checks.push({ ok, method: 'api', detail: ok ? `Relu chez ${PLATFORM_LABEL[cs.platform]} : conforme.` : `Relu chez ${PLATFORM_LABEL[cs.platform]} : valeur différente.`, at });
      } catch (e) {
        checks.push({ ok: false, method: 'api', detail: msg(e), at });
      }
    } else if (!ch.verification?.length) {
      checks.push({ ok: false, method: 'manual', detail: 'Fichiers prêts : à déposer sur votre site, puis cliquez sur « Vérifier ».', at });
    }
    if (opts.pageCheck !== false) {
      const p = await checkPublic(ch);
      if (p) checks.push({ ok: p.ok, method: 'page', detail: p.detail, at });
    }
    ch.verification = [...(ch.verification ?? []), ...checks].slice(-10);
    const api = checks.find((c) => c.method === 'api');
    const page = checks.find((c) => c.method === 'page');
    const verified = cs.platform === 'export' ? Boolean(page?.ok) : Boolean(api?.ok) && (!page || page.ok);
    if (verified) ch.status = 'verified';
    await appendJournal(cs.businessId, cs.id, actor, verified ? 'change.verified' : 'change.unverified', { changeId: ch.id, detail: checks.map((c) => c.detail).join(' · ') }, now);
  }
}

async function markEffect(cs: ChangeSet, actor: Actor, now: Date): Promise<void> {
  const live = cs.changes.some((c) => c.status === 'verified' || (cs.platform !== 'export' && c.status === 'applied'));
  if (!live) return;
  const id = `an_pub_${cs.id}`;
  if (!(await getDoc(ANNOTATIONS, id))) {
    const a: Annotation = {
      id,
      businessId: cs.businessId,
      date: now.toISOString().slice(0, 10),
      label: cleanLabel(`Publié : ${cs.title}`),
      kind: 'action',
      series: 'all',
      taskId: null,
      href: `/app/agent?cs=${cs.id}`,
      createdAt: now.toISOString(),
    };
    await putDoc<Annotation>(ANNOTATIONS, id, a, cs.businessId);
  }
  if (!cs.remeasureJobId) {
    const url = cs.changes.find((c) => c.target.url)?.target.url ?? cs.site;
    const runAt = new Date(now.getTime() + REMEASURE_DELAY_DAYS * 86_400_000);
    const job = await enqueue('siteaudit.run', { businessId: cs.businessId, url, kind: 'full', reason: 'publish', changeSetId: cs.id }, { businessId: cs.businessId, runAt, dedupeKey: `publish-remeasure:${cs.id}` });
    cs.remeasureJobId = job.id;
    await appendJournal(cs.businessId, cs.id, actor, 'remeasure.scheduled', { detail: `Remesure de ${url} le ${runAt.toISOString().slice(0, 10)}` }, now);
    // V5 : réanalyse SEO + GEO du site le même jour (avant / après, constats corrigés) — jamais bloquant.
    try {
      await enqueue('analysis.rerun', { businessId: cs.businessId, reason: 'publish', changeSetId: cs.id }, { businessId: cs.businessId, runAt, dedupeKey: `publish-reanalysis:${cs.id}` });
    } catch {
      /* file indisponible : la réanalyse planifiée de l'offre prendra le relais */
    }
  }
  // Appliqué mais pas encore relu conforme (cache du site, CDN) : nouvelle relecture le lendemain, une seule fois.
  if (cs.status === 'applied') {
    try {
      await enqueue('publish.verify', { businessId: cs.businessId, changeSetId: cs.id }, { businessId: cs.businessId, runAt: new Date(now.getTime() + 86_400_000), dedupeKey: `publish-verify:${cs.id}` });
    } catch {
      /* relecture manuelle toujours possible (« Vérifier ») */
    }
  }
}

export async function applyChangeSet(businessId: string, id: string, actor: Actor, opts: ApplyOptions = {}): Promise<ChangeSet> {
  assertNotDemo(businessId);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'apply');
    // Double garde : statut ET trace de validation humaine.
    if (!cs.validation?.by?.id || !cs.validation.at) throw new PublishError(409, 'Ces modifications doivent être validées avant d’être appliquées.', 'not_validated');
    const conn = connectorFor(cs.platform);
    const ctx = await contextFor(businessId, cs.platform, () => now);
    const previous = cs.status;
    cs.status = 'applying';
    await save(cs, now);
    await appendJournal(businessId, id, actor, 'apply.started', { detail: previous === 'validated' ? undefined : 'reprise des modifications non appliquées' }, now);
    let wrote = false;
    // Plusieurs changements de contenu sur la même page : chacun se rebase sur l'écriture précédente de Repéré.
    const lastWrite = new Map<string, { before: string | null; after: string | null }>();
    const resKey = (ch: Change) => (CONTENT_KINDS.has(ch.kind) && ch.target.resource ? `${ch.target.resource.type}:${ch.target.resource.id ?? ''}` : '');
    for (const ch of cs.changes.filter((c) => c.status === 'pending' || c.status === 'failed')) {
      try {
        if (cs.platform !== 'export') {
          ch.target.resource = await conn.locate(ctx, ch);
          const current = await conn.read(ctx, ch);
          const prev = lastWrite.get(resKey(ch));
          if (resKey(ch) && prev && sameValue(prev.before, ch.before) && sameValue(current, prev.after) && !sameValue(current, ch.after)) {
            ch.before = current;
            ch.after = computeAfter(current, ch.patch);
          }
          if (sameValue(current, ch.after)) {
            ch.status = 'applied';
            ch.appliedAt ??= now.toISOString();
            delete ch.error;
            await appendJournal(businessId, id, actor, 'change.unchanged', { changeId: ch.id, detail: 'Déjà en place : aucune écriture.' }, now);
            continue;
          }
          if (!sameValue(current, ch.before)) throw new PublishError(409, 'La valeur a changé sur le site depuis la proposition : reproposez cette modification.', 'conflict');
          const r = await conn.apply(ctx, ch);
          if (r.remoteRef) ch.remoteRef = r.remoteRef;
          wrote = true;
          if (resKey(ch)) lastWrite.set(resKey(ch), { before: ch.before, after: ch.after });
        }
        ch.status = 'applied';
        ch.appliedAt = now.toISOString();
        delete ch.error;
        await appendJournal(businessId, id, actor, 'change.applied', { changeId: ch.id, before: ch.before, after: ch.after }, now);
      } catch (e) {
        ch.status = 'failed';
        ch.error = msg(e);
        await appendJournal(businessId, id, actor, 'change.failed', { changeId: ch.id, detail: ch.error }, now);
      }
      await save(cs, now); // état durable après chaque écriture (reprise sûre)
    }
    if (wrote && conn.finalize) {
      try {
        await conn.finalize(ctx, cs.changes.filter((c) => c.status === 'applied'));
      } catch (e) {
        await appendJournal(businessId, id, actor, 'change.failed', { detail: `Publication du site : ${msg(e)}` }, now);
      }
    }
    await verifyChanges(cs, ctx, actor, opts, now);
    cs.status = statusAfterApply(cs.changes.filter((c) => c.status !== 'skipped'));
    if (cs.status !== 'failed') cs.appliedAt ??= now.toISOString();
    if (cs.status === 'verified') cs.verifiedAt = now.toISOString();
    await markEffect(cs, actor, now);
    await save(cs, now);
    await appendJournal(businessId, id, actor, cs.status === 'verified' ? 'verified' : 'applied', { detail: `Statut : ${cs.status}` }, now);
    return cs;
  });
}

/** Relance la relecture (après mise en cache, ou après dépôt des fichiers d'un export). */
export async function verifyChangeSet(businessId: string, id: string, actor: Actor, opts: ApplyOptions = {}): Promise<ChangeSet> {
  assertNotDemo(businessId);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'verify');
    const ctx = await contextFor(businessId, cs.platform, () => now);
    await verifyChanges(cs, ctx, actor, opts, now);
    cs.status = statusAfterApply(cs.changes.filter((c) => c.status !== 'skipped'));
    if (cs.status === 'verified') cs.verifiedAt ??= now.toISOString();
    await markEffect(cs, actor, now);
    await save(cs, now);
    if (cs.status === 'verified') await appendJournal(businessId, id, actor, 'verified', {}, now);
    return cs;
  });
}

// ---------------------------------------------------------------------------
// Retour arrière
// ---------------------------------------------------------------------------

export async function revertChangeSet(businessId: string, id: string, actor: Actor, opts: { changeIds?: string[]; force?: boolean; now?: Date } = {}): Promise<ChangeSet> {
  assertNotDemo(businessId);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const cs = await mustGet(businessId, id);
    assertTransition(cs, 'revert');
    const conn = connectorFor(cs.platform);
    const ctx = await contextFor(businessId, cs.platform, () => now);
    // Ordre inverse : les changements empilés sur une même page se défont du dernier au premier.
    const targets = cs.changes.filter((c) => ['applied', 'verified', 'failed'].includes(c.status) && (!opts.changeIds || opts.changeIds.includes(c.id))).reverse();
    if (!targets.length) throw new PublishError(409, 'Rien à annuler.', 'nothing_to_revert');
    let wrote = false;
    for (const ch of targets) {
      try {
        if (cs.platform !== 'export') {
          const current = await conn.read(ctx, ch);
          if (ch.status === 'failed' && !sameValue(current, ch.after)) continue; // rien n'a été écrit
          if (!sameValue(current, ch.before)) {
            if (!sameValue(current, ch.after) && !opts.force) throw new PublishError(409, 'Modifié depuis sur le site : retour arrière refusé pour ne pas écraser ce changement.', 'conflict');
            await conn.revert(ctx, ch);
            wrote = true;
            const back = await conn.read(ctx, ch);
            if (!sameValue(back, ch.before)) throw new PublishError(502, 'Retour arrière non confirmé à la relecture.', 'revert_unconfirmed');
          }
        } else if (ch.status === 'failed') continue;
        ch.status = 'reverted';
        ch.revertedAt = now.toISOString();
        delete ch.error;
        await appendJournal(businessId, id, actor, 'change.reverted', { changeId: ch.id, before: ch.after, after: ch.before, detail: cs.platform === 'export' ? 'Remettez les fichiers « avant » de l’archive.' : undefined }, now);
      } catch (e) {
        ch.error = msg(e);
        await appendJournal(businessId, id, actor, 'change.revert_failed', { changeId: ch.id, detail: ch.error }, now);
      }
      await save(cs, now);
    }
    if (wrote && conn.finalize) {
      try {
        await conn.finalize(ctx, targets.filter((c) => c.status === 'reverted'));
      } catch (e) {
        await appendJournal(businessId, id, actor, 'change.revert_failed', { detail: `Publication du site : ${msg(e)}` }, now);
      }
    }
    cs.status = statusAfterRevert(cs.changes, cs.status);
    if (cs.status === 'reverted') {
      cs.revertedAt = now.toISOString();
      const aid = `an_pubrev_${cs.id}`;
      if (!(await getDoc(ANNOTATIONS, aid))) {
        await putDoc<Annotation>(ANNOTATIONS, aid, { id: aid, businessId, date: now.toISOString().slice(0, 10), label: cleanLabel(`Annulé : ${cs.title}`), kind: 'action', series: 'all', taskId: null, href: `/app/agent?cs=${cs.id}`, createdAt: now.toISOString() }, businessId);
      }
    }
    await save(cs, now);
    if (cs.status === 'reverted') await appendJournal(businessId, id, actor, 'reverted', {}, now);
    return cs;
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Archive ZIP des fichiers à déposer (tout ChangeSet proposé ou plus avancé). */
export async function exportChangeSet(businessId: string, id: string): Promise<{ filename: string; zip: Buffer; files: { name: string; content: string }[] }> {
  const cs = await mustGet(businessId, id);
  if (cs.status === 'draft') throw new PublishError(409, 'Proposez d’abord ces modifications.');
  const b = buildExportBundle(cs);
  return { filename: `repere-${cs.id}.zip`, ...b };
}
