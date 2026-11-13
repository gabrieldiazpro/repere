/**
 * GET /api/v5/barometre/plan (admin) : catalogue, coût estimé par baromètre et pour le mois, budget restant.
 * Ne lance aucun appel d'IA : la mesure se fait par scripts/barometre/run.ts (ou la tâche « barometre.run »).
 */
import { isAdminRequest } from '@/lib/adminAuth';
import { CATALOG, barometreMax, launchCatalog } from '@/lib/barometre/catalog';
import { estimateMonthly, monthlyBudget, planWithinBudget } from '@/lib/barometre/cost';
import { currentPeriod, loadBudget } from '@/lib/barometre/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return Response.json({ error: 'non autorisé' }, { status: 401 });
  const period = currentPeriod();
  const ledger = await loadBudget(period, monthlyBudget());
  const launch = launchCatalog();
  const all = estimateMonthly(CATALOG);
  const month = estimateMonthly(launch);
  const plan = planWithinBudget(launch, ledger.remaining());
  return Response.json({
    period,
    budgetEur: ledger.limitEur,
    spentEur: Math.round(ledger.spentEur * 100) / 100,
    catalog: { count: all.count, calls: all.calls, costEur: all.costEur },
    launch: { max: barometreMax(), count: month.count, calls: month.calls, costEur: month.costEur, enabled: process.env.BAROMETRE_ENABLED === '1' },
    selected: plan.selected,
    skippedForBudget: plan.skipped.map((s) => s.slug),
  });
}
