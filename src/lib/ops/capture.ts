/**
 * Capture des erreurs serveur vers le stockage interne (src/lib/ops/errors.ts), sans dépendance.
 *
 * - `installServerCapture()` (appelé au démarrage par src/instrumentation-node.ts) : observe `console.error`.
 *   Couvre `log.error` / `captureError` (lignes JSON de src/lib/log.ts, qui partent déjà vers Sentry si SENTRY_DSN),
 *   les anciens `console.error('[webhook] …', e)` et ce que Next écrit lui-même. Le comportement de la console est
 *   inchangé (l'appel d'origine est toujours fait, en premier).
 * - `handleRequestError()` : branché sur `onRequestError` de Next 15 (src/instrumentation.ts) pour les erreurs de
 *   rendu, d'action serveur et de route ; journalise via `captureError` (donc Sentry si configuré).
 */
import { captureError } from '@/lib/log';
import { recordError, type ErrorInput, type ErrorSource } from './errors';

const g = globalThis as unknown as { __repereOpsCapture?: { installed: boolean; original?: typeof console.error } };
const cap = (g.__repereOpsCapture ??= { installed: false });

/** Origine déduite du nom d'événement du journal structuré. */
export function sourceOfEvent(event: string | undefined, message = ''): ErrorSource {
  const e = event ?? '';
  if (e.startsWith('client.')) return 'client';
  if (e.startsWith('job.') || e.startsWith('jobs.')) return 'job';
  if (e.startsWith('cron.') || e.includes('cron')) return 'cron';
  if (e.startsWith('stripe.') || e.includes('webhook') || /^\[webhook\]/.test(message)) return 'webhook';
  return 'server';
}

/** Convertit les arguments d'un `console.error` en erreur à enregistrer (null si rien d'exploitable). */
export function parseConsoleArgs(args: unknown[]): ErrorInput | null {
  if (!args.length) return null;
  const first = args[0];
  // Ligne JSON de src/lib/log.ts
  if (typeof first === 'string' && first.startsWith('{') && args.length === 1) {
    try {
      const o = JSON.parse(first) as { level?: string; event?: string; err?: { name?: string; message?: string; stack?: string }; route?: string; jobType?: string; digest?: string };
      if (o.level !== 'error') return null;
      const message = o.err?.message || o.event || 'erreur';
      return {
        source: sourceOfEvent(o.event, message),
        name: o.err?.name ?? 'Error',
        message: o.err ? message : `${o.event}`,
        stack: o.err?.stack,
        route: o.route ?? (o.jobType ? `job:${o.jobType}` : undefined),
        event: o.event,
        digest: o.digest,
      };
    } catch {
      /* texte libre commençant par « { » */
    }
  }
  const err = args.find((a): a is Error => a instanceof Error);
  const text = args
    .filter((a) => typeof a === 'string')
    .join(' ')
    .trim();
  if (!err && !text) return null;
  const prefix = /^\[([a-z0-9:_-]+)\]/i.exec(text)?.[1];
  return {
    source: sourceOfEvent(prefix ? `${prefix}.` : undefined, text),
    name: err?.name ?? 'ConsoleError',
    // Le message de l'erreur prime : la même erreur journalisée par Next et par onRequestError se dédoublonne.
    message: err?.message || text,
    stack: err?.stack,
    event: prefix ? `console.${prefix}` : undefined,
  };
}

/** Installe l'observation de `console.error` (une seule fois par processus). */
export function installServerCapture(): void {
  if (cap.installed) return;
  cap.installed = true;
  const original = console.error.bind(console);
  cap.original = original;
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const input = parseConsoleArgs(args);
      if (input) void recordError(input);
    } catch {
      /* jamais bloquant */
    }
  };
}

/** Tests : retire l'observation. */
export function uninstallServerCapture(): void {
  if (cap.installed && cap.original) console.error = cap.original;
  cap.installed = false;
}

interface RequestInfo {
  path?: string;
  method?: string;
}
interface ErrorContext {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
}

/** `onRequestError` de Next 15 : journal structuré (→ Sentry si SENTRY_DSN) + stockage interne. */
export async function handleRequestError(err: unknown, request: RequestInfo, context: ErrorContext): Promise<void> {
  try {
    const route = context.routePath ?? request.path;
    // captureError écrit une ligne JSON via console.error : l'observation ci-dessus l'enregistre (origine « server »).
    captureError(err, { event: `request.${context.routeType ?? 'error'}`, route, method: request.method, renderSource: context.renderSource, digest: (err as { digest?: string } | null)?.digest });
    if (!cap.installed) {
      const e = err instanceof Error ? err : new Error(String(err));
      await recordError({ source: 'server', name: e.name, message: e.message, stack: e.stack, route, digest: (e as { digest?: string }).digest });
    }
  } catch {
    /* jamais bloquant */
  }
}
