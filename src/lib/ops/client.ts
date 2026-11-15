/**
 * Remontée des erreurs du navigateur vers POST /api/ops/errors (même origine, aucune dépendance, aucun cookie lu).
 * Bornée : 5 envois par page au plus, doublons ignorés, aucun contenu de formulaire ni donnée saisie.
 *
 *   import { reportClientError } from '@/lib/ops/client';
 *   reportClientError(error, { boundary: 'app/ia' });      // dans un error.tsx
 *   <ClientErrorReporter />                                // erreurs non attrapées (window.onerror)
 */
const MAX_PER_PAGE = 5;
let sent = 0;
const seen = new Set<string>();

export interface ClientErrorPayload {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  url: string;
  boundary?: string;
  kind: 'boundary' | 'unhandled' | 'rejection';
}

export function buildClientPayload(err: unknown, extra: { boundary?: string; kind?: ClientErrorPayload['kind']; url?: string } = {}): ClientErrorPayload {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Erreur inconnue');
  const url = extra.url ?? (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  return {
    name: (e.name || 'Error').slice(0, 100),
    message: (e.message || 'Erreur inconnue').slice(0, 500),
    stack: e.stack?.split('\n').slice(0, 12).join('\n').slice(0, 3000),
    digest: (e as { digest?: string }).digest?.slice(0, 64),
    url: url.slice(0, 300),
    boundary: extra.boundary?.slice(0, 80),
    kind: extra.kind ?? 'boundary',
  };
}

export function reportClientError(err: unknown, extra: { boundary?: string; kind?: ClientErrorPayload['kind'] } = {}): void {
  try {
    if (typeof window === 'undefined' || sent >= MAX_PER_PAGE) return;
    const p = buildClientPayload(err, extra);
    const key = `${p.name}|${p.message}|${p.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    const body = JSON.stringify(p);
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/ops/errors', blob)) {
      void fetch('/api/ops/errors', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* jamais bloquant */
  }
}
