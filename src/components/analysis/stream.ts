/**
 * ANALYSE-UI — lecture du flux NDJSON de POST /api/v5/analysis et état de l'écran « analyse en cours ».
 * Pur (aucune dépendance React) : testé dans __tests__/stream.test.ts.
 */
import type { AnalysisEvent, Detection, FullAnalysis, ModuleId, ModuleStatus } from '@/lib/analysis/types';
import type { Severity } from '@/lib/crawl/types';
import type { Attribution } from '@/lib/roi/core';
import { currentAttribution } from '@/lib/roi/landing';

/** Lignes supplémentaires émises par la route (hors runFullAnalysis). */
export type RouteLine =
  | AnalysisEvent
  | { type: 'saved'; id: string; url: string; token: string; emailed?: boolean }
  | { type: 'cached'; id: string; at: string }
  | { type: 'error'; message: string };

export interface LiveFinding {
  source: 'seo' | 'geo' | 'ai';
  id: string;
  title: string;
  severity: Severity;
  t: number;
}

export interface LiveState {
  phase: 'running' | 'done' | 'error';
  id?: string;
  url?: string;
  budgetMs?: number;
  detection?: Detection;
  steps: Partial<Record<ModuleId, { status: 'running' | ModuleStatus; label: string; ms?: number; error?: string }>>;
  crawl: { fetched: number; queued: number; phase: string; current?: string; urls: string[] };
  findings: LiveFinding[];
  scores: { seo?: number; geo?: number; ai?: number };
  ai: { done: number; total: number; providers: string[]; last?: string };
  analysis?: FullAnalysis;
  saved?: { id: string; token: string };
  cached?: { at: string };
  error?: string;
  /** dernier temps serveur connu (ms depuis le début) */
  t: number;
}

export const MAX_MAP_URLS = 160;

export function initialLive(): LiveState {
  return { phase: 'running', steps: {}, crawl: { fetched: 0, queued: 0, phase: 'robots', urls: [] }, findings: [], scores: {}, ai: { done: 0, total: 0, providers: [] }, t: 0 };
}

const addUrl = (urls: string[], u: string | undefined) => (u && !urls.includes(u) && urls.length < MAX_MAP_URLS ? [...urls, u] : urls);

/** Applique un événement (immuable). Les événements inconnus sont ignorés. */
export function reduceLive(s: LiveState, e: RouteLine): LiveState {
  const t = 't' in e && typeof e.t === 'number' ? Math.max(s.t, e.t) : s.t;
  switch (e.type) {
    case 'start':
      return { ...s, id: e.id, url: e.url, budgetMs: e.budgetMs, t, crawl: { ...s.crawl, urls: addUrl(s.crawl.urls, e.url) } };
    case 'detected':
      return { ...s, detection: e.detection, t };
    case 'step':
      return { ...s, t, steps: { ...s.steps, [e.step]: { status: e.status, label: e.label, ...(e.ms != null ? { ms: e.ms } : {}), ...(e.error ? { error: e.error } : {}) } } };
    case 'crawl':
      return { ...s, t, crawl: { fetched: e.fetched, queued: e.queued, phase: e.phase, current: e.currentUrl ?? s.crawl.current, urls: [...(e.urls ?? []), e.currentUrl].reduce<string[]>((acc, u) => addUrl(acc, u), s.crawl.urls) } };
    case 'finding':
      if (s.findings.some((f) => f.id === e.id)) return { ...s, t };
      return { ...s, t, findings: [...s.findings, { source: e.source, id: e.id, title: e.title, severity: e.severity, t }] };
    case 'ai':
      return {
        ...s,
        t,
        ai: { done: e.done, total: e.total, last: e.provider ?? s.ai.last, providers: e.provider && !s.ai.providers.includes(e.provider) ? [...s.ai.providers, e.provider] : s.ai.providers },
      };
    case 'score':
      return { ...s, t, scores: { ...s.scores, [e.module]: e.score } };
    case 'result':
      return { ...s, t, analysis: e.analysis, phase: 'done' };
    case 'saved':
      return { ...s, saved: { id: e.id, token: e.token } };
    case 'cached':
      return { ...s, cached: { at: e.at } };
    case 'error':
      // Erreur après le résultat (sauvegarde impossible) : on garde le rapport, sans lien de partage.
      return s.analysis ? { ...s, error: e.message } : { ...s, error: e.message, phase: 'error' };
    default:
      return s;
  }
}

/** Découpe un flux d'octets en objets JSON (une ligne = un objet ; lignes invalides ignorées). */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<RouteLine> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        const obj = parseLine(line);
        if (obj) yield obj;
      }
      if (done) break;
    }
    const last = parseLine(buf.trim());
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

function parseLine(line: string): RouteLine | null {
  if (!line) return null;
  try {
    const o = JSON.parse(line) as RouteLine;
    return o && typeof o === 'object' && typeof o.type === 'string' ? o : null;
  } catch {
    return null;
  }
}

export interface StartBody {
  url: string;
  pro: true;
  brand?: string;
  city?: string;
  siteType?: 'local' | 'pme' | 'ecommerce';
  email?: string;
  fresh?: boolean;
  hp?: string;
  /** origine de la visite (première page / UTM, sans cookie : src/lib/roi/landing.ts) ; ajoutée si absente */
  attribution?: Attribution | null;
}

export type StartFailure = { ok: false; status: number; error: string; fields?: Record<string, string>; retryAfterS?: number };

/**
 * Lance l'analyse. Succès : itère les lignes du flux via `onLine`. Échec avant le flux (400, 429, 503…) : renvoie
 * l'erreur lisible (et le délai d'attente si la route le donne).
 */
export async function startAnalysis(
  body: StartBody,
  onLine: (l: RouteLine) => void,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<{ ok: true } | StartFailure> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f('/api/v5/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body.attribution !== undefined ? body : { ...body, attribution: currentAttribution() ?? undefined }), signal: opts.signal });
  } catch {
    if (opts.signal?.aborted) return { ok: false, status: 0, error: 'Analyse annulée.' };
    return { ok: false, status: 0, error: 'Connexion impossible. Vérifiez votre réseau, puis relancez l’analyse.' };
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok || !/ndjson/.test(ct) || !res.body) {
    let data: { error?: string; fields?: Record<string, string> } = {};
    try {
      data = (await res.json()) as typeof data;
    } catch {
      /* corps vide */
    }
    const ra = Number(res.headers.get('retry-after'));
    return {
      ok: false,
      status: res.status,
      error: data.error || (res.status === 429 ? 'Trop d’analyses lancées récemment.' : 'L’analyse n’a pas pu démarrer. Réessayez dans un instant.'),
      ...(data.fields ? { fields: data.fields } : {}),
      ...(Number.isFinite(ra) && ra > 0 ? { retryAfterS: ra } : {}),
    };
  }
  try {
    for await (const line of readNdjson(res.body)) onLine(line);
  } catch {
    if (!opts.signal?.aborted) onLine({ type: 'error', message: 'La connexion a été coupée pendant l’analyse. Relancez-la : les pages déjà vues seront relues.' });
  }
  return { ok: true };
}

/** « dans 12 min », « dans 1 h » : délai d'attente lisible. */
export function waitLabel(seconds: number): string {
  if (seconds < 90) return 'dans une minute';
  const m = Math.ceil(seconds / 60);
  if (m < 60) return `dans ${m} min`;
  const h = Math.round(m / 60);
  return `dans ${h} h`;
}
