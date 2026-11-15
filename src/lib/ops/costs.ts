/**
 * Dépense estimée du jour (jour de Paris) chez les fournisseurs payants, à partir des compteurs EXISTANTS :
 *
 * | Source            | Compteur existant                                   | Pas      |
 * |-------------------|-----------------------------------------------------|----------|
 * | copilote (IA)     | `copilot.usage` `day:AAAA-MM-JJ` (src/lib/copilot/budget.ts) | jour |
 * | audits (IA)       | `audits.result.details.estimatedCostEur` (Supabase)  | audit    |
 * | DataForSEO        | `seodata.costs` (src/lib/seodata/cost.ts), en USD    | mois     |
 * | baromètre (IA)    | `barometre.budget` (src/lib/barometre/storage.ts)    | mois     |
 * | autres            | `ops.costs` `AAAA-MM-JJ` via `recordProviderCost()`  | jour     |
 *
 * Pour les compteurs mensuels, la part du jour = total du mois maintenant − dernier total observé la veille
 * (`ops.costsnap`). Ce sont des ESTIMATIONS (coûts déclarés par nos appels, pas les factures des fournisseurs).
 */
import { createClient } from '@supabase/supabase-js';
import { getDoc, incrDoc, listDocs, putDoc } from '@/lib/store';
import { OPS, opsConfig, parisDay, parisDayStart } from './config';

export type CostSource = 'copilot' | 'audits' | 'dataforseo' | 'barometre' | 'other';

export const COST_LABEL: Record<CostSource, string> = {
  copilot: 'Copilote (IA)',
  audits: 'Audits (IA)',
  dataforseo: 'DataForSEO',
  barometre: 'Baromètre (IA)',
  other: 'Autres appels déclarés',
};

export interface DailyCosts {
  day: string;
  totalEur: number;
  bySource: Record<CostSource, number>;
  capEur: number;
  over: boolean;
  /** Part du plafond consommée (0..∞), null sans plafond. */
  ratio: number | null;
}

interface MonthTotals {
  month: string;
  dataforseoEur: number;
  barometreEur: number;
}
interface SnapLast extends MonthTotals {
  day: string;
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const monthOf = (d: Date) => d.toISOString().slice(0, 7);

function eurPerUsd(): number {
  const n = Number(process.env.SEODATA_EUR_PER_USD);
  return Number.isFinite(n) && n > 0 && n < 5 ? n : 0.92;
}

async function monthTotals(now: Date): Promise<MonthTotals> {
  const month = monthOf(now);
  let usd = 0;
  for (const d of await listDocs<{ month?: string; spentUsd?: number }>('seodata.costs', { limit: 5000 })) {
    if (d.data.month === month) usd += Number(d.data.spentUsd) || 0;
  }
  const bar = (await getDoc<{ spentEur?: number }>('barometre.budget', month))?.data.spentEur ?? 0;
  return { month, dataforseoEur: r4(usd * eurPerUsd()), barometreEur: r4(Number(bar) || 0) };
}

/** Somme des coûts estimés des audits créés aujourd'hui (Supabase uniquement ; en démo les IA sont simulées). */
async function auditsTodayEur(now: Date): Promise<number> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return 0;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb
    .from('audits')
    .select('cost:result->details->estimatedCostEur')
    .gte('created_at', parisDayStart(now).toISOString())
    .limit(5000)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error(`[ops] coûts des audits : ${error.message}`);
  return r4(((data ?? []) as { cost: unknown }[]).reduce((s, r) => s + (Number(r.cost) || 0), 0));
}

async function copilotTodayEur(now: Date): Promise<number> {
  const doc = await getDoc<{ milliEur?: number }>('copilot.usage', `day:${parisDay(now)}`);
  return r4((doc?.data.milliEur ?? 0) / 1000);
}

/** Pour un module qui appelle un fournisseur payant sans compteur propre. Ne lève jamais. */
export async function recordProviderCost(eur: number, now: Date = new Date()): Promise<void> {
  if (!Number.isFinite(eur) || eur <= 0) return;
  try {
    await incrDoc(OPS.costs, parisDay(now), { milliEur: Math.round(eur * 1000) });
  } catch {
    /* jamais bloquant */
  }
}

/**
 * Part du jour des compteurs mensuels. Met à jour le dernier total observé.
 * Base du jour = dernier total observé un jour précédent du même mois (0 si le mois vient de changer).
 */
async function monthlyToday(now: Date): Promise<{ dataforseo: number; barometre: number }> {
  const day = parisDay(now);
  const cur = await monthTotals(now);
  let base = (await getDoc<SnapLast>(OPS.costSnap, `base:${day}`))?.data ?? null;
  if (!base) {
    const last = (await getDoc<SnapLast>(OPS.costSnap, 'last'))?.data ?? null;
    const firstOfMonth = day.endsWith('-01');
    if (last && last.month === cur.month && last.day < day) base = { ...last, day };
    else if (last && last.month !== cur.month && firstOfMonth) base = { day, month: cur.month, dataforseoEur: 0, barometreEur: 0 };
    // Aucun relevé exploitable : la dépense antérieure du jour est inconnue, on compte à partir de maintenant
    // (prudence : ne jamais attribuer au jour la dépense de tout le mois et déclencher une pause à tort).
    else base = { ...cur, day };
    await putDoc(OPS.costSnap, `base:${day}`, base);
  }
  await putDoc<SnapLast>(OPS.costSnap, 'last', { ...cur, day });
  if (base.month !== cur.month) return { dataforseo: cur.dataforseoEur, barometre: cur.barometreEur };
  return { dataforseo: r4(Math.max(0, cur.dataforseoEur - base.dataforseoEur)), barometre: r4(Math.max(0, cur.barometreEur - base.barometreEur)) };
}

export interface CostDeps {
  now?: Date;
  env?: Record<string, string | undefined>;
  /** Tests : remplace la lecture des audits (Supabase). */
  audits?: (now: Date) => Promise<number>;
}

/** Dépense estimée du jour, par source, face au plafond OPS_DAILY_COST_CAP_EUR. Une source illisible compte 0. */
export async function dailyCosts(deps: CostDeps = {}): Promise<DailyCosts & { unreadable: CostSource[] }> {
  const now = deps.now ?? new Date();
  const cfg = opsConfig(deps.env ?? process.env);
  const unreadable: CostSource[] = [];
  const safe = async <T>(src: CostSource, fn: () => Promise<T>, def: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      unreadable.push(src);
      return def;
    }
  };
  const [copilot, audits, monthly, other] = await Promise.all([
    safe('copilot', () => copilotTodayEur(now), 0),
    safe('audits', () => (deps.audits ?? auditsTodayEur)(now), 0),
    safe('dataforseo', () => monthlyToday(now), { dataforseo: 0, barometre: 0 }),
    safe('other', async () => ((await getDoc<{ milliEur?: number }>(OPS.costs, parisDay(now)))?.data.milliEur ?? 0) / 1000, 0),
  ]);
  const bySource: Record<CostSource, number> = { copilot, audits, dataforseo: monthly.dataforseo, barometre: monthly.barometre, other: r4(other) };
  const totalEur = r4(Object.values(bySource).reduce((a, b) => a + b, 0));
  const capEur = cfg.dailyCostCapEur;
  return {
    day: parisDay(now),
    totalEur,
    bySource,
    capEur,
    over: capEur > 0 && totalEur > capEur,
    ratio: capEur > 0 ? r4(totalEur / capEur) : null,
    unreadable,
  };
}
