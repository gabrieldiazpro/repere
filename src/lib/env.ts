/**
 * Validation des variables d'environnement (zod), au démarrage et à la demande.
 *
 * Trois modes :
 * - `demo`        : `DEMO_MODE=1` (explicite), ou aucune base configurée hors production. IA simulées, store `.data/`,
 *                   e-mails dans les logs, paiement simulé. Autorisé en production uniquement si `DEMO_MODE=1`.
 * - `development` : hors production, au moins une brique réelle configurée. Les manques sont des avertissements.
 * - `production`  : `VERCEL_ENV=production` ou `APP_ENV=production`. **Tout secret obligatoire manquant ou mal formé
 *                   empêche le démarrage** (`assertEnv()` lève une erreur qui liste les variables à corriger).
 *
 * Le build (`next build`, `NEXT_PHASE=phase-production-build`) n'est jamais bloqué : il tourne sans clé (CI, mode démo).
 * Appel au démarrage : `src/instrumentation.ts` → `register() { (await import('@/lib/env')).assertEnv(); }`.
 * La liste complète des variables est dans `.env.example` (contrôlée par `node scripts/ops/check-env.mjs`).
 */
import { z } from 'zod';

type Source = Record<string, string | undefined>;

const str = () => z.string().trim().optional();
const num = (def: number) =>
  z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().finite().nonnegative().optional().default(def));
const flag = () =>
  z.preprocess((v) => (typeof v === 'string' ? ['1', 'true', 'on', 'yes'].includes(v.trim().toLowerCase()) : false), z.boolean());
const url = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.url({ error: 'doit être une URL complète (https://…)' }).optional(),
  );

/** Schéma de toutes les variables lues par l'application (les valeurs vides valent « absentes »). */
export const EnvSchema = z.object({
  // Mode
  NODE_ENV: str(),
  VERCEL_ENV: str(),
  APP_ENV: str(),
  DEMO_MODE: flag(),
  NEXT_PHASE: str(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().catch(undefined),
  SENTRY_DSN: url(),

  // Site
  NEXT_PUBLIC_APP_URL: url(),
  NEXT_PUBLIC_SITE_URL: url(),
  SITE_URL: url(),
  APP_URL: url(),
  NEXT_PUBLIC_BRAND_NAME: str(),
  NEXT_PUBLIC_CONTACT_EMAIL: str(),

  // Supabase
  SUPABASE_URL: url(),
  NEXT_PUBLIC_SUPABASE_URL: url(),
  SUPABASE_SERVICE_ROLE_KEY: str(),
  SUPABASE_ANON_KEY: str(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: str(),

  // Stripe
  STRIPE_SECRET_KEY: str(),
  STRIPE_WEBHOOK_SECRET: str(),
  STRIPE_TAX_RATE_ID: str(),
  /** obsolète V3 : portail créé côté serveur (POST /api/account/portal) */
  NEXT_PUBLIC_STRIPE_PORTAL_URL: url(),

  // E-mail
  RESEND_API_KEY: str(),
  EMAIL_FROM: str(),
  EMAIL_REPLY_TO: str(),
  LEGAL_NAME: str(),
  LEGAL_ADDRESS: str(),
  LEGAL_SIREN: str(),

  // Connexion (agent COMPTES)
  AUTH_SECRET: str(),
  AUTH_LOCAL_ACCOUNTS: flag(),
  SUPABASE_JWT_SECRET: str(),

  // Secrets applicatifs
  CRON_SECRET: str(),
  SHARE_SECRET: str(),
  INTEGRATIONS_SECRET: str(),
  UNSUBSCRIBE_SECRET: str(),
  AUDIT_SIGNING_SECRET: str(),
  DIGEST_SIGNING_SECRET: str(),
  RATE_LIMIT_SALT: str(),
  ADMIN_TOKEN: str(),

  // IA
  OPENAI_API_KEY: str(),
  PERPLEXITY_API_KEY: str(),
  GEMINI_API_KEY: str(),
  ANTHROPIC_API_KEY: str(),
  MISTRAL_API_KEY: str(),
  MISTRAL_MODEL: str(),
  MISTRAL_EXTRACTOR_MODEL: str(),
  GOOGLE_PLACES_KEY: str(),
  GEMINI_GROUNDING: z.enum(['on', 'off']).optional().catch(undefined),
  AUDIT_PROVIDERS: str(),

  // Questions suivies, croissance (agents QUESTIONS, CROISSANCE)
  PROMPTS_SITE_FETCH: z.enum(['on', 'off']).optional().catch(undefined),
  GROWTH_REFERRAL_REWARD: str(),

  // Local, e-commerce, copilote (agents LOCAL, ECOMMERCE, COPILOTE)
  LOCAL_MAP_BUDGET_EUR: num(0),
  SHOPIFY_CLIENT_ID: str(),
  SHOPIFY_CLIENT_SECRET: str(),
  SHOPIFY_API_VERSION: z.string().regex(/^\d{4}-(01|04|07|10)$/).optional().catch(undefined),
  COPILOT_MAX_TOOL_TURNS: num(4),

  // File de tâches
  JOBS_WORKER_BUDGET_MS: num(240_000),
  JOBS_TIMEOUT_MS: num(90_000),
  JOBS_BATCH: num(10),
  JOBS_CONCURRENCY: num(2),
  JOBS_MAX_ATTEMPTS: num(5),
  JOBS_BACKOFF_BASE_MS: num(60_000),
  JOBS_KICK: z.enum(['on', 'off']).optional().catch(undefined),

  // Sécurité HTTP (next.config.ts)
  CSP_REPORT_ONLY: flag(),
  CSP_DISABLE: flag(),
  CSP_REPORT_SAMPLE: str(),
  /** CSP à nonce posée par le middleware sur les pages dynamiques (défaut : on) */
  CSP_NONCE: z.enum(['on', 'off']).optional().catch(undefined),

  // V5 — toutes facultatives, avec repli (docs/MISE-EN-LIGNE.md, « Données SEO et publication »)
  // Analyse 60 s (src/lib/analysis, POST /api/v5/analysis)
  ANALYSIS_MAX_AI_CALLS: num(18),
  ANALYSIS_RATE_LIMIT_PER_HOUR: num(6),
  ANALYSIS_RATE_LIMIT_PER_DAY: num(15),
  ANALYSIS_PER_DOMAIN_PER_HOUR: num(4),
  ANALYSIS_GLOBAL_PER_HOUR: num(120),
  ANALYSIS_GLOBAL_PER_DAY: num(600),
  /** 0 = pas d'envoi du lien du rapport à l'e-mail saisi (défaut : envoyé) */
  ANALYSIS_EMAIL_REPORT: z.enum(['0', '1']).optional().catch(undefined),
  // GEO-OPT : off = aucune IA dans le module (gabarits et règles seulement)
  GEO_LLM: z.enum(['on', 'off']).optional().catch(undefined),
  // SEO-DATA : sans clé, chaque source est « non configurée » (rien n'est estimé)
  GOOGLE_CLIENT_ID: str(),
  GOOGLE_CLIENT_SECRET: str(),
  PAGESPEED_API_KEY: str(),
  CRUX_API_KEY: str(),
  DATAFORSEO_LOGIN: str(),
  DATAFORSEO_PASSWORD: str(),
  SEODATA_EUR_PER_USD: num(0.92),
  // PUBLICATION : fiche Google (accès API à obtenir) et fichiers de thème Shopify (exemption Shopify)
  PUBLISH_GBP_ENABLED: flag(),
  SHOPIFY_THEME_WRITE: flag(),
  /** 0 = l'agent ne crée plus de brouillons automatiquement après les explorations (défaut : actif) */
  PUBLISH_AGENT_AUTO: z.enum(['0', '1']).optional().catch(undefined),
  // BAROMÈTRE : passe mensuelle automatique seulement si BAROMETRE_ENABLED=1 (décision fondateur, coût IA)
  BAROMETRE_ENABLED: flag(),
  BAROMETRE_BUDGET_EUR: num(120),
  BAROMETRE_PROVIDERS: str(),
  BAROMETRE_DEMO_PREVIEW: flag(),

  // Réglages numériques existants
  AUDIT_RATE_LIMIT_PER_DAY: num(5),
  AUDIT_GLOBAL_PER_DAY: num(300),
  AUDIT_GLOBAL_PER_HOUR: num(60),
  AUDIT_PER_EMAIL_PER_DAY: num(3),
  EMAIL_GLOBAL_PER_DAY: num(200),
});

export type AppEnv = z.infer<typeof EnvSchema>;
export type EnvMode = 'demo' | 'development' | 'production';

export interface EnvReport {
  ok: boolean;
  mode: EnvMode;
  /** Production réelle (hors build), quel que soit le mode démo. */
  production: boolean;
  /** Variables obligatoires absentes ou invalides (bloquant en production hors démo). */
  errors: string[];
  /** Briques désactivées, incohérences non bloquantes. */
  warnings: string[];
  /** Noms des variables manquantes (sans valeur). */
  missing: string[];
  env: AppEnv;
}

interface Rule {
  name: string;
  /** Valeur effective (alias inclus). */
  get: (s: Source) => string | undefined;
  check?: (v: string) => string | null;
  why: string;
}

const v = (k: string) => (s: Source) => {
  const x = s[k]?.trim();
  return x ? x : undefined;
};
const minLen = (n: number) => (x: string) => (x.length >= n ? null : `au moins ${n} caractères (openssl rand -hex 32)`);
const prefix = (...p: string[]) => (x: string) => (p.some((q) => x.startsWith(q)) ? null : `doit commencer par ${p.join(' ou ')}`);

/** Secrets et réglages sans lesquels la production ne démarre pas. */
export const REQUIRED_IN_PRODUCTION: Rule[] = [
  { name: 'SUPABASE_URL', get: (s) => v('SUPABASE_URL')(s) ?? v('NEXT_PUBLIC_SUPABASE_URL')(s), why: 'base de données (sinon écriture ouverte sur un disque éphémère)' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', get: v('SUPABASE_SERVICE_ROLE_KEY'), check: minLen(40), why: 'accès serveur à la base' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', get: (s) => v('NEXT_PUBLIC_SUPABASE_ANON_KEY')(s) ?? v('SUPABASE_ANON_KEY')(s), why: 'connexion des clients' },
  { name: 'NEXT_PUBLIC_APP_URL', get: (s) => v('NEXT_PUBLIC_APP_URL')(s) ?? v('APP_URL')(s), check: prefix('https://'), why: 'liens des e-mails et retours Stripe' },
  { name: 'STRIPE_SECRET_KEY', get: v('STRIPE_SECRET_KEY'), check: prefix('sk_live_', 'sk_test_', 'rk_live_'), why: 'paiement' },
  { name: 'STRIPE_WEBHOOK_SECRET', get: v('STRIPE_WEBHOOK_SECRET'), check: prefix('whsec_'), why: 'signature du webhook Stripe' },
  { name: 'RESEND_API_KEY', get: v('RESEND_API_KEY'), check: prefix('re_'), why: 'envoi des e-mails' },
  { name: 'CRON_SECRET', get: v('CRON_SECRET'), check: minLen(16), why: 'protection des crons et du worker' },
  { name: 'UNSUBSCRIBE_SECRET', get: v('UNSUBSCRIBE_SECRET'), check: minLen(16), why: 'liens de désinscription signés' },
  { name: 'AUDIT_SIGNING_SECRET', get: v('AUDIT_SIGNING_SECRET'), check: minLen(16), why: 'liens signés (plan PDF, « C’est fait »)' },
  { name: 'RATE_LIMIT_SALT', get: v('RATE_LIMIT_SALT'), check: minLen(16), why: 'hachage des IP (limitation de débit)' },
  // F3 de qa/v3/securite-v3.md : plus de repli sur un autre secret (ni sur la clé service_role) en production.
  { name: 'SHARE_SECRET', get: v('SHARE_SECRET'), check: minLen(16), why: 'liens de partage et confirmations de rapports' },
  { name: 'INTEGRATIONS_SECRET', get: v('INTEGRATIONS_SECRET'), check: minLen(16), why: 'chiffrement des webhooks et jetons Shopify' },
];

function isOn(x: string | undefined): boolean {
  return ['1', 'true', 'on', 'yes'].includes((x ?? '').trim().toLowerCase());
}

/** Production réelle à l'exécution (le build n'est jamais concerné). */
export function isProductionRuntime(source: Source = process.env): boolean {
  if (source.NEXT_PHASE === 'phase-production-build') return false;
  return source.VERCEL_ENV === 'production' || source.APP_ENV === 'production';
}

/** Valide un environnement (par défaut `process.env`) sans jamais lever. */
export function validateEnv(source: Source = process.env): EnvReport {
  const parsed = EnvSchema.safeParse(source);
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${issue.path.join('.')} : ${issue.message}`);
  }
  const env = (parsed.success ? parsed.data : EnvSchema.parse({})) as AppEnv;
  const production = isProductionRuntime(source);
  const explicitDemo = isOn(source.DEMO_MODE);
  const hasDb = Boolean(v('SUPABASE_SERVICE_ROLE_KEY')(source) && (v('SUPABASE_URL')(source) ?? v('NEXT_PUBLIC_SUPABASE_URL')(source)));
  const mode: EnvMode = explicitDemo || (!production && !hasDb) ? 'demo' : production ? 'production' : 'development';

  for (const r of REQUIRED_IN_PRODUCTION) {
    const val = r.get(source);
    if (!val) {
      missing.push(r.name);
      if (mode === 'production') errors.push(`${r.name} manquante : ${r.why}`);
      else if (mode === 'development') warnings.push(`${r.name} absente : ${r.why} (désactivé)`);
      continue;
    }
    const problem = r.check?.(val);
    if (problem) {
      if (mode === 'production') errors.push(`${r.name} invalide : ${problem}`);
      else warnings.push(`${r.name} : ${problem}`);
    }
  }

  if (production && explicitDemo) warnings.push('DEMO_MODE=1 en production : données simulées, aucun paiement réel.');
  if (production && v('STRIPE_SECRET_KEY')(source)?.startsWith('sk_test_')) warnings.push('STRIPE_SECRET_KEY est une clé de test en production.');
  const ai = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY'].filter((k) => v(k)(source));
  if (mode !== 'demo' && ai.length === 0) warnings.push('Aucune clé IA : les audits sont simulés (étiquetés « démo »).');
  if (production && !v('SENTRY_DSN')(source)) warnings.push('SENTRY_DSN absent : les erreurs ne sont que dans les logs.');
  if (mode === 'production' && isOn(source.AUTH_LOCAL_ACCOUNTS)) {
    warnings.push('AUTH_LOCAL_ACCOUNTS=1 en production : à réserver au dépannage (comptes locaux sans Supabase).');
  }
  if (mode === 'production' && !v('NEXT_PUBLIC_SUPABASE_URL')(source)) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL absente au build : la CSP (connect-src) bloquera la connexion depuis le navigateur.');
  }
  for (const k of ['AUTH_SECRET'] as const) {
    if (mode === 'production' && !v(k)(source)) warnings.push(`${k} absent : repli sur un autre secret (à séparer, openssl rand -hex 32).`);
  }
  if (production && isOn(source.CSP_DISABLE)) warnings.push('CSP_DISABLE=1 : aucune politique de sécurité du contenu en production.');
  if (Boolean(v('SHOPIFY_CLIENT_ID')(source)) !== Boolean(v('SHOPIFY_CLIENT_SECRET')(source))) warnings.push('SHOPIFY_CLIENT_ID et SHOPIFY_CLIENT_SECRET vont ensemble : connecteur Shopify désactivé.');
  // V5 (facultatives) : incohérences signalées, jamais bloquantes.
  if (Boolean(v('DATAFORSEO_LOGIN')(source)) !== Boolean(v('DATAFORSEO_PASSWORD')(source))) warnings.push('DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD vont ensemble : positions et volumes « non configurés ».');
  if (Boolean(v('GOOGLE_CLIENT_ID')(source)) !== Boolean(v('GOOGLE_CLIENT_SECRET')(source))) warnings.push('GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble : connexion Google (Search Console, GA4) désactivée.');
  if (isOn(source.SHOPIFY_THEME_WRITE) && !v('SHOPIFY_CLIENT_ID')(source)) warnings.push('SHOPIFY_THEME_WRITE=1 sans application Shopify (SHOPIFY_CLIENT_ID) : sans effet hors jeton d’app saisi par le client.');
  if (isOn(source.BAROMETRE_ENABLED) && ai.length === 0) warnings.push('BAROMETRE_ENABLED=1 sans clé IA : aucune mesure réelle possible, aucun baromètre publié.');
  if (production && isOn(source.BAROMETRE_DEMO_PREVIEW)) warnings.push('BAROMETRE_DEMO_PREVIEW=1 en production : ignoré (aperçu local seulement).');
  if (v('SUPABASE_URL')(source) && v('NEXT_PUBLIC_SUPABASE_URL')(source) && v('SUPABASE_URL')(source) !== v('NEXT_PUBLIC_SUPABASE_URL')(source)) {
    warnings.push('SUPABASE_URL et NEXT_PUBLIC_SUPABASE_URL diffèrent.');
  }

  return { ok: errors.length === 0, mode, production, errors, warnings, missing, env };
}

/** Message lisible pour un humain (console Vercel, terminal). */
export function formatEnvReport(r: EnvReport): string {
  const lines = [`[env] mode ${r.mode}${r.production ? ' (production)' : ''} : ${r.ok ? 'configuration valide' : 'CONFIGURATION INVALIDE'}`];
  for (const e of r.errors) lines.push(`  ✗ ${e}`);
  for (const w of r.warnings) lines.push(`  ! ${w}`);
  if (!r.ok) lines.push('  → Renseignez ces variables (voir .env.example et scripts/ops/mise-en-production.md), ou DEMO_MODE=1 pour une démo assumée.');
  return lines.join('\n');
}

export class EnvError extends Error {
  report: EnvReport;
  constructor(report: EnvReport) {
    super(formatEnvReport(report));
    this.name = 'EnvError';
    this.report = report;
  }
}

let cached: EnvReport | null = null;

/** Rapport mis en cache pour `process.env` (à appeler à l'exécution, pas au chargement des modules). */
export function envReport(): EnvReport {
  if (!cached) cached = validateEnv(process.env);
  return cached;
}

/** Tests : oublie le rapport mis en cache. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Au démarrage : écrit le rapport, et **lève une erreur en production** si un secret obligatoire manque
 * (sauf `DEMO_MODE=1`). Renvoie les variables typées.
 */
export function assertEnv(source: Source = process.env): AppEnv {
  const r = source === process.env ? envReport() : validateEnv(source);
  if (!r.ok && r.mode === 'production') throw new EnvError(r);
  if (r.warnings.length || !r.ok) {
    if (!source.VITEST) console.warn(formatEnvReport(r));
  }
  return r.env;
}

/** Variables typées (valeurs par défaut appliquées). Lève en production si la configuration est invalide. */
export function getEnv(): AppEnv {
  return assertEnv(process.env);
}

/** Mode démo effectif. */
export function isDemoMode(source: Source = process.env): boolean {
  return validateEnv(source).mode === 'demo';
}
