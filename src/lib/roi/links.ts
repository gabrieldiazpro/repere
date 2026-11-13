/**
 * Liens entrants gagnés par les pages des baromètres (DataForSEO Backlinks, cible = adresse de chaque page publiée).
 * Seulement si les liens entrants sont activés sur la plateforme (SEODATA_BACKLINKS_ENABLED=1, engagement pris) et
 * DataForSEO configuré. Relevé une fois par mois (cache `roi.links` / `<AAAA-MM>`), plafonné par ROI_LINKS_CAP_EUR
 * (défaut 2 €/mois, ≈ 0,02 $ par page) sur le registre de coûts SEO-DATA du compte « repere-roi ».
 */
import { barometrePath, listPublished } from '@/lib/barometre/public';
import { abs } from '@/lib/seo/site';
import { reserve } from '@/lib/seodata/cost';
import { DataForSeoClient, dataForSeoConfigured } from '@/lib/seodata/dataforseo';
import { backlinksCostUsd, backlinksPlatformEnabled } from '@/lib/seodata/limits';
import { getDoc, putDoc } from '@/lib/store';
import { monthOf } from './visits';

export const LINKS = 'roi.links';
export const ROI_LEDGER_ID = 'repere-roi';
const MAX_PAGES = 50;

export interface BarometreLinks {
  month: string;
  at: string;
  pages: { slug: string; url: string; backlinks: number; referringDomains: number }[];
  backlinks: number;
  referringDomains: number;
}

export type BarometreLinksView = { state: 'off'; reason: string } | { state: 'empty'; reason: string } | ({ state: 'ok' } & BarometreLinks) | { state: 'error'; reason: string };

function capEur(): number {
  const n = Number(process.env.ROI_LINKS_CAP_EUR);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

export function linksOff(): string | null {
  if (!backlinksPlatformEnabled()) return 'Liens entrants non activés (SEODATA_BACKLINKS_ENABLED) : aucun relevé.';
  if (!dataForSeoConfigured()) return 'DataForSEO non configuré : aucun relevé.';
  return null;
}

/** Liens des pages baromètre du mois (cache) ; `refresh` relève si le mois n'a pas encore été relevé. */
export async function barometreLinks(opts: { refresh?: boolean; now?: Date; client?: DataForSeoClient } = {}): Promise<BarometreLinksView> {
  const off = linksOff();
  if (off && !opts.client) return { state: 'off', reason: off };
  const month = monthOf(opts.now);
  const hit = (await getDoc<BarometreLinks>(LINKS, month))?.data;
  if (hit) return { state: 'ok', ...hit };
  if (!opts.refresh) return { state: 'empty', reason: 'Pas encore relevé ce mois-ci.' };
  const published = (await listPublished().catch(() => [])).slice(0, MAX_PAGES);
  if (!published.length) return { state: 'empty', reason: 'Aucun baromètre publié : aucune page à relever.' };
  try {
    const client = opts.client ?? new DataForSeoClient((op, usd) => reserve(ROI_LEDGER_ID, op, usd, capEur(), opts.now));
    const pages: BarometreLinks['pages'] = [];
    for (const e of published) {
      const url = abs(barometrePath(e.slug));
      const tasks = await client.post<Record<string, unknown>>('/backlinks/summary/live', { target: url, include_subdomains: false }, 'backlinks.roi', backlinksCostUsd(1));
      const r = DataForSeoClient.first<Record<string, unknown>>(tasks);
      pages.push({ slug: e.slug, url, backlinks: Number(r?.backlinks ?? 0), referringDomains: Number(r?.referring_domains ?? 0) });
    }
    const v: BarometreLinks = {
      month,
      at: (opts.now ?? new Date()).toISOString(),
      pages,
      backlinks: pages.reduce((a, p) => a + p.backlinks, 0),
      referringDomains: pages.reduce((a, p) => a + p.referringDomains, 0),
    };
    await putDoc(LINKS, month, v);
    return { state: 'ok', ...v };
  } catch (e) {
    return { state: 'error', reason: (e as Error).message || 'Relevé impossible.' };
  }
}
