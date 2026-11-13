import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_SIGNING_SECRET manquant');
  return 'dev-only-signing-secret'; // mode démo / local uniquement
}

/** Jeton d'accès au plan d'action : HMAC-SHA256 hex de l'identifiant d'audit. */
export function signPlanToken(auditId: string): string {
  return createHmac('sha256', secret()).update(auditId).digest('hex');
}

export function verifyPlanToken(auditId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  let expected: Buffer;
  try { expected = Buffer.from(signPlanToken(auditId), 'hex'); } catch { return false; }
  const given = Buffer.from(token, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
