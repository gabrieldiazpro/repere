/**
 * Stockage des analyses 60 s (src/lib/store, collections `analysis.*`).
 *
 * - `analysis.runs/<id>` : l'analyse + domaine + hachage du jeton de partage + hachage de l'e-mail (jamais en clair).
 * - `analysis.domains/<hash du domaine>` : dernière analyse et historique (cache 10 min, réanalyse avant / après).
 * - Partage : jeton aléatoire de 32 octets (primitives de src/lib/share : newToken / hashToken), montré une fois,
 *   seul son SHA-256 est stocké ; lien `/analyse/<id>?t=<jeton>`, expiration 90 jours.
 * - Rattachement à un compte à l'inscription : même règle que l'audit gratuit (AMELIO-ENTONNOIR) — seulement si
 *   l'e-mail de la session est celui saisi pour l'analyse ; l'audit moteur du contrôle IA est rattaché avec.
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { appUrl } from '@/lib/email';
import { DEFAULT_EXPIRY_DAYS, TOKEN_RE, hashToken, newToken } from '@/lib/share';
import type { FullAnalysis } from './types';

export const RUNS = 'analysis.runs';
export const DOMAINS = 'analysis.domains';
export const CACHE_TTL_MS = 10 * 60 * 1000;
const HISTORY_MAX = 20;
const TOKENS_MAX = 50;

export interface StoredAnalysis {
  analysis: FullAnalysis;
  domain: string;
  /** hachages des jetons de partage (un par demandeur, y compris les réponses servies depuis le cache) */
  tokenHashes: string[];
  expiresAt: string;
  /** hachages des e-mails des demandeurs (rattachement) */
  emailHashes: string[];
  businessId?: string | null;
  attachedAt?: string | null;
}

interface DomainIndex {
  domain: string;
  latestId: string;
  latestAt: string;
  history: { id: string; at: string; global: number | null }[];
}

function secret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET || process.env.SHARE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_SIGNING_SECRET manquant');
  return 'repere-dev-analysis-secret';
}

export function emailHash(email: string): string {
  return crypto.createHmac('sha256', secret()).update(`analysis-email|${email.trim().toLowerCase()}`).digest('hex');
}

function domainKey(domain: string): string {
  return crypto.createHash('sha256').update(`analysis-domain|${domain.toLowerCase()}`).digest('hex').slice(0, 40);
}

export function analysisShareUrl(id: string, token: string): string {
  const base = appUrl().replace(/\/$/, '');
  return `${base}/analyse/${encodeURIComponent(id)}?t=${token}`;
}

/** Enregistre l'analyse et renvoie le jeton de partage (à ne montrer qu'à son auteur). */
export async function saveAnalysis(
  analysis: FullAnalysis,
  meta: { domain: string; email?: string | null; now?: Date; /** réanalyse d'un espace (file de tâches) : rattachée d'office */ businessId?: string | null },
): Promise<{ token: string; url: string; expiresAt: string }> {
  const now = meta.now ?? new Date();
  const token = newToken();
  const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 86_400_000).toISOString();
  const doc: StoredAnalysis = {
    analysis,
    domain: meta.domain,
    tokenHashes: [hashToken(token)],
    expiresAt,
    emailHashes: meta.email ? [emailHash(meta.email)] : [],
    businessId: meta.businessId ?? null,
    ...(meta.businessId ? { attachedAt: now.toISOString() } : {}),
  };
  await putDoc<StoredAnalysis>(RUNS, analysis.id, doc, meta.businessId ?? null);
  const k = domainKey(meta.domain);
  const prev = await getDoc<DomainIndex>(DOMAINS, k);
  const history = [{ id: analysis.id, at: analysis.createdAt, global: analysis.scores.global }, ...(prev?.data.history ?? [])].slice(0, HISTORY_MAX);
  await putDoc<DomainIndex>(DOMAINS, k, { domain: meta.domain, latestId: analysis.id, latestAt: now.toISOString(), history });
  return { token, url: analysisShareUrl(analysis.id, token), expiresAt };
}

export async function getStoredAnalysis(id: string): Promise<StoredAnalysis | null> {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
  const d = await getDoc<StoredAnalysis>(RUNS, id);
  return d?.data ?? null;
}

function safeEq(x: string, y: string): boolean {
  const a = Buffer.from(x);
  const b = Buffer.from(y);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Vérifie le jeton de partage (comparaison à temps constant). */
export function tokenMatches(doc: StoredAnalysis, token: string | null | undefined, now: Date = new Date()): boolean {
  if (!token || !TOKEN_RE.test(token)) return false;
  if (doc.expiresAt <= now.toISOString()) return false;
  const h = hashToken(token);
  return doc.tokenHashes.some((t) => safeEq(h, t));
}

/** Nouveau jeton pour une analyse existante (réponse servie depuis le cache à un autre demandeur). */
export async function issueToken(id: string, email?: string | null): Promise<{ token: string; url: string } | null> {
  const doc = await getStoredAnalysis(id);
  if (!doc) return null;
  const token = newToken();
  const eh = email ? emailHash(email) : null;
  const next: StoredAnalysis = {
    ...doc,
    tokenHashes: [...doc.tokenHashes, hashToken(token)].slice(-TOKENS_MAX),
    emailHashes: eh && !doc.emailHashes.includes(eh) ? [...doc.emailHashes, eh].slice(-TOKENS_MAX) : doc.emailHashes,
  };
  await putDoc<StoredAnalysis>(RUNS, id, next, doc.businessId ?? null);
  return { token, url: analysisShareUrl(id, token) };
}

/** Dernière analyse d'un domaine, si elle a moins de `ttlMs` (cache). */
export async function cachedAnalysis(domain: string, ttlMs = CACHE_TTL_MS, now: Date = new Date()): Promise<StoredAnalysis | null> {
  const idx = await getDoc<DomainIndex>(DOMAINS, domainKey(domain));
  if (!idx || now.getTime() - Date.parse(idx.data.latestAt) > ttlMs) return null;
  const doc = await getStoredAnalysis(idx.data.latestId);
  return doc && !doc.analysis.partial ? doc : null;
}

/** Analyse précédente d'un domaine (réanalyse : comparaison avant / après). */
export async function previousAnalysis(domain: string): Promise<FullAnalysis | null> {
  const idx = await getDoc<DomainIndex>(DOMAINS, domainKey(domain));
  if (!idx) return null;
  return (await getStoredAnalysis(idx.data.latestId))?.analysis ?? null;
}

export async function domainHistory(domain: string): Promise<DomainIndex['history']> {
  return (await getDoc<DomainIndex>(DOMAINS, domainKey(domain)))?.data.history ?? [];
}

/**
 * Rattache une analyse anonyme à un compte (appelé à l'inscription, comme `claim.audit`).
 * Refus si l'e-mail ne correspond pas, ou si l'analyse appartient déjà à un autre espace.
 */
export async function attachAnalysisToBusiness(id: string, businessId: string, sessionEmail: string, now: Date = new Date()): Promise<boolean> {
  const doc = await getStoredAnalysis(id);
  if (!doc || !doc.emailHashes.length || !sessionEmail) return false;
  if (doc.businessId && doc.businessId !== businessId) return false;
  const h = emailHash(sessionEmail);
  if (!doc.emailHashes.some((x) => safeEq(h, x))) return false;
  if (doc.businessId === businessId) return true;
  await putDoc<StoredAnalysis>(RUNS, id, { ...doc, businessId, attachedAt: now.toISOString() }, businessId);
  const auditId = doc.analysis.ai?.auditId;
  if (auditId) {
    try {
      const db = await import('@/lib/db');
      if (!(await db.getAuditBusinessId(auditId))) await db.linkAuditToBusiness(auditId, businessId);
    } catch {
      /* l'analyse reste rattachée même si l'audit moteur ne l'est pas */
    }
  }
  return true;
}

/** L'analyse a-t-elle été demandée avec cette adresse ? (préremplissage de l'inscription, même règle que le rattachement) */
export async function analysisRequestedBy(id: string, email: string): Promise<StoredAnalysis | null> {
  if (!id || !email) return null;
  const doc = await getStoredAnalysis(id).catch(() => null);
  if (!doc || !doc.emailHashes?.length) return null;
  const h = emailHash(email);
  return doc.emailHashes.some((x) => safeEq(h, x)) ? doc : null;
}

export async function listAnalysesForBusiness(businessId: string, limit = 50): Promise<FullAnalysis[]> {
  const docs = await listDocs<StoredAnalysis>(RUNS, { businessId, limit });
  return docs.filter((d) => d.data.businessId === businessId).map((d) => d.data.analysis);
}

/** Vue publique : l'analyse telle quelle (elle ne contient ni e-mail ni clé), sans le HTML des pages. */
export function toPublicAnalysis(a: FullAnalysis): FullAnalysis {
  return a;
}
