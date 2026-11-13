/**
 * Catalogue des variables de PRODUCTION de Repéré : où trouver chaque clé, son format, si elle est obligatoire.
 * Source unique pour scripts/ops/secrets.mjs (modèle .env.production.local), scripts/ops/check-env.mjs --prod
 * (contrôle avant mise en ligne) et docs/MISE-EN-LIGNE.md. Pages vérifiées le 2026-11-13.
 */

/** Secrets internes générés par secrets.mjs (32 octets aléatoires, 64 caractères hexadécimaux). */
export const INTERNAL_SECRETS = [
  { name: 'AUTH_SECRET', why: 'signature des sessions de connexion' },
  { name: 'SHARE_SECRET', why: 'liens de partage et confirmations de rapports' },
  { name: 'INTEGRATIONS_SECRET', why: 'chiffrement des webhooks et jetons Shopify (NE JAMAIS CHANGER une fois en service)' },
  { name: 'RATE_LIMIT_SALT', why: 'hachage des adresses IP (limitation de débit)' },
  { name: 'AUDIT_SIGNING_SECRET', why: 'liens signés (plan PDF, « C’est fait »)' },
  { name: 'DIGEST_SIGNING_SECRET', why: 'liens signés du résumé hebdomadaire' },
  { name: 'CRON_SECRET', why: 'protection des crons et du worker' },
  { name: 'UNSUBSCRIBE_SECRET', why: 'liens de désinscription signés' },
  { name: 'ADMIN_TOKEN', why: 'accès à /admin (à garder pour vous)' },
];
export const INTERNAL_SECRET_BYTES = 32;

const err = (msg) => ({ level: 'error', msg });
const warn = (msg) => ({ level: 'warn', msg });

/** Charge utile d'un JWT (sans vérifier la signature), ou null. */
export function jwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3 || !parts[0].startsWith('eyJ')) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Référence du projet Supabase dans https://<ref>.supabase.co */
export function supabaseRef(url) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(String(url ?? '').trim());
  return m ? m[1] : null;
}

/** Clé de Luhn (SIREN 9 chiffres, SIRET 14 chiffres). La Poste (SIRET 356000000xxxxx) fait exception. */
export function luhnOk(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const PLACEHOLDER = /\[?\s*(à|a) compl[ée]ter|\[à vérifier|xxx|000 000 000|prénom nom|votre-domaine|exemple\.fr|example\.com/i;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

function supabaseKeyCheck(v, env, expected) {
  if (expected === 'anon') {
    if (v.startsWith('sb_secret_')) return err('c’est une clé SECRÈTE : collez ici la clé « publishable » (sb_publishable_…)');
    if (v.startsWith('sb_publishable_')) return null;
  } else {
    if (v.startsWith('sb_publishable_')) return err('c’est la clé publique : collez ici la clé « secret » (sb_secret_…)');
    if (v.startsWith('sb_secret_')) return null;
  }
  const p = jwtPayload(v);
  if (!p) return err(expected === 'anon' ? 'doit commencer par sb_publishable_ (ou être l’ancienne clé anon eyJ…)' : 'doit commencer par sb_secret_ (ou être l’ancienne clé service_role eyJ…)');
  if (expected === 'anon' && p.role !== 'anon') return err(`clé JWT de rôle « ${p.role} » : il faut la clé anon (publique)`);
  if (expected === 'service' && p.role !== 'service_role') return err(`clé JWT de rôle « ${p.role} » : il faut la clé service_role`);
  const ref = supabaseRef(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref && p.ref && p.ref !== ref) return err(`clé d’un autre projet Supabase (${p.ref}) que SUPABASE_URL (${ref})`);
  return null;
}

/**
 * Variables externes et de configuration. `required` : obligatoire pour la production.
 * `vercel: false` : utilisée seulement par les scripts (jamais envoyée à Vercel).
 */
export const CATALOG = [
  // --- Site ---
  {
    name: 'NEXT_PUBLIC_APP_URL', group: 'Site', required: true, sensitive: false,
    where: 'Votre domaine, par ex. https://repere-ia.fr (Vercel › Settings › Domains)',
    check: (v) => (!/^https:\/\/[^/]+$/.test(v) ? err('doit être https://domaine, sans chemin ni barre finale') : /localhost|vercel\.app$/.test(v) ? warn('adresse provisoire : mettez le domaine définitif avant d’encaisser') : null),
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL', group: 'Site', required: true, sensitive: false,
    where: 'Même valeur que NEXT_PUBLIC_APP_URL (adresse canonique pour Google et les IA)',
    check: (v, env) => (!/^https:\/\/[^/]+$/.test(v) ? err('doit être https://domaine, sans barre finale') : env.NEXT_PUBLIC_APP_URL && v !== env.NEXT_PUBLIC_APP_URL ? warn('diffère de NEXT_PUBLIC_APP_URL') : null),
  },
  {
    name: 'NEXT_PUBLIC_CONTACT_EMAIL', group: 'Site', required: true, sensitive: false,
    where: 'Adresse de contact publique (pied de page, llms.txt)',
    check: (v) => (EMAIL.test(v) ? null : err('adresse e-mail invalide')),
  },
  {
    name: 'EMAIL_FROM', group: 'Site', required: true, sensitive: false,
    where: 'Expéditeur des e-mails, sur le domaine vérifié chez Resend, par ex. « Repéré <bonjour@mail.votre-domaine.fr> »',
    check: (v) => (/^([^<>]+<)?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(v.trim()) ? null : err('format attendu : Nom <adresse@domaine>')),
  },
  { name: 'EMAIL_REPLY_TO', group: 'Site', required: false, sensitive: false, where: 'Adresse de réponse (facultatif)', check: (v) => (EMAIL.test(v) ? null : err('adresse e-mail invalide')) },

  // --- Supabase ---
  {
    name: 'SUPABASE_URL', group: 'Supabase', required: true, sensitive: false,
    where: 'https://supabase.com/dashboard/project/_?showConnect=true (bouton « Connect » : Project URL)',
    check: (v) => (!/^https:\/\//.test(v) ? err('doit commencer par https://') : supabaseRef(v) ? null : warn('n’a pas la forme https://<ref>.supabase.co (domaine personnalisé ?)')),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL', group: 'Supabase', required: true, sensitive: false,
    where: 'Même valeur que SUPABASE_URL',
    check: (v, env) => (env.SUPABASE_URL && v !== env.SUPABASE_URL ? err('doit être identique à SUPABASE_URL') : null),
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', group: 'Supabase', required: true, sensitive: false,
    where: 'https://supabase.com/dashboard/project/_/settings/api-keys (clé « Publishable », sb_publishable_…)',
    check: (v, env) => supabaseKeyCheck(v, env, 'anon'),
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY', group: 'Supabase', required: true, sensitive: true,
    where: 'https://supabase.com/dashboard/project/_/settings/api-keys (clé « Secret », sb_secret_… : « Reveal »)',
    check: (v, env) => (v.length < 40 ? err('trop courte : copiez la clé entière') : supabaseKeyCheck(v, env, 'service')),
  },
  {
    name: 'DATABASE_URL', group: 'Supabase', required: false, sensitive: true, vercel: false,
    where: 'https://supabase.com/dashboard/project/_?showConnect=true › « Session pooler » › URI (remplacez [YOUR-PASSWORD]). Scripts seulement, pas Vercel.',
    check: (v) => (/YOUR-PASSWORD/i.test(v) ? err('remplacez [YOUR-PASSWORD] par le mot de passe de la base') : !/^postgres(ql)?:\/\//.test(v) ? err('doit commencer par postgresql://') : null),
  },
  {
    name: 'SUPABASE_JWT_SECRET', group: 'Supabase', required: false, sensitive: true,
    where: 'Facultatif (accélère la vérification des sessions) : https://supabase.com/dashboard/project/_/settings/jwt (Legacy JWT secret)',
    check: (v) => (v.length < 32 ? warn('semble trop court') : null),
  },

  // --- Stripe ---
  {
    name: 'STRIPE_SECRET_KEY', group: 'Stripe', required: true, sensitive: true,
    where: 'https://dashboard.stripe.com/apikeys en mode « live » (clé secrète sk_live_… ; pour un essai, la même page dans un sandbox donne sk_test_…)',
    check: (v) => (/^pk_/.test(v) ? err('clé PUBLIQUE (pk_) : il faut la clé secrète sk_live_…') : /^(sk_live_|rk_live_)/.test(v) ? null : /^sk_test_/.test(v) ? warn('clé de TEST : aucun paiement réel ne sera encaissé') : err('doit commencer par sk_live_ (ou rk_live_)')),
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET', group: 'Stripe', required: true, sensitive: true,
    where: 'Imprimé par node scripts/ops/stripe-setup.mjs (ou Stripe › Développeurs › Webhooks › votre endpoint › « Révéler »)',
    check: (v) => (/^whsec_/.test(v) ? null : err('doit commencer par whsec_')),
  },
  { name: 'STRIPE_TAX_RATE_ID', group: 'Stripe', required: false, sensitive: false, where: 'Seulement si vous facturez la TVA (txr_…) ; vide en franchise de TVA', check: (v) => (/^txr_/.test(v) ? null : err('doit commencer par txr_')) },

  // --- E-mails ---
  {
    name: 'RESEND_API_KEY', group: 'Resend', required: true, sensitive: true,
    where: 'https://resend.com/api-keys (« Create API Key », permission Sending access) ; domaine : https://resend.com/domains',
    check: (v) => (/^re_[A-Za-z0-9_]{10,}$/.test(v) ? null : err('doit commencer par re_')),
  },

  // --- IA (au moins une ; les trois premières pour un audit complet) ---
  { name: 'OPENAI_API_KEY', group: 'IA', required: false, ai: true, sensitive: true, where: 'https://platform.openai.com/api-keys', check: (v) => (/^sk-/.test(v) ? null : err('doit commencer par sk-')) },
  { name: 'PERPLEXITY_API_KEY', group: 'IA', required: false, ai: true, sensitive: true, where: 'https://console.perplexity.ai/project/keys', check: (v) => (/^pplx-/.test(v) ? null : warn('format inhabituel (les clés commencent d’ordinaire par pplx-)')) },
  { name: 'GEMINI_API_KEY', group: 'IA', required: false, ai: true, sensitive: true, where: 'https://aistudio.google.com/apikey', check: (v) => (/^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_.-]{20,})$/.test(v) ? null : warn('format inhabituel (AIza… ou AQ.…)')) },
  { name: 'ANTHROPIC_API_KEY', group: 'IA', required: false, ai: true, sensitive: true, where: 'https://platform.claude.com/settings/keys', check: (v) => (/^sk-ant-/.test(v) ? null : err('doit commencer par sk-ant-')) },
  { name: 'MISTRAL_API_KEY', group: 'IA', required: false, ai: true, sensitive: true, where: 'https://console.mistral.ai/api-keys (moyen de paiement requis)', check: (v) => (/^[A-Za-z0-9]{32}$/.test(v) ? null : warn('format inhabituel (32 caractères attendus)')) },
  {
    name: 'GOOGLE_PLACES_KEY', group: 'Google', required: false, sensitive: true,
    where: 'https://console.cloud.google.com/apis/credentials (API Places (New) activée : https://console.cloud.google.com/apis/library/places.googleapis.com)',
    check: (v) => (/^AIza[0-9A-Za-z_-]{35}$/.test(v) ? null : warn('format inhabituel (AIza… attendu)')),
  },

  // --- V5 : données SEO et publication (toutes facultatives : sans elles, « non configuré », rien n'est inventé) ---
  {
    name: 'GOOGLE_CLIENT_ID', group: 'Données SEO', required: false, sensitive: false,
    where: 'https://console.cloud.google.com/apis/credentials › Créer un ID client OAuth (application Web) ; URI de redirection <APP_URL>/api/v5/connect/google/callback et <APP_URL>/api/connect/ga4/callback ; activer « Google Search Console API »',
    check: (v) => (/\.apps\.googleusercontent\.com$/.test(v) ? null : warn('format inhabituel (…apps.googleusercontent.com attendu)')),
  },
  {
    name: 'GOOGLE_CLIENT_SECRET', group: 'Données SEO', required: false, sensitive: true,
    where: 'https://console.cloud.google.com/apis/credentials (même client OAuth que GOOGLE_CLIENT_ID)',
    check: (v, env) => (env?.GOOGLE_CLIENT_ID ? (/^GOCSPX-/.test(v) ? null : warn('format inhabituel (GOCSPX-… attendu)')) : warn('GOOGLE_CLIENT_ID manquant : la connexion Google reste désactivée')),
  },
  {
    name: 'PAGESPEED_API_KEY', group: 'Données SEO', required: false, sensitive: true,
    where: 'https://developers.google.com/speed/docs/insights/v5/get-started (« Get a Key ») ; activer « PageSpeed Insights API » et « Chrome UX Report API » sur https://console.cloud.google.com/apis/library — gratuit',
    check: (v) => (/^AIza[0-9A-Za-z_-]{35}$/.test(v) ? null : warn('format inhabituel (AIza… attendu)')),
  },
  {
    name: 'CRUX_API_KEY', group: 'Données SEO', required: false, sensitive: true,
    where: 'https://developer.chrome.com/docs/crux/api (facultatif : vide = PAGESPEED_API_KEY)',
    check: (v) => (/^AIza[0-9A-Za-z_-]{35}$/.test(v) ? null : warn('format inhabituel (AIza… attendu)')),
  },
  {
    name: 'DATAFORSEO_LOGIN', group: 'Données SEO', required: false, sensitive: false,
    where: 'https://app.dataforseo.com/api-access (identifiant API, paiement à l’appel, dépôt minimal 50 $)',
    check: (v, env) => (env?.DATAFORSEO_PASSWORD ? null : warn('DATAFORSEO_PASSWORD manquant : positions et volumes non configurés')),
  },
  {
    name: 'DATAFORSEO_PASSWORD', group: 'Données SEO', required: false, sensitive: true,
    where: 'https://app.dataforseo.com/api-access (mot de passe API, différent du mot de passe du compte)',
  },

  // --- Suivi des erreurs ---
  { name: 'SENTRY_DSN', group: 'Suivi', required: false, sensitive: false, where: 'https://sentry.io › Settings › Projects › Client Keys (DSN) — facultatif', check: (v) => (/^https:\/\/[^@]+@[^/]+\/\d+$/.test(v) ? null : err('DSN invalide (https://clé@hôte/numéro)')) },

  // --- Identité légale (publiée : mentions légales, CGV, confidentialité, JSON-LD, llms.txt) ---
  { name: 'NEXT_PUBLIC_LEGAL_NAME', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Nom et prénom de l’entrepreneur individuel, ou dénomination de la société (extrait Kbis / avis INSEE)' },
  { name: 'NEXT_PUBLIC_LEGAL_FORM', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Forme juridique, par ex. « entrepreneur individuel (micro-entrepreneur) » ou « SAS au capital de 1 000 € »' },
  {
    name: 'NEXT_PUBLIC_LEGAL_SIREN', group: 'Légal', required: true, legal: true, sensitive: false,
    where: 'https://annuaire-entreprises.data.gouv.fr (9 chiffres)',
    check: (v) => { const d = v.replace(/\s/g, ''); return !/^\d{9}$/.test(d) ? err('9 chiffres attendus') : luhnOk(d) ? null : err('numéro SIREN invalide (clé de contrôle)'); },
  },
  {
    name: 'NEXT_PUBLIC_LEGAL_SIRET', group: 'Légal', required: false, legal: true, sensitive: false,
    where: 'SIRET de l’établissement (14 chiffres), même source',
    check: (v, env) => { const d = v.replace(/\s/g, ''); const siren = (env.NEXT_PUBLIC_LEGAL_SIREN ?? '').replace(/\s/g, ''); if (!/^\d{14}$/.test(d)) return err('14 chiffres attendus'); if (siren && !d.startsWith(siren)) return err('ne commence pas par le SIREN'); return luhnOk(d) || d.startsWith('356000000') ? null : err('numéro SIRET invalide (clé de contrôle)'); },
  },
  {
    name: 'NEXT_PUBLIC_LEGAL_RCS_CITY', group: 'Légal', required: false, legal: true, sensitive: false,
    where: 'Ville du greffe du RCS (extrait Kbis) : obligatoire pour une société',
    check: (v) => (/\d/.test(v) ? err('indiquez seulement la ville (ex. Lyon)') : null),
  },
  { name: 'NEXT_PUBLIC_LEGAL_STREET', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Adresse du siège ou de domiciliation (numéro et rue)' },
  { name: 'NEXT_PUBLIC_LEGAL_POSTAL_CODE', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Code postal (5 chiffres)', check: (v) => (/^\d{5}$/.test(v) ? null : err('5 chiffres attendus')) },
  { name: 'NEXT_PUBLIC_LEGAL_CITY', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Ville' },
  { name: 'NEXT_PUBLIC_LEGAL_EMAIL', group: 'Légal', required: true, legal: true, sensitive: false, where: 'E-mail de contact de l’éditeur (mentions légales, droits RGPD)', check: (v) => (EMAIL.test(v) ? null : err('adresse e-mail invalide')) },
  { name: 'NEXT_PUBLIC_LEGAL_PHONE', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Téléphone de l’éditeur (obligatoire dans les mentions légales, loi pour la confiance dans l’économie numérique, art. 6)', check: (v) => (/^\+?[\d\s.]{9,20}$/.test(v) ? null : err('numéro invalide')) },
  { name: 'NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Directeur de la publication : Prénom NOM (et qualité pour une société)' },
  { name: 'NEXT_PUBLIC_LEGAL_FOUNDING_DATE', group: 'Légal', required: false, legal: true, sensitive: false, where: 'Date de création AAAA ou AAAA-MM-JJ (facultatif)', check: (v) => (/^\d{4}(-\d{2}-\d{2})?$/.test(v) ? null : err('format AAAA ou AAAA-MM-JJ')) },
  { name: 'NEXT_PUBLIC_FOUNDER_NAME', group: 'Légal', required: true, legal: true, sensitive: false, where: 'Prénom NOM du fondateur (page /a-propos, JSON-LD Person)' },
  { name: 'NEXT_PUBLIC_FOUNDER_TITLE', group: 'Légal', required: false, legal: true, sensitive: false, where: 'Fonction (défaut : Fondateur)' },
  { name: 'NEXT_PUBLIC_FOUNDER_BIO', group: 'Légal', required: true, legal: true, sensitive: false, where: '2 ou 3 phrases de parcours vérifiable', check: (v) => (v.length < 60 ? warn('bio très courte (2 ou 3 phrases attendues)') : null) },
  { name: 'NEXT_PUBLIC_FOUNDER_LINKEDIN', group: 'Légal', required: false, legal: true, sensitive: false, where: 'URL du profil LinkedIn (facultatif)', check: (v) => (/^https:\/\/([a-z]+\.)?linkedin\.com\//.test(v) ? null : err('URL LinkedIn https://… attendue')) },
  { name: 'NEXT_PUBLIC_FOUNDER_IMAGE', group: 'Légal', required: false, legal: true, sensitive: false, where: 'URL https d’une photo (facultatif)', check: (v) => (/^https:\/\//.test(v) ? null : err('URL https attendue')) },
  { name: 'NEXT_PUBLIC_SAME_AS', group: 'Légal', required: false, legal: true, sensitive: false, where: 'Profils officiels séparés par des virgules (LinkedIn entreprise, Pappers…), facultatif' },
];

/**
 * Copies serveur des champs légaux (pied des e-mails, src/lib/email.ts), dérivées des NEXT_PUBLIC_LEGAL_*.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function derivedLegal(env) {
  const street = env.NEXT_PUBLIC_LEGAL_STREET?.trim();
  const city = [env.NEXT_PUBLIC_LEGAL_POSTAL_CODE?.trim(), env.NEXT_PUBLIC_LEGAL_CITY?.trim()].filter(Boolean).join(' ');
  return {
    LEGAL_NAME: env.NEXT_PUBLIC_LEGAL_NAME?.trim() || '',
    LEGAL_ADDRESS: [street, city].filter(Boolean).join(', '),
    LEGAL_SIREN: (env.NEXT_PUBLIC_LEGAL_SIREN ?? '').replace(/\s/g, ''),
  };
}

/** Même règle que ENTITY_READY de src/lib/seo/site.ts (fondateur + SIREN + adresse). */
export function entityReady(env) {
  const g = (k) => (env[k] ?? '').trim();
  return Boolean(g('NEXT_PUBLIC_FOUNDER_NAME') && g('NEXT_PUBLIC_FOUNDER_BIO') && g('NEXT_PUBLIC_LEGAL_SIREN') && g('NEXT_PUBLIC_LEGAL_STREET') && g('NEXT_PUBLIC_LEGAL_CITY'));
}

export { PLACEHOLDER, EMAIL };
