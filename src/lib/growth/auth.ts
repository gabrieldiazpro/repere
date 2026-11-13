/**
 * Autorisation du module CROISSANCE : délègue directement à @/lib/auth (agent COMPTES).
 * `errorResponse` convertit HttpError en réponse JSON (statut propre), tout le reste en 500 générique journalisé.
 */
import { toResponse } from '@/lib/auth';

export { requireBusiness, HttpError } from '@/lib/auth';
export type { Role } from '@/lib/auth';

export function errorResponse(e: unknown, tag: string): Response {
  return toResponse(e, `api/growth/${tag}`);
}
