#!/usr/bin/env node
/**
 * Sauvegarde chiffrée des tables importantes de Supabase, depuis votre ordinateur (gratuit, sans service tiers).
 * Procédure complète et restauration : docs/MISE-EN-LIGNE.md, « Sauvegardes » ; scripts/ops/backup.md.
 *
 *   node scripts/ops/sauvegarde.mjs                         # exporte → ~/repere-sauvegardes/repere-AAAA-MM-JJ-HHMM.repere-sauv (hors du dépôt)
 *   node scripts/ops/sauvegarde.mjs --sortie ~/Coffre        # dossier de sortie
 *   node scripts/ops/sauvegarde.mjs --verifier <fichier>     # déchiffre en mémoire et affiche le nombre de lignes
 *   node scripts/ops/sauvegarde.mjs --dechiffrer <fichier> --sortie restore.json   # JSON en clair (à effacer après)
 *   node scripts/ops/sauvegarde.mjs --restaurer <fichier> --fichier .env.test.local --confirmer [--tables a,b]
 *
 * Variables : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (lues dans
 * .env.production.local ou --fichier), BACKUP_PASSPHRASE (phrase secrète, 16 caractères au moins, à garder dans
 * votre gestionnaire de mots de passe : sans elle, la sauvegarde est illisible). Aucune valeur n'est affichée.
 * Restauration : upsert (insère ou remplace par clé primaire), jamais de suppression. Refusée vers le projet
 * d'origine sans --meme-projet.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { argValue, loadScriptEnv } from './lib/envfile.mjs';
import { TABLES, backupFileName, checkPassphrase, chunks, decryptBackup, encryptBackup, readAll, summarize } from './lib/sauvegarde.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const expand = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p));

function client(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires (.env.production.local ou --fichier).');
  return { sb: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), host: new URL(url).host };
}

function passphrase(env) {
  const p = env.BACKUP_PASSPHRASE;
  const err = checkPassphrase(p);
  if (err) throw new Error(err);
  return p;
}

function wanted() {
  const t = argValue(argv, '--tables');
  if (!t) return TABLES;
  const list = t.split(',').map((x) => x.trim()).filter(Boolean);
  const unknown = list.filter((x) => !TABLES.includes(x));
  if (unknown.length) throw new Error(`Tables inconnues : ${unknown.join(', ')} (connues : ${TABLES.join(', ')})`);
  return TABLES.filter((x) => list.includes(x));
}

async function exportAll(env) {
  const { sb, host } = client(env);
  const pass = passphrase(env);
  const tables = {};
  const missing = [];
  for (const t of wanted()) {
    try {
      tables[t] = await readAll((from, to) => sb.from(t).select('*').range(from, to));
      console.log(`  ${t.padEnd(20)} ${String(tables[t].length).padStart(7)} lignes`);
    } catch (e) {
      // Table absente (migration non appliquée) : signalée, la sauvegarde continue.
      missing.push(`${t} (${e.message})`);
    }
  }
  const payload = { version: 1, createdAt: new Date().toISOString(), source: host, tables };
  const dir = expand(argValue(argv, '--sortie') || path.join(os.homedir(), 'repere-sauvegardes'));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, backupFileName());
  await fs.writeFile(file, encryptBackup(payload, pass), { mode: 0o600 });
  // Contrôle immédiat : le fichier écrit se relit avec la phrase secrète.
  const back = summarize(decryptBackup(await fs.readFile(file), pass));
  const total = Object.values(back).reduce((a, b) => a + b, 0);
  console.log(`\nSauvegarde chiffrée : ${file}\n${total} lignes, ${Object.keys(back).length} tables, relecture vérifiée.`);
  if (missing.length) console.log(`Tables non exportées : ${missing.join(' ; ')}`);
  console.log('Copiez ce fichier hors de votre ordinateur (clé USB, stockage personnel). Il ne contient pas les comptes (schéma auth).');
}

async function load(file, env) {
  return decryptBackup(await fs.readFile(expand(file)), passphrase(env));
}

async function restore(file, env) {
  const payload = await load(file, env);
  const { sb, host } = client(env);
  if (host === payload.source && !has('--meme-projet')) {
    throw new Error(`Le projet cible (${host}) est celui d'origine. Restaurez d'abord sur un projet de TEST, ou ajoutez --meme-projet en connaissance de cause.`);
  }
  if (!has('--confirmer')) {
    console.log(`Simulation (ajoutez --confirmer pour écrire) : vers ${host}`);
    for (const [t, n] of Object.entries(summarize(payload))) console.log(`  ${t.padEnd(20)} ${String(n).padStart(7)} lignes à insérer ou remplacer`);
    return;
  }
  const list = wanted();
  for (const t of TABLES) {
    if (!list.includes(t) || !payload.tables[t]?.length) continue;
    let n = 0;
    for (const batch of chunks(payload.tables[t])) {
      const { error } = await sb.from(t).upsert(batch);
      if (error) throw new Error(`${t} : ${error.message} (après ${n} lignes). Les tables suivantes n'ont pas été restaurées.`);
      n += batch.length;
    }
    console.log(`  ${t.padEnd(20)} ${String(n).padStart(7)} lignes restaurées`);
  }
  console.log(`\nRestauration terminée vers ${host}. Vérifiez GET /api/health (Bearer CRON_SECRET) et un compte de test.`);
}

async function main() {
  const { env } = await loadScriptEnv(argv);
  const verify = argValue(argv, '--verifier');
  const decrypt = argValue(argv, '--dechiffrer');
  const rest = argValue(argv, '--restaurer');
  if (verify) {
    const p = await load(verify, env);
    console.log(`Sauvegarde du ${p.createdAt} (projet ${p.source}) : lisible.`);
    for (const [t, n] of Object.entries(summarize(p))) console.log(`  ${t.padEnd(20)} ${String(n).padStart(7)} lignes`);
  } else if (decrypt) {
    const out = argValue(argv, '--sortie');
    if (!out) throw new Error('--sortie <fichier.json> requis avec --dechiffrer.');
    await fs.writeFile(expand(out), JSON.stringify(await load(decrypt, env), null, 1), { mode: 0o600 });
    console.log(`JSON en clair écrit dans ${out}. Il contient des données personnelles : effacez-le après usage.`);
  } else if (rest) {
    await restore(rest, env);
  } else {
    console.log('Export des tables Supabase…');
    await exportAll(env);
  }
}

main().catch((e) => {
  console.error(`Échec : ${e.message}`);
  process.exit(1);
});
