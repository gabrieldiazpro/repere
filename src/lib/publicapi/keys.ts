/**
 * Clés d'API publiques (Réglages › API).
 *
 * Format : `rp_live_<identifiant 12>_<secret 43>` (secret = 32 octets aléatoires en base64url, 256 bits).
 * - Le jeton complet n'est montré qu'UNE fois, à la création. Seule son empreinte est stockée :
 *   HMAC-SHA256(poivre, identifiant + secret). Poivre : PUBLIC_API_KEY_PEPPER (facultatif ; le changer invalide
 *   toutes les clés). Le secret ayant 256 bits d'entropie, l'empreinte ne se devine pas même sans poivre.
 * - Vérification : recherche par identifiant (préfixe public), puis comparaison en temps constant des empreintes.
 * - Portée : un espace (`space`) ou toute l'agence (`agency` : les espaces en offre Agence dont le créateur est
 *   propriétaire ou administrateur, réévalués à CHAQUE requête — un accès retiré coupe la clé).
 * - Droits : `read` (lecture) ou `write` (lecture + écritures sûres : questions suivies, nouvelle mesure).
 *   La validation des propositions de l'agent n'est JAMAIS possible par l'API (validation humaine dans l'app).
 * - Clé de démonstration : publique, en lecture seule, limitée aux comptes démo (données fictives étiquetées).
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { ApiError } from './errors';

export const KEYS_COLLECTION = 'publicapi.keys';
export const MAX_ACTIVE_KEYS = 10;

export type KeyAccess = 'read' | 'write';
export type KeyScope = { kind: 'space'; businessId: string } | { kind: 'agency'; userId: string };

export interface ApiKeyRecord {
  id: string;
  label: string;
  /** empreinte HMAC-SHA256 (hex) — jamais le secret */
  hash: string;
  /** 4 derniers caractères du secret, pour reconnaître la clé */
  last4: string;
  access: KeyAccess;
  scope: KeyScope;
  createdAt: string;
  createdBy: { userId: string; email?: string | null };
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
}

export interface ApiKeyView {
  id: string;
  label: string;
  /** début visible de la clé (« rp_live_ab12cd34ef56_… ») */
  prefix: string;
  last4: string;
  access: KeyAccess;
  scope: 'space' | 'agency';
  businessId: string | null;
  createdAt: string;
  createdBy: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const KEY_RE = /^rp_(live|demo)_([a-z0-9]{12})_([A-Za-z0-9_-]{32,64})$/;

/** Clé de démonstration publique : lecture seule, comptes démo uniquement (Plomberie Martin, Paysia, Maison Sora). */
export const DEMO_API_KEY = 'rp_demo_lectureseule_DemonstrationRepereLectureSeule-Fictive2026';
export const DEMO_KEY_ID = 'lectureseule';

function pepper(): string {
  return process.env.PUBLIC_API_KEY_PEPPER || 'repere-public-api-v1';
}

export function hashSecret(id: string, secret: string): string {
  return crypto.createHmac('sha256', pepper()).update(`${id}.${secret}`).digest('hex');
}

/** Comparaison en temps constant de deux chaînes (longueurs différentes : comparées sur une empreinte fixe). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

function randomId(n = 12): string {
  const bytes = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return s;
}

export function generateKey(): { id: string; secret: string; token: string } {
  const id = randomId();
  const secret = crypto.randomBytes(32).toString('base64url');
  return { id, secret, token: `rp_live_${id}_${secret}` };
}

export function parseKey(token: string | null | undefined): { kind: 'live' | 'demo'; id: string; secret: string } | null {
  if (typeof token !== 'string' || token.length > 120) return null;
  const m = KEY_RE.exec(token.trim());
  return m ? { kind: m[1] as 'live' | 'demo', id: m[2], secret: m[3] } : null;
}

/** Valeur de la colonne `business_id` du store : l'espace, ou `agency:<utilisateur>` (liste par propriétaire). */
export function ownerRef(scope: KeyScope): string {
  return scope.kind === 'space' ? scope.businessId : `agency:${scope.userId}`;
}

export function toView(r: ApiKeyRecord): ApiKeyView {
  return {
    id: r.id,
    label: r.label,
    prefix: `rp_live_${r.id}_…`,
    last4: r.last4,
    access: r.access,
    scope: r.scope.kind,
    businessId: r.scope.kind === 'space' ? r.scope.businessId : null,
    createdAt: r.createdAt,
    createdBy: r.createdBy.email ?? null,
    lastUsedAt: r.lastUsedAt ?? null,
    revokedAt: r.revokedAt ?? null,
  };
}

export function cleanLabel(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  return s || 'Clé d’API';
}

export async function listApiKeys(scope: KeyScope): Promise<ApiKeyView[]> {
  const ref = ownerRef(scope);
  const docs = await listDocs<ApiKeyRecord>(KEYS_COLLECTION, { businessId: ref, limit: 200 });
  return docs
    .map((d) => d.data)
    .filter((r) => r && ownerRef(r.scope) === ref)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toView);
}

export interface CreateKeyInput {
  scope: KeyScope;
  access: KeyAccess;
  label?: string;
  createdBy: { userId: string; email?: string | null };
}

/** Crée une clé. Le jeton renvoyé n'est plus jamais lisible ensuite. */
export async function createApiKey(input: CreateKeyInput, now: Date = new Date()): Promise<{ key: ApiKeyView; token: string }> {
  if (input.access !== 'read' && input.access !== 'write') throw new ApiError(400, 'invalid_request', 'Droits invalides (lecture ou écriture).');
  const active = (await listApiKeys(input.scope)).filter((k) => !k.revokedAt);
  if (active.length >= MAX_ACTIVE_KEYS) throw new ApiError(409, 'conflict', `${MAX_ACTIVE_KEYS} clés actives au maximum : révoquez-en une avant d’en créer une autre.`);
  const { id, secret, token } = generateKey();
  const rec: ApiKeyRecord = {
    id,
    label: cleanLabel(input.label),
    hash: hashSecret(id, secret),
    last4: secret.slice(-4),
    access: input.access,
    scope: input.scope,
    createdAt: now.toISOString(),
    createdBy: { userId: input.createdBy.userId, email: input.createdBy.email ?? null },
    lastUsedAt: null,
    revokedAt: null,
  };
  await putDoc<ApiKeyRecord>(KEYS_COLLECTION, id, rec, ownerRef(input.scope));
  return { key: toView(rec), token };
}

/** Révoque une clé de ce propriétaire (espace ou agence). Faux si la clé n'existe pas ou appartient à un autre. */
export async function revokeApiKey(scope: KeyScope, id: string, by: string, now: Date = new Date()): Promise<boolean> {
  if (!/^[a-z0-9]{12}$/.test(id)) return false;
  const doc = await getDoc<ApiKeyRecord>(KEYS_COLLECTION, id);
  const r = doc?.data;
  if (!r || ownerRef(r.scope) !== ownerRef(scope)) return false;
  if (r.revokedAt) return true;
  await putDoc<ApiKeyRecord>(KEYS_COLLECTION, id, { ...r, revokedAt: now.toISOString(), revokedBy: by }, ownerRef(r.scope));
  return true;
}

export type VerifiedKey = { demo: true; id: typeof DEMO_KEY_ID } | { demo: false; id: string; record: ApiKeyRecord };

/**
 * Vérifie un jeton. null : absent, mal formé, inconnu, révoqué ou faux — sans distinguer les cas (pas d'oracle).
 */
export async function verifyApiKey(token: string | null | undefined): Promise<VerifiedKey | null> {
  const p = parseKey(token);
  if (!p) return null;
  if (p.kind === 'demo') return safeEqual(token!.trim(), DEMO_API_KEY) ? { demo: true, id: DEMO_KEY_ID } : null;
  const doc = await getDoc<ApiKeyRecord>(KEYS_COLLECTION, p.id).catch(() => null);
  const r = doc?.data;
  // Empreinte calculée même si la clé est inconnue : temps de réponse comparable.
  const got = hashSecret(p.id, p.secret);
  const ok = !!r && safeEqual(got, r.hash);
  if (!ok || !r || r.revokedAt || r.id !== p.id) return null;
  return { demo: false, id: r.id, record: r };
}

/** Note la dernière utilisation (au plus une écriture par minute et par clé). */
export async function touchKey(r: ApiKeyRecord, now: Date = new Date()): Promise<void> {
  const last = r.lastUsedAt ? Date.parse(r.lastUsedAt) : 0;
  if (now.getTime() - last < 60_000) return;
  const fresh = (await getDoc<ApiKeyRecord>(KEYS_COLLECTION, r.id))?.data;
  if (!fresh || fresh.revokedAt) return;
  await putDoc<ApiKeyRecord>(KEYS_COLLECTION, r.id, { ...fresh, lastUsedAt: now.toISOString() }, ownerRef(fresh.scope));
}
