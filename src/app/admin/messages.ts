/**
 * Messages du formulaire /contact (collection `contact.messages` de '@/lib/store', écrite par POST /api/leads) :
 * lecture et « marquer comme répondu » pour l'écran d'administration. Serveur uniquement.
 */
import { getDoc, listDocs, updateDoc } from '@/lib/store';

export const CONTACT_COLLECTION = 'contact.messages';

export interface ContactMessage {
  email: string;
  name: string | null;
  company: string | null;
  subject: string | null;
  message: string;
  receivedAt: string;
  answered: boolean;
  answeredAt?: string | null;
}

export interface ContactMessageRow extends ContactMessage {
  id: string;
}

/** Non répondus d'abord, puis du plus récent au plus ancien. Pure. */
export function sortMessages(rows: ContactMessageRow[]): ContactMessageRow[] {
  return [...rows].sort((a, b) => Number(a.answered) - Number(b.answered) || (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''));
}

export async function loadContactMessages(limit = 200): Promise<ContactMessageRow[]> {
  const docs = await listDocs<ContactMessage>(CONTACT_COLLECTION, { limit, order: 'desc' });
  return sortMessages(
    docs
      .filter((d) => d.data && typeof d.data.message === 'string')
      .map((d) => ({ ...d.data, id: d.id, answered: d.data.answered === true, receivedAt: d.data.receivedAt ?? d.createdAt })),
  );
}

/** Marque un message comme répondu (ou le rouvre). Faux si le message n'existe pas. */
export async function setAnswered(id: string, answered: boolean, now: Date = new Date()): Promise<boolean> {
  if (!/^[A-Za-z0-9:_.-]{1,120}$/.test(id)) return false;
  const doc = await getDoc<ContactMessage>(CONTACT_COLLECTION, id);
  if (!doc) return false;
  await updateDoc<ContactMessage>(CONTACT_COLLECTION, id, { answered, answeredAt: answered ? now.toISOString() : null });
  return true;
}
