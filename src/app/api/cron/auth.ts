import { timingSafeEqual } from 'node:crypto';

/**
 * Crons et worker : `Authorization: Bearer <CRON_SECRET>` (Vercel Cron l'envoie automatiquement, pg_cron le pose
 * dans ses en-têtes). Sans secret : appel libre hors production uniquement.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
