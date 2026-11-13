#!/usr/bin/env node
/**
 * Deux contrôles des variables d'environnement.
 *
 * 1. Documentation (CI) : chaque variable lue dans src/ (process.env.X, process.env['X'], env('X')) figure dans
 *    .env.example.
 *      node scripts/ops/check-env.mjs           # rapport, code 1 si une variable lue n'est pas documentée
 *      node scripts/ops/check-env.mjs --json    # sortie JSON
 *
 * 2. Production (avant chaque mise en ligne) : valeurs RÉELLES de .env.production.local (ou --fichier), avec
 *    présence, longueur et format de chaque clé, prix Stripe de chaque offre vendue, identité légale complète
 *    (ENTITY_READY), modes de dépannage éteints, et la même validation que l'application au démarrage
 *    (src/lib/env.ts).
 *      node scripts/ops/check-env.mjs --prod [--fichier .env.production.local] [--json]
 *    Code 1 si une erreur bloque la mise en ligne. Aucune valeur secrète n'est affichée.
 *
 * Les variables posées par la plateforme (NODE_ENV, VERCEL_*, NEXT_PHASE, VITEST, CI…) sont ignorées.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOG, INTERNAL_SECRETS, PLACEHOLDER, derivedLegal, entityReady } from './lib/catalog.mjs';
import { APP_ROOT, argValue, parseEnv } from './lib/envfile.mjs';
import { priceEnvName, soldPlans } from './lib/plans.mjs';

const root = APP_ROOT;
const PLATFORM = new Set(['NODE_ENV', 'NEXT_PHASE', 'NEXT_RUNTIME', 'VITEST', 'CI', 'PORT', 'HOSTNAME', 'TZ', 'HOME', 'PATH']);
const isPlatform = (k) => PLATFORM.has(k) || k.startsWith('VERCEL_') || k === 'VERCEL' || k.startsWith('npm_') || k.startsWith('__NEXT');
/** Lues uniquement par les scripts de scripts/ops (pas par l'application). */
const SCRIPT_ONLY = new Set(['DATABASE_URL']);

const PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /\benv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  /\bnumEnv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  // V5 : num('X', défaut) des routes (src/app/api/v5/analysis) et env.X des modules qui reçoivent l'environnement
  /\bnum\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
  /\benv\.([A-Z][A-Z0-9_]*)/g,
  // src/lib/env.ts : source.X et v('X')
  /\bsource\.([A-Z][A-Z0-9_]*)/g,
  /\bv\(\s*['"]([A-Z][A-Z0-9_]*)['"]\)/g,
];

async function walk(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.includes(`${path.sep}__tests__${path.sep}`)) out.push(p);
  }
  return out;
}

export async function usedVariables(dirs = ['src', 'next.config.ts', 'scripts/barometre']) {
  const used = new Map();
  for (const d of dirs) {
    const abs = path.join(root, d);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) continue;
    const files = stat.isDirectory() ? await walk(abs) : [abs];
    for (const f of files) {
      const text = await fs.readFile(f, 'utf8');
      for (const re of PATTERNS) {
        for (const m of text.matchAll(re)) {
          const k = m[1];
          if (isPlatform(k)) continue;
          if (!used.has(k)) used.set(k, new Set());
          used.get(k).add(path.relative(root, f));
        }
      }
    }
  }
  return used;
}

export async function documentedVariables(file = '.env.example') {
  const text = await fs.readFile(path.join(root, file), 'utf8');
  const out = new Set();
  for (const line of text.split('\n')) {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m && !line.trim().startsWith('# ') ) out.add(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Contrôle de production
// ---------------------------------------------------------------------------------------------------------------

const isOn = (x) => ['1', 'true', 'on', 'yes'].includes(String(x ?? '').trim().toLowerCase());

/** Validation de src/lib/env.ts (même code que l'application au démarrage), si Node sait lire le TypeScript. */
async function appValidation(env) {
  try {
    const orig = process.emitWarning;
    process.emitWarning = (w, ...r) => (/Reparsing|Type Stripping|MODULE_TYPELESS/i.test(`${typeof w === 'string' ? w : w?.message} ${JSON.stringify(r)}`) ? undefined : orig.call(process, w, ...r));
    try {
      const m = await import(pathToFileURL(path.join(root, 'src', 'lib', 'env.ts')).href);
      return m.validateEnv({ ...env, VERCEL_ENV: 'production', NEXT_PHASE: '' });
    } finally {
      process.emitWarning = orig;
    }
  } catch {
    return null;
  }
}

/**
 * Contrôle complet d'un environnement de production. Ne lève jamais.
 * @param {Record<string,string>} env
 * @param {{ plans?: {id:string}[], app?: boolean }} opts  plans : offres vendues (défaut : src/lib/plans.ts) ;
 *   app : rejouer aussi la validation de src/lib/env.ts (défaut vrai).
 */
export async function checkProduction(env, opts = {}) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const val = (k) => (env[k] ?? '').trim();

  // 1. Secrets internes
  const seen = new Map();
  for (const s of INTERNAL_SECRETS) {
    const v = val(s.name);
    if (!v) errors.push(`${s.name} manquant (${s.why}) → node scripts/ops/secrets.mjs --completer`);
    else if (v.length < 16) errors.push(`${s.name} trop court (${v.length} caractères, 32 minimum conseillés)`);
    else if (v.length < 32) warnings.push(`${s.name} court (${v.length} caractères) : 32 ou plus conseillés`);
    else ok.push(s.name);
    if (v) {
      if (seen.has(v)) errors.push(`${s.name} est identique à ${seen.get(v)} : chaque secret doit être différent`);
      else seen.set(v, s.name);
    }
  }

  // 2. Clés externes, site, identité légale
  for (const c of CATALOG) {
    const v = val(c.name);
    if (!v) {
      if (c.required) errors.push(`${c.name} manquante → ${c.where}`);
      continue;
    }
    if ((c.legal || c.group === 'Site') && PLACEHOLDER.test(v)) {
      errors.push(`${c.name} contient un texte provisoire (« ${v.slice(0, 40)} ») : mettez la vraie valeur`);
      continue;
    }
    const r = c.check?.(v, env);
    if (r?.level === 'error') errors.push(`${c.name} invalide : ${r.msg}`);
    else if (r?.level === 'warn') warnings.push(`${c.name} : ${r.msg}`);
    else ok.push(c.name);
  }
  if (!CATALOG.filter((c) => c.ai).some((c) => val(c.name))) {
    errors.push('Aucune clé IA : les audits seraient simulés. Ajoutez au moins OPENAI_API_KEY, GEMINI_API_KEY et PERPLEXITY_API_KEY.');
  } else {
    const missingAi = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'PERPLEXITY_API_KEY'].filter((k) => !val(k));
    if (missingAi.length) warnings.push(`IA absentes de l’audit de base : ${missingAi.join(', ')} (les offres annoncent ChatGPT, Gemini et Perplexity)`);
  }

  // 3. Prix Stripe de chaque offre vendue
  let plans = opts.plans;
  if (!plans) {
    try {
      plans = await soldPlans();
    } catch (e) {
      warnings.push(`Offres non lues (${e instanceof Error ? e.message : e}) : prix Stripe non vérifiés`);
      plans = [];
    }
  }
  const priceIds = new Map();
  for (const p of plans) {
    const k = priceEnvName(p.id);
    const v = val(k);
    if (!v) errors.push(`${k} manquant (offre ${p.id}) → node scripts/ops/stripe-setup.mjs`);
    else if (!/^price_[A-Za-z0-9]+$/.test(v)) errors.push(`${k} invalide : doit commencer par price_`);
    else if (priceIds.has(v)) errors.push(`${k} et ${priceIds.get(v)} ont le même prix Stripe`);
    else {
      priceIds.set(v, k);
      ok.push(k);
    }
  }
  // 4. Identité légale publiée
  if (/\b(SAS|SASU|SARL|EURL|SA|SCI|SNC|soci[ée]t[ée])\b/i.test(val('NEXT_PUBLIC_LEGAL_FORM')) && !val('NEXT_PUBLIC_LEGAL_RCS_CITY')) {
    errors.push('NEXT_PUBLIC_LEGAL_RCS_CITY manquante : une société doit indiquer son greffe (RCS <ville>) dans les mentions légales');
  }
  const ready = entityReady(env);
  if (!ready) errors.push('ENTITY_READY faux : NEXT_PUBLIC_FOUNDER_NAME, NEXT_PUBLIC_FOUNDER_BIO, NEXT_PUBLIC_LEGAL_SIREN, NEXT_PUBLIC_LEGAL_STREET et NEXT_PUBLIC_LEGAL_CITY sont nécessaires (page /a-propos, JSON-LD, llms.txt)');
  const derived = derivedLegal(env);
  for (const [k, v] of Object.entries(derived)) {
    if (val(k) && v && val(k) !== v) warnings.push(`${k} (pied des e-mails) diffère de l’identité publiée : laissez-le vide, il sera recopié depuis NEXT_PUBLIC_LEGAL_*`);
  }

  // 5. Modes de dépannage éteints
  if (isOn(env.DEMO_MODE)) errors.push('DEMO_MODE est activé : videz-le (données simulées, aucun paiement réel)');
  if (isOn(env.AUTH_LOCAL_ACCOUNTS)) errors.push('AUTH_LOCAL_ACCOUNTS est activé : videz-le (comptes locaux de dépannage)');
  if (isOn(env.CSP_DISABLE)) errors.push('CSP_DISABLE est activé : videz-le (aucune politique de sécurité du contenu)');
  if (isOn(env.CSP_REPORT_ONLY)) warnings.push('CSP_REPORT_ONLY est activé : la CSP n’est pas appliquée');

  // 6. Validation de l'application elle-même (src/lib/env.ts), comme au démarrage sur Vercel
  if (opts.app !== false) {
    const r = await appValidation({ ...env, ...Object.fromEntries(Object.entries(derived).filter(([k, v]) => v && !val(k))) });
    if (r) {
      for (const e of r.errors) if (!errors.some((x) => x.startsWith(e.split(' ')[0]))) errors.push(`[démarrage] ${e}`);
      if (r.mode !== 'production') errors.push(`[démarrage] l’application démarrerait en mode « ${r.mode} » au lieu de « production »`);
    } else {
      warnings.push('Validation de src/lib/env.ts non rejouée (Node 22.18+ nécessaire) : contrôles du script seulement');
    }
  }

  return { ok: errors.length === 0, errors, warnings, passed: ok, entityReady: ready };
}

export function formatProduction(r, file) {
  const L = [`Contrôle de production${file ? ` (${file})` : ''} : ${r.ok ? '✓ PRÊT' : `✗ ${r.errors.length} problème(s) bloquant(s)`}`];
  L.push(`  ${r.passed.length} variables correctes · ENTITY_READY ${r.entityReady ? 'vrai' : 'faux'}`);
  if (r.errors.length) L.push('', 'À corriger (bloquant) :', ...r.errors.map((e) => `  ✗ ${e}`));
  if (r.warnings.length) L.push('', 'À vérifier :', ...r.warnings.map((w) => `  ! ${w}`));
  if (r.ok) L.push('', 'Étape suivante : node scripts/ops/secrets.mjs --vercel-fichier (import dans Vercel), puis redéployer.');
  return L.join('\n');
}

async function mainProd(argv) {
  const file = argValue(argv, '--fichier') || '.env.production.local';
  const abs = path.isAbsolute(file) ? file : path.join(root, file);
  const text = await fs.readFile(abs, 'utf8').catch(() => null);
  if (text === null) {
    console.error(`✗ ${file} introuvable : lancez d’abord node scripts/ops/secrets.mjs`);
    process.exitCode = 1;
    return;
  }
  const r = await checkProduction(parseEnv(text));
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: r.ok, errors: r.errors, warnings: r.warnings, entityReady: r.entityReady }, null, 2));
  else console.log(formatProduction(r, file));
  process.exitCode = r.ok ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--prod')) return mainProd(argv);
  const used = await usedVariables();
  const documented = await documentedVariables();
  // STRIPE_PRICE_<PLANID> est construit dynamiquement : les variables documentées de cette famille sont « lues ».
  const dynamicFamilies = ['STRIPE_PRICE_'];
  const missing = [...used.keys()].filter((k) => !documented.has(k)).sort();
  const unused = [...documented].filter((k) => !used.has(k) && !SCRIPT_ONLY.has(k) && !dynamicFamilies.some((f) => k.startsWith(f))).sort();
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ used: used.size, documented: documented.size, missing, unused }, null, 2));
  } else {
    console.log(`Variables lues dans le code : ${used.size} — documentées dans .env.example : ${documented.size}`);
    if (missing.length) {
      console.log(`\n✗ Lues mais absentes de .env.example (${missing.length}) :`);
      for (const k of missing) console.log(`  ${k}  (${[...used.get(k)].slice(0, 3).join(', ')})`);
    }
    if (unused.length) {
      console.log(`\n! Documentées mais jamais lues (${unused.length}) : ${unused.join(', ')}`);
    }
    if (!missing.length) console.log('\n✓ Toutes les variables lues sont documentées.');
    console.log('  (Avant une mise en ligne : node scripts/ops/check-env.mjs --prod)');
  }
  process.exitCode = missing.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
