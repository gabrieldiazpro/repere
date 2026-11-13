import { getDoc, listDocs, putDoc } from '@/lib/store';
import { getBusinessRecord, isDemoBusinessId } from '@/lib/db';
import { citationStats } from '@/lib/engine/scoring';
import { COLLECTIONS, RANKING_MAX_AGE_DAYS, RANKING_MIN_ENTRIES } from './constants';
import { isFresh, latestRealMeasure } from './measure';
import { slugify } from './tokens';

/** Inscription au classement : opt-in explicite, révocable à tout moment. */
export interface RankingEnrollment {
  businessId: string;
  optIn: boolean;
  displayName: string;
  trade: string;
  city: string;
  tradeSlug: string;
  citySlug: string;
  optedInAt: string | null;
  revokedAt: string | null;
}

export async function getEnrollment(businessId: string): Promise<RankingEnrollment | null> {
  return (await getDoc<RankingEnrollment>(COLLECTIONS.ranking, businessId))?.data ?? null;
}

export async function setRankingOptIn(b: { id: string; name: string; trade: string; city: string }, optIn: boolean): Promise<RankingEnrollment> {
  if (isDemoBusinessId(b.id)) throw new Error('demo');
  const prev = await getEnrollment(b.id);
  const now = new Date().toISOString();
  const rec: RankingEnrollment = {
    businessId: b.id,
    optIn,
    displayName: b.name,
    trade: b.trade,
    city: b.city,
    tradeSlug: slugify(b.trade),
    citySlug: slugify(b.city),
    optedInAt: optIn ? (prev?.optIn ? prev.optedInAt : now) : (prev?.optedInAt ?? null),
    revokedAt: optIn ? null : now,
  };
  await putDoc(COLLECTIONS.ranking, b.id, rec, b.id);
  return rec;
}

export interface RankingEntry {
  rank: number;
  name: string;
  /** Part des réponses mesurées qui citent le commerce (0-100, entier). */
  citationRate: number;
  cited: number;
  total: number;
  measuredAt: string;
}

export interface RankingPage {
  state: 'preparation' | 'published';
  /** Inscrits réels avec une mesure récente : le seul chiffre exposé tant que la page est en préparation. */
  count: number;
  minEntries: number;
  entries: RankingEntry[];
  /** Date de la mesure la plus ancienne retenue (affichée avec la méthode). */
  oldestMeasure: string | null;
}

/** Pure : classement dense par taux de citation, égalités regroupées (même rang). */
export function rankEntries(rows: Omit<RankingEntry, 'rank'>[]): RankingEntry[] {
  const sorted = [...rows].sort((a, b) => b.citationRate - a.citationRate || b.cited - a.cited || a.name.localeCompare(b.name, 'fr'));
  let rank = 0;
  let last: number | null = null;
  return sorted.map((r) => {
    if (r.citationRate !== last) {
      rank += 1;
      last = r.citationRate;
    }
    return { ...r, rank };
  });
}

/** Pure : publié seulement à partir de RANKING_MIN_ENTRIES inscrits réels. */
export function rankingState(count: number, min = RANKING_MIN_ENTRIES): 'preparation' | 'published' {
  return count >= min ? 'published' : 'preparation';
}

/** Commerces inscrits pour ce couple, avec mesure réelle récente. Jamais de démo, jamais de donnée fictive. */
export async function buildRanking(tradeSlug: string, citySlug: string, now: Date = new Date()): Promise<RankingPage> {
  const all = await listDocs<RankingEnrollment>(COLLECTIONS.ranking, { limit: 5000 });
  const mine = all.map((d) => d.data).filter((e) => e.optIn && e.tradeSlug === tradeSlug && e.citySlug === citySlug && !isDemoBusinessId(e.businessId));
  const rows: Omit<RankingEntry, 'rank'>[] = [];
  // Seuls les espaces payants (client Stripe réel) comptent, un seul par client : 10 comptes gratuits portant les noms
  // de vrais commerces ne suffisent pas à publier un classement (M8 de qa/v3/securite-v3.md).
  const seenCustomers = new Set<string>();
  for (const e of mine) {
    const b = await getBusinessRecord(e.businessId);
    const customer = b?.stripeCustomerId && !b.stripeCustomerId.startsWith('guest_') ? b.stripeCustomerId : null;
    if (!b || b.plan === 'free' || b.isActive === false || !customer || seenCustomers.has(customer)) continue;
    seenCustomers.add(customer);
    const m = await latestRealMeasure(e.businessId);
    if (!m || !isFresh(m.measuredAt, RANKING_MAX_AGE_DAYS, now)) continue;
    const { cited, total } = citationStats(m.audit);
    if (!total) continue;
    rows.push({ name: e.displayName, citationRate: Math.round((cited / total) * 100), cited, total, measuredAt: m.measuredAt });
  }
  const state = rankingState(rows.length);
  return {
    state,
    count: rows.length,
    minEntries: RANKING_MIN_ENTRIES,
    entries: state === 'published' ? rankEntries(rows) : [],
    oldestMeasure: rows.length ? rows.map((r) => r.measuredAt).sort()[0] : null,
  };
}

/** Couples métier × ville ayant au moins un inscrit (pour l'index /classement ; aucun nom exposé). */
export async function listRankingPairs(): Promise<{ trade: string; city: string; tradeSlug: string; citySlug: string; count: number }[]> {
  const all = await listDocs<RankingEnrollment>(COLLECTIONS.ranking, { limit: 5000 });
  const map = new Map<string, { trade: string; city: string; tradeSlug: string; citySlug: string; count: number }>();
  for (const d of all) {
    const e = d.data;
    if (!e.optIn || isDemoBusinessId(e.businessId)) continue;
    const k = `${e.tradeSlug}/${e.citySlug}`;
    const cur = map.get(k);
    if (cur) cur.count += 1;
    else map.set(k, { trade: e.trade, city: e.city, tradeSlug: e.tradeSlug, citySlug: e.citySlug, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
