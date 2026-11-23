/**
 * Expéditeur des e-mails de l'agence (V6).
 *
 * - Domaine VÉRIFIÉ chez le fournisseur d'envoi (enregistrements SPF / DKIM posés par l'agence) :
 *   « Agence Exemple <rapports@agence-exemple.example> », réponse à l'adresse de l'agence.
 * - Sinon : le nom affiché devient celui de l'agence, l'adresse reste celle de Repéré (EMAIL_FROM). On ne fait JAMAIS
 *   partir un e-mail d'un domaine non vérifié (il serait rejeté ou classé en indésirable, et ce serait de l'usurpation).
 * - Vérification : API « domains » de Resend si RESEND_API_KEY est défini ; sans clé, l'écran l'explique (statut
 *   `unavailable`) et rien n'est simulé.
 */
import { normalizeDomain, normalizeLocalPart, type AgencyProfile, type DnsRecord, type DomainStatus, type SenderDomain } from './profile';

/** Adresse d'un en-tête From « Nom <adresse> » ou « adresse ». */
export function addressOf(from: string): string {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1] : from).trim();
}

/** Nom d'affichage sans caractères qui casseraient l'en-tête. */
function displayName(s: string): string {
  return s.replace(/["<>\r\n\\]/g, '').trim().slice(0, 60);
}

export interface SenderHeaders {
  from: string;
  replyTo?: string;
  /** vrai si l'adresse est au domaine de l'agence */
  ownDomain: boolean;
}

export function senderFor(profile: Pick<AgencyProfile, 'name' | 'senderName' | 'replyTo' | 'senderDomain'> | null, defaultFrom: string): SenderHeaders {
  if (!profile) return { from: defaultFrom, ownDomain: false };
  const name = displayName(profile.senderName || profile.name) || 'Rapport';
  const d = profile.senderDomain;
  if (d && d.status === 'verified' && normalizeDomain(d.name)) {
    return { from: `"${name}" <${normalizeLocalPart(d.localPart)}@${d.name}>`, ...(profile.replyTo ? { replyTo: profile.replyTo } : {}), ownDomain: true };
  }
  return { from: `"${name}" <${addressOf(defaultFrom)}>`, ...(profile.replyTo ? { replyTo: profile.replyTo } : {}), ownDomain: false };
}

export const defaultFromAddress = () => process.env.EMAIL_FROM || 'Repéré <onboarding@resend.dev>';

// ---------------------------------------------------------------------------
// Vérification du domaine chez le fournisseur d'envoi
// ---------------------------------------------------------------------------

export interface DomainApi {
  create(name: string): Promise<{ id: string; status: string; records: DnsRecord[] }>;
  get(id: string): Promise<{ id: string; status: string; records: DnsRecord[] }>;
  verify(id: string): Promise<void>;
}

/** Statut du fournisseur → statut affiché. */
export function mapStatus(s: string | undefined | null): DomainStatus {
  switch (s) {
    case 'verified':
      return 'verified';
    case 'failed':
    case 'temporary_failure':
      return 'failed';
    case 'not_started':
      return 'not_started';
    default:
      return 'pending';
  }
}

function asRecords(list: unknown): DnsRecord[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 12).map((r) => {
    const o = r as Record<string, unknown>;
    return { record: String(o.record ?? ''), type: String(o.type ?? ''), name: String(o.name ?? ''), value: String(o.value ?? ''), status: o.status ? String(o.status) : undefined, ...(typeof o.priority === 'number' ? { priority: o.priority } : {}) };
  });
}

/** Client Resend réel (null sans clé). */
export async function resendDomainApi(): Promise<DomainApi | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const { Resend } = await import('resend');
  const r = new Resend(key);
  const unwrap = <T>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error || !res.data) throw new Error(res.error?.message ?? 'Réponse vide du fournisseur d’envoi.');
    return res.data;
  };
  return {
    async create(name) {
      const d = unwrap(await r.domains.create({ name }));
      return { id: d.id, status: String(d.status), records: asRecords(d.records) };
    },
    async get(id) {
      const d = unwrap(await r.domains.get(id));
      return { id: d.id, status: String(d.status), records: asRecords(d.records) };
    },
    async verify(id) {
      unwrap(await r.domains.verify(id));
    },
  };
}

export const NO_PROVIDER_MESSAGE =
  'Le service d’envoi n’est pas encore relié à cet environnement : votre domaine est noté, la vérification DNS sera possible dès la mise en ligne. D’ici là, vos rapports partent avec le nom de votre agence et l’adresse de Repéré.';

/** Enregistre (ou relance) un domaine d'envoi. `api` null : statut `unavailable`, aucun appel. */
export async function registerDomain(input: { domain: unknown; localPart?: unknown }, prev: SenderDomain | null, api: DomainApi | null, now: Date = new Date()): Promise<SenderDomain> {
  const name = normalizeDomain(input.domain);
  if (!name) throw new Error('Domaine invalide : indiquez par exemple agence-exemple.example ou rapports.agence-exemple.example.');
  const localPart = normalizeLocalPart(input.localPart);
  if (!api) return { name, localPart, status: 'unavailable', providerId: null, records: [], checkedAt: now.toISOString(), error: null };
  try {
    if (prev?.providerId && prev.name === name) {
      const d = await api.get(prev.providerId);
      return { name, localPart, status: mapStatus(d.status), providerId: d.id, records: d.records, checkedAt: now.toISOString(), error: null };
    }
    const d = await api.create(name);
    return { name, localPart, status: mapStatus(d.status), providerId: d.id, records: d.records, checkedAt: now.toISOString(), error: null };
  } catch (e) {
    return { name, localPart, status: 'failed', providerId: prev?.name === name ? (prev.providerId ?? null) : null, records: prev?.name === name ? prev.records : [], checkedAt: now.toISOString(), error: e instanceof Error ? e.message.slice(0, 200) : 'Erreur du fournisseur d’envoi.' };
  }
}

/** Demande la vérification puis relit le statut. */
export async function checkDomain(d: SenderDomain, api: DomainApi | null, now: Date = new Date()): Promise<SenderDomain> {
  if (!api || !d.providerId) return { ...d, status: api ? d.status : 'unavailable', checkedAt: now.toISOString() };
  try {
    await api.verify(d.providerId);
    const g = await api.get(d.providerId);
    return { ...d, status: mapStatus(g.status), records: g.records.length ? g.records : d.records, checkedAt: now.toISOString(), error: null };
  } catch (e) {
    return { ...d, checkedAt: now.toISOString(), error: e instanceof Error ? e.message.slice(0, 200) : 'Erreur du fournisseur d’envoi.' };
  }
}
