/**
 * Authentification et périmètre de l'API publique (REST et MCP).
 *
 * - Jeton : `Authorization: Bearer rp_live_…` (ou en-tête `X-Api-Key`). Jamais dans l'URL (journaux, historiques).
 * - Offre : l'API est réservée aux offres Accompagné et Agence (et à la démo). Une clé d'espace sur un espace repassé
 *   en Essentiel ou Découverte renvoie 402 ; une clé d'agence ignore simplement les espaces hors offre Agence.
 * - Périmètre réévalué à chaque requête : clé d'espace → le créateur doit être encore propriétaire ou administrateur ;
 *   clé d'agence → espaces en offre Agence dont le créateur est propriétaire ou administrateur.
 * - Isolation : tout espace hors périmètre répond 404 « Espace introuvable » (comme un espace inexistant : aucune
 *   information sur l'existence d'espaces d'autres clients).
 */
import { API_TIERS, apiLimitFor, getEntitlements, type Entitlements } from '@/lib/entitlements';
import { DEMO_IDS, isDemoBusinessId } from '@/lib/demo-v2';
import type { BusinessRecord } from '@/lib/db';
import { ApiError } from './errors';
import { verifyApiKey, type ApiKeyRecord, type KeyAccess, type KeyScope } from './keys';

/** Offres qui ouvrent l'API publique : la table des droits fait foi (src/lib/entitlements.ts, champ `api`). */
export { API_TIERS };

/** Droit d'accès à l'API publique : champ `api` des droits (repli sur le niveau pour un objet partiel). */
export function apiAllowed(e: Pick<Entitlements, 'tier'> & Partial<Pick<Entitlements, 'api'>>): boolean {
  return typeof e.api === 'boolean' ? e.api : apiLimitFor(e.tier);
}

export const PLAN_REQUIRED_MESSAGE = 'L’API publique est incluse dans les offres Accompagné et Agence. Changez d’offre depuis Réglages › Offre et facturation.';

export interface Principal {
  keyId: string;
  demo: boolean;
  access: KeyAccess;
  scope: KeyScope | { kind: 'demo' };
  /** utilisateur créateur (clés réelles) */
  userId: string | null;
  /** enregistrement de la clé (clés réelles), pour noter la dernière utilisation */
  record: ApiKeyRecord | null;
}

/** Dépendances (base de données) injectables pour les tests. */
export interface AccessDeps {
  getBusinessRecord(id: string): Promise<BusinessRecord | null>;
  getRole(businessId: string, userId: string): Promise<string | null>;
  listBusinessesForUser(userId: string): Promise<BusinessRecord[]>;
}

async function defaultDeps(): Promise<AccessDeps> {
  const db = await import('@/lib/db');
  return {
    getBusinessRecord: (id) => db.getBusinessRecord(id),
    async getRole(businessId, userId) {
      const m = await db.getMembership(businessId, userId).catch(() => null);
      if (m?.role) return m.role;
      const b = await db.getBusinessRecord(businessId).catch(() => null);
      return b?.ownerId === userId ? 'owner' : null;
    },
    listBusinessesForUser: async (userId) => (await db.listBusinessesForUser(userId)) as BusinessRecord[],
  };
}

let depsOverride: Partial<AccessDeps> | null = null;
/** Tests : remplace tout ou partie des accès base de données. `null` rétablit. */
export function __setAccessDeps(d: Partial<AccessDeps> | null): void {
  depsOverride = d;
}
async function deps(): Promise<AccessDeps> {
  return { ...(await defaultDeps()), ...(depsOverride ?? {}) };
}

/** Lit le jeton : Authorization Bearer (prioritaire) ou X-Api-Key. */
export function tokenOf(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (h) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(h);
    return m ? m[1] : null;
  }
  const k = req.headers.get('x-api-key');
  return k ? k.trim() : null;
}

/** 401 si le jeton est absent, mal formé, inconnu ou révoqué (même message dans tous les cas). */
export async function authenticate(req: Request): Promise<Principal> {
  const token = tokenOf(req);
  if (!token) throw new ApiError(401, 'unauthorized', 'Clé d’API manquante : ajoutez l’en-tête « Authorization: Bearer <votre clé> ».');
  const v = await verifyApiKey(token);
  if (!v) throw new ApiError(401, 'unauthorized', 'Clé d’API invalide ou révoquée.');
  if (v.demo) return { keyId: v.id, demo: true, access: 'read', scope: { kind: 'demo' }, userId: null, record: null };
  return { keyId: v.id, demo: false, access: v.record.access, scope: v.record.scope, userId: v.record.createdBy.userId, record: v.record };
}

export function requireWrite(p: Principal): void {
  if (p.demo) throw new ApiError(403, 'demo_read_only', 'Clé de démonstration : lecture seule, aucune modification n’est enregistrée.');
  if (p.access !== 'write') throw new ApiError(403, 'insufficient_scope', 'Cette clé est en lecture seule : créez une clé « lecture et écriture » dans Réglages › API.');
}

const isAdminRole = (r: string | null) => r === 'owner' || r === 'admin';

export interface SpaceAccess {
  business: BusinessRecord;
  entitlements: Entitlements;
}

/**
 * Espaces accessibles à cette clé (ordre stable). Clé d'espace hors offre : 402 (le client sait pourquoi sa clé ne
 * marche plus). Créateur qui a perdu son rôle : 401 (la clé est de fait révoquée).
 */
export async function spacesOf(p: Principal): Promise<SpaceAccess[]> {
  const d = await deps();
  if (p.scope.kind === 'demo') {
    const out: SpaceAccess[] = [];
    for (const id of DEMO_IDS) {
      const b = await d.getBusinessRecord(id).catch(() => null);
      if (b) out.push({ business: b, entitlements: getEntitlements(b) });
    }
    return out;
  }
  if (p.scope.kind === 'space') {
    const id = p.scope.businessId;
    const b = isDemoBusinessId(id) ? null : await d.getBusinessRecord(id).catch(() => null);
    if (!b || !p.userId || !isAdminRole(await d.getRole(id, p.userId))) throw new ApiError(401, 'unauthorized', 'Clé d’API invalide ou révoquée.');
    const e = getEntitlements(b);
    if (!apiAllowed(e)) throw new ApiError(402, 'plan_required', PLAN_REQUIRED_MESSAGE);
    return [{ business: b, entitlements: e }];
  }
  // Agence : espaces en offre Agence où le créateur est propriétaire ou administrateur.
  const userId = p.scope.userId;
  const list = await d.listBusinessesForUser(userId).catch(() => [] as BusinessRecord[]);
  const out: SpaceAccess[] = [];
  for (const b of list) {
    if (isDemoBusinessId(b.id)) continue;
    const e = getEntitlements(b);
    if (!e.agency.portfolio || !apiAllowed(e)) continue;
    if (!isAdminRole(await d.getRole(b.id, userId))) continue;
    out.push({ business: b, entitlements: e });
  }
  out.sort((a, b) => a.business.name.localeCompare(b.business.name, 'fr') || a.business.id.localeCompare(b.business.id));
  if (!out.length) throw new ApiError(402, 'plan_required', 'Aucun espace en offre Agence n’est rattaché à cette clé. ' + PLAN_REQUIRED_MESSAGE);
  return out;
}

const SPACE_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

/** Un espace du périmètre, ou 404 (jamais 403 : pas d'oracle sur l'existence des espaces des autres). */
export async function requireSpace(p: Principal, spaceId: string): Promise<SpaceAccess> {
  if (!SPACE_ID_RE.test(spaceId)) throw new ApiError(404, 'not_found', 'Espace introuvable.');
  const spaces = await spacesOf(p);
  const s = spaces.find((x) => x.business.id === spaceId);
  if (!s) throw new ApiError(404, 'not_found', 'Espace introuvable.');
  return s;
}
