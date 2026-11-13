/**
 * Appels Supabase Auth côté serveur, sans @supabase/ssr (non installé) : @supabase/supabase-js + cookies gérés à la main.
 * - lien magique PKCE : le vérificateur est capturé dans un stockage mémoire puis posé en cookie httpOnly (rp_pkce) ;
 * - échange du code (`?code=`) ou vérification d'un `token_hash` (liens générés par le serveur : achat, invitation) ;
 * - rafraîchissement par jeton de rafraîchissement (middleware) ;
 * - administration (service_role) : recherche et création d'utilisateurs, génération de liens.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { anonKey, serviceRoleKey, supabaseUrl } from './config';
import { verifyHs256, type JwtClaims } from './cookies';

const STORAGE_KEY = 'rp';
const VERIFIER_KEY = `${STORAGE_KEY}-code-verifier`;

export interface SupabaseTokens {
  accessToken: string;
  refreshToken: string;
  /** secondes */
  expiresIn: number;
  userId: string;
  email: string;
}

/** Stockage mémoire jetable (un client par requête : aucun partage de session entre utilisateurs). */
function memoryStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    map: m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

function publicClient(storage?: ReturnType<typeof memoryStorage>): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), {
    auth: {
      flowType: 'pkce',
      storageKey: STORAGE_KEY,
      storage,
      persistSession: Boolean(storage),
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let _admin: SupabaseClient | null = null;
let _adminKey = '';
export function adminClient(): SupabaseClient {
  const key = `${supabaseUrl()}|${serviceRoleKey()}`;
  if (!_admin || _adminKey !== key) {
    _admin = createClient(supabaseUrl(), serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    _adminKey = key;
  }
  return _admin;
}

function toTokens(s: { access_token: string; refresh_token: string; expires_in?: number; user?: { id: string; email?: string } | null } | null): SupabaseTokens | null {
  if (!s?.access_token || !s.user?.id) return null;
  return {
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    expiresIn: s.expires_in ?? 3600,
    userId: s.user.id,
    email: (s.user.email ?? '').toLowerCase(),
  };
}

/**
 * Envoie le lien magique (e-mail Supabase) en flux PKCE. Renvoie le vérificateur à poser en cookie httpOnly.
 * `shouldCreateUser: false` : seul le serveur crée des comptes (inscription Découverte, paiement).
 */
export async function sendOtpPkce(email: string, redirectTo: string): Promise<{ verifier: string | null; error: string | null }> {
  const storage = memoryStorage();
  const { error } = await publicClient(storage).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  return { verifier: storage.map.get(VERIFIER_KEY) ?? null, error: error?.message ?? null };
}

/** Échange `?code=` (PKCE) contre une session. */
export async function exchangeCode(code: string, verifier: string): Promise<SupabaseTokens | null> {
  const storage = memoryStorage({ [VERIFIER_KEY]: verifier });
  const { data, error } = await publicClient(storage).auth.exchangeCodeForSession(code);
  if (error) return null;
  return toTokens(data.session);
}

/** Vérifie un `token_hash` (lien généré par `generateLink`). */
export async function verifyTokenHash(tokenHash: string, type: 'magiclink' | 'email' | 'invite' | 'signup' = 'email'): Promise<SupabaseTokens | null> {
  const { data, error } = await publicClient().auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return null;
  return toTokens(data.session);
}

export async function refreshTokens(refreshToken: string): Promise<SupabaseTokens | null> {
  try {
    const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error) return null;
    return toTokens(data.session);
  } catch {
    return null;
  }
}

// Petit cache des jetons vérifiés (évite un aller-retour Supabase à chaque requête d'une même page).
const verified = new Map<string, { claims: JwtClaims; until: number }>();

/** Vérifie un jeton d'accès : HS256 local si SUPABASE_JWT_SECRET, sinon `auth.getUser` (réseau, mis en cache 60 s). */
export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
  const local = verifyHs256(token, process.env.SUPABASE_JWT_SECRET);
  if (local === 'invalid') return null;
  if (local) return local.sub ? { userId: local.sub, email: String(local.email ?? '').toLowerCase() } : null;
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return { userId: String(hit.claims.sub), email: String(hit.claims.email ?? '') };
  try {
    const { data, error } = await adminClient().auth.getUser(token);
    if (error || !data.user) return null;
    const claims = { sub: data.user.id, email: (data.user.email ?? '').toLowerCase() };
    if (verified.size > 500) verified.clear();
    verified.set(token, { claims, until: Date.now() + 60_000 });
    return { userId: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}

export async function signOutToken(accessToken: string): Promise<void> {
  try {
    await adminClient().auth.admin.signOut(accessToken);
  } catch {
    /* jeton déjà expiré : rien à faire */
  }
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export interface AuthUserInfo {
  id: string;
  email: string;
  confirmed: boolean;
}

/** Recherche par e-mail via la fonction SQL `find_auth_user` (listUsers ne filtre pas ; migration 0003). */
export async function findUserByEmail(email: string): Promise<AuthUserInfo | null> {
  const { data, error } = await adminClient().rpc('find_auth_user', { p_email: email.toLowerCase() });
  if (error) throw new Error(`[auth] find_auth_user : ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; email?: string; email_confirmed_at?: string | null } | null;
  if (!row?.id) return null;
  return { id: row.id, email: String(row.email ?? email).toLowerCase(), confirmed: Boolean(row.email_confirmed_at) };
}

/** Crée un utilisateur NON confirmé : l'adresse sera confirmée au premier clic sur le lien magique. */
export async function createUser(email: string): Promise<AuthUserInfo> {
  const { data, error } = await adminClient().auth.admin.createUser({ email: email.toLowerCase(), email_confirm: false });
  if (error || !data.user) {
    const again = await findUserByEmail(email);
    if (again) return again;
    throw new Error(`[auth] création du compte impossible : ${error?.message ?? 'inconnue'}`);
  }
  return { id: data.user.id, email: email.toLowerCase(), confirmed: Boolean(data.user.email_confirmed_at) };
}

/** Lien magique généré côté serveur (envoyé par nos e-mails) : on ne garde que le `hashed_token`. */
export async function generateMagicTokenHash(email: string): Promise<string | null> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'magiclink', email: email.toLowerCase() });
  if (error) {
    console.error('[auth] generateLink', error.message);
    return null;
  }
  return data.properties?.hashed_token ?? null;
}
