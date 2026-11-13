/**
 * Récupération d'URL publique pour l'import de catalogue : délègue à la récupération sûre de `@/lib/siteaudit`
 * (anti-SSRF, robots.txt respecté, délai, taille maximale). Le `Fetcher` est injectable pour les tests.
 */
import { tryFetch } from '@/lib/siteaudit';

export interface FetchedPage {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export type Fetcher = (url: string, accept?: 'html' | 'json' | 'xml') => Promise<FetchedPage | null>;

const ACCEPT = {
  html: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  json: 'application/json,*/*;q=0.5',
  xml: 'application/xml,text/xml,*/*;q=0.5',
};

/** GET sûr ; null en cas d'échec (jamais d'exception). */
export const safeFetch: Fetcher = async (url, accept = 'html') => {
  const r = await tryFetch(url, { accept: ACCEPT[accept] });
  if (!r) return null;
  return { url: r.finalUrl || r.url, status: r.status, contentType: r.contentType, body: r.body };
};
