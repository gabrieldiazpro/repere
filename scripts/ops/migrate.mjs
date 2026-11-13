#!/usr/bin/env node
/**
 * Applique la base de données de Repéré sur Supabase (ou tout Postgres 15+).
 *
 *   node scripts/ops/migrate.mjs                 # applique schema.sql puis les migrations pas encore appliquées
 *   node scripts/ops/migrate.mjs --dry-run       # montre ce qui serait appliqué, sans rien modifier
 *   node scripts/ops/migrate.mjs --tout-en-un    # (re)génère supabase/TOUT-EN-UN.sql (variante sans terminal)
 *   node scripts/ops/migrate.mjs --cron          # planifie le worker chaque minute (pg_cron + pg_net)
 *   node scripts/ops/migrate.mjs --cron --dry-run  # affiche le SQL de planification à coller dans l'éditeur SQL
 *
 * Connexion : DATABASE_URL (dans .env.production.local ou le terminal). Supabase › bouton « Connect » ›
 * « Session pooler » › URI (remplacer [YOUR-PASSWORD] par le mot de passe de la base).
 * Options : --fichier <fichier>, --ca <certificat.crt> (vérification stricte du certificat Supabase).
 *
 * Suivi : table public.repere_migrations (nom, empreinte). Un fichier modifié depuis sa dernière application est
 * rejoué : tous les fichiers sont idempotents. Chaque fichier est appliqué dans sa propre transaction.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROOT, argValue, loadScriptEnv } from './lib/envfile.mjs';
import {
  ALL_IN_ONE_FILE,
  TRACKING_SQL,
  TRACKING_TABLE,
  buildAllInOne,
  cronSql,
  listMigrations,
  pendingMigrations,
  trackingInsertSql,
} from './lib/migrations.mjs';

const ok = (m) => console.log(`✓ ${m}`);
const info = (m) => console.log(`  ${m}`);
const fail = (m) => console.error(`✗ ${m}`);

/** Options de connexion `pg` à partir de DATABASE_URL. */
export function pgConfig(url, caPem) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error('DATABASE_URL n’est pas une adresse valide (elle doit commencer par postgresql://).');
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('DATABASE_URL doit commencer par postgresql://');
  if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(url)) {
    throw new Error('Remplacez [YOUR-PASSWORD] dans DATABASE_URL par le mot de passe de la base (Supabase › Database › Settings).');
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  u.searchParams.delete('sslmode');
  const ssl = local ? false : caPem ? { ca: caPem, rejectUnauthorized: true } : { rejectUnauthorized: false };
  return { connectionString: u.toString(), ssl, connectionTimeoutMillis: 15_000, statement_timeout: 120_000 };
}

/** Fichiers déjà appliqués (Map nom → empreinte). Table absente : base neuve. */
export async function appliedMigrations(client) {
  const exists = await client.query(`select to_regclass('public.${TRACKING_TABLE}') as t`);
  if (!exists.rows[0]?.t) return new Map();
  const r = await client.query(`select name, checksum from public.${TRACKING_TABLE}`);
  return new Map(r.rows.map((x) => [x.name, x.checksum]));
}

/**
 * Applique les fichiers en attente avec un client compatible `pg` ({ query }).
 * Renvoie la liste des fichiers appliqués. Lève à la première erreur (le fichier fautif est annulé).
 * @param {{ query: (sql: string) => Promise<{ rows: any[] } | any> }} client
 * @param {{ dryRun?: boolean, all?: { name: string, file?: string, sql: string, checksum: string }[], log?: (m: string) => void }} [opts]
 */
export async function migrate(client, { dryRun = false, all, log = info } = {}) {
  const files = all ?? (await listMigrations());
  const applied = await appliedMigrations(client);
  const pending = pendingMigrations(files, applied);
  if (dryRun) return pending;
  await client.query(TRACKING_SQL);
  for (const m of pending) {
    log(`→ ${m.name} (${m.reason})`);
    try {
      await client.query('begin');
      await client.query(m.sql);
      await client.query(trackingInsertSql(m));
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      const err = new Error(`Échec dans ${m.name} : ${e instanceof Error ? e.message : String(e)}`);
      err.file = m.name;
      throw err;
    }
  }
  return pending;
}

async function writeAllInOne() {
  const all = await listMigrations();
  const text = buildAllInOne(all);
  const prev = await fs.readFile(ALL_IN_ONE_FILE, 'utf8').catch(() => null);
  await fs.writeFile(ALL_IN_ONE_FILE, text);
  ok(`${path.relative(APP_ROOT, ALL_IN_ONE_FILE)} ${prev === text ? 'déjà à jour' : 'généré'} (${all.length} fichiers, ${text.split('\n').length} lignes).`);
  info('À coller dans Supabase › SQL Editor › New query, puis « Run ».');
}

async function connect(env, argv) {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL manquante. Ajoutez-la dans .env.production.local (Supabase › bouton « Connect » › Session pooler › URI),\n' +
        '  ou utilisez la variante sans terminal : supabase/TOUT-EN-UN.sql dans l’éditeur SQL de Supabase.',
    );
  }
  const caFile = argValue(argv, '--ca');
  const ca = caFile ? await fs.readFile(path.resolve(caFile), 'utf8') : undefined;
  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    throw new Error('Le paquet « pg » est absent : lancez d’abord « npm install » dans le dossier app.');
  }
  const client = new pg.Client(pgConfig(url, ca));
  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint = '';
    if (/password authentication failed/i.test(msg)) hint = 'mot de passe incorrect (Supabase › Database › Settings › Reset database password).';
    else if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) hint = 'adresse introuvable : copiez l’URI « Session pooler » (la connexion directe exige IPv6).';
    else if (/ENETUNREACH|EHOSTUNREACH/i.test(msg)) hint = 'réseau sans IPv6 : utilisez l’URI « Session pooler » (port 5432) au lieu de la connexion directe.';
    else if (/timeout/i.test(msg)) hint = 'délai dépassé : vérifiez l’URI, le réseau, ou que le projet Supabase n’est pas en pause.';
    throw new Error(`Connexion impossible à la base : ${msg}${hint ? `\n  → ${hint}` : ''}`);
  }
  return client;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');

  if (argv.includes('--tout-en-un')) {
    await writeAllInOne();
    return;
  }

  const { env, file } = await loadScriptEnv(argv);
  if (file) info(`Variables lues dans ${file}`);

  if (argv.includes('--cron')) {
    const appUrl = env.NEXT_PUBLIC_APP_URL || env.APP_URL;
    if (!appUrl || !/^https:\/\//.test(appUrl)) throw new Error('NEXT_PUBLIC_APP_URL (https://…) est nécessaire pour planifier le worker.');
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET manquant : lancez d’abord node scripts/ops/secrets.mjs');
    const sql = cronSql({ appUrl, cronSecret: env.CRON_SECRET });
    if (dryRun || !env.DATABASE_URL) {
      console.log('\n-- À coller dans Supabase › SQL Editor (contient CRON_SECRET : ne le partagez pas) :\n');
      console.log(sql);
      return;
    }
    const client = await connect(env, argv);
    try {
      const r = await client.query(sql);
      const rows = Array.isArray(r) ? r.at(-1).rows : r.rows;
      ok(`Planification en place : ${rows.map((x) => `${x.jobname} (${x.schedule})`).join(', ')}`);
    } finally {
      await client.end();
    }
    return;
  }

  const all = await listMigrations();
  if (dryRun && !env.DATABASE_URL) {
    info('Aucune DATABASE_URL : sur une base neuve, ces fichiers seraient appliqués dans cet ordre :');
    for (const m of all) info(`→ ${m.name}`);
    return;
  }

  const client = await connect(env, argv);
  try {
    const pending = await migrate(client, { dryRun, all });
    if (!pending.length) {
      ok(`Base à jour : ${all.length} fichiers déjà appliqués, rien à faire.`);
    } else if (dryRun) {
      info(`Essai à blanc : ${pending.length} fichier(s) seraient appliqués :`);
      for (const m of pending) info(`→ ${m.name} (${m.reason})`);
      info('Relancez sans --dry-run pour appliquer.');
    } else {
      ok(`${pending.length} fichier(s) appliqué(s). Base à jour.`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
