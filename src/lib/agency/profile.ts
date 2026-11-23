/**
 * Marque de l'agence (V6, agent AGENCES) — saisie UNE fois, appliquée à tous les espaces clients de l'agence :
 * rapport mensuel imprimable, liens de partage créés par l'envoi programmé, e-mails (nom d'expéditeur, adresse de
 * réponse, domaine d'envoi une fois vérifié).
 *
 * - Collection `agency.profiles` (id = identifiant de l'utilisateur propriétaire de l'agence).
 * - Un espace client « appartient » à l'agence dont un propriétaire ou administrateur a un profil : pas d'index à
 *   tenir à jour (on lit les membres de l'espace, au plus quelques lectures).
 * - La marque n'est appliquée que si l'espace a le droit `agency.branding` (offre Agence) : jamais ailleurs.
 */
import { getDoc, putDoc } from '@/lib/store';
import type { ShareBranding } from '@/lib/share';

export const PROFILES = 'agency.profiles';

import { DEFAULT_AGENCY_COLOR } from './brand';
export { DEFAULT_AGENCY_COLOR, initialsOf } from './brand';

export type DomainStatus = 'not_started' | 'pending' | 'verified' | 'failed' | 'unavailable';

export interface DnsRecord {
  /** SPF, DKIM, MX… */
  record: string;
  type: string;
  name: string;
  value: string;
  status?: string;
  priority?: number;
}

export interface SenderDomain {
  /** domaine d'envoi, ex. agence-exemple.example (ou un sous-domaine : rapports.agence-exemple.example) */
  name: string;
  /** partie locale de l'adresse : rapports@… */
  localPart: string;
  status: DomainStatus;
  /** identifiant chez le fournisseur d'envoi (Resend) */
  providerId?: string | null;
  records: DnsRecord[];
  checkedAt?: string | null;
  error?: string | null;
}

export interface AgencyProfile {
  agencyId: string;
  /** nom affiché à la place de Repéré */
  name: string;
  /** logo en https (affiché sur le rapport et la page partagée) */
  logoUrl?: string | null;
  /** couleur d'accent #rrggbb */
  color: string;
  /** nom d'expéditeur des e-mails (défaut : nom de l'agence) */
  senderName?: string | null;
  /** adresse de réponse (vos clients vous répondent directement) */
  replyTo?: string | null;
  /** masquer « produit avec Repéré » (pied de page) */
  hideRepere: boolean;
  /** ligne de contact en pied de rapport (téléphone, site) */
  footer?: string | null;
  senderDomain?: SenderDomain | null;
  updatedAt: string;
  updatedBy?: string | null;
  demo?: boolean;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim() || v.length > 500) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Domaine d'envoi saisi → nom de domaine normalisé, ou null (pas d'IP, pas de port, 2 niveaux au moins). */
export function normalizeDomain(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let d = v.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^.*@/, '').replace(/\.$/, '');
  if (!d || d.length > 120) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return null;
  return d;
}

export function normalizeLocalPart(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9._-]{0,40}$/.test(s) ? s : 'rapports';
}

export interface ProfileInput {
  name?: unknown;
  logoUrl?: unknown;
  color?: unknown;
  senderName?: unknown;
  replyTo?: unknown;
  hideRepere?: unknown;
  footer?: unknown;
}

export class AgencyError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Valide la saisie (pur). Le nom est obligatoire ; tout le reste est facultatif. */
export function sanitizeProfile(agencyId: string, input: ProfileInput, prev: AgencyProfile | null, now: Date = new Date()): AgencyProfile {
  const name = clean(input.name, 60);
  if (name.length < 2) throw new AgencyError(400, 'Indiquez le nom de votre agence (2 caractères au moins).');
  const logoRaw = typeof input.logoUrl === 'string' ? input.logoUrl.trim() : '';
  const logoUrl = logoRaw ? safeHttpsUrl(logoRaw) : null;
  if (logoRaw && !logoUrl) throw new AgencyError(400, 'Le logo doit être une adresse https (fichier PNG, SVG ou JPG).');
  const colorRaw = typeof input.color === 'string' ? input.color.trim() : '';
  if (colorRaw && !COLOR_RE.test(colorRaw)) throw new AgencyError(400, 'Couleur attendue au format #RRGGBB.');
  const replyRaw = clean(input.replyTo, 120);
  if (replyRaw && !EMAIL_RE.test(replyRaw)) throw new AgencyError(400, 'Adresse de réponse invalide.');
  return {
    agencyId,
    name,
    logoUrl,
    color: (colorRaw || prev?.color || DEFAULT_AGENCY_COLOR).toLowerCase(),
    senderName: clean(input.senderName, 60) || null,
    replyTo: replyRaw ? replyRaw.toLowerCase() : null,
    hideRepere: input.hideRepere === true || input.hideRepere === 'on' || input.hideRepere === 'true',
    footer: clean(input.footer, 140) || null,
    senderDomain: prev?.senderDomain ?? null,
    updatedAt: now.toISOString(),
    updatedBy: prev?.updatedBy ?? null,
  };
}

export async function getAgencyProfile(agencyId: string): Promise<AgencyProfile | null> {
  if (!agencyId) return null;
  return (await getDoc<AgencyProfile>(PROFILES, agencyId))?.data ?? null;
}

export async function saveAgencyProfile(agencyId: string, input: ProfileInput, by: string | null, now: Date = new Date()): Promise<AgencyProfile> {
  const prev = await getAgencyProfile(agencyId);
  const next = { ...sanitizeProfile(agencyId, input, prev, now), updatedBy: by };
  await putDoc<AgencyProfile>(PROFILES, agencyId, next, null);
  return next;
}

export async function putSenderDomain(agencyId: string, domain: SenderDomain | null, now: Date = new Date()): Promise<AgencyProfile> {
  const prev = await getAgencyProfile(agencyId);
  if (!prev) throw new AgencyError(409, 'Enregistrez d’abord le nom de votre agence.');
  const next: AgencyProfile = { ...prev, senderDomain: domain, updatedAt: now.toISOString() };
  await putDoc<AgencyProfile>(PROFILES, agencyId, next, null);
  return next;
}

/** Marque des liens de partage et de la page publique (format attendu par src/lib/share). */
export function shareBrandingOf(p: Pick<AgencyProfile, 'name' | 'logoUrl' | 'color' | 'hideRepere'>): ShareBranding {
  return { name: p.name, ...(p.logoUrl ? { logoUrl: p.logoUrl } : {}), color: p.color, ...(p.hideRepere ? { hideRepere: true } : {}) };
}

/**
 * Profil d'agence qui s'applique à un espace client : un propriétaire, puis un administrateur, qui a un profil.
 * `members` est injecté (tests) ; par défaut `listMembers` de la base.
 */
export async function agencyProfileForBusiness(
  businessId: string,
  deps: { members?: (id: string) => Promise<{ userId: string; role: string }[]>; ownerId?: string | null } = {},
): Promise<AgencyProfile | null> {
  const members = deps.members ?? (async (id: string) => (await import('@/lib/db')).listMembers(id));
  const list = await members(businessId).catch(() => [] as { userId: string; role: string }[]);
  const order = [
    ...(deps.ownerId ? [deps.ownerId] : []),
    ...list.filter((m) => m.role === 'owner').map((m) => m.userId),
    ...list.filter((m) => m.role === 'admin').map((m) => m.userId),
  ];
  for (const id of [...new Set(order)]) {
    const p = await getAgencyProfile(id);
    if (p) return p;
  }
  return null;
}
