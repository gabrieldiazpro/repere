/**
 * Service de l'agent de contenu (comptes réels ; comptes démo : lecture seule, simulation côté interface).
 *
 * Garanties, vérifiées ICI (pas seulement par les routes) :
 * - rien n'est créé chez le client sans validation humaine (qui, quand) d'un brouillon sans « [à compléter] » ;
 * - plafond mensuel par offre (quota.ts) : au-delà, ni création chez le client ni export ;
 * - création en brouillon d'abord quand la plateforme le permet ; mise en ligne = second geste explicite ;
 * - retour arrière : retrait de la ligne (retour au brouillon), puis corbeille ;
 * - journal immuable (journal.ts) ; repère sur les courbes à la mise en ligne ; mesure J+30 / J+90.
 */
import { ANNOTATIONS, cleanLabel, type Annotation } from '@/lib/annotations';
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { EntitlementTier } from '@/lib/entitlements';
import { getConnection, listConnections } from '@/lib/publish/connections';
import { buildPageExport, canCreate, pageConnectorFor, type PageDraftInput, type PageOptions } from '@/lib/publish/pages';
import { contextFor, createRewriteChangeSet, proposeChangeSet } from '@/lib/publish/service';
import { PLATFORM_LABEL, PublishError, type Platform } from '@/lib/publish/types';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { buildDraft, finalizeDraft, type DraftContext } from './draft';
import { sanitizeFacts } from './facts';
import { appendContentJournal } from './journal';
import { bodyToHtml, parseBody, slugify, TODO_TEST } from './markdown';
import { quotaView } from './quota';
import { refreshEffect, startEffect, type EffectInputs } from './effect';
import { ContentError, type Actor, type ContentDraft, type ContentOpportunity, type ContentSettings, type MentionStatus, type MentionTracking, type StoredFacts } from './types';

export const DRAFTS = 'content.drafts';
export const FACTS = 'content.facts';
export const MENTIONS = 'content.mentions';
export const SETTINGS = 'content.settings';
export const DISMISSED = 'content.dismissed';

const DEMO_MSG = 'Compte de démonstration : rien n’est enregistré.';
function assertNotDemo(businessId: string) {
  if (isDemoBusinessId(businessId)) throw new ContentError(403, DEMO_MSG, 'demo_read_only');
}
function assertHuman(actor: Actor) {
  if (!actor.id || actor.id === 'agent' || actor.id === 'system' || actor.role === 'mandate') throw new ContentError(403, 'Cette étape doit être faite par une personne.', 'human_required');
}

/**
 * V10 (PILOTE-AUTO) : une personne, OU le mandat Pilote automatique signé par le client (acteur `mandat:<id>`) —
 * seulement pour un contenu validé sous CE mandat (contrôlé par l'appelant via `d.validation.by.id`) et tant que le
 * mandat est actif et autorise les contenus (relu dans le stockage, jamais cru sur parole).
 */
async function assertHumanOrMandate(businessId: string, actor: Actor) {
  if (actor.role !== 'mandate') return assertHuman(actor);
  const { isMandateActor, mandateAllows } = await import('@/lib/autopilot/mandate');
  const { getMandate } = await import('@/lib/autopilot/store');
  const m = await getMandate(businessId);
  if (!isMandateActor(actor) || !m || actor.id !== `mandat:${m.id}` || !mandateAllows(m, 'contenus')) {
    throw new ContentError(403, 'Mandat Pilote automatique absent, en pause ou sans les contenus : validation par une personne requise.', 'human_required');
  }
}

function assertSameValidator(d: ContentDraft, actor: Actor) {
  if (actor.role === 'mandate' && d.validation?.by?.id !== actor.id) throw new ContentError(403, 'Ce contenu n’a pas été validé sous ce mandat.', 'human_required');
}
const msg = (e: unknown) => (e instanceof PublishError || e instanceof ContentError ? e.message : 'Erreur inattendue pendant l’opération.');

const g = globalThis as unknown as { __repereContentLocks?: Map<string, Promise<unknown>> };
const locks = (g.__repereContentLocks ??= new Map());
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

// ---------------------------------------------------------------------------
// Faits clés, réglages, propositions écartées
// ---------------------------------------------------------------------------
export async function getFacts(businessId: string): Promise<StoredFacts | null> {
  const d = await getDoc<StoredFacts>(FACTS, businessId);
  return d && d.data.businessId === businessId ? d.data : null;
}

export async function saveFacts(businessId: string, input: unknown, actor: Actor, now = new Date()): Promise<StoredFacts> {
  assertNotDemo(businessId);
  assertHuman(actor);
  const doc: StoredFacts = { businessId, facts: sanitizeFacts(input), updatedAt: now.toISOString(), updatedBy: actor.email ?? actor.id };
  await putDoc<StoredFacts>(FACTS, businessId, doc, businessId);
  await appendContentJournal(businessId, 'facts', actor, 'facts.updated', `${Object.keys(doc.facts).length} fait(s) renseigné(s)`, now);
  return doc;
}

export async function getSettings(businessId: string): Promise<ContentSettings> {
  const d = await getDoc<ContentSettings>(SETTINGS, businessId);
  return d?.data ?? {};
}

export function sanitizeSettings(v: unknown): ContentSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const s = (x: unknown, re: RegExp) => (typeof x === 'string' && re.test(x.trim()) ? x.trim() : undefined);
  const out: ContentSettings = {
    webflowCollectionId: s(o.webflowCollectionId, /^[a-f0-9]{24}$/i),
    wixMemberId: s(o.wixMemberId, /^[a-f0-9-]{8,64}$/i),
    shopifyBlogId: s(o.shopifyBlogId, /^gid:\/\/shopify\/Blog\/\d+$/),
    prestashopCategoryId: s(o.prestashopCategoryId, /^\d{1,6}$/),
    platform: s(o.platform, /^(wordpress|shopify|webflow|wix|prestashop)$/) as Platform | undefined,
  };
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined)) as ContentSettings;
}

export async function saveSettings(businessId: string, input: unknown, actor: Actor): Promise<ContentSettings> {
  assertNotDemo(businessId);
  assertHuman(actor);
  const s = sanitizeSettings(input);
  await putDoc<ContentSettings>(SETTINGS, businessId, s, businessId);
  return s;
}

export async function listDismissed(businessId: string): Promise<string[]> {
  const d = await getDoc<{ ids: string[] }>(DISMISSED, businessId);
  return d?.data.ids ?? [];
}

export async function dismissOpportunity(businessId: string, opId: string, actor: Actor): Promise<string[]> {
  assertNotDemo(businessId);
  assertHuman(actor);
  if (!/^op_[a-z0-9]{1,16}$/.test(opId)) throw new ContentError(400, 'Proposition inconnue.');
  const ids = [...new Set([...(await listDismissed(businessId)), opId])].slice(-200);
  await putDoc(DISMISSED, businessId, { ids }, businessId);
  return ids;
}

// ---------------------------------------------------------------------------
// Brouillons
// ---------------------------------------------------------------------------
async function save(d: ContentDraft, now = new Date()): Promise<ContentDraft> {
  d.version += 1;
  d.updatedAt = now.toISOString();
  await putDoc<ContentDraft>(DRAFTS, d.id, d, d.businessId);
  return d;
}

export async function listDrafts(businessId: string): Promise<ContentDraft[]> {
  if (isDemoBusinessId(businessId)) return [];
  const docs = await listDocs<ContentDraft>(DRAFTS, { businessId, limit: 300 });
  return docs.map((x) => x.data).filter((x) => x.businessId === businessId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDraft(businessId: string, id: string): Promise<ContentDraft | null> {
  const d = await getDoc<ContentDraft>(DRAFTS, id);
  return d && d.data.businessId === businessId ? d.data : null;
}

async function mustGet(businessId: string, id: string): Promise<ContentDraft> {
  const d = await getDraft(businessId, id);
  if (!d) throw new ContentError(404, 'Brouillon introuvable.', 'not_found');
  return d;
}

/** Rédige le brouillon d'une proposition (une seule fois : un brouillon ouvert pour la même proposition est renvoyé). */
export async function createDraft(businessId: string, op: ContentOpportunity, ctx: Omit<DraftContext, 'businessId'>, actor: Actor): Promise<ContentDraft> {
  assertNotDemo(businessId);
  // V10 (PILOTE-AUTO) : le pilote rédige aussi des brouillons sous mandat (rédiger n'est pas publier).
  await assertHumanOrMandate(businessId, actor);
  return withLock(`op:${businessId}:${op.id}`, async () => {
    const open = (await listDrafts(businessId)).find((d) => d.opportunityId === op.id && d.status !== 'rejected' && d.status !== 'removed');
    if (open) return open;
    const d = await buildDraft(op, { ...ctx, businessId });
    await putDoc<ContentDraft>(DRAFTS, d.id, d, businessId);
    await appendContentJournal(businessId, d.id, actor, 'drafted', `${d.title} · ${d.writer === 'ia' ? 'rédigé par l’IA à partir de vos faits' : 'modèle structuré'}${d.missing.length ? ` · ${d.missing.length} information(s) à compléter` : ''}`, ctx.now);
    return d;
  });
}

export interface DraftEdit {
  title?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  body?: string;
}

const EDITABLE: ContentDraft['status'][] = ['draft', 'validated'];

/** Modification par le client : nouvelle version gardée, la validation précédente tombe. */
export async function editDraft(businessId: string, id: string, edit: DraftEdit, actor: Actor, ctx: Pick<DraftContext, 'name' | 'site' | 'segment' | 'facts' | 'pages'>, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (!EDITABLE.includes(d.status)) throw new ContentError(409, 'Ce contenu est déjà chez la plateforme : modifiez-le là-bas, ou retirez-le puis recréez-le.', 'bad_state');
    const str = (v: unknown, max: number) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, max);
    if (edit.body !== undefined) {
      const b = str(edit.body, 60_000).trim();
      if (b.length < 20) throw new ContentError(400, 'Texte trop court.');
      d.body = b;
    }
    if (edit.title !== undefined) d.title = str(edit.title, 140).trim() || d.title;
    if (edit.metaTitle !== undefined) d.metaTitle = str(edit.metaTitle, 80).trim();
    if (edit.metaDescription !== undefined) d.metaDescription = str(edit.metaDescription, 200).trim();
    if (edit.slug !== undefined && d.action === 'create') d.slug = slugify(str(edit.slug, 80)) || d.slug;
    d.history = [...d.history, { at: now.toISOString(), by: actor.email ?? actor.id, body: d.body }].slice(-20);
    if (d.status === 'validated') {
      delete d.validation;
      d.status = 'draft';
    }
    const next = finalizeDraft(d, { ...ctx, now });
    await save(next, now);
    await appendContentJournal(businessId, id, actor, 'edited', next.missing.length ? `${next.missing.length} information(s) encore à compléter` : 'Texte complet', now);
    return next;
  });
}

/** Validation explicite par une personne (rôle vérifié par la route : administrateur ou propriétaire). */
export async function validateDraft(businessId: string, id: string, actor: Actor, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (d.status !== 'draft') throw new ContentError(409, 'Seul un brouillon peut être validé.', 'bad_state');
    if (TODO_TEST.test(`${d.title}\n${d.metaTitle}\n${d.metaDescription}\n${d.body}`)) throw new ContentError(409, 'Il reste des « [à compléter] » : complétez-les (fiche faits clés ou texte) avant de valider.', 'incomplete');
    d.status = 'validated';
    d.validation = { by: actor, at: now.toISOString() };
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'validated', d.title, now);
    return d;
  });
}

/**
 * V10 (PILOTE-AUTO) : validation sous mandat. Le pilote (src/lib/autopilot/runner.ts) a déjà vérifié les règles du
 * mandat (faits de la fiche officielle confirmée, contrôles passés, rien de juridique ni de prix) ; ici, double garde :
 * mandat actif relu dans le stockage, brouillon complet, aucun contrôle bloquant.
 */
export async function validateDraftUnderMandate(businessId: string, id: string, actor: Actor, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  await assertHumanOrMandate(businessId, actor);
  if (actor.role !== 'mandate') throw new ContentError(403, 'Réservé au pilote automatique.', 'bad_actor');
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (d.status !== 'draft') throw new ContentError(409, 'Seul un brouillon peut être validé.', 'bad_state');
    if (TODO_TEST.test(`${d.title}\n${d.metaTitle}\n${d.metaDescription}\n${d.body}`) || d.missing.length) throw new ContentError(409, 'Contenu incomplet : il reste à la validation manuelle.', 'incomplete');
    if (d.checks.some((c) => !c.ok)) throw new ContentError(409, 'Un contrôle ne passe pas : il reste à la validation manuelle.', 'checks');
    d.status = 'validated';
    d.validation = { by: actor, at: now.toISOString() };
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'validated', `${d.title} (mandat Pilote automatique)`, now);
    return d;
  });
}

export async function rejectDraft(businessId: string, id: string, actor: Actor, reason?: string, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (!EDITABLE.includes(d.status)) throw new ContentError(409, 'Ce contenu est déjà chez la plateforme : retirez-le plutôt.', 'bad_state');
    d.status = 'rejected';
    delete d.validation;
    d.rejection = { by: actor, at: now.toISOString(), ...(reason ? { reason: reason.slice(0, 300) } : {}) };
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'rejected', reason, now);
    return d;
  });
}

// ---------------------------------------------------------------------------
// Création chez le client, mise en ligne, retour arrière
// ---------------------------------------------------------------------------
export function draftToPageInput(d: ContentDraft, author: string): PageDraftInput {
  return {
    format: d.format,
    title: d.title,
    slug: d.slug,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    html: bodyToHtml(d.body),
    blocks: parseBody(d.body),
    jsonLd: d.jsonLd,
    excerpt: d.metaDescription,
    author,
  };
}

function pageOpts(s: ContentSettings, allowScript: boolean): PageOptions {
  return { webflowCollectionId: s.webflowCollectionId, wixMemberId: s.wixMemberId, shopifyBlogId: s.shopifyBlogId, prestashopCategoryId: s.prestashopCategoryId, allowScript };
}

/** Plateforme de création : réglage, sinon la première connectée (test réussi) qui sait créer ce format. */
export async function targetPlatform(businessId: string, d: Pick<ContentDraft, 'format'>, settings: ContentSettings): Promise<Platform | null> {
  const conns = (await listConnections(businessId)).filter((c) => c.lastTest?.ok);
  const ok = (p: Platform) => conns.some((c) => c.platform === p) && canCreate(p, d.format);
  if (settings.platform && ok(settings.platform)) return settings.platform;
  return conns.map((c) => c.platform).find(ok) ?? null;
}

function assertQuota(tier: EntitlementTier, drafts: ContentDraft[], now: Date) {
  const q = quotaView(tier, drafts, now);
  if (q.left <= 0) {
    throw new ContentError(
      429,
      q.limit === 0
        ? 'La publication de contenus est incluse à partir de l’offre Essentiel. Vos brouillons restent disponibles.'
        : `Plafond du mois atteint (${q.limit} contenu${q.limit > 1 ? 's' : ''}) : prochain contenu possible le ${q.resetsAt}. Ce rythme est volontaire : la qualité compte plus que le volume.`,
      'quota',
    );
  }
}

export interface PushResult {
  draft: ContentDraft;
  /** réécriture : modifications confiées à l'agent de publication */
  changeSetId?: string;
}

/**
 * Crée le contenu validé chez le client, en BROUILLON (page ou article non publié). Réécriture d'une page existante :
 * prépare une modification dans l'agent de publication (avant / après exacts, application et retour arrière là-bas).
 */
export async function pushDraft(businessId: string, id: string, actor: Actor, opts: { tier: EntitlementTier; author: string; now?: Date }): Promise<PushResult> {
  assertNotDemo(businessId);
  await assertHumanOrMandate(businessId, actor);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    assertSameValidator(d, actor);
    if (d.status !== 'validated' || !d.validation?.by?.id) throw new ContentError(409, 'Ce contenu doit être validé avant d’être envoyé sur votre site.', 'not_validated');
    if (TODO_TEST.test(d.body)) throw new ContentError(409, 'Il reste des « [à compléter] ».', 'incomplete');
    const settings = await getSettings(businessId);
    const platform = await targetPlatform(businessId, d.action === 'rewrite' ? { format: 'page' } : d, settings);
    const all = await listDrafts(businessId);

    if (d.action === 'rewrite' && d.existing) {
      const conns = (await listConnections(businessId)).filter((c) => c.lastTest?.ok && c.lastTest.capabilities.includes('rewrite'));
      const p = conns.find((c) => c.platform === settings.platform)?.platform ?? conns[0]?.platform;
      if (!p) throw new ContentError(409, 'Aucune connexion ne permet de réécrire cette page : utilisez l’export.', 'no_platform');
      assertQuota(opts.tier, all, now);
      const site = new URL(d.existing.url).origin;
      const cs = await createRewriteChangeSet(businessId, { platform: p, site, url: d.existing.url, title: `Réécriture : ${d.title}`, value: bodyToHtml(d.body), rationale: `Contenu validé dans Contenus par ${actor.email ?? actor.id}.`, originId: `content:${d.id}` }, actor, now);
      try {
        await proposeChangeSet(businessId, cs.id, actor, now);
      } catch {
        /* proposition relancée depuis l'agent (lecture de l'état réel impossible pour l'instant) */
      }
      d.platform = p;
      d.consumedAt ??= now.toISOString();
      d.status = 'remote_draft';
      d.remote = { platform: p, format: 'page', id: cs.id, status: 'draft', url: d.existing.url, extra: { changeSetId: cs.id } };
      await save(d, now);
      await appendContentJournal(businessId, id, actor, 'remote.created', `Réécriture confiée à l’agent (${PLATFORM_LABEL[p]}) : à appliquer depuis /app/agent`, now);
      return { draft: d, changeSetId: cs.id };
    }

    if (!platform) throw new ContentError(409, 'Aucune plateforme connectée ne sait créer ce contenu : utilisez l’export (fichiers HTML et Markdown).', 'no_platform');
    assertQuota(opts.tier, all, now);
    const conn = pageConnectorFor(platform)!;
    const ctx = await contextFor(businessId, platform, () => now);
    const c = await getConnection(businessId, platform);
    const po = pageOpts(settings, Boolean(c?.lastTest?.capabilities.includes('jsonld')));
    try {
      const clash = await conn.findBySlug(ctx, d.format, d.slug, po);
      if (clash) throw new ContentError(409, `Une ${d.format === 'article' ? 'publication' : 'page'} utilise déjà l’adresse « ${d.slug} » sur votre site : changez l’adresse du brouillon.`, 'slug_taken');
      const remote = await conn.createDraft(ctx, draftToPageInput(d, opts.author), po);
      d.platform = platform;
      d.remote = remote;
      d.status = remote.status === 'published' ? 'published' : 'remote_draft';
      d.consumedAt ??= now.toISOString();
      await save(d, now);
      await appendContentJournal(businessId, id, actor, 'remote.created', `${PLATFORM_LABEL[platform]} : ${d.format === 'article' ? 'article' : 'page'} créé${d.format === 'article' ? '' : 'e'} en brouillon (non visible du public)`, now);
      return { draft: d };
    } catch (e) {
      await appendContentJournal(businessId, id, actor, 'remote.failed', msg(e), now);
      if (e instanceof ContentError) throw e;
      throw new ContentError(e instanceof PublishError ? e.status : 502, msg(e), e instanceof PublishError ? e.code : 'upstream');
    }
  });
}

async function remoteCtx(businessId: string, d: ContentDraft, now: Date) {
  if (!d.platform || !d.remote) throw new ContentError(409, 'Ce contenu n’a pas été créé sur votre site.', 'bad_state');
  const conn = pageConnectorFor(d.platform);
  if (!conn || d.remote.extra?.changeSetId) throw new ContentError(409, 'Cette réécriture se gère depuis l’agent de publication.', 'bad_state');
  const ctx = await contextFor(businessId, d.platform, () => now);
  return { conn, ctx, po: pageOpts(await getSettings(businessId), false) };
}

async function markLive(d: ContentDraft, actor: Actor, now: Date, effectInputs?: EffectInputs) {
  d.publishedAt = now.toISOString();
  d.effect = startEffect(d, { ...(effectInputs ?? {}), at: now.toISOString() });
  const aid = `an_content_${d.id}`;
  if (!(await getDoc(ANNOTATIONS, aid))) {
    const a: Annotation = { id: aid, businessId: d.businessId, date: now.toISOString().slice(0, 10), label: cleanLabel(`Nouvelle page : ${d.title}`), kind: 'action', series: 'all', taskId: null, href: `/app/contenu/${d.id}`, createdAt: now.toISOString() };
    await putDoc<Annotation>(ANNOTATIONS, aid, a, d.businessId);
  }
  void actor;
}

/** Mise en ligne (second geste explicite, après relecture du brouillon chez la plateforme). */
export async function publishDraft(businessId: string, id: string, actor: Actor, opts: { now?: Date; effect?: EffectInputs } = {}): Promise<ContentDraft> {
  assertNotDemo(businessId);
  await assertHumanOrMandate(businessId, actor);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    assertSameValidator(d, actor);
    if (d.status !== 'remote_draft' && d.status !== 'unpublished') throw new ContentError(409, 'Rien à mettre en ligne.', 'bad_state');
    if (!d.validation?.by?.id) throw new ContentError(409, 'Contenu non validé.', 'not_validated');
    const { conn, ctx, po } = await remoteCtx(businessId, d, now);
    try {
      await conn.publish(ctx, d.remote!, po);
      const back = await conn.read(ctx, d.remote!, po);
      if (!back || back.status !== 'published') throw new ContentError(502, 'Mise en ligne non confirmée à la relecture : vérifiez dans votre outil.', 'unverified');
      d.remote = { ...d.remote!, ...back, html: undefined };
      d.status = 'published';
      d.liveUrl = back.url ?? d.liveUrl;
      if (!d.effect) await markLive(d, actor, now, opts.effect);
      await save(d, now);
      await appendContentJournal(businessId, id, actor, 'published', `${PLATFORM_LABEL[d.platform!]}${back.url ? ` · ${back.url}` : ''}`, now);
      return d;
    } catch (e) {
      await appendContentJournal(businessId, id, actor, 'remote.failed', msg(e), now);
      if (e instanceof ContentError) throw e;
      throw new ContentError(502, msg(e), 'upstream');
    }
  });
}

/** Retour arrière : retire de la ligne (le contenu reste en brouillon chez la plateforme). */
export async function unpublishDraft(businessId: string, id: string, actor: Actor, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (d.status !== 'published') throw new ContentError(409, 'Ce contenu n’est pas en ligne.', 'bad_state');
    const { conn, ctx, po } = await remoteCtx(businessId, d, now);
    await conn.unpublish(ctx, d.remote!, po);
    const back = await conn.read(ctx, d.remote!, po);
    if (back && back.status === 'published') throw new ContentError(502, 'Retrait non confirmé à la relecture.', 'unverified');
    d.remote = { ...d.remote!, status: 'draft' };
    d.status = 'unpublished';
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'unpublished', PLATFORM_LABEL[d.platform!], now);
    return d;
  });
}

/** Corbeille (ou suppression définitive quand la plateforme n'a pas de corbeille : Shopify, PrestaShop, Webflow). */
export async function removeDraft(businessId: string, id: string, actor: Actor, now = new Date()): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (d.status !== 'remote_draft' && d.status !== 'unpublished') throw new ContentError(409, 'Retirez d’abord le contenu de la ligne.', 'bad_state');
    const { conn, ctx, po } = await remoteCtx(businessId, d, now);
    await conn.remove(ctx, d.remote!, po);
    d.remote = { ...d.remote!, status: 'trashed' };
    d.status = 'removed';
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'removed', PLATFORM_LABEL[d.platform!], now);
    return d;
  });
}

/** Export HTML / Markdown (tout site) : compte dans le quota, contenu validé seulement. */
export async function exportDraft(businessId: string, id: string, actor: Actor, opts: { tier: EntitlementTier; author: string; now?: Date }): Promise<{ draft: ContentDraft; filename: string; zip: Buffer; files: { name: string; content: string }[] }> {
  assertNotDemo(businessId);
  assertHuman(actor);
  const now = opts.now ?? new Date();
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (!['validated', 'exported'].includes(d.status) || !d.validation?.by?.id) throw new ContentError(409, 'Validez ce contenu avant de l’exporter.', 'not_validated');
    if (!d.consumedAt) assertQuota(opts.tier, await listDrafts(businessId), now);
    const conns = await listConnections(businessId);
    const cms = (conns.find((c) => ['wix', 'webflow', 'prestashop'].includes(c.platform))?.platform ?? null) as Platform | null;
    const b = buildPageExport(draftToPageInput(d, opts.author), cms, now);
    const first = !d.consumedAt;
    d.consumedAt ??= now.toISOString();
    d.status = 'exported';
    await save(d, now);
    if (first) await appendContentJournal(businessId, id, actor, 'exported', 'Fichiers HTML et Markdown prêts à déposer', now);
    return { draft: d, filename: `repere-contenu-${d.slug || d.id}.zip`, ...b };
  });
}

/** Après un export : le client indique l'adresse publique → mesure d'effet. */
export async function declareLive(businessId: string, id: string, url: string, actor: Actor, opts: { now?: Date; effect?: EffectInputs } = {}): Promise<ContentDraft> {
  assertNotDemo(businessId);
  assertHuman(actor);
  const now = opts.now ?? new Date();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ContentError(400, 'Adresse invalide.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ContentError(400, 'Adresse invalide.');
  return withLock(id, async () => {
    const d = await mustGet(businessId, id);
    if (d.status !== 'exported') throw new ContentError(409, 'Seul un contenu exporté se déclare en ligne ici.', 'bad_state');
    d.liveUrl = u.toString();
    d.status = 'published';
    await markLive(d, actor, now, opts.effect);
    await save(d, now);
    await appendContentJournal(businessId, id, actor, 'declared_live', d.liveUrl, now);
    return d;
  });
}

/** Complète les mesures J+30 / J+90 dues (appelé au chargement de /app/contenu et par la tâche planifiée). */
export async function refreshEffects(businessId: string, inputs: Omit<EffectInputs, 'at'>, now = new Date()): Promise<number> {
  if (isDemoBusinessId(businessId)) return 0;
  let n = 0;
  for (const d of await listDrafts(businessId)) {
    if (!d.effect || (d.effect.d30 && d.effect.d90)) continue;
    const next = refreshEffect(d, { ...inputs, at: now.toISOString() }, now);
    if (!next) continue;
    d.effect = next;
    await save(d, now);
    await appendContentJournal(businessId, d.id, { id: 'system' }, 'effect.measured', next.d90 ? 'Mesure J+90' : 'Mesure J+30', now);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Mentions à obtenir (suivi manuel : rien n'est envoyé par Repéré)
// ---------------------------------------------------------------------------
export async function listMentionTracking(businessId: string): Promise<MentionTracking[]> {
  if (isDemoBusinessId(businessId)) return [];
  return (await listDocs<MentionTracking>(MENTIONS, { businessId, limit: 300 })).map((x) => x.data).filter((x) => x.businessId === businessId);
}

const MENTION_STATUSES: MentionStatus[] = ['a_faire', 'demande', 'obtenu', 'refuse'];

export async function setMentionStatus(businessId: string, mentionId: string, status: MentionStatus, extra: { url?: string; note?: string }, actor: Actor, now = new Date()): Promise<MentionTracking> {
  assertNotDemo(businessId);
  assertHuman(actor);
  if (!/^mn_[a-z0-9]{1,16}$/.test(mentionId)) throw new ContentError(400, 'Site inconnu.');
  if (!MENTION_STATUSES.includes(status)) throw new ContentError(400, 'Statut inconnu.');
  const key = `${businessId}.${mentionId}`;
  const prev = (await getDoc<MentionTracking>(MENTIONS, key))?.data;
  let url: string | undefined;
  if (extra.url) {
    let u: URL | null = null;
    try {
      u = new URL(extra.url);
    } catch {
      u = null;
    }
    if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) throw new ContentError(400, 'Adresse de la mention invalide.');
    url = u.toString();
  }
  const t: MentionTracking = {
    id: mentionId,
    businessId,
    status,
    ...(status === 'demande' || prev?.requestedAt ? { requestedAt: prev?.requestedAt ?? now.toISOString() } : {}),
    ...(status === 'obtenu' ? { obtainedAt: prev?.obtainedAt ?? now.toISOString() } : {}),
    ...(url ?? prev?.url ? { url: url ?? prev?.url } : {}),
    ...(extra.note ? { note: extra.note.slice(0, 300) } : prev?.note ? { note: prev.note } : {}),
    updatedAt: now.toISOString(),
    updatedBy: actor.email ?? actor.id,
  };
  await putDoc<MentionTracking>(MENTIONS, key, t, businessId);
  await appendContentJournal(businessId, mentionId, actor, 'mention.updated', `${status}${url ? ` · ${url}` : ''}`, now);
  return t;
}
