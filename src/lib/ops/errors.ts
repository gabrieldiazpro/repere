/**
 * Stockage interne des erreurs, regroupées par signature (collection `ops.errors` du store).
 *
 * Une signature = hachage de (origine, nom, message normalisé, route) : les nombres, identifiants, adresses et URL
 * variables sont remplacés pour que « audit 8f3a… introuvable » et « audit 91bc… introuvable » forment un seul groupe.
 * Chaque groupe garde le compte, la première et la dernière occurrence, la dernière pile (masquée).
 * Un compteur horaire (`ops.errcount`, id `h:AAAA-MM-JJTHH`) sert à détecter les pics.
 *
 * Jamais bloquant : `recordError` ne lève jamais, se protège de la récursion (une erreur du store pendant
 * l'enregistrement d'une erreur) et limite les écritures par instance (tempête d'erreurs).
 */
import { createHash } from 'node:crypto';
import { getDoc, incrDoc, listDocs, putDoc } from '@/lib/store';
import { redactString } from '@/lib/log';
import { OPS, parisHour } from './config';

export type ErrorSource = 'server' | 'client' | 'job' | 'webhook' | 'cron';

export interface ErrorInput {
  source: ErrorSource;
  name?: string;
  message: string;
  stack?: string;
  route?: string;
  event?: string;
  digest?: string;
}

export interface ErrorGroup {
  signature: string;
  source: ErrorSource;
  name: string;
  message: string;
  route: string | null;
  event: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
  lastStack: string | null;
  lastDigest: string | null;
  release: string | null;
}

/** Remplace ce qui varie d'une occurrence à l'autre (identifiants, nombres, URL, adresses). */
export function normalizeMessage(m: string): string {
  return redactString(m)
    .replace(/https?:\/\/[^\s"')]+/g, '<url>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<id>')
    .replace(/[A-Za-z0-9._%+-]+\*{3}@[A-Za-z0-9.-]+/g, '<email>')
    .replace(/\d+(?:[.,]\d+)?/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Route sans paramètres variables (`/r/abc123` → `/r/<id>`), sans requête. */
export function normalizeRoute(r: string | undefined | null): string | null {
  if (!r) return null;
  let p = r;
  try {
    p = new URL(r, 'http://x').pathname;
  } catch {
    /* déjà un chemin */
  }
  return p
    .split('/')
    .map((s) => (/^\[.+\]$/.test(s) ? s : /\d/.test(s) && s.length >= 6 ? '<id>' : s))
    .join('/')
    .slice(0, 200);
}

export function errorSignature(e: Pick<ErrorInput, 'source' | 'name' | 'message' | 'route'>): string {
  const basis = [e.source, e.name ?? 'Error', normalizeMessage(e.message), normalizeRoute(e.route) ?? ''].join('|');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Garde-fous par instance
// ---------------------------------------------------------------------------

const g = globalThis as unknown as {
  __repereOpsErr?: { busy: boolean; windowStart: number; writes: number; dropped: number; recent: Map<string, number> };
};
const st = (g.__repereOpsErr ??= { busy: false, windowStart: 0, writes: 0, dropped: 0, recent: new Map() });

const MAX_WRITES_PER_MIN = 60;
const DEDUPE_MS = 3000;

/** Clé de dédoublonnage indépendante de l'origine (Next journalise parfois la même erreur que `onRequestError`). */
function dedupeKey(e: ErrorInput): string {
  return `${e.name ?? 'Error'}|${normalizeMessage(e.message)}`;
}

/** Tests : remet les garde-fous à zéro. */
export function resetErrorGuards(): void {
  st.busy = false;
  st.windowStart = 0;
  st.writes = 0;
  st.dropped = 0;
  st.recent.clear();
}

/** Erreurs ignorées par cette instance (tempête) depuis son démarrage. */
export function droppedErrors(): number {
  return st.dropped;
}

/**
 * Enregistre une occurrence. Renvoie la signature, ou null si ignorée (doublon immédiat, récursion, tempête).
 */
export async function recordError(input: ErrorInput, now: Date = new Date()): Promise<string | null> {
  if (st.busy) return null;
  const t = now.getTime();
  const dk = dedupeKey(input);
  const seen = st.recent.get(dk);
  if (seen !== undefined && t - seen < DEDUPE_MS) return null;
  st.recent.set(dk, t);
  if (st.recent.size > 500) st.recent.clear();
  if (t - st.windowStart > 60_000) {
    st.windowStart = t;
    st.writes = 0;
  }
  if (st.writes >= MAX_WRITES_PER_MIN) {
    st.dropped += 1;
    return null;
  }
  st.writes += 1;
  st.busy = true;
  try {
    const signature = errorSignature(input);
    const iso = now.toISOString();
    const prev = (await getDoc<ErrorGroup>(OPS.errors, signature))?.data;
    const group: ErrorGroup = {
      signature,
      source: input.source,
      name: (input.name ?? 'Error').slice(0, 100),
      message: redactString(input.message).slice(0, 500),
      route: normalizeRoute(input.route),
      event: input.event?.slice(0, 100) ?? prev?.event ?? null,
      count: (prev?.count ?? 0) + 1,
      firstAt: prev?.firstAt ?? iso,
      lastAt: iso,
      lastStack: input.stack ? redactString(input.stack.split('\n').slice(0, 12).join('\n')).slice(0, 3000) : (prev?.lastStack ?? null),
      lastDigest: input.digest?.slice(0, 64) ?? prev?.lastDigest ?? null,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? prev?.release ?? null,
    };
    await putDoc(OPS.errors, signature, group);
    await incrDoc(OPS.errorCount, `h:${parisHour(now)}`, { n: 1, [input.source]: 1 });
    return signature;
  } catch {
    return null; // le store est en panne : le journal (stdout) garde la trace
  } finally {
    st.busy = false;
  }
}

/** Groupes d'erreurs, les plus récents d'abord. */
export async function listErrorGroups(limit = 50): Promise<ErrorGroup[]> {
  const docs = await listDocs<ErrorGroup>(OPS.errors, { limit: Math.min(500, limit) });
  return docs.map((d) => d.data).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Erreurs de l'heure en cours et de l'heure précédente (fenêtre glissante approximative d'une à deux heures). */
export async function errorsLastHour(now: Date = new Date()): Promise<{ current: number; previous: number }> {
  const read = async (d: Date) => (await getDoc<{ n?: number }>(OPS.errorCount, `h:${parisHour(d)}`))?.data.n ?? 0;
  const [current, previous] = await Promise.all([read(now), read(new Date(now.getTime() - 3600_000))]);
  return { current, previous };
}

/** Erreurs des 24 dernières heures (somme des compteurs horaires). */
export async function errorsLast24h(now: Date = new Date()): Promise<number> {
  const ids = Array.from({ length: 24 }, (_, i) => `h:${parisHour(new Date(now.getTime() - i * 3600_000))}`);
  const vals = await Promise.all(ids.map(async (id) => (await getDoc<{ n?: number }>(OPS.errorCount, id))?.data.n ?? 0));
  return vals.reduce((a, b) => a + b, 0);
}
