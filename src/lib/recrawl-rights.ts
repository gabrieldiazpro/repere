/**
 * Droits d'exploration manuelle du site depuis l'app (APP-SEO, « Relancer l'exploration ») par offre.
 * Fichier de données pur (sans dépendance serveur) : lu par src/lib/entitlements.ts (champ `recrawl`) et par
 * src/components/app/seo/model.ts (écrans clients). Proposition APP-SEO reprise telle quelle (13 nov. 2026) ;
 * le nombre de pages est borné par le budget de 50 s d'une exploration lancée depuis la page.
 */
export interface CrawlRights {
  maxPages: number;
  /** explorations manuelles autorisées par période */
  perPeriod: number;
  periodDays: number;
  label: string;
}

export const CRAWL_RIGHTS: Record<'decouverte' | 'essentiel' | 'accompagne' | 'agence' | 'demo', CrawlRights> = {
  decouverte: { maxPages: 60, perPeriod: 1, periodDays: 7, label: '1 exploration par semaine, 60 pages' },
  essentiel: { maxPages: 300, perPeriod: 1, periodDays: 1, label: '1 exploration par jour, jusqu’à 300 pages' },
  accompagne: { maxPages: 1000, perPeriod: 3, periodDays: 1, label: '3 explorations par jour, jusqu’à 1 000 pages' },
  agence: { maxPages: 2000, perPeriod: 10, periodDays: 1, label: '10 explorations par jour, jusqu’à 2 000 pages' },
  demo: { maxPages: 60, perPeriod: 0, periodDays: 1, label: 'Démo : exploration de démonstration' },
};

export function crawlRights(tier: string): CrawlRights {
  return (CRAWL_RIGHTS as Record<string, CrawlRights>)[tier] ?? CRAWL_RIGHTS.decouverte;
}
