/**
 * Usage réel d'un onglet payant de l'app (aujourd'hui : /app/seo/liens), compté côté serveur à l'affichage.
 * Document `roi.usage` / `<AAAA-MM>` : clés `<onglet>|<businessId>` = nombre d'affichages. Comptes démo ignorés.
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getDoc, incrDoc } from '@/lib/store';
import { monthOf } from './visits';

export const USAGE = 'roi.usage';
export type UsageTab = 'liens';

export async function recordTabView(businessId: string | null | undefined, tab: UsageTab, now: Date = new Date()): Promise<void> {
  if (!businessId || isDemoBusinessId(businessId) || !/^[A-Za-z0-9_-]{1,80}$/.test(businessId)) return;
  try {
    await incrDoc(USAGE, monthOf(now), { [`${tab}|${businessId}`]: 1 });
  } catch {
    /* mesure facultative */
  }
}

export interface TabUsage {
  month: string;
  views: number;
  /** comptes distincts qui ont ouvert l'onglet */
  accounts: number;
  byAccount: Record<string, number>;
}

/** Lecture pure d'un document du mois. */
export function summarizeUsage(month: string, tab: UsageTab, doc: Record<string, number> | null | undefined): TabUsage {
  const out: TabUsage = { month, views: 0, accounts: 0, byAccount: {} };
  for (const [k, raw] of Object.entries(doc ?? {})) {
    if (!k.startsWith(`${tab}|`)) continue;
    const n = Number(raw) || 0;
    out.views += n;
    out.byAccount[k.slice(tab.length + 1)] = n;
  }
  out.accounts = Object.keys(out.byAccount).length;
  return out;
}

export async function readTabUsage(tab: UsageTab, month: string): Promise<TabUsage> {
  return summarizeUsage(month, tab, (await getDoc<Record<string, number>>(USAGE, month))?.data);
}
