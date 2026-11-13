/**
 * Liens signés du digest (« C'est fait » cliquable depuis l'e-mail).
 * Jeton = base64url(JSON {b: businessId, t: taskId, e: expiration s}) + '.' + HMAC-SHA256 (base64url).
 * Secret : DIGEST_SIGNING_SECRET, sinon AUDIT_SIGNING_SECRET (obligatoire en production).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl } from '@/lib/email';

/** Validité du lien « C'est fait » : 14 jours (deux digests). */
export const DONE_TOKEN_TTL_S = 14 * 86_400;
const DEFAULT_TTL_S = DONE_TOKEN_TTL_S;

function secret(): string {
  const s = process.env.DIGEST_SIGNING_SECRET || process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('DIGEST_SIGNING_SECRET manquant');
  return 'dev-only-digest-secret';
}

const mac = (payload: string) => createHmac('sha256', secret()).update(`digest-done|${payload}`).digest('base64url');

export interface DonePayload {
  businessId: string;
  taskId: string;
  exp: number; // secondes epoch
}

export function signDoneToken(businessId: string, taskId: string, ttlS = DEFAULT_TTL_S, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ b: businessId, t: taskId, e: Math.floor(now / 1000) + ttlS })).toString('base64url');
  return `${payload}.${mac(payload)}`;
}

export function verifyDoneToken(token: string | null | undefined, now = Date.now()): DonePayload | null {
  if (!token || token.length > 600) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { b?: unknown; t?: unknown; e?: unknown };
    if (typeof p.b !== 'string' || typeof p.t !== 'string' || typeof p.e !== 'number') return null;
    if (p.e * 1000 < now) return null;
    return { businessId: p.b, taskId: p.t, exp: p.e };
  } catch {
    return null;
  }
}

export function doneUrl(businessId: string, taskId: string): string {
  return `${appUrl()}/api/digest/done?token=${encodeURIComponent(signDoneToken(businessId, taskId))}`;
}
