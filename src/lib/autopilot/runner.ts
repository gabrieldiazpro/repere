/**
 * Pilote automatique — exécution. Deux entrées :
 * - `runAutopilot` : après chaque analyse du site (src/lib/analysis/job.ts) ; arrêt automatique si un score a baissé
 *   au-delà de la marge depuis la dernière série, puis séries de corrections couvertes par le mandat (création,
 *   proposition = lecture de l'état réel, validation SOUS MANDAT, application, relecture), puis contenus (brouillon
 *   chez le client, mise en ligne programmée à +72 h, e-mail avec « Bloquer »).
 * - `sweepAutopilot` : chaque jour (cron /api/pilote/cron) ; met en ligne les contenus dont le délai de relecture est
 *   passé (sans blocage, mandat toujours actif, contrôles toujours bons) et envoie le récapitulatif du lundi.
 *
 * Garanties : jamais sur un compte démo ; jamais sans mandat actif ; jamais hors des catégories du mandat ni au-delà
 * des plafonds de l'offre ; toute action est journalisée (journal chaîné) et prévenue après coup avec annulation.
 * Ne lève jamais : une erreur est journalisée et le pilote s'arrête pour ce passage.
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { Entitlements } from '@/lib/entitlements';
import type { SiteCrawl } from '@/lib/crawl/types';
import type { ContentDraft } from '@/lib/content/types';
import type { Actor, ChangeSet, Finding } from '@/lib/publish/types';
import type { PlanSite } from '@/lib/publish/planner';
import { log } from '@/lib/log';
import { CONTENT_REVIEW_HOURS, MAX_SERIES_PER_RUN, mandateActor, mandateAllows, mandateKinds, type Mandate } from './mandate';
import { evaluateChangeSet, evaluateDraft, scoreDrop, type FicheView, type Scores } from './policy';
import { buildRecap, isRecapDue, recapEmail } from './recap';
import type { AutopilotAction, AutopilotJournalEntry, AutopilotState, ContentSchedule, SeriesRecord } from './store';

export interface AutopilotBusiness {
  id: string;
  name: string;
  website: string | null;
  segment: 'local' | 'pme' | 'ecommerce';
  trade?: string | null;
  city?: string | null;
  contactEmail?: string | null;
}

export interface AutopilotDeps {
  business(businessId: string): Promise<{ b: AutopilotBusiness; ent: Entitlements } | null>;
  getMandate(businessId: string): Promise<Mandate | null>;
  pauseMandate(businessId: string, who: Actor, o: { reason: 'client' | 'guard'; detail?: string }, now: Date): Promise<Mandate>;
  getState(businessId: string): Promise<AutopilotState>;
  saveState(s: AutopilotState, now: Date): Promise<AutopilotState>;
  journal(businessId: string, who: Actor, action: AutopilotAction, o: { ref?: string; detail?: string }, now: Date): Promise<unknown>;
  fiche(businessId: string): Promise<{ view: FicheView; values: string[] } | null>;
  regulated(b: AutopilotBusiness): boolean;
  listChangeSets(businessId: string): Promise<ChangeSet[]>;
  createChangeSets(businessId: string, findings: Finding[], site: PlanSite, actor: Actor, now: Date): Promise<void>;
  proposeChangeSet(businessId: string, id: string, actor: Actor, now: Date): Promise<ChangeSet>;
  validateUnderMandate(businessId: string, id: string, now: Date): Promise<ChangeSet>;
  applyChangeSet(businessId: string, id: string, actor: Actor, now: Date): Promise<ChangeSet>;
  countAppliedThisMonth(businessId: string, now: Date): Promise<number>;
  listDrafts(businessId: string): Promise<ContentDraft[]>;
  /** crée des brouillons de contenus (pages manquantes) à partir des opportunités ; renvoie le nombre créé */
  prepareDrafts(businessId: string, max: number, input: { b: AutopilotBusiness; crawl?: SiteCrawl; findingIds: string[]; actor: Actor; now: Date }): Promise<number>;
  validateDraft(businessId: string, id: string, actor: Actor, now: Date): Promise<ContentDraft>;
  pushDraft(businessId: string, id: string, actor: Actor, o: { tier: Entitlements['tier']; author: string; now: Date }): Promise<ContentDraft>;
  publishDraft(businessId: string, id: string, actor: Actor, now: Date): Promise<ContentDraft>;
  notify(businessId: string, n: { title: string; body: string; href: string; severity?: 'critique' | 'important' | 'info'; dedupeKey: string }): Promise<void>;
  email(to: string, m: import('@/lib/email').AutopilotEmail): Promise<void>;
  actionUrl(businessId: string, kind: 'undo' | 'block' | 'pause', ref?: string): string;
  appUrl(): string;
  listJournal(businessId: string): Promise<AutopilotJournalEntry[]>;
}

const REQUIRED: (keyof AutopilotDeps)[] = ['business', 'getMandate', 'pauseMandate', 'getState', 'saveState', 'journal', 'fiche', 'regulated', 'listChangeSets', 'createChangeSets', 'proposeChangeSet', 'validateUnderMandate', 'applyChangeSet', 'countAppliedThisMonth', 'listDrafts', 'prepareDrafts', 'validateDraft', 'pushDraft', 'publishDraft', 'notify', 'email', 'actionUrl', 'appUrl', 'listJournal'];

export interface RunInput {
  trigger: 'analysis' | 'manual' | 'scheduled';
  findings?: Finding[];
  crawl?: SiteCrawl;
  site?: PlanSite;
  /** analyse qui déclenche le passage : base de l'arrêt automatique et repère des séries appliquées */
  analysis?: { id: string; createdAt: string; scores: Scores };
  now?: Date;
  deps?: Partial<AutopilotDeps>;
}

export type RunResult =
  | { status: 'skipped'; reason: 'demo' | 'offer' | 'no_mandate' | 'paused' | 'error' }
  | { status: 'stopped'; detail: string }
  | { status: 'done'; applied: string[]; skipped: number; scheduled: string[]; quotaLeft: number };

const SYSTEM: Actor = { id: 'system', role: 'system' };

async function defaultDeps(): Promise<AutopilotDeps> {
  const [store, publish, content, db, ent, tokens, email] = await Promise.all([
    import('./store'),
    import('@/lib/publish/service'),
    import('@/lib/content/service'),
    import('@/lib/db'),
    import('@/lib/entitlements'),
    import('./tokens'),
    import('@/lib/email'),
  ]);
  return {
    async business(businessId) {
      const r = await db.getBusinessRecord(businessId);
      if (!r) return null;
      const segment = r.segment === 'pme' || r.segment === 'ecommerce' ? r.segment : 'local';
      return { b: { id: r.id, name: r.name, website: r.website ?? null, segment, trade: r.trade, city: r.city, contactEmail: r.contactEmail }, ent: ent.getEntitlements(r) };
    },
    getMandate: store.getMandate,
    pauseMandate: (b, who, o, now) => store.pauseMandate(b, who, o, now),
    getState: store.getState,
    saveState: store.saveState,
    journal: (b, who, a, o, now) => store.appendAutopilotJournal(b, who, a, o, now),
    fiche: async (businessId) => (await import('./sources')).ficheForAutopilot(businessId),
    regulated: (b) => isRegulatedSync(b),
    listChangeSets: (b) => publish.listChangeSets(b, { limit: 500 }),
    createChangeSets: async (b, f, site, actor, now) => {
      await publish.createChangeSets(b, f, site, actor, { now });
    },
    proposeChangeSet: publish.proposeChangeSet,
    validateUnderMandate: publish.validateChangeSetUnderMandate,
    applyChangeSet: (b, id, actor, now) => publish.applyChangeSet(b, id, actor, { now }),
    countAppliedThisMonth: publish.countAppliedThisMonth,
    listDrafts: content.listDrafts,
    prepareDrafts: async (b, max, input) => (await import('./sources')).prepareContentDrafts(b, max, input),
    validateDraft: content.validateDraftUnderMandate,
    pushDraft: async (b, id, actor, o) => (await content.pushDraft(b, id, actor, o)).draft,
    publishDraft: (b, id, actor, now) => content.publishDraft(b, id, actor, { now }),
    async notify(businessId, n) {
      const { notify } = await import('@/lib/notify');
      await notify(businessId, { type: 'autopilot', ...n });
    },
    async email(to, m) {
      await email.sendAutopilotEmail(to, m);
    },
    actionUrl: tokens.actionUrl,
    appUrl: email.appUrl,
    listJournal: (b) => store.listAutopilotJournal(b, 300),
  };
}

let regulatedFn: ((t: string | null | undefined) => boolean) | null = null;
function isRegulatedSync(b: AutopilotBusiness): boolean {
  return regulatedFn ? regulatedFn(b.trade) : false;
}
async function loadRegulated() {
  if (!regulatedFn) regulatedFn = (await import('@/lib/regulated')).isRegulatedTrade;
}

async function depsWith(over?: Partial<AutopilotDeps>): Promise<AutopilotDeps> {
  await loadRegulated();
  // Tests : toutes les dépendances injectées, aucun import du stockage réel.
  if (over && REQUIRED.every((k) => typeof over[k] === 'function')) return { ...(over as AutopilotDeps) };
  return { ...(await defaultDeps()), ...(over ?? {}) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Passage du pilote pour un espace (après une analyse, ou à la demande). Ne lève jamais. */
export async function runAutopilot(businessId: string, input: RunInput): Promise<RunResult> {
  const now = input.now ?? new Date();
  if (isDemoBusinessId(businessId)) return { status: 'skipped', reason: 'demo' };
  if (process.env.AUTOPILOT_ENABLED === '0') return { status: 'skipped', reason: 'paused' };
  try {
    const d = await depsWith(input.deps);
    const ctx = await d.business(businessId);
    if (!ctx || !ctx.ent.autopilot) return { status: 'skipped', reason: 'offer' };
    const { b, ent } = ctx;
    const mandate = await d.getMandate(businessId);
    if (!mandate || mandate.status === 'revoked') return { status: 'skipped', reason: 'no_mandate' };
    if (mandate.status !== 'active') return { status: 'skipped', reason: 'paused' };
    const actor = mandateActor(mandate) as Actor;
    const state = await d.getState(businessId);

    // 1. Arrêt automatique : une série précédente a-t-elle fait baisser un score au-delà de la marge ?
    if (input.analysis) {
      const pending = state.series.filter((s) => (s.status === 'applied' || s.status === 'verified') && !s.checkedAt && s.baseline && s.appliedAt < input.analysis!.createdAt);
      const dropped = pending.map((s) => ({ s, r: scoreDrop(s.baseline, input.analysis!.scores) })).filter((x) => x.r.dropped);
      for (const s of pending) {
        s.checkedAt = now.toISOString();
        s.after = { seo: input.analysis.scores.seo, geo: input.analysis.scores.geo };
      }
      if (dropped.length) {
        const detail = dropped[0].r.detail;
        const ids = dropped.map((x) => x.s.csId);
        state.guard = { trippedAt: now.toISOString(), detail, seriesIds: ids };
        await d.saveState(state, now);
        await d.pauseMandate(businessId, SYSTEM, { reason: 'guard', detail: `Arrêt automatique : ${detail}` }, now);
        await d.notify(businessId, { title: 'Pilote automatique arrêté : un score a baissé', body: `${detail}. Rien d’autre ne sera fait sans votre accord. Vous pouvez annuler les dernières séries en un clic.`, href: '/app/agent/pilote', severity: 'critique', dedupeKey: `autopilot:guard:${now.toISOString().slice(0, 10)}` });
        if (b.contactEmail) {
          await d.email(b.contactEmail, {
            tag: 'autopilot_stop',
            subject: 'Pilote automatique arrêté : un score de votre site a baissé',
            preheader: 'Rien d’autre ne sera fait sans votre accord.',
            paragraphs: [
              `Après les dernières modifications faites sur le site de ${b.name}, notre analyse mesure une baisse au-delà de la marge : ${detail}.`,
              'Par précaution, le pilote automatique s’est arrêté. Rien d’autre ne sera fait sans votre accord. La baisse peut venir d’autre chose que nos modifications (changement sur le site, panne passagère) : vous pouvez annuler les séries concernées, ou relancer le pilote si tout vous semble normal.',
            ],
            items: dropped.map((x) => ({ text: `${x.s.title} (${x.s.appliedAt.slice(0, 10)})`, link: { label: 'Annuler cette série', url: d.actionUrl(businessId, 'undo', x.s.csId) } })),
            cta: { label: 'Voir le pilote', url: `${d.appUrl()}/app/agent/pilote` },
          });
        }
        return { status: 'stopped', detail };
      }
    }

    const fiche = await d.fiche(businessId).catch(() => null);
    const regulated = d.regulated(b);
    const applied: string[] = [];
    let skipped = 0;
    let used = await d.countAppliedThisMonth(businessId, now);
    const max = ent.publish.changeSetsPerMonth;

    // 2. Séries de corrections couvertes par le mandat.
    const kinds = new Set(mandateKinds(mandate.categories));
    if (input.findings?.length && input.site && used < max) {
      const covered = input.findings.filter((f) => {
        const k = (f.autoFix as { kind?: string } | undefined)?.kind;
        return !k || kinds.has(k as never) || (k === 'img.alt' && kinds.has('image.alt')) || (k === 'robots' && kinds.has('robots.txt'));
      });
      if (covered.length) await d.createChangeSets(businessId, covered.slice(0, 12), input.site, actor, now).catch((e) => log.warn('autopilot.create_failed', { businessId, error: String(e) }));
    }
    let list = await d.listChangeSets(businessId);
    for (const cs of list.filter((c) => c.status === 'draft' && !c.origin.findingId.startsWith('content:'))) {
      if (cs.changes.some((c) => !kinds.has(c.kind))) continue;
      try {
        await d.proposeChangeSet(businessId, cs.id, actor, now);
      } catch {
        /* rien d'applicable : reste en brouillon */
      }
    }
    list = await d.listChangeSets(businessId);
    for (const cs of list.filter((c) => c.status === 'proposed')) {
      if (applied.length >= MAX_SERIES_PER_RUN || used >= max) break;
      const v = evaluateChangeSet(cs, { mandate, regulated, ficheValues: fiche?.view.confirmedAt ? fiche.values : [] });
      if (!v.ok) {
        skipped++;
        continue;
      }
      try {
        await d.validateUnderMandate(businessId, cs.id, now);
        const done = await d.applyChangeSet(businessId, cs.id, actor, now);
        const pages = new Set(done.changes.map((c) => c.target.url).filter(Boolean)).size;
        const rec: SeriesRecord = {
          csId: cs.id,
          title: cs.title,
          kinds: [...new Set(done.changes.map((c) => c.kind))],
          pages,
          appliedAt: now.toISOString(),
          status: done.status === 'verified' ? 'verified' : done.status === 'failed' ? 'failed' : 'applied',
          baseline: input.analysis ? { ...input.analysis.scores, analysisId: input.analysis.id } : null,
        };
        state.series.push(rec);
        if (rec.status !== 'failed') {
          used++;
          applied.push(cs.id);
          await d.journal(businessId, actor, 'series.applied', { ref: cs.id, detail: `${cs.title} · ${plural(done.changes.filter((c) => c.status === 'applied' || c.status === 'verified').length, 'modification', 'modifications')} · statut ${done.status}` }, now);
        } else {
          await d.journal(businessId, actor, 'series.failed', { ref: cs.id, detail: done.changes.find((c) => c.error)?.error ?? 'échec' }, now);
        }
      } catch (e) {
        skipped++;
        await d.journal(businessId, actor, 'series.skipped', { ref: cs.id, detail: e instanceof Error ? e.message : String(e) }, now);
      }
    }

    // 3. Contenus : brouillon chez le client, mise en ligne programmée après le délai de relecture.
    const scheduled: string[] = [];
    if (mandateAllows(mandate, 'contenus') && !regulated && ent.contentsPerMonth > 0) {
      const month = now.toISOString().slice(0, 7);
      let drafts = await d.listDrafts(businessId);
      const consumed = drafts.filter((x) => x.consumedAt?.slice(0, 7) === month).length;
      let left = ent.contentsPerMonth - consumed;
      const waiting = drafts.filter((x) => x.status === 'draft' && x.action === 'create').length;
      if (left > 0 && waiting < left) {
        try {
          await d.prepareDrafts(businessId, left - waiting, { b, crawl: input.crawl, findingIds: (input.findings ?? []).map((f) => f.id), actor, now });
          drafts = await d.listDrafts(businessId);
        } catch (e) {
          log.warn('autopilot.prepare_failed', { businessId, error: String(e) });
        }
      }
      for (const dr of drafts.filter((x) => x.status === 'draft')) {
        if (left <= 0) break;
        const v = evaluateDraft(dr, { mandate, regulated, fiche: fiche?.view ?? null });
        if (!v.ok) continue;
        try {
          await d.validateDraft(businessId, dr.id, actor, now);
          const pushed = await d.pushDraft(businessId, dr.id, actor, { tier: ent.tier, author: b.name, now });
          if (pushed.status === 'published') throw new Error('La plateforme a publié directement : contenu retiré du pilote.');
          const sch: ContentSchedule = { draftId: dr.id, title: dr.title, scheduledAt: now.toISOString(), publishAt: new Date(now.getTime() + CONTENT_REVIEW_HOURS * 3_600_000).toISOString(), status: 'scheduled' };
          state.contents.push(sch);
          scheduled.push(dr.id);
          left--;
          await d.journal(businessId, actor, 'content.scheduled', { ref: dr.id, detail: `${dr.title} · brouillon créé chez vous, mise en ligne prévue le ${sch.publishAt.slice(0, 16).replace('T', ' ')} (UTC) sauf blocage` }, now);
        } catch (e) {
          await d.journal(businessId, actor, 'content.failed', { ref: dr.id, detail: e instanceof Error ? e.message : String(e) }, now);
        }
      }
    }

    state.lastRunAt = now.toISOString();
    await d.saveState(state, now);

    // 4. Prévenir après coup, avec l'annulation en un clic.
    if (applied.length || scheduled.length) {
      const series = state.series.filter((s) => applied.includes(s.csId));
      const contents = state.contents.filter((c) => scheduled.includes(c.draftId));
      const title = [applied.length ? plural(applied.length, 'série de corrections faite', 'séries de corrections faites') : '', scheduled.length ? plural(scheduled.length, 'contenu en relecture', 'contenus en relecture') : ''].filter(Boolean).join(', ');
      await d.notify(businessId, { title: `Pilote automatique : ${title}`, body: 'Chaque série est annulable en un clic ; chaque contenu peut être bloqué pendant 72 h.', href: '/app/agent/pilote', severity: 'info', dedupeKey: `autopilot:run:${now.toISOString()}` });
      if (b.contactEmail) {
        await d.email(b.contactEmail, {
          tag: scheduled.length ? 'autopilot_review' : 'autopilot_done',
          subject: `Pilote automatique : ${title} sur votre site`,
          preheader: 'Annulable en un clic. Rien d’autre n’a été touché.',
          paragraphs: [
            `Dans le cadre de votre mandat, Repéré vient de faire ceci sur le site de ${b.name}. Les valeurs d’avant sont gardées : chaque série se défait à l’identique.`,
            ...(contents.length ? [`Les contenus ci-dessous sont créés en brouillon chez vous (non visibles du public). Ils seront mis en ligne dans ${CONTENT_REVIEW_HOURS} heures, sauf si vous les bloquez.`] : []),
          ],
          items: [
            ...series.map((s) => ({ text: `${s.title} (${plural(s.pages || 1, 'page', 'pages')})`, link: { label: 'Annuler', url: d.actionUrl(businessId, 'undo', s.csId) } })),
            ...contents.map((c) => ({ text: `Contenu : ${c.title}`, link: { label: 'Bloquer la mise en ligne', url: d.actionUrl(businessId, 'block', c.draftId) } })),
          ],
          cta: { label: 'Tout voir dans mon espace', url: `${d.appUrl()}/app/agent/pilote` },
        });
      }
    }
    log.info('autopilot.run', { businessId, trigger: input.trigger, applied: applied.length, skipped, scheduled: scheduled.length });
    return { status: 'done', applied, skipped, scheduled, quotaLeft: Math.max(0, max - used) };
  } catch (e) {
    log.warn('autopilot.failed', { businessId, error: e instanceof Error ? e.message : String(e) });
    return { status: 'skipped', reason: 'error' };
  }
}

/**
 * Balayage quotidien d'un espace : mise en ligne des contenus arrivés au bout du délai de relecture, puis
 * récapitulatif du lundi (et rapport du mois le premier lundi). Ne lève jamais.
 */
export async function sweepBusiness(businessId: string, now = new Date(), over?: Partial<AutopilotDeps>): Promise<{ published: number; recap: boolean }> {
  const out = { published: 0, recap: false };
  if (isDemoBusinessId(businessId)) return out;
  try {
    const d = await depsWith(over);
    const ctx = await d.business(businessId);
    if (!ctx) return out;
    const { b, ent } = ctx;
    const mandate = await d.getMandate(businessId);
    const state = await d.getState(businessId);
    const fiche = await d.fiche(businessId).catch(() => null);
    const regulated = d.regulated(b);
    const drafts = await d.listDrafts(businessId);
    for (const c of state.contents.filter((x) => x.status === 'scheduled' && Date.parse(x.publishAt) <= now.getTime())) {
      // Le mandat est relu au moment de publier : en pause, révoqué, ou sans contenus → rien n'est mis en ligne.
      if (!ent.autopilot || !mandateAllows(mandate, 'contenus')) continue;
      const dr = drafts.find((x) => x.id === c.draftId);
      if (!dr || dr.status !== 'remote_draft') {
        c.status = 'failed';
        c.error = 'Le brouillon n’est plus disponible chez vous (supprimé ou modifié) : rien n’a été mis en ligne.';
        continue;
      }
      const v = evaluateDraft({ ...dr, status: 'draft' }, { mandate, regulated, fiche: fiche?.view ?? null });
      if (!v.ok) {
        c.status = 'failed';
        c.error = v.reasons[0];
        continue;
      }
      try {
        const live = await d.publishDraft(businessId, dr.id, mandateActor(mandate!) as Actor, now);
        c.status = 'published';
        c.publishedAt = now.toISOString();
        if (live.liveUrl) c.liveUrl = live.liveUrl;
        out.published++;
        await d.journal(businessId, mandateActor(mandate!) as Actor, 'content.published', { ref: dr.id, detail: `${dr.title}${live.liveUrl ? ` · ${live.liveUrl}` : ''}` }, now);
      } catch (e) {
        c.status = 'failed';
        c.error = e instanceof Error ? e.message : String(e);
        await d.journal(businessId, SYSTEM, 'content.failed', { ref: dr.id, detail: c.error }, now);
      }
    }
    if (ent.autopilot && mandate && mandate.status !== 'revoked' && isRecapDue(state.lastRecapAt, now)) {
      const journal = await d.listJournal(businessId).catch(() => []);
      const waiting = (await d.listChangeSets(businessId).catch(() => [])).filter((c) => c.status === 'proposed').length;
      const recap = buildRecap({ state, journal, now, used: await d.countAppliedThisMonth(businessId, now), limits: { series: ent.publish.changeSetsPerMonth, contents: ent.contentsPerMonth }, mandate, waitingProposals: waiting });
      if (b.contactEmail) await d.email(b.contactEmail, recapEmail(recap, { name: b.name, businessId, app: d.appUrl(), actionUrl: d.actionUrl }));
      state.lastRecapAt = now.toISOString();
      out.recap = true;
      await d.journal(businessId, SYSTEM, 'recap.sent', { detail: recap.monthly ? 'Rapport du mois envoyé' : 'Récapitulatif de la semaine envoyé' }, now);
    }
    await d.saveState(state, now);
    if (out.published) await d.notify(businessId, { title: `Pilote automatique : ${plural(out.published, 'contenu mis en ligne', 'contenus mis en ligne')}`, body: 'Après le délai de relecture, sans blocage de votre part. Vous pouvez le retirer à tout moment.', href: '/app/agent/pilote', severity: 'info', dedupeKey: `autopilot:pub:${now.toISOString().slice(0, 10)}` });
    return out;
  } catch (e) {
    log.warn('autopilot.sweep_failed', { businessId, error: e instanceof Error ? e.message : String(e) });
    return out;
  }
}

export async function sweepAutopilot(now = new Date()): Promise<{ businesses: number; published: number; recaps: number }> {
  const { listAutopilotBusinesses } = await import('./store');
  const ids = await listAutopilotBusinesses();
  let published = 0;
  let recaps = 0;
  for (const id of ids) {
    const r = await sweepBusiness(id, now);
    published += r.published;
    if (r.recap) recaps++;
  }
  return { businesses: ids.length, published, recaps };
}
