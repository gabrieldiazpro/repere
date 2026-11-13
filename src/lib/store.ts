/**
 * Store de documents générique pour les modules V2 (sources, vérité, tâches, tracking, copilote, digest…).
 *
 * - Avec Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) : table `documents`
 *   (voir supabase/schema.sql, section V2) — colonnes collection, id, business_id, data jsonb, created_at, updated_at.
 * - Sinon (démo / dev) : mémoire persistée dans `.data/doc-<collection>.json`.
 *
 * Chaque module V2 possède ses collections (préfixe = nom du module, ex. `exec.tasks`, `track.daily`).
 * Ne pas utiliser pour les données V1 déjà gérées par src/lib/db.ts.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { log } from './log';

export interface StoredDoc<T = unknown> {
  id: string;
  collection: string;
  businessId: string | null;
  data: T;
  createdAt: string;
  updatedAt: string;
}

export interface ListOptions {
  businessId?: string;
  limit?: number;
  /** tri par date de mise à jour (défaut : décroissant) */
  order?: 'asc' | 'desc';
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseOn = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return _sb;
}

type Coll = Record<string, StoredDoc>;
const g = globalThis as unknown as { __repereDocs?: Map<string, Promise<Coll>>; __repereDocsDir?: string };
const colls = (g.__repereDocs ??= new Map());
const chains = new Map<string, Promise<void>>();

function dir(): string {
  return g.__repereDocsDir || process.env.DATA_DIR || path.join(process.cwd(), '.data');
}
function file(c: string) {
  return path.join(dir(), `doc-${c.replace(/[^a-z0-9._-]/gi, '_')}.json`);
}
/**
 * Écriture atomique : fichier temporaire unique dans le même dossier, puis rename (atomique sur un même volume).
 * Un lecteur concurrent voit l'ancien contenu complet ou le nouveau, jamais un fichier tronqué.
 */
export async function writeFileAtomic(target: string, body: string): Promise<void> {
  const tmp = `${target}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await fs.writeFile(tmp, body, 'utf8');
    await fs.rename(tmp, target);
  } catch (e) {
    await fs.unlink(tmp).catch(() => undefined);
    throw e;
  }
}

/**
 * Lecture protégée d'un fichier JSON : absent → `fallback` ; vide, tronqué ou illisible → `fallback` + journal,
 * et le fichier abîmé est mis de côté (`.corrupt-<horodatage>`) pour ne pas être écrasé sans trace.
 */
export async function readJsonSafe<T>(target: string, fallback: () => T, scope = 'store'): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(target, 'utf8');
  } catch {
    return fallback(); // absent
  }
  if (!raw.trim()) {
    log.warn(`${scope}.json_empty`, { file: path.basename(target) });
    return fallback();
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    log.warn(`${scope}.json_corrupt`, { file: path.basename(target), bytes: raw.length, error: e instanceof Error ? e.message : String(e) });
    await fs.copyFile(target, `${target}.corrupt-${Date.now()}`).catch(() => undefined);
    return fallback();
  }
}

function load(c: string): Promise<Coll> {
  let p = colls.get(c);
  if (!p) {
    p = readJsonSafe<Coll>(file(c), () => ({}), 'store').then((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}));
    colls.set(c, p);
  }
  return p;
}
function persist(c: string): Promise<void> {
  const next = (chains.get(c) ?? Promise.resolve()).then(async () => {
    const body = JSON.stringify(await load(c));
    try {
      await fs.mkdir(dir(), { recursive: true });
      await writeFileAtomic(file(c), body);
    } catch {
      g.__repereDocsDir = path.join(os.tmpdir(), 'repere-data');
      try {
        await fs.mkdir(dir(), { recursive: true });
        await writeFileAtomic(file(c), body);
      } catch {
        /* mémoire seulement */
      }
    }
  });
  chains.set(c, next.catch(() => undefined));
  return next;
}

type Row = { id: string; collection: string; business_id: string | null; data: unknown; created_at: string; updated_at: string };
const fromRow = <T>(r: Row): StoredDoc<T> => ({
  id: r.id,
  collection: r.collection,
  businessId: r.business_id,
  data: r.data as T,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Crée ou remplace un document. */
export async function putDoc<T>(collection: string, id: string, data: T, businessId: string | null = null): Promise<StoredDoc<T>> {
  const now = new Date().toISOString();
  if (supabaseOn()) {
    const { data: row, error } = await sb()
      .from('documents')
      .upsert({ collection, id, business_id: businessId, data, updated_at: now }, { onConflict: 'collection,id' })
      .select()
      .single();
    if (error) throw new Error(`[store] put ${collection}/${id} : ${error.message}`);
    return fromRow<T>(row as Row);
  }
  const c = await load(collection);
  const prev = c[id];
  const doc: StoredDoc<T> = { id, collection, businessId: businessId ?? prev?.businessId ?? null, data, createdAt: prev?.createdAt ?? now, updatedAt: now };
  c[id] = doc as StoredDoc;
  await persist(collection);
  return doc;
}

export async function getDoc<T>(collection: string, id: string): Promise<StoredDoc<T> | null> {
  if (supabaseOn()) {
    const { data, error } = await sb().from('documents').select('*').eq('collection', collection).eq('id', id).maybeSingle();
    if (error) throw new Error(`[store] get ${collection}/${id} : ${error.message}`);
    return data ? fromRow<T>(data as Row) : null;
  }
  const c = await load(collection);
  return (c[id] as StoredDoc<T>) ?? null;
}

/** Fusion superficielle de `patch` dans data (crée le document s'il n'existe pas). */
export async function updateDoc<T extends object>(collection: string, id: string, patch: Partial<T>, businessId: string | null = null): Promise<StoredDoc<T>> {
  const prev = await getDoc<T>(collection, id);
  return putDoc<T>(collection, id, { ...(prev?.data ?? ({} as T)), ...patch } as T, businessId ?? prev?.businessId ?? null);
}

export async function listDocs<T>(collection: string, opts: ListOptions = {}): Promise<StoredDoc<T>[]> {
  const limit = opts.limit ?? 500;
  const asc = opts.order === 'asc';
  if (supabaseOn()) {
    let q = sb().from('documents').select('*').eq('collection', collection);
    if (opts.businessId) q = q.eq('business_id', opts.businessId);
    const { data, error } = await q.order('updated_at', { ascending: asc }).limit(limit);
    if (error) throw new Error(`[store] list ${collection} : ${error.message}`);
    return (data as Row[]).map((r) => fromRow<T>(r));
  }
  const c = await load(collection);
  return (Object.values(c) as StoredDoc<T>[])
    .filter((d) => !opts.businessId || d.businessId === opts.businessId)
    .sort((a, b) => (asc ? 1 : -1) * a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, limit);
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
  if (supabaseOn()) {
    const { error } = await sb().from('documents').delete().eq('collection', collection).eq('id', id);
    if (error) throw new Error(`[store] delete ${collection}/${id} : ${error.message}`);
    return;
  }
  const c = await load(collection);
  delete c[id];
  await persist(collection);
}

/** Incrémente des compteurs numériques d'un document (agrégats de tracking). Non atomique en Supabase : voir rpc `documents_incr` du schéma. */
export async function incrDoc(collection: string, id: string, deltas: Record<string, number>, businessId: string | null = null): Promise<void> {
  if (supabaseOn()) {
    const { error } = await sb().rpc('documents_incr', { p_collection: collection, p_id: id, p_business_id: businessId, p_deltas: deltas });
    if (!error) return;
  }
  const prev = await getDoc<Record<string, number>>(collection, id);
  const data = { ...(prev?.data ?? {}) };
  for (const [k, v] of Object.entries(deltas)) data[k] = (data[k] ?? 0) + v;
  await putDoc(collection, id, data, businessId ?? prev?.businessId ?? null);
}

/** SQL à ajouter à supabase/schema.sql (section V2). */
export const DOCUMENTS_SQL = `
create table if not exists documents (
  collection text not null,
  id text not null,
  business_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists documents_business_idx on documents (collection, business_id, updated_at desc);
alter table documents enable row level security; -- accès service_role uniquement

create or replace function documents_incr(p_collection text, p_id text, p_business_id text, p_deltas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v numeric;
begin
  insert into documents (collection, id, business_id, data) values (p_collection, p_id, p_business_id, '{}'::jsonb)
  on conflict (collection, id) do nothing;
  for k, v in select key, value::numeric from jsonb_each_text(p_deltas) loop
    update documents set data = jsonb_set(data, array[k], to_jsonb(coalesce((data->>k)::numeric, 0) + v)), updated_at = now()
    where collection = p_collection and id = p_id;
  end loop;
end $$;
-- Service role uniquement (F2) : ni anon ni authenticated ne lisent, n'écrivent ou n'incrémentent.
revoke all on documents from anon, authenticated;
revoke all on function documents_incr(text, text, text, jsonb) from public, anon, authenticated;
`;
