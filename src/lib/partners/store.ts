/**
 * Candidatures et partenaires (src/lib/store, collection `partners.records`). Serveur uniquement.
 * Un partenaire est une candidature passée au statut « accepte » : elle reçoit alors un code de parrainage unique et
 * des conditions (taux, durée) reprises de sa famille, ajustables dans l'admin. L'annuaire public ne montre que les
 * partenaires acceptés, publiés par l'admin ET ayant donné leur accord (listOk) : aucun partenaire inventé.
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { normalizeWebsite, type AudienceSize, type PartnerFields } from './validate';
import { FAMILIES, type CommissionTerms, type PartnerFamily } from './program';
import { isPartnerCode, suggestCode, uniqueCode } from './codes';

export const PARTNERS_COLLECTION = 'partners.records';

export const PARTNER_STATUSES = [
  { id: 'a_etudier', label: 'À étudier' },
  { id: 'accepte', label: 'Accepté' },
  { id: 'refuse', label: 'Refusé' },
  { id: 'suspendu', label: 'Suspendu' },
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]['id'];
export const isPartnerStatus = (v: unknown): v is PartnerStatus => PARTNER_STATUSES.some((s) => s.id === v);
export const partnerStatusLabel = (s: PartnerStatus) => PARTNER_STATUSES.find((x) => x.id === s)?.label ?? s;

export interface PartnerPayout {
  at: string;
  cents: number;
  note: string;
}

export interface PartnerRecord {
  family: PartnerFamily;
  company: string;
  website: string;
  domain: string;
  name: string;
  email: string;
  role: string | null;
  city: string | null;
  audience: AudienceSize | null;
  message: string;
  listOk: boolean;
  consent: { at: string; text: string };
  receivedAt: string;
  status: PartnerStatus;
  statusHistory: { at: string; status: PartnerStatus }[];
  notes: { at: string; text: string }[];
  /** Code de parrainage, attribué à l'acceptation. */
  code: string | null;
  /** Conditions convenues (null : pas de commission). Fixées à l'acceptation depuis la famille. */
  commission: CommissionTerms | null;
  /** Publié dans l'annuaire par l'admin (nécessite listOk). */
  listed: boolean;
  /** Versements faits à la main (virement sur facture du partenaire). */
  payouts: PartnerPayout[];
  notified: 'sent' | 'logged' | 'error' | 'suppressed' | 'pending';
}

export interface PartnerRow extends PartnerRecord {
  id: string;
}

export const PARTNER_CONSENT_TEXT =
  'J’accepte que Repéré (Mycelo) utilise ces informations pour étudier ma candidature au programme partenaires et me recontacter à son sujet. Elles sont supprimées 12 mois après la fin du partenariat ou d’un refus, ou sur simple demande.';

export const LIST_OK_TEXT =
  'Facultatif : si ma candidature est acceptée, j’accepte que le nom de ma structure, sa ville et son site figurent dans l’annuaire public des partenaires. Je peux retirer cet accord à tout moment.';

export const DUPLICATE_WINDOW_DAYS = 30;

export function domainOf(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

const ID_RE = /^prt_[A-Za-z0-9_-]{6,40}$/;
export const isPartnerId = (id: string) => ID_RE.test(id);
const newId = () => `prt_${crypto.randomBytes(9).toString('base64url')}`;

export function buildPartner(f: PartnerFields, now: Date = new Date()): PartnerRecord {
  const website = normalizeWebsite(f.website) ?? f.website.trim();
  const at = now.toISOString();
  return {
    family: f.family as PartnerFamily,
    company: f.company.trim(),
    website,
    domain: domainOf(website),
    name: f.name.trim(),
    email: f.email.trim().toLowerCase(),
    role: f.role.trim() || null,
    city: f.city.trim() || null,
    audience: f.audience || null,
    message: f.message.trim(),
    listOk: f.listOk === true,
    consent: { at, text: PARTNER_CONSENT_TEXT },
    receivedAt: at,
    status: 'a_etudier',
    statusHistory: [{ at, status: 'a_etudier' }],
    notes: [],
    code: null,
    commission: null,
    listed: false,
    payouts: [],
    notified: 'pending',
  };
}

/** À étudier d'abord, puis acceptés, suspendus, refusés ; plus récents d'abord. Pur. */
export function sortPartners(rows: PartnerRow[]): PartnerRow[] {
  const rank: Record<PartnerStatus, number> = { a_etudier: 0, accepte: 1, suspendu: 2, refuse: 3 };
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || b.receivedAt.localeCompare(a.receivedAt));
}

export async function listPartners(limit = 1000): Promise<PartnerRow[]> {
  const docs = await listDocs<PartnerRecord>(PARTNERS_COLLECTION, { limit, order: 'desc' });
  return sortPartners(docs.filter((d) => d.data && typeof d.data.email === 'string').map((d) => ({ ...d.data, id: d.id })));
}

export async function getPartner(id: string): Promise<PartnerRow | null> {
  if (!isPartnerId(id)) return null;
  const d = await getDoc<PartnerRecord>(PARTNERS_COLLECTION, id);
  return d ? { ...d.data, id: d.id } : null;
}

/** Partenaires visibles dans l'annuaire public (pur sur une liste). */
export function publicDirectory(rows: PartnerRow[]): { id: string; company: string; family: PartnerFamily; city: string | null; website: string; domain: string }[] {
  return rows
    .filter((r) => r.status === 'accepte' && r.listed && r.listOk)
    .sort((a, b) => a.company.localeCompare(b.company, 'fr'))
    .map((r) => ({ id: r.id, company: r.company, family: r.family, city: r.city, website: r.website, domain: r.domain }));
}

export async function savePartnerApplication(p: PartnerRecord, now: Date = new Date()): Promise<{ id: string; duplicate: boolean }> {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 86_400_000).toISOString();
  const existing = (await listPartners()).find((r) => r.email === p.email && r.domain === p.domain && r.receivedAt >= since);
  if (existing) return { id: existing.id, duplicate: true };
  const id = newId();
  await putDoc<PartnerRecord>(PARTNERS_COLLECTION, id, p);
  return { id, duplicate: false };
}

async function patch(id: string, fn: (p: PartnerRecord, all: () => Promise<PartnerRow[]>) => Promise<PartnerRecord | null> | PartnerRecord | null): Promise<PartnerRow | null> {
  if (!isPartnerId(id)) return null;
  const d = await getDoc<PartnerRecord>(PARTNERS_COLLECTION, id);
  if (!d) return null;
  const next = await fn(d.data, () => listPartners());
  if (!next) return null;
  await putDoc<PartnerRecord>(PARTNERS_COLLECTION, id, next);
  return { ...next, id };
}

export function setPartnerNotified(id: string, notified: PartnerRecord['notified']) {
  return patch(id, (p) => ({ ...p, notified }));
}

/**
 * Change le statut. Le premier passage en « accepte » attribue un code unique (tiré du nom) et les conditions de la
 * famille ; un code déjà attribué n'est jamais changé ici (les liens déjà partagés restent valables).
 */
export function setPartnerStatus(id: string, status: PartnerStatus, now: Date = new Date()) {
  return patch(id, async (p, all) => {
    if (p.status === status) return p;
    let code = p.code;
    let commission = p.commission;
    if (status === 'accepte' && !code) {
      const taken = (await all()).map((r) => r.code).filter((c): c is string => !!c);
      code = uniqueCode(suggestCode(p.company), taken);
      commission = FAMILIES[p.family].commission;
    }
    return {
      ...p,
      status,
      code,
      commission,
      listed: status === 'accepte' ? p.listed : false,
      statusHistory: [...(p.statusHistory ?? []), { at: now.toISOString(), status }],
    };
  });
}

/** Remplace le code (avant qu'il soit diffusé, de préférence). Refuse un code invalide ou déjà pris. */
export function setPartnerCode(id: string, code: string) {
  const c = code.trim().toLowerCase();
  if (!isPartnerCode(c)) return Promise.resolve(null);
  return patch(id, async (p, all) => {
    if (p.status !== 'accepte' && p.status !== 'suspendu') return null;
    if ((await all()).some((r) => r.id !== id && r.code === c)) return null;
    return { ...p, code: c };
  });
}

/** Conditions : taux en pourcentage (0 à 50) et durée en mois (1 à 36) ; taux 0 = pas de commission. */
export function setPartnerTerms(id: string, ratePct: number, months: number) {
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 50 || !Number.isInteger(months) || months < 1 || months > 36) return Promise.resolve(null);
  return patch(id, (p) => ({ ...p, commission: ratePct === 0 ? null : { rate: Math.round(ratePct * 10) / 1000, months } }));
}

/** Publie ou retire de l'annuaire : publication refusée sans accord du partenaire ou s'il n'est pas accepté. */
export function setPartnerListed(id: string, listed: boolean) {
  return patch(id, (p) => (listed && (!p.listOk || p.status !== 'accepte') ? null : { ...p, listed }));
}

export const NOTE_MAX = 2000;
export function addPartnerNote(id: string, text: string, now: Date = new Date()) {
  const t = text.trim().slice(0, NOTE_MAX);
  if (!t) return Promise.resolve(null);
  return patch(id, (p) => ({ ...p, notes: [...(p.notes ?? []), { at: now.toISOString(), text: t }] }));
}

/** Enregistre un versement fait à la main (montant en euros, > 0, ≤ 100 000). */
export function addPartnerPayout(id: string, euros: number, note: string, now: Date = new Date()) {
  if (!Number.isFinite(euros) || euros <= 0 || euros > 100_000) return Promise.resolve(null);
  return patch(id, (p) => ({ ...p, payouts: [...(p.payouts ?? []), { at: now.toISOString(), cents: Math.round(euros * 100), note: note.trim().slice(0, 300) }] }));
}

/** Retire le consentement à l'annuaire (demande du partenaire). */
export function withdrawListing(id: string) {
  return patch(id, (p) => ({ ...p, listOk: false, listed: false }));
}
