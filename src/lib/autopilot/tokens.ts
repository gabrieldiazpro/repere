/**
 * Liens signés des e-mails du pilote : « Annuler cette série » et « Bloquer ce contenu », utilisables sans se connecter
 * (le client agit depuis sa boîte mail). Jeton = base64url(JSON {b, k, r, e}) + '.' + HMAC-SHA256. Le lien ouvre une
 * page de confirmation (jamais d'action sur un simple GET : les antivirus de messagerie ouvrent les liens).
 * Secret : AUTOPILOT_SIGNING_SECRET, sinon DIGEST_SIGNING_SECRET / AUDIT_SIGNING_SECRET (obligatoire en production).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl } from '@/lib/email';

export type TokenKind = 'undo' | 'block' | 'pause';
/** Validité : 30 jours (une série reste annulable plus longtemps depuis l'application). */
export const TOKEN_TTL_S = 30 * 86_400;

function secret(): string {
  const s = process.env.AUTOPILOT_SIGNING_SECRET || process.env.DIGEST_SIGNING_SECRET || process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTOPILOT_SIGNING_SECRET manquant');
  return 'dev-only-autopilot-secret';
}

const mac = (payload: string) => createHmac('sha256', secret()).update(`autopilot|${payload}`).digest('base64url');

export interface ActionToken {
  businessId: string;
  kind: TokenKind;
  /** série (cs_…) ou contenu (ct_…) ; vide pour une pause */
  ref: string;
  exp: number;
}

export function signActionToken(businessId: string, kind: TokenKind, ref: string, ttlS = TOKEN_TTL_S, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ b: businessId, k: kind, r: ref, e: Math.floor(now / 1000) + ttlS })).toString('base64url');
  return `${payload}.${mac(payload)}`;
}

export function verifyActionToken(token: string | null | undefined, now = Date.now()): ActionToken | null {
  if (!token || token.length > 800) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { b?: unknown; k?: unknown; r?: unknown; e?: unknown };
    if (typeof p.b !== 'string' || typeof p.r !== 'string' || typeof p.e !== 'number') return null;
    if (p.k !== 'undo' && p.k !== 'block' && p.k !== 'pause') return null;
    if (p.e * 1000 < now) return null;
    return { businessId: p.b, kind: p.k, ref: p.r, exp: p.e };
  } catch {
    return null;
  }
}

/** Page de confirmation publique (noindex) qui exécute l'action après un clic. */
export function actionUrl(businessId: string, kind: TokenKind, ref = ''): string {
  return `${appUrl()}/pilote/action?t=${encodeURIComponent(signActionToken(businessId, kind, ref))}`;
}
