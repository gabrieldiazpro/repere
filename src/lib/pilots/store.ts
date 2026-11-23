/**
 * Candidatures au programme « entreprises pilotes » (src/lib/store, collection `pilots.applications`).
 * Serveur uniquement. Une candidature porte son statut, ses notes internes et, une fois active, l'espace Repéré
 * (businessId) d'où sont tirées les mesures J0 / J30 / J90 (voir ./measures.ts).
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { PILOT_SLOTS_BY_SEGMENT, normalizeWebsite, type PilotFields, type PilotSegment } from './validate';

export const PILOTS_COLLECTION = 'pilots.applications';

export const PILOT_STATUSES = [
  { id: 'a_etudier', label: 'À étudier' },
  { id: 'retenue', label: 'Retenue' },
  { id: 'refusee', label: 'Refusée' },
  { id: 'active', label: 'Active' },
] as const;
export type PilotStatus = (typeof PILOT_STATUSES)[number]['id'];

export const statusLabel = (s: PilotStatus) => PILOT_STATUSES.find((x) => x.id === s)?.label ?? s;
export function isPilotStatus(v: unknown): v is PilotStatus {
  return PILOT_STATUSES.some((s) => s.id === v);
}

export interface PilotNote {
  at: string;
  text: string;
}

export interface PilotApplication {
  name: string;
  email: string;
  company: string;
  website: string;
  domain: string;
  segment: PilotSegment;
  city: string | null;
  role: string | null;
  motivation: string;
  publishOk: boolean;
  /** Horodatage et texte exact du consentement recueilli (preuve RGPD). */
  consent: { at: string; text: string };
  receivedAt: string;
  status: PilotStatus;
  statusHistory: { at: string; status: PilotStatus }[];
  notes: PilotNote[];
  /** Espace Repéré du pilote (mesures réelles) ; renseigné par l'admin. */
  businessId: string | null;
  /** Début du programme (J0), posé au passage en « active » ou à la main. */
  startedAt: string | null;
  /** Résultat de la notification au fondateur. */
  notified: 'sent' | 'logged' | 'error' | 'suppressed' | 'pending';
}

export interface PilotRow extends PilotApplication {
  id: string;
}

/** Texte du consentement, affiché tel quel sous la case à cocher et conservé avec la candidature. */
export const CONSENT_TEXT =
  'J’accepte que Repéré (Mycelo) utilise ces informations pour étudier ma candidature et me recontacter à son sujet. Elles sont supprimées 12 mois après la fin du programme, ou sur simple demande.';

/** Doublon : même e-mail et même domaine dans les 30 derniers jours → on ne recrée pas la candidature. */
export const DUPLICATE_WINDOW_DAYS = 30;

export function domainOf(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

function newId(): string {
  return `pil_${crypto.randomBytes(9).toString('base64url')}`;
}

const ID_RE = /^pil_[A-Za-z0-9_-]{6,40}$/;
export const isPilotId = (id: string) => ID_RE.test(id);

/** Construit l'enregistrement à partir de champs déjà validés. Pur. */
export function buildApplication(f: PilotFields, now: Date = new Date()): PilotApplication {
  const website = normalizeWebsite(f.website) ?? f.website.trim();
  const at = now.toISOString();
  return {
    name: f.name.trim(),
    email: f.email.trim().toLowerCase(),
    company: f.company.trim(),
    website,
    domain: domainOf(website),
    segment: f.segment as PilotSegment,
    city: f.city.trim() || null,
    role: f.role.trim() || null,
    motivation: f.motivation.trim(),
    publishOk: f.publishOk === true,
    consent: { at, text: CONSENT_TEXT },
    receivedAt: at,
    status: 'a_etudier',
    statusHistory: [{ at, status: 'a_etudier' }],
    notes: [],
    businessId: null,
    startedAt: null,
    notified: 'pending',
  };
}

export async function listPilots(limit = 500): Promise<PilotRow[]> {
  const docs = await listDocs<PilotApplication>(PILOTS_COLLECTION, { limit, order: 'desc' });
  return sortPilots(docs.filter((d) => d.data && typeof d.data.email === 'string').map((d) => ({ ...d.data, id: d.id })));
}

/** À étudier d'abord, puis actives, retenues, refusées ; plus récentes en premier dans chaque groupe. Pur. */
export function sortPilots(rows: PilotRow[]): PilotRow[] {
  const rank: Record<PilotStatus, number> = { a_etudier: 0, active: 1, retenue: 2, refusee: 3 };
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || b.receivedAt.localeCompare(a.receivedAt));
}

export async function getPilot(id: string): Promise<PilotRow | null> {
  if (!isPilotId(id)) return null;
  const d = await getDoc<PilotApplication>(PILOTS_COLLECTION, id);
  return d ? { ...d.data, id: d.id } : null;
}

/** Enregistre une candidature ; renvoie l'existante si doublon récent (même e-mail, même domaine). */
export async function savePilotApplication(app: PilotApplication, now: Date = new Date()): Promise<{ id: string; duplicate: boolean }> {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString();
  const existing = (await listPilots()).find((r) => r.email === app.email && r.domain === app.domain && r.receivedAt >= since);
  if (existing) return { id: existing.id, duplicate: true };
  const id = newId();
  await putDoc<PilotApplication>(PILOTS_COLLECTION, id, app);
  return { id, duplicate: false };
}

async function patch(id: string, fn: (p: PilotApplication) => PilotApplication): Promise<PilotRow | null> {
  if (!isPilotId(id)) return null;
  const d = await getDoc<PilotApplication>(PILOTS_COLLECTION, id);
  if (!d) return null;
  const next = fn(d.data);
  await putDoc<PilotApplication>(PILOTS_COLLECTION, id, next, next.businessId);
  return { ...next, id };
}

export function setNotified(id: string, notified: PilotApplication['notified']) {
  return patch(id, (p) => ({ ...p, notified }));
}

/** Change le statut ; le passage en « active » pose J0 (startedAt) s'il n'est pas déjà fixé. */
export function setPilotStatus(id: string, status: PilotStatus, now: Date = new Date()) {
  return patch(id, (p) =>
    p.status === status
      ? p
      : {
          ...p,
          status,
          statusHistory: [...(p.statusHistory ?? []), { at: now.toISOString(), status }],
          startedAt: status === 'active' && !p.startedAt ? now.toISOString() : p.startedAt,
        },
  );
}

export const NOTE_MAX = 2000;

export function addPilotNote(id: string, text: string, now: Date = new Date()) {
  const t = text.trim().slice(0, NOTE_MAX);
  if (!t) return Promise.resolve(null);
  return patch(id, (p) => ({ ...p, notes: [...(p.notes ?? []), { at: now.toISOString(), text: t }] }));
}

const BUSINESS_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Rattache l'espace Repéré du pilote et, si fourni, la date de J0 (AAAA-MM-JJ). Vide = détacher. */
export function linkPilotBusiness(id: string, businessId: string, startDate?: string) {
  const b = businessId.trim();
  if (b && !BUSINESS_ID_RE.test(b)) return Promise.resolve(null);
  let started: string | null | undefined;
  if (startDate !== undefined && startDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) return Promise.resolve(null);
    const d = new Date(`${startDate.trim()}T09:00:00Z`);
    if (!Number.isFinite(d.getTime())) return Promise.resolve(null);
    started = d.toISOString();
  }
  return patch(id, (p) => ({ ...p, businessId: b || null, startedAt: started !== undefined ? started : p.startedAt }));
}

/** Compte les places occupées (retenues + actives) sur PILOT_SLOTS. Pur. */
export function seatsTaken(rows: Pick<PilotRow, 'status'>[]): number {
  return rows.filter((r) => r.status === 'retenue' || r.status === 'active').length;
}

/** V10 : places occupées et restantes par parcours (4 local, 3 PME, 3 e-commerce). Pur. */
export function seatsBySegment(rows: Pick<PilotRow, 'status' | 'segment'>[]): Record<PilotSegment, { slots: number; taken: number; left: number }> {
  const out = {} as Record<PilotSegment, { slots: number; taken: number; left: number }>;
  for (const seg of Object.keys(PILOT_SLOTS_BY_SEGMENT) as PilotSegment[]) {
    const slots = PILOT_SLOTS_BY_SEGMENT[seg];
    const taken = Math.min(slots, seatsTaken(rows.filter((r) => r.segment === seg)));
    out[seg] = { slots, taken, left: slots - taken };
  }
  return out;
}
