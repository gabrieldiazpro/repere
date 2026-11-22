/**
 * Pagination par curseur opaque (`cursor` + `limit`), identique sur toutes les listes de l'API publique.
 * Réponse : { data: [...], pagination: { limit, total, hasMore, nextCursor } }.
 * Le curseur encode une position ; il est lié au chemin pour qu'un curseur d'une liste ne serve pas sur une autre.
 */
import crypto from 'node:crypto';
import { ApiError } from './errors';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface Page {
  limit: number;
  offset: number;
  scope: string;
}

export interface Pagination {
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

function tag(scope: string): string {
  return crypto.createHash('sha256').update(scope).digest('base64url').slice(0, 6);
}

export function encodeCursor(offset: number, scope: string): string {
  return Buffer.from(`${tag(scope)}.${offset}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string, scope: string): number {
  let raw = '';
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    raw = '';
  }
  const m = /^([A-Za-z0-9_-]{6})\.(\d{1,7})$/.exec(raw);
  if (!m || m[1] !== tag(scope)) throw new ApiError(400, 'invalid_request', 'Curseur de pagination invalide : reprenez « nextCursor » tel que renvoyé par la page précédente.');
  return Number(m[2]);
}

export function parsePage(q: URLSearchParams, scope: string): Page {
  const rawLimit = q.get('limit');
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!/^\d{1,3}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > MAX_LIMIT) {
      throw new ApiError(400, 'invalid_request', `« limit » doit être un entier entre 1 et ${MAX_LIMIT}.`);
    }
    limit = Number(rawLimit);
  }
  const cursor = q.get('cursor');
  return { limit, offset: cursor ? decodeCursor(cursor, scope) : 0, scope };
}

export function paginate<T>(items: T[], page: Page): { data: T[]; pagination: Pagination } {
  const data = items.slice(page.offset, page.offset + page.limit);
  const next = page.offset + page.limit;
  const hasMore = next < items.length;
  return { data, pagination: { limit: page.limit, total: items.length, hasMore, nextCursor: hasMore ? encodeCursor(next, page.scope) : null } };
}
