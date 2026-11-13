/**
 * Lecture et écriture minimales de fichiers .env (KEY=valeur, commentaires #, guillemets simples ou doubles).
 * Aucune dépendance : utilisé par les scripts de mise en ligne (secrets, check-env, migrate, stripe-setup).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Dossier racine de l'application (contient package.json). */
export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Fichier de production local, jamais versionné. */
export const PROD_ENV_FILE = '.env.production.local';

/** Analyse le texte d'un fichier .env. Les lignes invalides sont ignorées. */
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
      const dq = v.startsWith('"');
      v = v.slice(1, -1);
      if (dq) v = v.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else {
      const hash = v.search(/\s#/);
      if (hash >= 0) v = v.slice(0, hash);
      v = v.trim();
    }
    out[m[1]] = v;
  }
  return out;
}

/** Valeur prête à écrire dans un .env (guillemets si nécessaire). */
export function quoteEnv(v) {
  const s = String(v ?? '');
  if (s === '') return '';
  if (/^[A-Za-z0-9_\-.:/@+,=]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/**
 * Remplace la valeur des clés données dans un texte .env (ligne `KEY=…` existante), ou les ajoute à la fin.
 * Les commentaires et l'ordre sont conservés.
 */
export function upsertEnvText(text, values, { section = 'Ajouté automatiquement' } = {}) {
  const lines = String(text).split('\n');
  const done = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(lines[i]);
    if (m && Object.prototype.hasOwnProperty.call(values, m[1])) {
      lines[i] = `${m[1]}=${quoteEnv(values[m[1]])}`;
      done.add(m[1]);
    }
  }
  const rest = Object.keys(values).filter((k) => !done.has(k));
  if (rest.length) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('', `# --- ${section} ---`, ...rest.map((k) => `${k}=${quoteEnv(values[k])}`));
  }
  return `${lines.join('\n').replace(/\n*$/, '')}\n`;
}

/** Met à jour un fichier .env existant (voir upsertEnvText). */
export async function upsertEnvFile(file, values, opts) {
  const abs = path.isAbsolute(file) ? file : path.join(APP_ROOT, file);
  const text = await fs.readFile(abs, 'utf8');
  await fs.writeFile(abs, upsertEnvText(text, values, opts), { mode: 0o600 });
}

/** Lit un fichier .env (chemin relatif à l'application). Renvoie null s'il n'existe pas. */
export async function readEnvFile(file = PROD_ENV_FILE) {
  const abs = path.isAbsolute(file) ? file : path.join(APP_ROOT, file);
  const text = await fs.readFile(abs, 'utf8').catch(() => null);
  return text === null ? null : parseEnv(text);
}

/** Valeur d'un argument `--nom valeur` ou `--nom=valeur`. */
export function argValue(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === name) return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
  }
  return undefined;
}

/**
 * Environnement effectif d'un script : `--fichier <fichier>` (défaut : .env.production.local s'il existe),
 * complété par les variables du terminal (qui priment).
 */
export async function loadScriptEnv(argv = process.argv.slice(2), base = process.env) {
  const explicit = argValue(argv, '--fichier');
  const file = explicit || PROD_ENV_FILE;
  const fromFile = (await readEnvFile(file)) ?? {};
  if (explicit && !Object.keys(fromFile).length) {
    const abs = path.isAbsolute(file) ? file : path.join(APP_ROOT, file);
    const exists = await fs.stat(abs).then(() => true, () => false);
    if (!exists) throw new Error(`Fichier introuvable : ${file}`);
  }
  const env = { ...fromFile };
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== '') env[k] = v;
  return { env, file: Object.keys(fromFile).length ? file : null };
}
