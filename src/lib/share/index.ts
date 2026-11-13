/**
 * Liens de partage publics (docs/v3/09-audit-app.md n° 6, 02-teardown-midmarket.md : rapports par lien, marque blanche).
 *
 * - Jeton aléatoire de 32 octets (base64url), montré UNE fois à la création ; seul son SHA-256 est stocké
 *   (`share.tokens/<hash>` → identifiant du lien). Une fuite de la base ne donne aucun lien utilisable.
 * - Portée : `report` (un audit précis) ou `dashboard` (tableau de bord en lecture, dernier audit + historique).
 * - Expiration (1 à 365 jours, défaut 90), révocation, mot de passe facultatif (scrypt salé).
 * - Marque blanche (droit `whiteLabel`) : nom, logo (URL https), couleur, masquage de « Repéré ».
 * - La vue publique (`buildPublicView`) ne contient jamais d'e-mail, de tâche ni de fiche de vérité.
 */
import crypto from 'node:crypto';
import { getDoc, incrDoc, listDocs, putDoc } from '@/lib/store';
import { getBusinessRecord, listAuditsForBusiness } from '@/lib/db';
import { auditStats } from '@/lib/digest/stats';
import { scoreBand, type AuditResult } from '@/lib/engine';
import { appUrl } from '@/lib/email';
import { providerName } from '@/lib/exports';

export const LINKS = 'share.links';
export const TOKENS = 'share.tokens';
export const VIEWS = 'share.views';

export type ShareScope = 'report' | 'dashboard';

export interface ShareBranding {
  name?: string;
  logoUrl?: string;
  color?: string;
  hideRepere?: boolean;
}

export interface ShareLink {
  id: string;
  businessId: string;
  scope: ShareScope;
  auditId?: string;
  label?: string;
  tokenHash: string;
  /** 6 derniers caractères du jeton, pour reconnaître le lien dans la liste */
  hint: string;
  expiresAt: string;
  revokedAt?: string | null;
  password?: { salt: string; hash: string } | null;
  branding?: ShareBranding | null;
  createdAt: string;
  createdBy?: string | null;
}

/** Ce qu'on renvoie au client propriétaire (jamais le hachage ni le mot de passe). */
export interface ShareLinkView {
  id: string;
  scope: ShareScope;
  auditId?: string;
  label?: string;
  hint: string;
  expiresAt: string;
  revoked: boolean;
  expired: boolean;
  passwordProtected: boolean;
  branding: ShareBranding | null;
  views: number;
  lastViewedAt: string | null;
  createdAt: string;
}

export const DEFAULT_EXPIRY_DAYS = 90;
export const MAX_EXPIRY_DAYS = 365;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url'); // 43 caractères
}

export function shareUrl(token: string): string {
  return `${appUrl().replace(/\/$/, '')}/r/${token}`;
}

// ---------------------------------------------------------------------------
// Mot de passe (scrypt) et cookie de déverrouillage
// ---------------------------------------------------------------------------
export function hashPassword(pw: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  return { salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') };
}

/** Vérification asynchrone (scrypt ne bloque plus la boucle d'événements : F5 de qa/v3/securite-v3.md). */
export async function checkPassword(pw: string, stored: { salt: string; hash: string }): Promise<boolean> {
  const h = await new Promise<Buffer>((resolve, reject) => crypto.scrypt(pw, stored.salt, 32, (e, k) => (e ? reject(e) : resolve(k))));
  const ref = Buffer.from(stored.hash, 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(h, ref);
}

function secret(): string {
  const s = process.env.SHARE_SECRET;
  if (s) return s;
  // Jamais de repli sur un autre secret en production (F3 de qa/v3/securite-v3.md).
  if (process.env.NODE_ENV === 'production') throw new Error('SHARE_SECRET manquant');
  return process.env.UNSUBSCRIBE_SECRET || 'repere-dev-share-secret';
}

/** Nom du cookie de déverrouillage d'un lien protégé. */
export const unlockCookieName = (link: Pick<ShareLink, 'id'>) => `rp_sh_${link.id.slice(0, 12)}`;

/** Preuve de déverrouillage : HMAC(id du lien + hachage du mot de passe) — changer le mot de passe invalide les cookies. */
export function unlockProof(link: Pick<ShareLink, 'id' | 'password'>): string {
  return crypto.createHmac('sha256', secret()).update(`share-unlock|${link.id}:${link.password?.hash ?? ''}`).digest('base64url');
}

export function verifyUnlockProof(link: Pick<ShareLink, 'id' | 'password'>, proof: string | undefined | null): boolean {
  if (!proof) return false;
  const a = Buffer.from(unlockProof(link));
  const b = Buffer.from(proof);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Validation de la marque blanche
// ---------------------------------------------------------------------------
export function sanitizeBranding(b: ShareBranding | null | undefined, whiteLabel: boolean): ShareBranding | null {
  if (!b || !whiteLabel) return null;
  const out: ShareBranding = {};
  const name = b.name?.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  if (name) out.name = name;
  if (b.logoUrl) {
    try {
      const u = new URL(b.logoUrl);
      if (u.protocol === 'https:' && !u.username && !u.password && b.logoUrl.length <= 500) out.logoUrl = u.toString();
    } catch {
      /* URL invalide ignorée */
    }
  }
  if (b.color && /^#[0-9a-f]{6}$/i.test(b.color)) out.color = b.color.toLowerCase();
  if (b.hideRepere) out.hideRepere = true;
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// Création, liste, révocation
// ---------------------------------------------------------------------------
export interface CreateShareInput {
  businessId: string;
  scope: ShareScope;
  auditId?: string;
  label?: string;
  expiresInDays?: number;
  password?: string | null;
  branding?: ShareBranding | null;
  /** droit `whiteLabel` du commerce (sinon la marque blanche est ignorée) */
  whiteLabel?: boolean;
  createdBy?: string | null;
  now?: Date;
}

export class ShareError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function createShareLink(input: CreateShareInput): Promise<{ token: string; url: string; link: ShareLinkView }> {
  const now = input.now ?? new Date();
  if (input.scope === 'report') {
    const audits = await listAuditsForBusiness(input.businessId);
    // Sans auditId (contrat : facultatif) : le dernier audit du commerce.
    if (!input.auditId) {
      const latest = [...audits].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
      if (!latest) throw new ShareError(400, 'Aucun audit à partager pour l’instant : lancez d’abord une mesure.');
      input = { ...input, auditId: latest.id };
    }
    if (!audits.some((a) => a.id === input.auditId)) throw new ShareError(404, 'Audit introuvable pour ce commerce.');
  }
  const days = Math.min(MAX_EXPIRY_DAYS, Math.max(1, Math.round(input.expiresInDays ?? DEFAULT_EXPIRY_DAYS)));
  const pw = input.password?.trim();
  if (pw && (pw.length < 8 || pw.length > 128)) throw new ShareError(400, 'Mot de passe : 8 à 128 caractères.');
  const token = newToken();
  const tokenHash = hashToken(token);
  const id = `sh_${crypto.randomBytes(9).toString('base64url')}`;
  const link: ShareLink = {
    id,
    businessId: input.businessId,
    scope: input.scope,
    ...(input.scope === 'report' ? { auditId: input.auditId } : {}),
    label: input.label?.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || undefined,
    tokenHash,
    hint: token.slice(-6),
    expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
    revokedAt: null,
    password: pw ? hashPassword(pw) : null,
    branding: sanitizeBranding(input.branding, !!input.whiteLabel),
    createdAt: now.toISOString(),
    createdBy: input.createdBy ?? null,
  };
  await putDoc<ShareLink>(LINKS, id, link, input.businessId);
  await putDoc(TOKENS, tokenHash, { linkId: id }, input.businessId);
  return { token, url: shareUrl(token), link: toView(link, 0, null, now) };
}

function toView(l: ShareLink, views: number, lastViewedAt: string | null, now: Date = new Date()): ShareLinkView {
  return {
    id: l.id, scope: l.scope, auditId: l.auditId, label: l.label, hint: l.hint, expiresAt: l.expiresAt,
    revoked: !!l.revokedAt, expired: l.expiresAt <= now.toISOString(), passwordProtected: !!l.password,
    branding: l.branding ?? null, views, lastViewedAt, createdAt: l.createdAt,
  };
}

export async function listShareLinks(businessId: string, now: Date = new Date()): Promise<ShareLinkView[]> {
  const docs = await listDocs<ShareLink>(LINKS, { businessId, limit: 200 });
  const out: ShareLinkView[] = [];
  for (const d of docs) {
    if (d.data.businessId !== businessId) continue;
    const v = await getDoc<{ views?: number; last?: number }>(VIEWS, d.id);
    out.push(toView(d.data, v?.data.views ?? 0, v?.updatedAt ?? null, now));
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeShareLink(businessId: string, linkId: string, now: Date = new Date()): Promise<boolean> {
  const doc = await getDoc<ShareLink>(LINKS, linkId);
  if (!doc || doc.data.businessId !== businessId) return false;
  if (!doc.data.revokedAt) await putDoc<ShareLink>(LINKS, linkId, { ...doc.data, revokedAt: now.toISOString() }, businessId);
  return true;
}

// ---------------------------------------------------------------------------
// Résolution d'un jeton (page publique)
// ---------------------------------------------------------------------------
export type ResolveStatus = 'ok' | 'not_found' | 'expired' | 'revoked' | 'password_required';

export async function resolveShareToken(
  token: string,
  opts: { now?: Date; unlockProof?: string | null; password?: string | null } = {},
): Promise<{ status: ResolveStatus; link: ShareLink | null }> {
  if (!TOKEN_RE.test(token)) return { status: 'not_found', link: null };
  const idx = await getDoc<{ linkId: string }>(TOKENS, hashToken(token));
  if (!idx) return { status: 'not_found', link: null };
  const doc = await getDoc<ShareLink>(LINKS, idx.data.linkId);
  if (!doc) return { status: 'not_found', link: null };
  const link = doc.data;
  const now = (opts.now ?? new Date()).toISOString();
  if (link.revokedAt) return { status: 'revoked', link };
  if (link.expiresAt <= now) return { status: 'expired', link };
  if (link.password) {
    const ok = (opts.password && (await checkPassword(opts.password, link.password))) || verifyUnlockProof(link, opts.unlockProof);
    if (!ok) return { status: 'password_required', link };
  }
  return { status: 'ok', link };
}

export async function recordShareView(linkId: string, businessId: string): Promise<void> {
  await incrDoc(VIEWS, linkId, { views: 1 }, businessId).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Vue publique (aucune donnée sensible)
// ---------------------------------------------------------------------------
export interface PublicShareView {
  scope: ShareScope;
  brand: { name: string; logoUrl: string | null; color: string; showRepere: boolean };
  business: { name: string; context: string };
  demo: boolean;
  measuredAt: string;
  score: number;
  range: { low: number; high: number };
  band: { label: string; color: string; bg: string; ink: string };
  rankLabel: string;
  shareOfVoice: number;
  methodLabel: string;
  providers: { name: string; score: number | null }[];
  ranking: { pos: number; name: string; isMe: boolean; share: number }[];
  sources: { domain: string; label: string; citations: number; you: 'present' | 'absent' | 'unknown' }[];
  excerpts: { provider: string; query: string; text: string; mentioned: boolean }[];
  history: { date: string; score: number; low: number; high: number }[];
  expiresAt: string;
}

const DEFAULT_COLOR = '#4338ca';

function contextOf(a: AuditResult): string {
  const i = a.input as AuditResult['input'] & { segment?: string; category?: string };
  if ((i.segment ?? a.segment) === 'local' || !(i.segment ?? a.segment)) return [i.trade, i.district, i.city].filter(Boolean).join(', ');
  return i.category || i.trade || '';
}

/** Supprime tout ce qui ressemble à une adresse e-mail ou un numéro de téléphone (verbatims). */
export function scrubContact(s: string): string {
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[adresse masquée]')
    .replace(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g, '[numéro masqué]');
}

export function buildPublicViewFrom(link: ShareLink, audits: AuditResult[], businessName: string): PublicShareView | null {
  const target = link.scope === 'report' ? audits.find((a) => a.id === link.auditId) : audits[audits.length - 1];
  if (!target) return null;
  const s = auditStats(target);
  const band = scoreBand(target.score);
  const providers = (target.providersUsed?.length ? target.providersUsed : (Object.keys(target.subScores ?? {}) as AuditResult['providersUsed']))
    .map((p) => ({ name: providerName(p), score: target.subScores?.[p] ?? null }));
  const brandName = link.branding?.name || businessName;
  return {
    scope: link.scope,
    brand: {
      name: brandName,
      logoUrl: link.branding?.logoUrl ?? null,
      color: link.branding?.color ?? DEFAULT_COLOR,
      showRepere: !link.branding?.hideRepere,
    },
    business: { name: businessName, context: contextOf(target) },
    demo: !!target.demo,
    measuredAt: (target.measuredAt || target.createdAt).slice(0, 10),
    score: Math.round(target.score),
    range: target.range ?? { low: target.score, high: target.score },
    band: { label: band.label, color: band.color, bg: band.bg, ink: band.ink },
    rankLabel: s.label,
    shareOfVoice: s.shareOfVoice,
    methodLabel: s.methodLabel,
    providers,
    ranking: s.rows.slice(0, 10).map((r) => ({ pos: r.pos, name: r.name, isMe: r.isMe, share: r.share })),
    sources: (target.sources?.domains ?? []).slice(0, 8).map((d) => ({ domain: d.domain, label: d.label, citations: d.citations, you: d.clientPresence })),
    excerpts: (target.excerpts ?? []).slice(0, 4).map((e) => ({ provider: providerName(e.provider), query: e.query, text: scrubContact(e.text).slice(0, 600), mentioned: e.mentioned })),
    history:
      link.scope === 'dashboard'
        ? audits.slice(-12).map((a) => ({ date: (a.measuredAt || a.createdAt).slice(0, 10), score: Math.round(a.score), low: a.range?.low ?? a.score, high: a.range?.high ?? a.score }))
        : [],
    expiresAt: link.expiresAt,
  };
}

export async function buildPublicView(link: ShareLink): Promise<PublicShareView | null> {
  const business = await getBusinessRecord(link.businessId);
  if (!business) return null;
  const audits = await listAuditsForBusiness(link.businessId); // jamais un audit d'un autre commerce
  return buildPublicViewFrom(link, audits, business.name);
}
