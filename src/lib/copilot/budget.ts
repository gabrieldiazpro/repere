/**
 * Plafond de coût journalier du copilote (COPILOT_DAILY_BUDGET_EUR, défaut 2 €), tous clients confondus,
 * compté dans `copilot.usage` (id `day:YYYY-MM-DD`, jour de Paris). Au-delà : réponses préparées sans LLM.
 */
import { getDoc, incrDoc } from '@/lib/store';

const COLL = 'copilot.usage';

export function dailyBudgetEur(): number {
  const v = Number(process.env.COPILOT_DAILY_BUDGET_EUR);
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

function dayKey(d = new Date()): string {
  return `day:${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)}`;
}

export async function spentTodayEur(): Promise<number> {
  const doc = await getDoc<{ milliEur?: number }>(COLL, dayKey());
  return (doc?.data.milliEur ?? 0) / 1000;
}

/** Plafond journalier par compte (COPILOT_BUSINESS_DAILY_BUDGET_EUR, défaut 0,50 €) : un compte ne vide pas le budget de tous. */
export function businessDailyBudgetEur(): number {
  const v = Number(process.env.COPILOT_BUSINESS_DAILY_BUDGET_EUR);
  return Number.isFinite(v) && v >= 0 ? v : 0.5;
}

/**
 * Réserve le pire cas AVANT l'appel (incrément atomique puis relecture, sûr en concurrence — qa/v2/securite-v2.md E2).
 * Renvoie le montant réservé en milli-euros, ou null si le plafond global ou celui du compte serait dépassé.
 */
export async function reserveBudget(estimateEur: number, businessId: string): Promise<number | null> {
  const milli = Math.ceil(estimateEur * 1000);
  const day = dayKey();
  const mine = `${day}:${businessId}`;
  await incrDoc(COLL, day, { milliEur: milli });
  await incrDoc(COLL, mine, { milliEur: milli }, businessId);
  const total = (await getDoc<{ milliEur?: number }>(COLL, day))?.data.milliEur ?? 0;
  const own = (await getDoc<{ milliEur?: number }>(COLL, mine))?.data.milliEur ?? 0;
  if (total > dailyBudgetEur() * 1000 || own > businessDailyBudgetEur() * 1000) {
    await incrDoc(COLL, day, { milliEur: -milli });
    await incrDoc(COLL, mine, { milliEur: -milli }, businessId);
    return null;
  }
  return milli;
}

/** Ajuste la réservation au coût réel (compte aussi l'appel). */
export async function settleSpend(reservedMilli: number, costEur: number, businessId: string): Promise<void> {
  const delta = Math.ceil(costEur * 1000) - reservedMilli;
  await incrDoc(COLL, dayKey(), { milliEur: delta, calls: 1 });
  await incrDoc(COLL, `${dayKey()}:${businessId}`, { milliEur: delta, calls: 1 }, businessId);
}

/** true si la dépense estimée tient dans le plafond du jour (lecture seule, non atomique : préférer reserveBudget). */
export async function withinBudget(estimateEur: number): Promise<boolean> {
  return (await spentTodayEur()) + estimateEur <= dailyBudgetEur();
}

export async function recordSpend(costEur: number, businessId: string): Promise<void> {
  const milli = Math.ceil(costEur * 1000);
  await incrDoc(COLL, dayKey(), { milliEur: milli, calls: 1 });
  await incrDoc(COLL, `${dayKey()}:${businessId}`, { milliEur: milli, calls: 1 }, businessId);
}
