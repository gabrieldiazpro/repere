/**
 * Liste ordonnée des fichiers SQL de Repéré et fabrication du fichier « tout-en-un ».
 * Ordre : supabase/schema.sql, puis supabase/migrations/NNNN_*.sql par numéro croissant.
 * Tous les fichiers sont idempotents (if not exists, or replace, drop … if exists) : les rejouer est sans risque.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './envfile.mjs';

export const SUPABASE_DIR = path.join(APP_ROOT, 'supabase');
export const ALL_IN_ONE_FILE = path.join(SUPABASE_DIR, 'TOUT-EN-UN.sql');
/** Table de suivi des fichiers appliqués (schéma public, fermée aux clients par RLS et révocation). */
export const TRACKING_TABLE = 'repere_migrations';

export const TRACKING_SQL = `create table if not exists public.${TRACKING_TABLE} (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
alter table public.${TRACKING_TABLE} enable row level security; -- aucune politique : service_role uniquement
revoke all on public.${TRACKING_TABLE} from public;
do $$ begin
  execute 'revoke all on public.${TRACKING_TABLE} from anon, authenticated';
exception when undefined_object then null; end $$;`;

export function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
}

/** Fichiers à appliquer, dans l'ordre : [{ name, file, sql, checksum }]. */
export async function listMigrations(dir = SUPABASE_DIR) {
  const out = [];
  const schemaFile = path.join(dir, 'schema.sql');
  const schema = await fs.readFile(schemaFile, 'utf8');
  out.push({ name: 'schema.sql', file: schemaFile, sql: schema, checksum: checksum(schema) });
  const mdir = path.join(dir, 'migrations');
  const names = (await fs.readdir(mdir).catch(() => []))
    .filter((n) => /^\d{4}_[a-z0-9_-]+\.sql$/i.test(n))
    .sort((a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4)) || a.localeCompare(b));
  for (const n of names) {
    const f = path.join(mdir, n);
    const sql = await fs.readFile(f, 'utf8');
    out.push({ name: `migrations/${n}`, file: f, sql, checksum: checksum(sql) });
  }
  return out;
}

/** Fichiers à (ré)appliquer : jamais appliqués, ou modifiés depuis (contenu idempotent, donc rejouable). */
export function pendingMigrations(all, applied /* Map name → checksum */) {
  return all.map((m) => ({
    ...m,
    reason: !applied.has(m.name) ? 'nouveau' : applied.get(m.name) !== m.checksum ? 'modifié depuis la dernière application' : null,
  })).filter((m) => m.reason);
}

const sqlLiteral = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function trackingInsertSql(m) {
  return `insert into public.${TRACKING_TABLE} (name, checksum) values (${sqlLiteral(m.name)}, ${sqlLiteral(m.checksum)})
on conflict (name) do update set checksum = excluded.checksum, applied_at = now();`;
}

/** Contenu de supabase/TOUT-EN-UN.sql (à coller dans Supabase › SQL Editor). Déterministe. */
export function buildAllInOne(all) {
  const parts = [
    '-- =====================================================================================================',
    '-- Repéré — base de données COMPLÈTE, en un seul fichier (généré, ne pas modifier à la main).',
    '-- Régénérer : node scripts/ops/migrate.mjs --tout-en-un',
    '--',
    '-- Mode d’emploi (sans terminal) : Supabase › SQL Editor › New query › coller TOUT ce fichier › Run.',
    '-- Rejouable sans risque (idempotent) : à relancer après chaque mise à jour de l’application.',
    '-- Résultat attendu : « Success. No rows returned ». Contrôle : la dernière requête liste les fichiers appliqués.',
    `-- Contenu : ${all.map((m) => `${m.name} (${m.checksum})`).join(', ')}`,
    '-- =====================================================================================================',
    '',
    TRACKING_SQL,
    '',
  ];
  for (const m of all) {
    parts.push(
      '-- #####################################################################################################',
      `-- ${m.name}`,
      '-- #####################################################################################################',
      m.sql.trimEnd(),
      '',
      trackingInsertSql(m),
      '',
    );
  }
  parts.push(`select name, checksum, applied_at from public.${TRACKING_TABLE} order by name;`, '');
  return parts.join('\n');
}

/** SQL de planification pg_cron + pg_net (worker chaque minute, purges nocturnes). */
export function cronSql({ appUrl, cronSecret }) {
  const url = `${String(appUrl).replace(/\/+$/, '')}/api/cron/worker`;
  const auth = `Bearer ${cronSecret}`;
  return `create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('repere-worker', '* * * * *', $cron$ select net.http_post(
  url := ${sqlLiteral(url)},
  headers := jsonb_build_object('authorization', ${sqlLiteral(auth)}),
  timeout_milliseconds := 5000) $cron$);
select cron.schedule('repere-jobs-purge', '23 3 * * *', 'select jobs_purge()');
select cron.schedule('repere-purge', '41 3 * * *', 'select purge_old_data()');
select jobname, schedule from cron.job where jobname like 'repere-%' order by jobname;`;
}
