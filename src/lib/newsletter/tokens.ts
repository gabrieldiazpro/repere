/**
 * Jetons signés (HMAC-SHA256) de la lettre mensuelle et des ressources : confirmation d'inscription (double opt-in),
 * désinscription en un clic, accès au guide téléchargé. Le but de chaque jeton fait partie du message signé : un jeton
 * de désinscription ne confirme pas une inscription, et inversement.
 *
 * Secret : NEWSLETTER_SECRET, sinon UNSUBSCRIBE_SECRET (déjà exigé en production par src/lib/email.ts).
 */
import crypto from 'node:crypto';

export type TokenPurpose = 'nl-confirm' | 'nl-unsub' | 'res-guide-2027';

function secret(): string {
  const s = process.env.NEWSLETTER_SECRET || process.env.UNSUBSCRIBE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('NEWSLETTER_SECRET (ou UNSUBSCRIBE_SECRET) manquant');
  return 'repere-dev-newsletter'; // dev / démo uniquement
}

export const normEmail = (email: string) => email.trim().toLowerCase();

export function signToken(purpose: TokenPurpose, email: string): string {
  return crypto.createHmac('sha256', secret()).update(`${purpose}:${normEmail(email)}`).digest('base64url').slice(0, 32);
}

export function verifyToken(purpose: TokenPurpose, email: string, token: string | null | undefined): boolean {
  if (!email || !token) return false;
  const expected = Buffer.from(signToken(purpose, email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Identifiant stable et non réversible d'une adresse (clé de stockage, dédoublonnage). */
export function emailId(email: string): string {
  return crypto.createHash('sha256').update(normEmail(email)).digest('hex').slice(0, 32);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && EMAIL_RE.test(v.trim());
