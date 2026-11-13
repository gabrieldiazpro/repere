import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import { getAudit, getAuditBusinessId, isDemoBusinessId } from '@/lib/db';
import { citationStats } from '@/lib/engine/scoring';
import { SITE_URL } from '@/lib/seo/site';
import { COLLECTIONS } from './constants';
import { generateToken, verifyToken } from './tokens';
import { bandFor, clampScore } from './score';

/** Carte de score partagée : privée par défaut, publiée sur décision explicite du propriétaire. */
export interface CardRecord {
  auditId: string;
  businessId: string;
  token: string;
  createdAt: string;
}

export const AUDIT_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function cardUrl(auditId: string, token: string): string {
  return `${SITE_URL}/carte/${auditId}?t=${token}`;
}
export function cardOgUrl(auditId: string, token: string): string {
  return `${SITE_URL}/carte/${auditId}/og?t=${token}`;
}

export async function getCardRecord(auditId: string): Promise<CardRecord | null> {
  if (!AUDIT_ID_RE.test(auditId)) return null;
  return (await getDoc<CardRecord>(COLLECTIONS.cards, auditId))?.data ?? null;
}

export class CardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Active le partage de la carte d'un audit. Règles : l'audit appartient au commerce, il n'est pas simulé,
 * une seule carte active par commerce (les autres sont retirées). Idempotent : le jeton existant est conservé.
 */
export async function enableCard(businessId: string, auditId: string): Promise<CardRecord> {
  if (!AUDIT_ID_RE.test(auditId)) throw new CardError(400, 'Identifiant d’audit invalide.');
  if (isDemoBusinessId(businessId)) throw new CardError(403, 'Compte de démonstration : pas de carte à partager.');
  const [audit, owner] = await Promise.all([getAudit(auditId), getAuditBusinessId(auditId)]);
  if (!audit || owner !== businessId) throw new CardError(404, 'Audit introuvable pour ce commerce.');
  if (audit.demo) throw new CardError(422, 'Cet audit est une simulation : une carte ne peut être partagée que pour une mesure réelle.');
  const existing = await getCardRecord(auditId);
  if (existing && existing.businessId === businessId) return existing;
  for (const d of await listDocs<CardRecord>(COLLECTIONS.cards, { businessId, limit: 50 })) await deleteDoc(COLLECTIONS.cards, d.id);
  const rec: CardRecord = { auditId, businessId, token: generateToken(), createdAt: new Date().toISOString() };
  await putDoc(COLLECTIONS.cards, auditId, rec, businessId);
  return rec;
}

/** Retire le partage (un clic) : le lien et l'image OG cessent immédiatement de répondre. */
export async function disableCard(businessId: string, auditId: string): Promise<boolean> {
  const rec = await getCardRecord(auditId);
  if (!rec || rec.businessId !== businessId) return false;
  await deleteDoc(COLLECTIONS.cards, auditId);
  return true;
}

export async function activeCardForBusiness(businessId: string): Promise<CardRecord | null> {
  return (await listDocs<CardRecord>(COLLECTIONS.cards, { businessId, limit: 1 }))[0]?.data ?? null;
}

/** Ce que la page et l'image affichent. Aucune donnée personnelle : ni e-mail, ni concurrent, ni texte d'IA. */
export interface CardView {
  name: string;
  trade: string;
  place: string;
  score: number;
  label: string;
  rangeLow: number;
  rangeHigh: number;
  /** Position moyenne quand la marque est citée (null si jamais citée). */
  avgRank: number | null;
  cited: number;
  total: number;
  measuredAt: string;
  confidence: 'faible' | 'moyenne' | 'bonne';
  demo: boolean;
}

export async function cardView(auditId: string, token: string | null | undefined): Promise<CardView | null> {
  const rec = await getCardRecord(auditId);
  if (!rec || !verifyToken(rec.token, token)) return null;
  const audit = await getAudit(auditId).catch(() => null);
  if (!audit) return null;
  const score = clampScore(audit.score);
  const { cited, total } = citationStats(audit);
  return {
    name: audit.input.businessName,
    trade: audit.input.trade,
    place: audit.input.district || audit.input.city,
    score,
    label: bandFor(score).label,
    rangeLow: clampScore(audit.margins?.score?.low ?? audit.range?.low ?? score),
    rangeHigh: clampScore(audit.margins?.score?.high ?? audit.range?.high ?? score),
    avgRank: audit.avgRank,
    cited,
    total,
    measuredAt: audit.measuredAt || audit.createdAt,
    confidence: audit.confidence,
    demo: audit.demo,
  };
}

/** Textes de partage sans superlatif ni promesse. */
export function shareLinks(view: CardView, url: string) {
  const text = `Mesure de la visibilité de ${view.name} dans les assistants IA : ${view.score}/100 (${view.label}). Mesuré par Repéré.`;
  return {
    text,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  };
}
