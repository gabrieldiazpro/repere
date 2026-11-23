/**
 * Demandes de démo (collection `meetings.requests`). Serveur uniquement.
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import type { Attribution } from '@/lib/roi/core';
import { normalizeWebsite, type MeetingFields, type MeetingOffer, type MeetingSegment, type Slot } from './validate';

export const MEETINGS_COLLECTION = 'meetings.requests';

export const MEETING_STATUSES = [
  { id: 'nouvelle', label: 'Nouvelle' },
  { id: 'planifiee', label: 'Planifiée' },
  { id: 'faite', label: 'Faite' },
  { id: 'annulee', label: 'Annulée' },
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number]['id'];
export const isMeetingStatus = (v: unknown): v is MeetingStatus => MEETING_STATUSES.some((s) => s.id === v);
export const meetingStatusLabel = (s: MeetingStatus) => MEETING_STATUSES.find((x) => x.id === s)?.label ?? s;

export const MEETING_CONSENT_TEXT =
  'J’accepte que Repéré (Mycelo) utilise ces informations pour organiser la démo et me recontacter à son sujet. Elles sont supprimées 12 mois après notre dernier échange, ou sur simple demande.';

export interface MeetingRequest {
  offer: MeetingOffer;
  segment: MeetingSegment | null;
  company: string;
  website: string;
  domain: string;
  size: string;
  need: string;
  slots: Slot[];
  otherTimes: string | null;
  name: string;
  email: string;
  phone: string | null;
  consent: { at: string; text: string };
  /** Origine de la visite (UTM, lien partenaire), comme les inscriptions (src/lib/roi). */
  attribution: Attribution | null;
  receivedAt: string;
  status: MeetingStatus;
  statusHistory: { at: string; status: MeetingStatus }[];
  notes: { at: string; text: string }[];
  notified: 'sent' | 'logged' | 'error' | 'suppressed' | 'pending';
  acknowledged: 'sent' | 'logged' | 'error' | 'suppressed' | 'pending';
}

export interface MeetingRow extends MeetingRequest {
  id: string;
}

/** Même e-mail, même offre dans les dernières 24 h → pas de nouvelle demande (ni de nouvel e-mail). */
export const DUPLICATE_WINDOW_HOURS = 24;

const ID_RE = /^mtg_[A-Za-z0-9_-]{6,40}$/;
export const isMeetingId = (id: string) => ID_RE.test(id);
const newId = () => `mtg_${crypto.randomBytes(9).toString('base64url')}`;

const domainOf = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
};

export function buildMeeting(f: MeetingFields, attribution: Attribution | null, now: Date = new Date()): MeetingRequest {
  const website = normalizeWebsite(f.website) ?? f.website.trim();
  const at = now.toISOString();
  return {
    offer: f.offer as MeetingOffer,
    segment: f.offer === 'accompagne' && f.segment ? f.segment : null,
    company: f.company.trim(),
    website,
    domain: domainOf(website),
    size: f.size,
    need: f.need.trim(),
    slots: [...f.slots].sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period)),
    otherTimes: f.otherTimes.trim() || null,
    name: f.name.trim(),
    email: f.email.trim().toLowerCase(),
    phone: f.phone.trim() || null,
    consent: { at, text: MEETING_CONSENT_TEXT },
    attribution,
    receivedAt: at,
    status: 'nouvelle',
    statusHistory: [{ at, status: 'nouvelle' }],
    notes: [],
    notified: 'pending',
    acknowledged: 'pending',
  };
}

export function sortMeetings(rows: MeetingRow[]): MeetingRow[] {
  const rank: Record<MeetingStatus, number> = { nouvelle: 0, planifiee: 1, faite: 2, annulee: 3 };
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || b.receivedAt.localeCompare(a.receivedAt));
}

export async function listMeetings(limit = 1000): Promise<MeetingRow[]> {
  const docs = await listDocs<MeetingRequest>(MEETINGS_COLLECTION, { limit, order: 'desc' });
  return sortMeetings(docs.filter((d) => d.data && typeof d.data.email === 'string').map((d) => ({ ...d.data, id: d.id })));
}

export async function saveMeeting(m: MeetingRequest, now: Date = new Date()): Promise<{ id: string; duplicate: boolean }> {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_HOURS * 3_600_000).toISOString();
  const existing = (await listMeetings()).find((r) => r.email === m.email && r.offer === m.offer && r.receivedAt >= since);
  if (existing) return { id: existing.id, duplicate: true };
  const id = newId();
  await putDoc<MeetingRequest>(MEETINGS_COLLECTION, id, m);
  return { id, duplicate: false };
}

async function patch(id: string, fn: (m: MeetingRequest) => MeetingRequest | null): Promise<MeetingRow | null> {
  if (!isMeetingId(id)) return null;
  const d = await getDoc<MeetingRequest>(MEETINGS_COLLECTION, id);
  if (!d) return null;
  const next = fn(d.data);
  if (!next) return null;
  await putDoc<MeetingRequest>(MEETINGS_COLLECTION, id, next);
  return { ...next, id };
}

export function setMeetingEmails(id: string, r: { notified?: MeetingRequest['notified']; acknowledged?: MeetingRequest['acknowledged'] }) {
  return patch(id, (m) => ({ ...m, ...r }));
}

export function setMeetingStatus(id: string, status: MeetingStatus, now: Date = new Date()) {
  return patch(id, (m) => (m.status === status ? m : { ...m, status, statusHistory: [...(m.statusHistory ?? []), { at: now.toISOString(), status }] }));
}

export function addMeetingNote(id: string, text: string, now: Date = new Date()) {
  const t = text.trim().slice(0, 2000);
  if (!t) return Promise.resolve(null);
  return patch(id, (m) => ({ ...m, notes: [...(m.notes ?? []), { at: now.toISOString(), text: t }] }));
}
