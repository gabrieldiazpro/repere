import { timingSafeEqual } from 'node:crypto';

/** Compare un jeton à ADMIN_TOKEN (temps constant). Faux si ADMIN_TOKEN n'est pas défini. */
export function isAdminToken(token: string | undefined | null): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Requête émise par l'admin ou un script de prospection : en-tête x-admin-token ou cookie admin_token. */
export function isAdminRequest(req: Request): boolean {
  if (isAdminToken(req.headers.get('x-admin-token'))) return true;
  const m = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') || '');
  return m ? isAdminToken(decodeURIComponent(m[1])) : false;
}
