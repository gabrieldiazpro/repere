/**
 * Journal structuré (une ligne JSON par événement) et point d'accroche d'erreurs compatible Sentry.
 *
 * - `log.info|warn|error(event, fields)` : JSON sur stdout/stderr, lisible par Vercel, Better Stack, Datadog…
 *   Les adresses e-mail et les jetons sont masqués avant écriture.
 * - `captureError(err, ctx)` : journalise et, si `SENTRY_DSN` est défini, envoie l'événement à Sentry par HTTP
 *   (protocole « envelope », sans SDK ni dépendance). Ne lève jamais, ne bloque jamais plus de 2 s.
 * - `withRequest(req)` : journal enfant portant l'identifiant de requête (`x-vercel-id` ou `x-request-id`).
 *
 * Fichier serveur (utilise fetch et crypto) ; aucune dépendance.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const v = (process.env.LOG_LEVEL ?? '').toLowerCase() as LogLevel;
  if (v in LEVELS) return LEVELS[v];
  return process.env.VITEST ? LEVELS.warn : LEVELS.info;
}

// ---------------------------------------------------------------------------
// Masquage
// ---------------------------------------------------------------------------

const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const SECRET_KEY_RE = /(pass(word)?|secret|token|authorization|api[-_]?key|cookie|dsn|signature)/i;
const BEARER_RE = /\b(Bearer\s+|sk_(live|test)_|rk_live_|whsec_|re_)[A-Za-z0-9._-]{6,}/g;

/** Masque e-mails (`j***@domaine.fr`) et jetons dans une chaîne. */
export function redactString(s: string): string {
  return s.replace(EMAIL_RE, '$1***@$2').replace(BEARER_RE, (m) => `${m.slice(0, 6)}…[masqué]`);
}

/** Copie profonde (bornée) en masquant les champs sensibles. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[profondeur]';
  if (typeof value === 'string') return redactString(value.length > 4000 ? `${value.slice(0, 4000)}…` : value);
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) && v != null && v !== '' ? '[masqué]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function serializeError(e: unknown): { name: string; message: string; stack?: string; status?: number } {
  if (e instanceof Error) {
    const status = (e as { status?: unknown }).status;
    return {
      name: e.name,
      message: redactString(e.message),
      stack: e.stack ? redactString(e.stack.split('\n').slice(0, 12).join('\n')) : undefined,
      ...(typeof status === 'number' ? { status } : {}),
    };
  }
  return { name: 'NonError', message: redactString(typeof e === 'string' ? e : safeJson(e)) };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

type Sink = (level: LogLevel, line: string) => void;
let sink: Sink = (level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

/** Tests : capture des lignes écrites. Renvoie une fonction de restauration. */
export function setLogSink(s: Sink): () => void {
  const prev = sink;
  sink = s;
  return () => {
    sink = prev;
  };
}

function write(level: LogLevel, event: string, fields: LogFields = {}, base: LogFields = {}): void {
  if (LEVELS[level] < minLevel()) return;
  const entry = {
    t: new Date().toISOString(),
    level,
    event,
    ...(redact({ ...base, ...fields }) as LogFields),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  };
  sink(level, safeJson(entry));
}

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  /** `err` est sérialisé (nom, message, pile masquée) puis transmis à Sentry si configuré. */
  error(event: string, err?: unknown, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

function makeLogger(base: LogFields): Logger {
  return {
    debug: (e, f) => write('debug', e, f, base),
    info: (e, f) => write('info', e, f, base),
    warn: (e, f) => write('warn', e, f, base),
    error: (e, err, f) => {
      write('error', e, { ...f, ...(err !== undefined ? { err: serializeError(err) } : {}) }, base);
      if (err !== undefined) void sendToSentry(err, { event: e, ...base, ...f });
    },
    child: (f) => makeLogger({ ...base, ...f }),
  };
}

export const log: Logger = makeLogger({});

/** Journal enfant portant l'identifiant de requête Vercel (ou x-request-id) et la route. */
export function withRequest(req: Request, fields: LogFields = {}): Logger {
  let route: string | undefined;
  try {
    route = new URL(req.url).pathname;
  } catch {
    /* url relative */
  }
  const requestId = req.headers.get('x-vercel-id') ?? req.headers.get('x-request-id') ?? undefined;
  return log.child({ requestId, route, ...fields });
}

/** Journalise une erreur et l'envoie à Sentry (si `SENTRY_DSN`). Ne lève jamais. */
export function captureError(err: unknown, ctx: LogFields & { event?: string } = {}): void {
  const { event = 'error.captured', ...rest } = ctx;
  log.error(event, err, rest);
}

// ---------------------------------------------------------------------------
// Sentry par HTTP (envelope) — https://develop.sentry.dev/sdk/envelopes/
// ---------------------------------------------------------------------------

export interface ParsedDsn {
  publicKey: string;
  host: string;
  protocol: string;
  path: string;
  projectId: string;
  envelopeUrl: string;
}

export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.split('/').filter(Boolean).pop();
    if (!u.username || !projectId) return null;
    const prefix = u.pathname.slice(0, u.pathname.lastIndexOf('/'));
    return {
      publicKey: u.username,
      host: u.host,
      protocol: u.protocol.replace(':', ''),
      path: prefix,
      projectId,
      envelopeUrl: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Construit l'enveloppe Sentry (exportée pour les tests). */
export function buildSentryEnvelope(err: unknown, ctx: LogFields, dsn: string): { body: string; eventId: string } {
  const e = serializeError(err);
  const eventId = randomHex(16);
  const frames = (e.stack ?? '')
    .split('\n')
    .slice(1)
    .map((l) => ({ function: l.trim().replace(/^at\s+/, '').slice(0, 200) }))
    .reverse();
  const tags: Record<string, string> = {};
  for (const k of ['event', 'jobType', 'route', 'businessId'] as const) {
    if (typeof ctx[k] === 'string') tags[k] = ctx[k] as string;
  }
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'repere',
    server_name: process.env.VERCEL_REGION ?? 'local',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tags,
    extra: redact(ctx),
    exception: { values: [{ type: e.name, value: e.message, stacktrace: frames.length ? { frames } : undefined }] },
  };
  const header = { event_id: eventId, sent_at: new Date().toISOString(), dsn };
  const payload = safeJson(event);
  const body = `${safeJson(header)}\n${safeJson({ type: 'event', length: new TextEncoder().encode(payload).length })}\n${payload}\n`;
  return { body, eventId };
}

async function sendToSentry(err: unknown, ctx: LogFields): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  const parsed = parseDsn(dsn);
  if (!parsed || !dsn) return;
  try {
    const { body } = buildSentryEnvelope(err, ctx, dsn);
    await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=repere-log/1.0`,
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* Sentry injoignable : le journal suffit */
  }
}
