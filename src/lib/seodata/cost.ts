/**
 * Plafond de coût par compte et par mois : chaque appel payant est d'abord RÉSERVÉ (estimation), refusé s'il ferait
 * dépasser le plafond de l'offre, puis ajusté au coût réel renvoyé par le fournisseur (DataForSEO renvoie `cost`).
 * Journal : collection `seodata.costs`, un document par compte et par mois (`<businessId>:<AAAA-MM>`).
 */
import { getDoc, putDoc } from '@/lib/store';
import { SeoDataError, monthKey } from './http';
import { eurPerUsd } from './limits';

export const COSTS = 'seodata.costs';

export interface CostLedger {
  businessId: string;
  month: string;
  /** dépense engagée (réservations + ajustements), en dollars US */
  spentUsd: number;
  calls: number;
  byOp: Record<string, { calls: number; usd: number }>;
  refused: number;
  updatedAt: string;
}

const locks = new Map<string, Promise<unknown>>();
function serial<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(k) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(k, tail);
  void tail.then(() => {
    if (locks.get(k) === tail) locks.delete(k);
  });
  return run;
}

const empty = (businessId: string, month: string): CostLedger => ({ businessId, month, spentUsd: 0, calls: 0, byOp: {}, refused: 0, updatedAt: new Date().toISOString() });

export async function getLedger(businessId: string, now: Date = new Date()): Promise<CostLedger> {
  const month = monthKey(now);
  return (await getDoc<CostLedger>(COSTS, `${businessId}:${month}`))?.data ?? empty(businessId, month);
}

export interface BudgetView {
  month: string;
  spentEur: number;
  capEur: number;
  remainingEur: number;
  calls: number;
  refused: number;
}

export async function budgetView(businessId: string, capEur: number, now: Date = new Date()): Promise<BudgetView> {
  const l = await getLedger(businessId, now);
  const spentEur = Math.round(l.spentUsd * eurPerUsd() * 10_000) / 10_000;
  return { month: l.month, spentEur, capEur, remainingEur: Math.max(0, Math.round((capEur - spentEur) * 10_000) / 10_000), calls: l.calls, refused: l.refused };
}

/**
 * Réserve `usd` pour l'opération `op`. Lève SeoDataError('budget') si le plafond mensuel (en euros) serait dépassé.
 * Renvoie une fonction d'ajustement à appeler avec le coût réel (ou rien pour garder l'estimation).
 */
export async function reserve(businessId: string, op: string, usd: number, capEur: number, now: Date = new Date()): Promise<(actualUsd?: number | null) => Promise<void>> {
  const month = monthKey(now);
  const id = `${businessId}:${month}`;
  await serial(id, async () => {
    const l = (await getDoc<CostLedger>(COSTS, id))?.data ?? empty(businessId, month);
    const capUsd = capEur / eurPerUsd();
    if (capEur <= 0 || l.spentUsd + usd > capUsd + 1e-9) {
      l.refused += 1;
      l.updatedAt = now.toISOString();
      await putDoc(COSTS, id, l, businessId);
      throw new SeoDataError(
        'budget',
        capEur <= 0
          ? 'Les données payantes (positions, volumes, liens) ne sont pas incluses dans votre offre.'
          : `Plafond mensuel de données atteint (${capEur.toFixed(2).replace('.', ',')} €). Les relevés reprendront le mois prochain.`,
      );
    }
    l.spentUsd = round(l.spentUsd + usd);
    l.calls += 1;
    const o = (l.byOp[op] ??= { calls: 0, usd: 0 });
    o.calls += 1;
    o.usd = round(o.usd + usd);
    l.updatedAt = now.toISOString();
    await putDoc(COSTS, id, l, businessId);
  });
  let settled = false;
  return async (actualUsd?: number | null) => {
    if (settled || actualUsd === undefined || actualUsd === null || !Number.isFinite(actualUsd)) return;
    settled = true;
    const delta = actualUsd - usd;
    if (Math.abs(delta) < 1e-9) return;
    await serial(id, async () => {
      const l = (await getDoc<CostLedger>(COSTS, id))?.data ?? empty(businessId, month);
      l.spentUsd = round(Math.max(0, l.spentUsd + delta));
      const o = (l.byOp[op] ??= { calls: 0, usd: 0 });
      o.usd = round(Math.max(0, o.usd + delta));
      l.updatedAt = new Date().toISOString();
      await putDoc(COSTS, id, l, businessId);
    });
  };
}

const round = (n: number) => Math.round(n * 1e7) / 1e7;
