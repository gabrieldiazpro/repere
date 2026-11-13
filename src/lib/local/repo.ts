/**
 * Persistance du module LOCAL (src/lib/store.ts, collections `local.*`).
 *
 * Règles Places : on ne stocke jamais le contenu d'une fiche lue par l'API (voir places.ts). Les audits `places` sont
 * passés par `toStorableAudit` (statuts et points seulement), les thèmes d'avis Places par `toStorableThemes`.
 * La saisie guidée, les URL et coordonnées d'annuaires et les avis collés viennent du client : ils sont stockés.
 */
import { getBusinessRecord } from '@/lib/db';
import { isEmailEnabled, sendEmail } from '@/lib/email';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { addNotification } from '@/lib/notify/center';
import { getDoc, listDocs, putDoc, updateDoc } from '@/lib/store';
import { toStorableAudit } from './gbp';
import { postClipboard } from './posts';
import { toStorableThemes } from './reviews';
import type { GbpAudit, LocalPost, ManualGbpInput, NapAudit, NapEntryInput, Reminder, ReviewThemesReport, VisibilityMap } from './types';

export const LOCAL_COLLECTIONS = {
  settings: 'local.settings',
  gbp: 'local.gbp',
  maps: 'local.maps',
  nap: 'local.nap',
  posts: 'local.posts',
  reminders: 'local.reminders',
  reviews: 'local.reviews',
} as const;

export interface LocalSettings {
  businessId: string;
  /** seul contenu Places stockable */
  placeId?: string;
  manual?: ManualGbpInput;
  napEntries?: NapEntryInput[];
  updatedAt: string;
}

function assertWritable(businessId: string): void {
  if (isDemoBusinessId(businessId)) throw new Error('Compte de démonstration : écriture refusée.');
}

export async function getLocalSettings(businessId: string): Promise<LocalSettings> {
  const d = await getDoc<LocalSettings>(LOCAL_COLLECTIONS.settings, businessId);
  return d?.data ?? { businessId, updatedAt: '' };
}

export async function saveLocalSettings(businessId: string, patch: Partial<Omit<LocalSettings, 'businessId' | 'updatedAt'>>): Promise<LocalSettings> {
  assertWritable(businessId);
  const prev = await getLocalSettings(businessId);
  const next: LocalSettings = { ...prev, ...patch, businessId, updatedAt: new Date().toISOString() };
  await putDoc(LOCAL_COLLECTIONS.settings, businessId, next, businessId);
  return next;
}

async function latest<T>(collection: string, businessId: string): Promise<T | null> {
  const docs = await listDocs<T>(collection, { businessId, limit: 1, order: 'desc' });
  return docs[0]?.data ?? null;
}

export async function saveGbpAudit(a: GbpAudit): Promise<GbpAudit> {
  assertWritable(a.businessId);
  const stored = toStorableAudit(a);
  await putDoc(LOCAL_COLLECTIONS.gbp, a.id, stored, a.businessId);
  return stored;
}
export const latestGbpAudit = (businessId: string) => latest<GbpAudit>(LOCAL_COLLECTIONS.gbp, businessId);

/** Historique des scores (pour la courbe) : id, date, score, couverture, source. */
export async function gbpHistory(businessId: string, limit = 24): Promise<Pick<GbpAudit, 'id' | 'createdAt' | 'score' | 'coverage' | 'source'>[]> {
  const docs = await listDocs<GbpAudit>(LOCAL_COLLECTIONS.gbp, { businessId, limit, order: 'desc' });
  return docs.map(({ data: a }) => ({ id: a.id, createdAt: a.createdAt, score: a.score, coverage: a.coverage, source: a.source })).reverse();
}

export async function saveMap(m: VisibilityMap): Promise<void> {
  assertWritable(m.businessId);
  await putDoc(LOCAL_COLLECTIONS.maps, m.id, m, m.businessId);
}
export const latestMap = (businessId: string) => latest<VisibilityMap>(LOCAL_COLLECTIONS.maps, businessId);

/** Cartes du mois civil en cours (plafond par offre). */
export async function mapsThisMonth(businessId: string, now: Date = new Date()): Promise<number> {
  const docs = await listDocs<VisibilityMap>(LOCAL_COLLECTIONS.maps, { businessId, limit: 50, order: 'desc' });
  const ym = now.toISOString().slice(0, 7);
  return docs.filter((d) => d.data.createdAt.slice(0, 7) === ym).length;
}

export async function saveNap(a: NapAudit): Promise<void> {
  assertWritable(a.businessId);
  await putDoc(LOCAL_COLLECTIONS.nap, a.id, a, a.businessId);
}
export const latestNap = (businessId: string) => latest<NapAudit>(LOCAL_COLLECTIONS.nap, businessId);

export async function saveThemes(r: ReviewThemesReport): Promise<void> {
  assertWritable(r.businessId);
  await putDoc(LOCAL_COLLECTIONS.reviews, `${r.businessId}:${r.createdAt}`, toStorableThemes(r), r.businessId);
}
export const latestThemes = (businessId: string) => latest<ReviewThemesReport>(LOCAL_COLLECTIONS.reviews, businessId);

export async function savePosts(posts: LocalPost[], reminders: Reminder[]): Promise<void> {
  for (const p of posts) {
    assertWritable(p.businessId);
    await putDoc(LOCAL_COLLECTIONS.posts, p.id, p, p.businessId);
  }
  for (const r of reminders) await putDoc(LOCAL_COLLECTIONS.reminders, r.id, r, r.businessId);
}

export async function listPosts(businessId: string): Promise<LocalPost[]> {
  const docs = await listDocs<LocalPost>(LOCAL_COLLECTIONS.posts, { businessId, limit: 100 });
  return docs.map((d) => d.data).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getPost(id: string): Promise<LocalPost | null> {
  return (await getDoc<LocalPost>(LOCAL_COLLECTIONS.posts, id))?.data ?? null;
}

export async function updatePost(businessId: string, id: string, patch: Partial<Pick<LocalPost, 'status' | 'text' | 'title' | 'date' | 'publishedAt'>>): Promise<LocalPost | null> {
  assertWritable(businessId);
  const prev = await getPost(id);
  if (!prev || prev.businessId !== businessId) return null;
  const next = await updateDoc<LocalPost>(LOCAL_COLLECTIONS.posts, id, patch, businessId);
  if (patch.status && patch.status !== 'planned') {
    const rid = `lr_${id.slice(3)}`;
    const r = await getDoc<Reminder>(LOCAL_COLLECTIONS.reminders, rid);
    if (r && r.data.status === 'pending') await updateDoc<Reminder>(LOCAL_COLLECTIONS.reminders, rid, { status: 'logged' }, businessId);
  }
  return next.data;
}

export interface ReminderRunReport {
  due: number;
  sent: number;
  notified: number;
  skipped: number;
}

/**
 * Rappels dus (à appeler par le cron) : notification dans l'app + e-mail au contact du commerce si l'envoi est
 * configuré. Idempotent (statut du rappel).
 */
export async function processDueReminders(now: Date = new Date(), deps: { send?: typeof sendEmail; notify?: typeof addNotification } = {}): Promise<ReminderRunReport> {
  const send = deps.send ?? sendEmail;
  const notify = deps.notify ?? addNotification;
  const docs = await listDocs<Reminder>(LOCAL_COLLECTIONS.reminders, { limit: 500, order: 'asc' });
  const due = docs.map((d) => d.data).filter((r) => r.status === 'pending' && Date.parse(r.dueAt) <= now.getTime() && !isDemoBusinessId(r.businessId));
  const rep: ReminderRunReport = { due: due.length, sent: 0, notified: 0, skipped: 0 };
  for (const r of due) {
    const post = await getPost(r.postId);
    if (!post || post.status !== 'planned') {
      await updateDoc<Reminder>(LOCAL_COLLECTIONS.reminders, r.id, { status: 'logged' }, r.businessId);
      rep.skipped++;
      continue;
    }
    const href = `/app/local/posts?post=${encodeURIComponent(post.id)}`;
    const n = await notify(r.businessId, { type: 'actions_reminder', title: `Post Google du jour : ${post.title}`, body: 'Le texte est prêt à copier. Publiez-le depuis votre fiche Google, puis marquez-le comme publié.', href, severity: 'info', dedupeKey: `local-post:${post.id}` }, now);
    if (n) rep.notified++;
    let status: Reminder['status'] = 'logged';
    const biz = await getBusinessRecord(r.businessId).catch(() => null);
    const to = biz?.contactEmail;
    if (to && isEmailEnabled()) {
      const text = `Bonjour,\n\nVotre post Google prévu aujourd’hui est prêt. Copiez le texte ci-dessous et publiez-le depuis votre fiche Google (Ajouter une actualité).\n\n---\n${postClipboard(post)}\n---\n\nIdée de photo : ${post.photoIdea}\n\nL’équipe Repéré`;
      const html = `<p>Bonjour,</p><p>Votre post Google prévu aujourd’hui est prêt. Copiez le texte ci-dessous et publiez-le depuis votre fiche Google (« Ajouter une actualité »).</p><pre style="white-space:pre-wrap;font-family:inherit;background:#F5F5F4;padding:12px;border-radius:8px">${escapeHtml(postClipboard(post))}</pre><p>Idée de photo : ${escapeHtml(post.photoIdea)}</p><p>L’équipe Repéré</p>`;
      const res = await send({ to, subject: `Votre post Google du jour : ${post.title}`, text, html, kind: 'service', tags: [{ name: 'type', value: 'local_post_reminder' }] });
      if (res.status === 'sent') {
        status = 'sent';
        rep.sent++;
      }
    }
    await updateDoc<Reminder>(LOCAL_COLLECTIONS.reminders, r.id, { status, sentAt: now.toISOString() }, r.businessId);
    await updateDoc<LocalPost>(LOCAL_COLLECTIONS.posts, post.id, { reminded: true }, r.businessId);
  }
  return rep;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
