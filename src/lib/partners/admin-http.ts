/** Contrôles des formulaires admin (/admin/partenaires/**) : cookie admin HttpOnly et même origine. Serveur. */
import { assertSameOrigin } from '@/lib/auth/http';
import { isAdminToken } from '@/lib/adminAuth';

/** Même origine ; les pages /admin sont en « no-referrer » : Chrome envoie « Origin: null », accepté seulement si Sec-Fetch-Site: same-origin. */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get('origin') === 'null') return req.headers.get('sec-fetch-site') === 'same-origin';
  try {
    assertSameOrigin(req);
    return true;
  } catch {
    return false;
  }
}

export function adminCookie(req: Request): boolean {
  const token = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') || '')?.[1];
  return isAdminToken(token ? decodeURIComponent(token) : null);
}

/** « 120,50 » → 120.5 */
export const formNumber = (v: FormDataEntryValue | null | undefined) => Number(String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'));
