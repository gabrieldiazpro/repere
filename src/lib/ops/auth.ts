import { timingSafeEqual } from 'node:crypto';
import { isAdminRequest } from '@/lib/adminAuth';

/** `Authorization: Bearer <CRON_SECRET>` (comparaison en temps constant). Faux sans CRON_SECRET. */
export function hasCronBearer(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Routes d'exploitation : Bearer CRON_SECRET, ou admin (en-tête x-admin-token / cookie admin_token = ADMIN_TOKEN). */
export function opsAuthorized(req: Request): boolean {
  return hasCronBearer(req) || isAdminRequest(req);
}

/** Formulaires de /admin/ops : même origine exigée en plus du cookie admin (pas de requête intersite). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // formulaires anciens / outils : le cookie SameSite protège déjà
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}
