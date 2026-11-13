/**
 * Point d'entrée des modules partagés pour QUESTIONS (docs/v3/12-CONTRATS-V3.md), raccordé à l'intégration V3 :
 * - `requireBusiness`, `HttpError`, `Role` (@/lib/auth) ;
 * - `getEntitlements`, `assertEntitled`, `Entitlements` (@/lib/entitlements) ;
 * - récupération sûre d'une page : `fetchPageSnapshot` (@/lib/siteaudit : anti-SSRF, robots.txt, délais, taille max).
 */
import { fetchPageSnapshot } from '@/lib/siteaudit';

export { requireBusiness, HttpError, type Role } from '@/lib/auth';
export { getEntitlements, assertEntitled, type Entitlements } from '@/lib/entitlements';

export interface SiteSnapshot {
  url: string;
  title?: string;
  description?: string;
  headings: string[];
}

export type SiteFetcher = (url: string) => Promise<SiteSnapshot | null>;

/**
 * Récupérateur de page sûr fourni par AUDIT-SITE. Aucune récupération « maison » : en cas d'échec, null, et les
 * suggestions se rabattent sur la catégorie et l'offre. Désactivable par PROMPTS_SITE_FETCH=off (tests, hors ligne).
 */
export function getSiteFetcher(): SiteFetcher | null {
  if (process.env.PROMPTS_SITE_FETCH === 'off') return null;
  return (u: string) => fetchPageSnapshot(u, { timeoutMs: 6_000 });
}
