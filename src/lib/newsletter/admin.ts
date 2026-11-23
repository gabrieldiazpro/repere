/** Actions de l'administration de la lettre (appelées par /admin/newsletter, cookie admin obligatoire). */
import { getEntry } from '@/lib/veille';
import { draftFromVeille, firstIssueDraft, todayParis } from './issue';
import { getIssue, listIssues, nextIssueNumber, saveIssue, updateDraft, type NewsletterIssue } from './store';

/** Crée le premier numéro (brouillon rédigé) s'il n'existe aucun numéro. Idempotent. */
export async function ensureFirstDraft(): Promise<void> {
  if ((await listIssues()).length) return;
  if (await getIssue('numero-1')) return;
  const t = new Date().toISOString();
  await saveIssue({ ...firstIssueDraft(), createdAt: t, updatedAt: t });
}

/** Nouveau brouillon à partir des dernières fiches de veille. */
export async function createDraft(today = todayParis()): Promise<NewsletterIssue> {
  const n = await nextIssueNumber();
  const t = new Date().toISOString();
  const d = draftFromVeille(n, today);
  return saveIssue({ ...d, id: (await getIssue(d.id)) ? `${d.id}-${Date.now().toString(36)}` : d.id, createdAt: t, updatedAt: t });
}

export interface DraftForm {
  subject: string;
  preheader: string;
  intro: string;
  outro: string;
  entrySlugs: string[];
}

/** Valide un formulaire de brouillon (longueurs, fiches existantes). Retourne null si invalide. */
export function parseDraftForm(f: Partial<Record<keyof DraftForm, unknown>>): DraftForm | null {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
  const subject = str(f.subject, 160);
  const preheader = str(f.preheader, 200);
  const intro = str(f.intro, 6000);
  const outro = str(f.outro, 3000);
  const slugs = (Array.isArray(f.entrySlugs) ? f.entrySlugs : []).filter((s): s is string => typeof s === 'string' && Boolean(getEntry(s)));
  const entrySlugs = [...new Set(slugs)].slice(0, 10);
  if (!subject || !intro || !entrySlugs.length) return null;
  return { subject, preheader, intro, outro, entrySlugs };
}

export async function saveDraftForm(id: string, form: DraftForm): Promise<NewsletterIssue | null> {
  return updateDraft(id, form);
}
