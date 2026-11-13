import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton opaque (144 bits, base64url, 24 caractères) : non devinable, révocable en le remplaçant. */
export function generateToken(bytes = 18): string {
  return randomBytes(bytes).toString('base64url');
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Comparaison à temps constant. Refuse tout jeton mal formé ou vide. */
export function verifyToken(expected: string | null | undefined, given: string | null | undefined): boolean {
  if (!expected || !given || !TOKEN_RE.test(given) || !TOKEN_RE.test(expected)) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
}

/** Code de parrainage lisible : 8 caractères sans voyelles ni signes ambigus (REP-XXXXXXXX). */
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';
export function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `REP-${s}`;
}
export const REFERRAL_CODE_RE = /^REP-[BCDFGHJKLMNPQRSTVWXZ2-9]{8}$/;

/** Slug d'URL : minuscules, sans accents, tirets. Sert aux couples métier/ville du classement. */
export function slugify(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
