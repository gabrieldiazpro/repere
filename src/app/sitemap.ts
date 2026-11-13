import type { MetadataRoute } from 'next';
import { TRADES, PRIORITY_TRADES, CITIES, getSeoStats, isIndexable, tradePath, pairPath } from '@/lib/seo';
import { CATEGORIES, getSegmentStats, isSegmentIndexable, categoryPath } from '@/lib/seo/segments';
import { GUIDES, guidePath } from '@/lib/seo/guides';
import { ENTITY_READY, HOUSE_PAGE_PATH, PAGE_UPDATED, TRADE_PAGES_UPDATED, abs, type StaticPath } from '@/lib/seo/site';
import { housePageLive } from '@/lib/seo/house';
import { STUDIES, studyPath } from '@/lib/studies';
import { NEW_ROUTES_UPDATED, v3Routes } from '@/lib/seo/routes';
import { buildRanking, listRankingPairs } from '@/lib/growth/ranking';
import { publishedEntries } from '@/lib/barometre/public';

/** Le sitemap se régénère une fois par jour (pages métier × ville qui deviennent indexables). */
export const revalidate = 86400;

/**
 * Règle : uniquement des URL indexables (jamais de noindex), lastmod = date réelle de modification du contenu
 * (constantes PAGE_UPDATED, dates des guides et études, date du dernier audit pour les pages de données).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages en noindex : légales (placeholders), /a-propos tant que l'entité n'est pas complète.
  const NOINDEX: StaticPath[] = ['/cgv', '/mentions-legales', '/confidentialite', ...(ENTITY_READY ? [] : (['/a-propos'] as StaticPath[]))];
  const entries: MetadataRoute.Sitemap = (Object.keys(PAGE_UPDATED) as StaticPath[])
    .filter((p) => !NOINDEX.includes(p))
    .map((p) => ({ url: abs(p), lastModified: PAGE_UPDATED[p] }));

  for (const t of TRADES) entries.push({ url: abs(tradePath(t)), lastModified: TRADE_PAGES_UPDATED });
  for (const g of GUIDES) entries.push({ url: abs(guidePath(g)), lastModified: g.updated });
  for (const s of STUDIES) entries.push({ url: abs(studyPath(s)), lastModified: s.updated });

  // Pages V3 (outils, fonctionnalités, démo, comparatifs par concurrent…) : seulement celles dont le dossier existe
  // (vérifié avec fs) et qui ne sont pas en noindex.
  for (const r of v3Routes()) entries.push({ url: abs(r.path), lastModified: NEW_ROUTES_UPDATED });

  // Classement public : seulement quand au moins un classement métier × ville est publié (10 inscrits réels minimum).
  try {
    const published: { tradeSlug: string; citySlug: string }[] = [];
    for (const p of (await listRankingPairs()).slice(0, 40)) {
      if ((await buildRanking(p.tradeSlug, p.citySlug)).state === 'published') published.push(p);
    }
    if (published.length) {
      entries.push({ url: abs('/classement'), lastModified: NEW_ROUTES_UPDATED });
      for (const p of published) entries.push({ url: abs(`/classement/${p.tradeSlug}/${p.citySlug}`), lastModified: NEW_ROUTES_UPDATED });
    }
  } catch {
    /* base indisponible : on ne liste pas le classement */
  }

  // Baromètres V5 : seulement ceux réellement mesurés et publiés (vide tant que rien n'est mesuré).
  try {
    for (const b of await publishedEntries()) entries.push({ url: abs(b.path), lastModified: b.lastModified });
  } catch {
    /* base indisponible */
  }

  // Page officielle de Repéré (dogfooding), seulement si elle existe et est indexable.
  if (await housePageLive()) entries.push({ url: abs(HOUSE_PAGE_PATH), lastModified: PAGE_UPDATED['/a-propos'] });

  // Pages métier × ville : seulement celles éligibles à l'indexation ; lastmod = date du dernier audit pris en compte.
  for (const t of PRIORITY_TRADES) {
    for (const c of CITIES) {
      const stats = await getSeoStats(t.slug, c.slug);
      if (stats && isIndexable(stats)) entries.push({ url: abs(pairPath(t, c)), lastModified: stats.lastUpdated });
    }
  }
  // Pages catégorie PME / e-commerce : même règle.
  for (const c of CATEGORIES) {
    const stats = await getSegmentStats(c.segment, c.slug);
    if (stats && isSegmentIndexable(stats)) entries.push({ url: abs(categoryPath(c)), lastModified: stats.lastUpdated });
  }
  return entries;
}
