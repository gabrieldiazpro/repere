#!/usr/bin/env node
/**
 * Prépare le fichier des variables de production : .env.production.local (jamais versionné).
 *
 *   node scripts/ops/secrets.mjs                  # crée le fichier : secrets internes générés + cases vides à remplir
 *   node scripts/ops/secrets.mjs --completer      # ajoute ce qui manque (nouveaux secrets, nouvelles cases) sans rien écraser
 *   node scripts/ops/secrets.mjs --liste          # liste les clés externes à coller, avec la page où les trouver
 *   node scripts/ops/secrets.mjs --vercel         # imprime les commandes « vercel env add » (valeurs du fichier)
 *   node scripts/ops/secrets.mjs --vercel-fichier # écrit .env.vercel.local, à importer dans Vercel (« Import .env »)
 *   node scripts/ops/secrets.mjs --force          # RÉGÉNÈRE les secrets internes (déconnecte tout le monde, voir plus bas)
 *
 * Options : --fichier <fichier> (défaut .env.production.local).
 * --force est dangereux une fois en service : INTEGRATIONS_SECRET chiffre les connexions des clients (perdues
 * si la clé change), AUTH_SECRET signe les sessions, les liens déjà envoyés (désinscription, partage) cessent de
 * fonctionner.
 */
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, INTERNAL_SECRETS, INTERNAL_SECRET_BYTES, derivedLegal } from './lib/catalog.mjs';
import { APP_ROOT, PROD_ENV_FILE, argValue, parseEnv, quoteEnv, upsertEnvText } from './lib/envfile.mjs';
import { priceEnvName, soldPlans } from './lib/plans.mjs';

export const VERCEL_ENV_FILE = '.env.vercel.local';

export function generateSecret(bytes = INTERNAL_SECRET_BYTES) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Valeurs internes : conserve celles déjà présentes (sauf `force`).
 * @param {Record<string, string>} [existing]
 * @param {{ force?: boolean }} [opts]
 * @returns {Record<string, string>}
 */
export function internalSecrets(existing = {}, { force = false } = {}) {
  const out = {};
  for (const s of INTERNAL_SECRETS) out[s.name] = !force && existing[s.name] ? existing[s.name] : generateSecret();
  return out;
}

/** Texte complet du fichier .env.production.local. */
export function buildEnvTemplate(values, priceNames = [], now = new Date()) {
  const v = (k) => quoteEnv(values[k] ?? '');
  const L = [
    `# Repéré — variables de PRODUCTION. Généré par node scripts/ops/secrets.mjs le ${now.toISOString().slice(0, 10)}.`,
    '# NE JAMAIS versionner, envoyer par e-mail ni coller dans un chat. Sauvegarde : votre gestionnaire de mots de passe.',
    '# Après chaque modification : node scripts/ops/check-env.mjs --prod',
    '# Règle : une valeur par ligne, sans espace autour du « = », sans guillemets sauf si la valeur contient des espaces.',
    '',
    '# ======================================================================================',
    '# 1. Secrets internes — générés automatiquement, NE PAS MODIFIER une fois le site en ligne',
    '# ======================================================================================',
  ];
  for (const s of INTERNAL_SECRETS) L.push(`# ${s.why}`, `${s.name}=${v(s.name)}`);
  let n = 2;
  const groups = [...new Set(CATALOG.map((c) => c.group))];
  for (const g of groups) {
    L.push('', '# ======================================================================================', `# ${n++}. ${g}`, '# ======================================================================================');
    if (g === 'IA') L.push('# Au moins une clé ; ChatGPT, Gemini et Perplexity pour un audit complet. Fixez un plafond de dépense chez chacun.');
    if (g === 'Légal') L.push('# Publié sur le site (mentions légales, CGV, confidentialité, JSON-LD). N’inventez rien : valeurs officielles uniquement.');
    for (const c of CATALOG.filter((x) => x.group === g)) {
      L.push(`# ${c.required ? '[OBLIGATOIRE] ' : '[facultatif] '}${c.where}`, `${c.name}=${v(c.name)}`);
    }
    if (g === 'Stripe' && priceNames.length) {
      L.push('# Prix Stripe : remplis automatiquement par node scripts/ops/stripe-setup.mjs');
      for (const p of priceNames) L.push(`${p}=${v(p)}`);
    }
  }
  return `${L.join('\n')}\n`;
}

/**
 * Variables à envoyer à Vercel : valeurs non vides, hors scripts, + copies serveur des champs légaux.
 * @param {Record<string, string>} env
 * @returns {Record<string, string>}
 */
export function vercelValues(env) {
  /** @type {Record<string, string>} */
  const out = {};
  const keep = (k) => {
    if (env[k] !== undefined && String(env[k]).trim() !== '') out[k] = String(env[k]).trim();
  };
  for (const s of INTERNAL_SECRETS) keep(s.name);
  for (const c of CATALOG) if (c.vercel !== false) keep(c.name);
  for (const k of Object.keys(env).sort()) if (k.startsWith('STRIPE_PRICE_')) keep(k);
  for (const [k, val] of Object.entries(derivedLegal(env))) if (val && !env[k]) out[k] = val;
  for (const k of ['LEGAL_NAME', 'LEGAL_ADDRESS', 'LEGAL_SIREN']) keep(k);
  return out;
}

const SENSITIVE = new Set([...INTERNAL_SECRETS.map((s) => s.name), ...CATALOG.filter((c) => c.sensitive).map((c) => c.name)]);
const sh = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** Commandes Vercel CLI (une par variable), environnement Production. */
export function vercelCommands(values) {
  const out = [
    '# Prérequis : npm i -g vercel@latest, puis dans le dossier app : vercel login && vercel link',
    '# Une variable déjà présente doit d’abord être retirée : vercel env rm NOM production --yes',
  ];
  for (const [k, val] of Object.entries(values)) {
    out.push(`printf '%s' ${sh(val)} | vercel env add ${k} production${SENSITIVE.has(k) ? ' --sensitive' : ''}`);
  }
  out.push('# Puis redéployez : vercel --prod (les variables ne s’appliquent qu’aux nouveaux déploiements)');
  return out.join('\n');
}

/** Liste lisible des clés externes à coller. */
export function externalKeysList(env = {}) {
  const lines = [];
  let group = '';
  for (const c of CATALOG) {
    if (c.group !== group) {
      group = c.group;
      lines.push('', `${group}`);
    }
    const filled = env[c.name] ? '✓' : c.required ? '✗' : '·';
    lines.push(`  ${filled} ${c.name}${c.required ? ' (obligatoire)' : ''}`, `      → ${c.where}`);
  }
  return lines.join('\n');
}

async function ensureGitignore() {
  const gi = path.join(APP_ROOT, '.gitignore');
  const text = await fs.readFile(gi, 'utf8').catch(() => '');
  const lines = text.split('\n').map((l) => l.trim());
  const add = [PROD_ENV_FILE, VERCEL_ENV_FILE].filter((f) => !lines.includes(f) && !lines.includes(`/${f}`));
  if (add.length) await fs.writeFile(gi, `${text.replace(/\n*$/, '\n')}${add.join('\n')}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const file = argValue(argv, '--fichier') || PROD_ENV_FILE;
  const abs = path.isAbsolute(file) ? file : path.join(APP_ROOT, file);
  const text = await fs.readFile(abs, 'utf8').catch(() => null);
  const existing = text === null ? null : parseEnv(text);
  const priceNames = (await soldPlans()).map((p) => priceEnvName(p.id));

  if (argv.includes('--liste')) {
    console.log('Clés externes à coller dans', file, '(✓ remplie, ✗ obligatoire manquante, · facultative) :');
    console.log(externalKeysList(existing ?? {}));
    return;
  }

  if (argv.includes('--vercel') || argv.includes('--vercel-fichier')) {
    if (!existing) throw new Error(`${file} introuvable : lancez d’abord node scripts/ops/secrets.mjs`);
    const values = vercelValues(existing);
    if (argv.includes('--vercel-fichier')) {
      const out = path.join(APP_ROOT, VERCEL_ENV_FILE);
      await fs.writeFile(out, `${Object.entries(values).map(([k, v]) => `${k}=${quoteEnv(v)}`).join('\n')}\n`, { mode: 0o600 });
      await ensureGitignore();
      console.log(`✓ ${VERCEL_ENV_FILE} écrit (${Object.keys(values).length} variables, sans DATABASE_URL).`);
      console.log('  Vercel › votre projet › Settings › Environment Variables › « Import .env » › choisir ce fichier,');
      console.log('  environnement « Production » uniquement, puis Save. Supprimez ensuite le fichier : rm .env.vercel.local');
    } else {
      console.log(vercelCommands(values));
    }
    return;
  }

  const force = argv.includes('--force');
  const complete = argv.includes('--completer');
  if (existing && !force && !complete) {
    console.error(`✗ ${file} existe déjà : rien n’a été écrasé.`);
    console.error('  → node scripts/ops/secrets.mjs --completer   (ajoute ce qui manque, sans rien modifier)');
    console.error('  → node scripts/ops/secrets.mjs --liste       (ce qu’il reste à coller)');
    console.error('  → node scripts/ops/secrets.mjs --force       (régénère les secrets : déconnecte tout le monde, à éviter en service)');
    process.exitCode = 1;
    return;
  }

  const secrets = internalSecrets(existing ?? {}, { force });
  let out;
  if (!existing) {
    out = buildEnvTemplate(secrets, priceNames);
  } else {
    // Complète ou régénère : on garde le fichier tel quel, on ne change que les secrets internes (vides, ou tous si --force)
    // et on ajoute les cases manquantes.
    const changed = Object.fromEntries(Object.entries(secrets).filter(([k, v]) => existing[k] !== v));
    out = upsertEnvText(text, changed, { section: 'Secrets internes ajoutés' });
    const known = new Set(Object.keys(parseEnv(out)));
    const missing = [...CATALOG.map((c) => c.name), ...priceNames].filter((k) => !known.has(k) && !new RegExp(`^${k}=`, 'm').test(out));
    if (missing.length) out = upsertEnvText(out, Object.fromEntries(missing.map((k) => [k, ''])), { section: 'Nouvelles variables à remplir (voir --liste)' });
    if (force) console.warn('! Secrets internes régénérés : redéployez, et prévenez que les sessions et liens envoyés sont invalidés.');
  }
  await fs.writeFile(abs, out, { mode: 0o600 });
  await fs.chmod(abs, 0o600).catch(() => undefined);
  await ensureGitignore();
  console.log(`✓ ${file} ${existing ? 'mis à jour' : 'créé'} : ${INTERNAL_SECRETS.length} secrets internes en place (64 caractères chacun).`);
  console.log('\nÀ coller maintenant dans ce fichier (✓ remplie, ✗ obligatoire manquante, · facultative) :');
  console.log(externalKeysList(parseEnv(out)));
  console.log('\nPuis : node scripts/ops/check-env.mjs --prod');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
