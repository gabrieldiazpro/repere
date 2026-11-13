/**
 * Tableau de ROI des sources de données payantes (/admin/roi, réservé admin). Tout est MESURÉ :
 * - coûts : registre des baromètres (`barometre.budget`) et registres SEO-DATA (`seodata.costs`, en $ convertis avec
 *   SEODATA_EUR_PER_USD) + engagement Backlinks quand SEODATA_BACKLINKS_ENABLED=1 ;
 * - revenus : offres réellement souscrites (Business.plan / planId, prix de src/lib/plans.ts), attribution première
 *   page / UTM enregistrée côté serveur (roi.attribution), visites comptées (roi.visits), usage de l'onglet (roi.usage).
 * Aucun chiffre estimé n'entre dans un ratio. Relevé mensuel (`roi.snapshots`) pour la règle d'arrêt à 3 mois.
 */
import { launchCatalog } from '@/lib/barometre/catalog';
import { estimateMonthly, monthlyBudget } from '@/lib/barometre/cost';
import { COLL as BAROMETRE_COLL, type BudgetDoc } from '@/lib/barometre/storage';
import { getBusinessRecord, listBusinessesForDigest, type BusinessRecord } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { tierOf } from '@/lib/entitlements';
import { isHouseBusinessId } from '@/lib/house';
import { COSTS, type CostLedger } from '@/lib/seodata/cost';
import { BACKLINKS_TIERS, backlinksFixedUsd, backlinksPlatformEnabled, eurPerUsd } from '@/lib/seodata/limits';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { listAttributions, type AttributionRecord } from './attribution';
import { backlinksIncrementalUsd, monthlyRecurringCents, roiRatio, stopDecision, type MonthPoint, type StopDecision } from './compute';
import { barometreLinks, type BarometreLinksView } from './links';
import { readTabUsage, type TabUsage } from './usage';
import { monthOf, readVisits, type VisitsMonth } from './visits';

export const SNAPSHOTS = 'roi.snapshots';
export type SourceId = 'barometres' | 'liens';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface BarometreSlugRow {
  slug: string;
  visits: number;
  analyses: number;
  audits: number;
  signups: number;
  paid: number;
  mrrEur: number;
}

export interface BarometreRoi {
  enabled: boolean;
  costEur: number;
  /** plafond mensuel (BAROMETRE_BUDGET_EUR) */
  budgetEur: number;
  /** baromètres mesurés par mois (BAROMETRE_MAX) et coût ESTIMÉ (affiché à part, jamais dans un ratio) */
  launchCount: number;
  launchEstimateEur: number;
  visits: VisitsMonth;
  previousVisits: VisitsMonth;
  analyses: number;
  audits: number;
  signupsTotal: number;
  signupsThisMonth: number;
  paid: number;
  mrrEur: number;
  bySlug: BarometreSlugRow[];
  links: BarometreLinksView;
  ratio: number | null;
  stop: StopDecision;
  history: MonthPoint[];
}

export interface LiensRoi {
  enabled: boolean;
  fixedUsd: number;
  spentBacklinksUsd: number;
  spentOtherUsd: number;
  costEur: number;
  subscribers: number;
  byTier: Record<string, { count: number; mrrEur: number }>;
  mrrEur: number;
  usage: TabUsage;
  /** abonnés avec l'onglet qui l'ont ouvert ce mois-ci */
  activeSubscribers: number;
  ratio: number | null;
  stop: StopDecision;
  history: MonthPoint[];
}

export interface RoiReport {
  month: string;
  at: string;
  eurPerUsd: number;
  barometres: BarometreRoi;
  liens: LiensRoi;
}

export interface RoiDeps {
  now?: Date;
  /** relever les liens des pages baromètre si le mois n'est pas encore relevé (appel payant, plafonné) */
  refreshLinks?: boolean;
  /** écrire le relevé mensuel (désactivé en lecture seule) */
  snapshot?: boolean;
  listPaid?: () => Promise<BusinessRecord[]>;
  getBusiness?: (id: string) => Promise<BusinessRecord | null>;
  env?: Record<string, string | undefined>;
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Abonnement payant en cours (hors démo et compte maison). */
export function isPaying(b: BusinessRecord | null | undefined): b is BusinessRecord {
  if (!b || isDemoBusinessId(b.id) || isHouseBusinessId(b.id)) return false;
  if (b.isActive === false) return false;
  return tierOf(b.plan) !== 'decouverte' && monthlyRecurringCents(b.planId) > 0;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date de démarrage : ROI_<SOURCE>_START si fournie, sinon le premier mois relevé avec une dépense. */
export function startDateOf(source: SourceId, history: MonthPoint[], env: Record<string, string | undefined> = process.env): string | null {
  const v = (env[source === 'barometres' ? 'ROI_BAROMETRE_START' : 'ROI_BACKLINKS_START'] ?? '').trim();
  if (DAY_RE.test(v)) return v;
  const first = [...history].sort((a, b) => a.month.localeCompare(b.month)).find((p) => p.costEur > 0);
  return first ? `${first.month}-01` : null;
}

async function history(source: SourceId): Promise<MonthPoint[]> {
  const docs = await listDocs<MonthPoint & { source: SourceId }>(SNAPSHOTS, { limit: 500 });
  return docs
    .map((d) => d.data)
    .filter((p) => p && p.source === source)
    .map((p) => ({ month: p.month, revenueEur: p.revenueEur, costEur: p.costEur }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function mergePoint(points: MonthPoint[], p: MonthPoint): MonthPoint[] {
  return [...points.filter((x) => x.month !== p.month), p].sort((a, b) => a.month.localeCompare(b.month));
}

async function barometreSection(month: string, attributions: AttributionRecord[], deps: RoiDeps, now: Date): Promise<BarometreRoi> {
  const env = deps.env ?? process.env;
  const enabled = env.BAROMETRE_ENABLED === '1';
  const budget = (await getDoc<BudgetDoc>(BAROMETRE_COLL.budget, month))?.data;
  const costEur = r2(budget?.spentEur ?? 0);
  const launch = estimateMonthly(launchCatalog(env), env);
  const [visits, previousVisits] = await Promise.all([readVisits(month), readVisits(prevMonth(month))]);
  const fromB = attributions.filter((a) => a.barometre);
  const rows = new Map<string, BarometreSlugRow>();
  const row = (slug: string) => {
    let r = rows.get(slug);
    if (!r) rows.set(slug, (r = { slug, visits: 0, analyses: 0, audits: 0, signups: 0, paid: 0, mrrEur: 0 }));
    return r;
  };
  for (const [slug, n] of Object.entries(visits.bySlug)) row(slug).visits += n;
  let analyses = 0;
  let audits = 0;
  let signupsTotal = 0;
  let signupsThisMonth = 0;
  let paid = 0;
  let mrrCents = 0;
  const getBusiness = deps.getBusiness ?? ((id: string) => getBusinessRecord(id).catch(() => null));
  for (const a of fromB) {
    const r = row(a.barometre!);
    if (a.kind === 'analysis') {
      analyses++;
      r.analyses++;
    } else if (a.kind === 'audit') {
      audits++;
      r.audits++;
    } else {
      signupsTotal++;
      r.signups++;
      if (a.at.startsWith(month)) signupsThisMonth++;
      const b = await getBusiness(a.id);
      if (isPaying(b)) {
        const c = monthlyRecurringCents(b.planId);
        paid++;
        mrrCents += c;
        r.paid++;
        r.mrrEur = r2(r.mrrEur + c / 100);
      }
    }
  }
  const mrrEur = r2(mrrCents / 100);
  const links = await barometreLinks({ refresh: !!deps.refreshLinks, now }).catch((e) => ({ state: 'error' as const, reason: String((e as Error).message) }));
  let hist = await history('barometres');
  if (costEur > 0 || mrrEur > 0) hist = mergePoint(hist, { month, revenueEur: mrrEur, costEur });
  const stop = stopDecision({ startDate: startDateOf('barometres', hist, env), points: hist, now });
  return {
    enabled,
    costEur,
    budgetEur: monthlyBudget(env),
    launchCount: launch.count,
    launchEstimateEur: launch.costEur,
    visits,
    previousVisits,
    analyses,
    audits,
    signupsTotal,
    signupsThisMonth,
    paid,
    mrrEur,
    bySlug: [...rows.values()].sort((a, b) => b.mrrEur - a.mrrEur || b.signups - a.signups || b.visits - a.visits),
    links,
    ratio: roiRatio(mrrEur, costEur),
    stop,
    history: hist,
  };
}

async function liensSection(month: string, deps: RoiDeps, now: Date): Promise<LiensRoi> {
  const env = deps.env ?? process.env;
  const enabled = backlinksPlatformEnabled(env);
  const fixedUsd = enabled ? backlinksFixedUsd(env) : 0;
  let bl = 0;
  let other = 0;
  for (const d of await listDocs<CostLedger>(COSTS, { limit: 20_000 })) {
    const l = d.data;
    if (!l || l.month !== month) continue;
    for (const [op, v] of Object.entries(l.byOp ?? {})) {
      if (op.startsWith('backlinks.')) bl += v.usd;
      else other += v.usd;
    }
  }
  const incUsd = enabled ? backlinksIncrementalUsd(other, bl, fixedUsd) : r2(bl);
  const costEur = r2(incUsd * eurPerUsd());
  const paidList = await (deps.listPaid ?? (() => listBusinessesForDigest(10_000)))().catch(() => [] as BusinessRecord[]);
  const withTab = paidList.filter((b) => isPaying(b) && (BACKLINKS_TIERS as readonly string[]).includes(tierOf(b.plan)));
  const byTier: LiensRoi['byTier'] = {};
  let mrrCents = 0;
  for (const b of withTab) {
    const t = tierOf(b.plan);
    const c = monthlyRecurringCents(b.planId);
    mrrCents += c;
    const x = (byTier[t] ??= { count: 0, mrrEur: 0 });
    x.count++;
    x.mrrEur = r2(x.mrrEur + c / 100);
  }
  const usage = await readTabUsage('liens', month);
  const ids = new Set(withTab.map((b) => b.id));
  const activeSubscribers = Object.keys(usage.byAccount).filter((id) => ids.has(id)).length;
  const mrrEur = r2(mrrCents / 100);
  let hist = await history('liens');
  if (costEur > 0) hist = mergePoint(hist, { month, revenueEur: mrrEur, costEur });
  const stop = stopDecision({ startDate: startDateOf('liens', hist, env), points: hist, now });
  return {
    enabled,
    fixedUsd,
    spentBacklinksUsd: r2(bl),
    spentOtherUsd: r2(other),
    costEur,
    subscribers: withTab.length,
    byTier,
    mrrEur,
    usage,
    activeSubscribers,
    ratio: roiRatio(mrrEur, costEur),
    stop,
    history: hist,
  };
}

export async function buildRoiReport(deps: RoiDeps = {}): Promise<RoiReport> {
  const now = deps.now ?? new Date();
  const month = monthOf(now);
  const attributions = await listAttributions().catch(() => [] as AttributionRecord[]);
  const [barometres, liens] = await Promise.all([barometreSection(month, attributions, deps, now), liensSection(month, deps, now)]);
  if (deps.snapshot !== false) {
    // Relevé du mois (écrasé pendant le mois, figé ensuite) : seulement pour une source qui a coûté quelque chose.
    const at = now.toISOString();
    if (barometres.costEur > 0 || barometres.mrrEur > 0) await putDoc(SNAPSHOTS, `barometres:${month}`, { source: 'barometres', month, revenueEur: barometres.mrrEur, costEur: barometres.costEur, at }).catch(() => undefined);
    if (liens.costEur > 0) await putDoc(SNAPSHOTS, `liens:${month}`, { source: 'liens', month, revenueEur: liens.mrrEur, costEur: liens.costEur, at }).catch(() => undefined);
  }
  return { month, at: now.toISOString(), eurPerUsd: eurPerUsd(), barometres, liens };
}
