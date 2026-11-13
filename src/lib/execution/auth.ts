/**
 * Contrôle d'accès des routes /api/exec/* — désormais adossé à `requireBusiness` (@/lib/auth) : session cookie
 * httpOnly (ou Bearer), rôles, comptes démo en lecture seule côté serveur (qa/v2/securite-v2.md E1).
 */
export { bearer, canEditBusiness, BUSINESS_ID_RE } from '@/lib/auth/compat';
