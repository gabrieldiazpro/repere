/**
 * Rôles d'équipe (V3) et erreur HTTP partagée par les routes protégées.
 * - owner  : facturation, membres, suppression ;
 * - admin  : membres (sauf propriétaires), réglages ;
 * - member : contributeur (coche les tâches, modifie la fiche de vérité) ;
 * - viewer : lecteur (voit et reçoit les rapports).
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export const ROLES: readonly Role[] = ['owner', 'admin', 'member', 'viewer'];

export const ROLE_RANK: Readonly<Record<Role, number>> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Contributeur',
  viewer: 'Lecteur',
};

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

/** `role` vaut au moins `min` ? */
export function hasRole(role: Role | null | undefined, min: Role): boolean {
  return Boolean(role) && ROLE_RANK[role as Role] >= ROLE_RANK[min];
}

/** Rôles qu'un membre peut attribuer (invitation, changement de rôle) : jamais au-dessus du sien ; owner seul nomme admin. */
export function assignableRoles(by: Role): Role[] {
  if (by === 'owner') return ['owner', 'admin', 'member', 'viewer'];
  if (by === 'admin') return ['member', 'viewer'];
  return [];
}

/** Erreur à statut HTTP (401, 402, 403, 404…), convertie en réponse JSON par `httpErrorResponse`. */
export class HttpError extends Error {
  status: number;
  /** Code machine facultatif (ex. 'upgrade_required', 'demo_read_only'). */
  code?: string;
  constructor(status: number, message?: string, code?: string) {
    super(message ?? defaultMessage(status));
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Requête invalide.';
    case 401:
      return 'Connectez-vous pour continuer.';
    case 402:
      return 'Cette fonction n’est pas incluse dans votre offre.';
    case 403:
      return 'Vous n’avez pas accès à cet espace.';
    case 404:
      return 'Introuvable.';
    case 409:
      return 'Conflit.';
    case 429:
      return 'Trop de tentatives, réessayez plus tard.';
    case 503:
      return 'Service momentanément indisponible.';
    default:
      return 'Erreur.';
  }
}

/** Réponse JSON `{ error, code? }` pour une HttpError (sans dépendre de next/server). */
export function httpErrorResponse(e: HttpError): Response {
  return new Response(JSON.stringify({ error: e.message, ...(e.code ? { code: e.code } : {}) }), {
    status: e.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
