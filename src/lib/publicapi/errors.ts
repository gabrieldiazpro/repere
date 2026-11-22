/**
 * Erreurs de l'API publique : un seul format, stable, documenté dans l'OpenAPI (schéma `Error`).
 *
 *   { "error": { "code": "not_found", "message": "Espace introuvable.", "status": 404, "requestId": "req_…", "docs": "…" } }
 *
 * Les messages sont en français (vouvoiement), les codes en anglais (stables, pour les programmes).
 */
import { HttpError } from '@/lib/auth/roles';

export const ERROR_CODES = [
  'invalid_request',
  'unauthorized',
  'forbidden',
  'insufficient_scope',
  'plan_required',
  'quota_exceeded',
  'demo_read_only',
  'not_found',
  'method_not_allowed',
  'conflict',
  'rate_limited',
  'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const DOCS_URL = '/developpeurs';

/** Convertit toute erreur (HttpError des modules internes comprise) en ApiError, sans fuite de détail interne. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpError) {
    const s = e.status;
    const code: ErrorCode =
      e.code === 'demo_read_only'
        ? 'demo_read_only'
        : e.code === 'quota_exceeded'
          ? 'quota_exceeded'
          : s === 400
            ? 'invalid_request'
            : s === 401
              ? 'unauthorized'
              : s === 402
                ? 'plan_required'
                : s === 403
                  ? 'forbidden'
                  : s === 404
                    ? 'not_found'
                    : s === 409
                      ? 'conflict'
                      : s === 429
                        ? 'rate_limited'
                        : 'internal_error';
    const status = code === 'internal_error' ? 500 : s;
    // Les messages des modules internes sont déjà rédigés pour le client (français, sans détail technique).
    return new ApiError(status, code, status >= 500 ? 'Une erreur est survenue. Réessayez dans un instant.' : e.message || 'Requête refusée.');
  }
  return new ApiError(500, 'internal_error', 'Une erreur est survenue. Réessayez dans un instant.');
}

export function errorBody(e: ApiError, requestId: string): Record<string, unknown> {
  return {
    error: {
      code: e.code,
      message: e.message,
      status: e.status,
      requestId,
      docs: DOCS_URL,
      ...(e.details ? { details: e.details } : {}),
    },
  };
}
