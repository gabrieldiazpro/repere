import { assertSameOrigin } from '@/lib/auth/http';
import { isAdmin } from '../data';

/** Cookie admin HttpOnly (jamais de jeton en paramètre d'URL). */
export function adminFromRequest(req: Request): boolean {
  const m = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') || '');
  return isAdmin(m ? decodeURIComponent(m[1]) : null);
}

/**
 * Même origine. Les pages /admin sont servies avec « Referrer-Policy: no-referrer » : Chrome envoie alors
 * « Origin: null » sur un formulaire POST de même origine ; accepté seulement avec Sec-Fetch-Site: same-origin.
 */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get('origin') === 'null') return req.headers.get('sec-fetch-site') === 'same-origin';
  try {
    assertSameOrigin(req);
    return true;
  } catch {
    return false;
  }
}
