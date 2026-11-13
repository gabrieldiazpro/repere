/**
 * Liens fixes du menu, dans un module sans dépendance : les composants client (MobileMenu) les importent sans
 * embarquer nav.ts, qui charge les guides, le registre des outils et l'aide (≈ 300 ko de JavaScript de dev évités).
 */
export const LOGIN_HREF = "/connexion";
export const DEMO_HREF = "/demo";
