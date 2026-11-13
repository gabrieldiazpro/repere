/**
 * Mode d'authentification, lu à chaque appel (les tests changent l'environnement) :
 * - 'supabase' : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY → Supabase Auth ;
 * - 'local'    : sans Supabase, hors production (ou AUTH_LOCAL_ACCOUNTS=1) → « compte local de développement »,
 *                lien magique affiché dans la console, session signée HMAC ;
 * - 'off'      : production sans Supabase → aucune connexion possible (jamais d'accès ouvert, A12 de docs/v3/10).
 */
export type AuthMode = 'supabase' | 'local' | 'off';

export function supabaseUrl(): string {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
}

export function serviceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

/** Clé publique (anon) ; à défaut la clé service_role (appels serveur uniquement). */
export function anonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || serviceRoleKey();
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function authMode(): AuthMode {
  if (supabaseUrl() && serviceRoleKey()) return 'supabase';
  if (!isProduction()) return 'local';
  // Dépannage sur machine dédiée uniquement : jamais sur Vercel (liens magiques dans les journaux, F1 de securite-v3).
  if (process.env.AUTH_LOCAL_ACCOUNTS === '1' && !process.env.VERCEL) return 'local';
  return 'off';
}

/**
 * Bac à sable local : sans Supabase et hors production, un commerce SANS aucun membre (créé par un test ou un script)
 * reste accessible sans session, comme en V2. Jamais en production.
 */
export function sandboxOpen(): boolean {
  return authMode() === 'local' && !isProduction();
}

/** Secret HMAC des sessions locales, des paramètres de rattachement signés et des jetons d'invitation. */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (isProduction()) throw new Error('AUTH_SECRET manquant');
  return 'repere-dev-auth-secret';
}
