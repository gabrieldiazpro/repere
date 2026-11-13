/**
 * @/lib/auth — session serveur (cookies httpOnly), accès aux commerces, rôles (contrat docs/v3/12-CONTRATS-V3.md).
 *
 *   const { business, role } = await requireBusiness(req, businessId, { write: true });
 *   const session = await getSession(req);           // null si non connecté
 *   throw new HttpError(402, '…', 'upgrade_required'); // → toResponse(e)
 *
 * Modes (config.ts) : Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), « compte local de développement » sans
 * Supabase hors production (lien magique affiché dans la console), ou indisponible en production sans Supabase.
 */
export type { Role } from './roles';
export { ROLES, ROLE_LABEL, ROLE_RANK, HttpError, assignableRoles, hasRole, httpErrorResponse, isRole } from './roles';
export type { Session } from './session';
export { getSession, bearerToken, clearSessionCookies, setCookies } from './session';
export { requireBusiness, requireSession, BUSINESS_ID_RE, type BusinessAccess, type RequireOptions } from './access';
export { authMode, type AuthMode } from './config';
export { COOKIES, safeNext } from './cookies';

import { HttpError, httpErrorResponse } from './roles';

/** Convertit une erreur en réponse JSON : HttpError → son statut ; le reste → 500 journalisé. */
export function toResponse(e: unknown, where = 'api'): Response {
  if (e instanceof HttpError) return httpErrorResponse(e);
  console.error(`[${where}]`, e);
  return httpErrorResponse(new HttpError(500, 'Une erreur est survenue. Réessayez dans un instant.'));
}
