/**
 * Suivi de positions Google : liste de mots-clés par compte, relevé hebdomadaire (file standard DataForSEO : dépôt
 * puis collecte), historique, variations, part de visibilité, concurrents qui se positionnent, suggestions
 * (Search Console « à portée de main » + mots-clés positionnés Labs).
 *
 * Collections : `seodata.rank.config` (id = businessId), `seodata.rank.snap` (id = businessId:AAAA-Www),
 * `seodata.labs` (id = businessId:AAAA-MM, cache mensuel des appels Labs payants).
 * Comptes démo : historique de 12 semaines calculé à la volée par le fournisseur démo, jamais stocké.
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { DEMO_SPECS, DemoSerp, ctrAt } from './demo';
import { SeoDataError, addDays, hostOf, monthKey, sameSite, weekKey } from './http';
import { locationFor, type ProviderSet, type SeoDataContext } from './providers';
import { loadStored } from './searchconsole';
import type { Device, KeywordsProvider, SerpProvider, SerpRequest, SerpResult } from './types';

export const RANK_CONFIG = 'seodata.rank.config';
export const RANK_SNAP = 'seodata.rank.snap';
export const LABS_CACHE = 'seodata.labs';
export const MAX_COMPETITORS = 5;
/** Au-delà, une collecte encore incomplète est close en « partielle » (tâches DataForSEO conservées 30 jours). */
export const COLLECT_MAX_AGE_MS = 24 * 3600_000;

export interface TrackedKeyword {
  keyword: string;
  addedAt: string;
  source: 'manual' | 'search-console' | 'labs' | 'demo';
  volume: number | null;
  difficulty: number | null;
  volumeAt: string | null;
}

export interface RankConfig {
  businessId: string;
  keywords: TrackedKeyword[];
  /** concurrents suivis manuellement (sinon : détectés dans les SERP) */
  competitors: string[];
  updatedAt: string;
}

export interface RankEntry {
  keyword: string;
  device: Device;
  /** null : absent de la profondeur relevée */
  position: number | null;
  url: string | null;
  features: string[];
  aiOverview: boolean | null;
  /** notre domaine est-il cité dans l'aperçu IA ? null si inconnu */
  aiOverviewCitesUs: boolean | null;
  top: { domain: string; position: number }[];
}

export interface RankSnapshot {
  businessId: string;
  week: string;
  takenAt: string;
  domain: string;
  provider: string;
  demo: boolean;
  depth: number;
  status: 'pending' | 'done' | 'partial';
  pending: { taskId: string; req: SerpRequest }[];
  results: RankEntry[];
  errors: string[];
}

export function normalizeKeyword(k: string): string {
  return k.normalize('NFC').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function demoConfig(ctx: SeoDataContext): RankConfig {
  const s = DEMO_SPECS[ctx.demoId!];
  return {
    businessId: ctx.businessId,
    // 6 mots-clés suivis sur 8 : les 2 autres servent d'exemples de suggestions.
    keywords: s.keywords.slice(0, 6).map((k) => ({ keyword: k.kw, addedAt: '2025-07-01T00:00:00.000Z', source: 'demo', volume: k.volume, difficulty: k.difficulty, volumeAt: null })),
    competitors: s.competitors.slice(0, 3),
    updatedAt: new Date().toISOString(),
  };
}

export async function getRankConfig(ctx: SeoDataContext): Promise<RankConfig> {
  if (ctx.demoId) return demoConfig(ctx);
  return (await getDoc<RankConfig>(RANK_CONFIG, ctx.businessId))?.data ?? { businessId: ctx.businessId, keywords: [], competitors: [], updatedAt: new Date().toISOString() };
}

async function saveRankConfig(ctx: SeoDataContext, c: RankConfig): Promise<void> {
  if (ctx.demoId) throw new SeoDataError('demo_read_only', 'Compte de démonstration : les modifications ne sont pas enregistrées.');
  await putDoc(RANK_CONFIG, ctx.businessId, { ...c, updatedAt: new Date().toISOString() }, ctx.businessId);
}

/**
 * Ajoute des mots-clés (dédoublonnés, plafond de l'offre). Les volumes sont demandés au fournisseur s'il est
 * configuré (une seule tâche jusqu'à 1 000 mots-clés) ; sinon ils restent null (« non configuré »).
 */
export async function addKeywords(ctx: SeoDataContext, keywords: string[], source: TrackedKeyword['source'], kp: KeywordsProvider | null, now = new Date()): Promise<{ added: string[]; skipped: string[]; config: RankConfig }> {
  if (ctx.limits.keywords <= 0) throw new SeoDataError('budget', 'Le suivi de positions n’est pas inclus dans votre offre (à partir d’Essentiel).');
  const c = await getRankConfig(ctx);
  const have = new Set(c.keywords.map((k) => k.keyword));
  const fresh = [...new Set(keywords.map(normalizeKeyword).filter((k) => k.length >= 2))].filter((k) => !have.has(k));
  const room = Math.max(0, ctx.limits.keywords - c.keywords.length);
  const added = fresh.slice(0, room);
  const skipped = fresh.slice(room);
  if (added.length === 0) {
    if (skipped.length) throw new SeoDataError('budget', `Votre offre comprend ${ctx.limits.keywords} mots-clés suivis.`);
    return { added, skipped, config: c };
  }
  let metrics = new Map<string, { volume: number | null; difficulty: number | null }>();
  if (kp) {
    try {
      const v = await kp.volumes(added, locationFor(ctx));
      const d = ctx.limits.labs && kp.difficulty ? await kp.difficulty(added, locationFor(ctx)).catch(() => ({}) as Record<string, number | null>) : {};
      metrics = new Map(v.map((m) => [m.keyword, { volume: m.volume, difficulty: d[m.keyword] ?? m.difficulty ?? null }]));
    } catch (e) {
      // Volumes indisponibles (plafond, panne) : on suit quand même les positions, volumes à null.
      if (!(e instanceof SeoDataError)) throw e;
    }
  }
  const at = now.toISOString();
  c.keywords.push(...added.map((k) => ({ keyword: k, addedAt: at, source, volume: metrics.get(k)?.volume ?? null, difficulty: metrics.get(k)?.difficulty ?? null, volumeAt: metrics.has(k) ? at : null })));
  await saveRankConfig(ctx, c);
  return { added, skipped, config: c };
}

export async function removeKeywords(ctx: SeoDataContext, keywords: string[]): Promise<RankConfig> {
  const c = await getRankConfig(ctx);
  const drop = new Set(keywords.map(normalizeKeyword));
  c.keywords = c.keywords.filter((k) => !drop.has(k.keyword));
  await saveRankConfig(ctx, c);
  return c;
}

export async function setCompetitors(ctx: SeoDataContext, domains: string[]): Promise<RankConfig> {
  const c = await getRankConfig(ctx);
  c.competitors = [...new Set(domains.map(hostOf).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && (!ctx.domain || !sameSite(d, ctx.domain))))].slice(0, MAX_COMPETITORS);
  await saveRankConfig(ctx, c);
  return c;
}

/** Rafraîchit les volumes de plus de 30 jours (une tâche). */
export async function refreshVolumes(ctx: SeoDataContext, kp: KeywordsProvider, now = new Date()): Promise<number> {
  if (ctx.demoId) return 0;
  const c = await getRankConfig(ctx);
  const stale = c.keywords.filter((k) => !k.volumeAt || now.getTime() - Date.parse(k.volumeAt) > 30 * 86_400_000).map((k) => k.keyword);
  if (!stale.length) return 0;
  const v = await kp.volumes(stale, locationFor(ctx));
  const by = new Map(v.map((m) => [m.keyword, m.volume]));
  for (const k of c.keywords) if (by.has(k.keyword)) Object.assign(k, { volume: by.get(k.keyword) ?? null, volumeAt: now.toISOString() });
  await saveRankConfig(ctx, c);
  return stale.length;
}

// ---------------------------------------------------------------------------
// Relevés
// ---------------------------------------------------------------------------

export function toEntry(r: SerpResult, domain: string): RankEntry {
  const mine = r.organic.find((o) => sameSite(o.domain, domain));
  return {
    keyword: r.keyword,
    device: r.device,
    position: mine?.position ?? null,
    url: mine?.url ?? null,
    features: r.features,
    aiOverview: r.aiOverview,
    aiOverviewCitesUs: r.aiOverview === true ? r.aiOverviewDomains.some((d) => sameSite(d, domain)) : r.aiOverview === false ? false : null,
    top: r.organic.slice(0, 20).map((o) => ({ domain: o.domain, position: o.position })),
  };
}

function requestsFor(ctx: SeoDataContext, c: RankConfig): SerpRequest[] {
  const loc = locationFor(ctx);
  return c.keywords.flatMap((k) => ctx.limits.devices.map((device) => ({ keyword: k.keyword, device, location: loc, depth: ctx.limits.depth, aiOverview: ctx.limits.aiOverview })));
}

/**
 * Relevé hebdomadaire (idempotent par semaine ISO). File standard si le fournisseur sait déposer (moins cher) :
 * renvoie `pending` et la tâche de collecte prend le relais ; sinon relevé immédiat.
 */
export async function runWeekly(ctx: SeoDataContext, serp: SerpProvider | null, now = new Date()): Promise<RankSnapshot> {
  if (ctx.demoId) throw new SeoDataError('demo_read_only', 'Compte de démonstration : relevés de démonstration seulement.');
  if (!serp) throw new SeoDataError('not_configured', 'Fournisseur de positions non configuré : aucun relevé.');
  if (!ctx.domain) throw new SeoDataError('bad_request', 'Renseignez l’adresse du site pour suivre ses positions.');
  const week = weekKey(now);
  const id = `${ctx.businessId}:${week}`;
  const existing = (await getDoc<RankSnapshot>(RANK_SNAP, id))?.data;
  if (existing && existing.status !== 'pending') return existing;
  if (existing && existing.pending.length) return existing;
  const c = await getRankConfig(ctx);
  const reqs = requestsFor(ctx, c);
  const snap: RankSnapshot = { businessId: ctx.businessId, week, takenAt: now.toISOString(), domain: ctx.domain, provider: serp.name, demo: serp.demo, depth: ctx.limits.depth, status: 'pending', pending: [], results: [], errors: [] };
  if (reqs.length === 0) {
    snap.status = 'done';
  } else if (serp.submit && serp.collect) {
    snap.pending = await serp.submit(reqs);
    if (snap.pending.length < reqs.length) snap.errors.push(`${reqs.length - snap.pending.length} relevé(s) refusé(s) par le fournisseur.`);
    if (snap.pending.length === 0) snap.status = 'partial';
  } else {
    for (const r of reqs) {
      try {
        snap.results.push(toEntry(await serp.live(r), ctx.domain));
      } catch (e) {
        if (e instanceof SeoDataError && e.code === 'budget') {
          snap.errors.push(e.message);
          break;
        }
        snap.errors.push(`${r.keyword} : ${e instanceof Error ? e.message : 'erreur'}`);
      }
    }
    snap.status = snap.errors.length ? 'partial' : 'done';
  }
  await putDoc(RANK_SNAP, id, snap, ctx.businessId);
  return snap;
}

/** Collecte des tâches déposées. Renvoie le relevé ; `status: 'pending'` = à relancer plus tard. */
export async function collectWeekly(ctx: SeoDataContext, serp: SerpProvider | null, week: string, now = new Date()): Promise<RankSnapshot | null> {
  if (!serp?.collect || !ctx.domain) return null;
  const id = `${ctx.businessId}:${week}`;
  const snap = (await getDoc<RankSnapshot>(RANK_SNAP, id))?.data;
  if (!snap || snap.status !== 'pending') return snap ?? null;
  const still: RankSnapshot['pending'] = [];
  for (const p of snap.pending) {
    try {
      const r = await serp.collect(p.taskId, p.req);
      if (r) snap.results.push(toEntry(r, snap.domain));
      else still.push(p);
    } catch (e) {
      if (e instanceof SeoDataError && e.retryable) still.push(p);
      else snap.errors.push(`${p.req.keyword} : ${e instanceof Error ? e.message : 'erreur'}`);
    }
  }
  snap.pending = still;
  if (still.length === 0) snap.status = snap.errors.length ? 'partial' : 'done';
  else if (now.getTime() - Date.parse(snap.takenAt) > COLLECT_MAX_AGE_MS) {
    snap.errors.push(`${still.length} relevé(s) non rendu(s) par le fournisseur en 24 h.`);
    snap.pending = [];
    snap.status = 'partial';
  }
  await putDoc(RANK_SNAP, id, snap, ctx.businessId);
  return snap;
}

/** Historique (du plus ancien au plus récent). Démo : 12 semaines calculées. */
export async function rankHistory(ctx: SeoDataContext, p: ProviderSet, weeks = 26, now = new Date()): Promise<RankSnapshot[]> {
  if (ctx.demoId) {
    const c = demoConfig(ctx);
    const serp = new DemoSerp(ctx.demoId, now);
    const out: RankSnapshot[] = [];
    for (let i = Math.min(weeks, 12) - 1; i >= 0; i--) {
      const at = addDays(now, -7 * i);
      const results: RankEntry[] = [];
      for (const r of requestsFor(ctx, c)) results.push(toEntry(await serp.live(r, at), ctx.domain!));
      out.push({ businessId: ctx.businessId, week: weekKey(at), takenAt: at.toISOString(), domain: ctx.domain!, provider: 'demo', demo: true, depth: ctx.limits.depth, status: 'done', pending: [], results, errors: [] });
    }
    return out;
  }
  void p;
  const docs = await listDocs<RankSnapshot>(RANK_SNAP, { businessId: ctx.businessId, limit: weeks + 4 });
  return docs.map((d) => d.data).filter((s) => s.businessId === ctx.businessId && s.status !== 'pending').sort((a, b) => a.week.localeCompare(b.week)).slice(-weeks);
}

// ---------------------------------------------------------------------------
// Rapport : variations, visibilité, concurrents
// ---------------------------------------------------------------------------

export interface KeywordReport {
  keyword: string;
  device: Device;
  volume: number | null;
  difficulty: number | null;
  position: number | null;
  previous: number | null;
  /** positif = gain de places ; null si pas de comparaison possible */
  change: number | null;
  best: number | null;
  url: string | null;
  features: string[];
  aiOverview: boolean | null;
  aiOverviewCitesUs: boolean | null;
  history: { week: string; position: number | null }[];
}

export interface RankReport {
  domain: string | null;
  demo: boolean;
  week: string | null;
  previousWeek: string | null;
  keywords: KeywordReport[];
  distribution: { top3: number; top10: number; top20: number; out: number };
  /** visibilité 0–100 : clics estimés (CTR moyen par position × volume) / clics si tout était 1er */
  visibility: number | null;
  visibilityPrevious: number | null;
  /** part de visibilité entre nous et les concurrents (somme = 100) */
  share: { domain: string; share: number; isUs: boolean; keywords: number; avgPosition: number | null }[];
  competitors: { domain: string; keywordsInTop10: number; avgPosition: number | null; tracked: boolean }[];
  aiOverview: { keywordsWithOverview: number; citesUs: number; known: number };
  movers: { up: KeywordReport[]; down: KeywordReport[] };
  note: string;
}

const weightOf = (v: number | null) => (v && v > 0 ? v : 10);

export function visibilityOf(entries: RankEntry[], volumes: Map<string, number | null>): number | null {
  if (!entries.length) return null;
  let got = 0;
  let max = 0;
  for (const e of entries) {
    const w = weightOf(volumes.get(e.keyword) ?? null);
    got += w * ctrAt(e.position);
    max += w * ctrAt(1);
  }
  return max ? Math.round((got / max) * 1000) / 10 : null;
}

export function buildReport(ctx: SeoDataContext, config: RankConfig, history: RankSnapshot[]): RankReport {
  const domain = ctx.domain;
  const last = history[history.length - 1] ?? null;
  const prev = history[history.length - 2] ?? null;
  const volumes = new Map(config.keywords.map((k) => [k.keyword, k.volume]));
  const diff = new Map(config.keywords.map((k) => [k.keyword, k.difficulty]));
  const key = (e: { keyword: string; device: Device }) => `${e.keyword}|${e.device}`;
  const prevBy = new Map((prev?.results ?? []).map((e) => [key(e), e]));
  const tracked = new Set(config.keywords.map((k) => k.keyword));
  const current = (last?.results ?? []).filter((e) => tracked.has(e.keyword));
  const keywords: KeywordReport[] = current.map((e) => {
    const p = prevBy.get(key(e));
    const hist = history.map((s) => ({ week: s.week, position: s.results.find((x) => key(x) === key(e))?.position ?? null }));
    const known = hist.map((h) => h.position).filter((x): x is number => x !== null);
    const depth = last?.depth ?? 20;
    // Entrée ou sortie de la profondeur relevée : variation comptée depuis/vers depth + 1.
    const change = p ? (p.position ?? depth + 1) - (e.position ?? depth + 1) : null;
    return {
      keyword: e.keyword,
      device: e.device,
      volume: volumes.get(e.keyword) ?? null,
      difficulty: diff.get(e.keyword) ?? null,
      position: e.position,
      previous: p ? p.position : null,
      change: p && (p.position !== null || e.position !== null) ? change : null,
      best: known.length ? Math.min(...known) : null,
      url: e.url,
      features: e.features,
      aiOverview: e.aiOverview,
      aiOverviewCitesUs: e.aiOverviewCitesUs,
      history: hist,
    };
  });
  const distribution = { top3: 0, top10: 0, top20: 0, out: 0 };
  for (const k of keywords) {
    if (k.position === null) distribution.out++;
    else if (k.position <= 3) distribution.top3++;
    else if (k.position <= 10) distribution.top10++;
    else if (k.position <= 20) distribution.top20++;
    else distribution.out++;
  }
  // Concurrents : tous les domaines du top 10, pondérés comme notre visibilité.
  const byDomain = new Map<string, { score: number; kws: Set<string>; pos: number[] }>();
  for (const e of current) {
    const w = weightOf(volumes.get(e.keyword) ?? null);
    const seen = new Set<string>();
    for (const t of e.top) {
      const d = domain && sameSite(t.domain, domain) ? domain : hostOf(t.domain);
      if (seen.has(d)) continue;
      seen.add(d);
      const v = byDomain.get(d) ?? { score: 0, kws: new Set(), pos: [] };
      v.score += w * ctrAt(t.position);
      if (t.position <= 10) v.kws.add(e.keyword);
      v.pos.push(t.position);
      byDomain.set(d, v);
    }
  }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  const manual = new Set(config.competitors.map(hostOf));
  const ranked = [...byDomain.entries()].filter(([d]) => !domain || d !== domain).sort((a, b) => b[1].score - a[1].score);
  const shown = [...ranked.filter(([d]) => manual.has(d)), ...ranked.filter(([d]) => !manual.has(d))].slice(0, MAX_COMPETITORS);
  const us = domain ? byDomain.get(domain) : undefined;
  const pool = [...(us && domain ? [[domain, us] as const] : []), ...shown];
  const total = pool.reduce((s, [, v]) => s + v.score, 0);
  const share = pool.map(([d, v]) => ({ domain: d, share: total ? Math.round((v.score / total) * 1000) / 10 : 0, isUs: d === domain, keywords: v.kws.size, avgPosition: avg(v.pos) }));
  const withAio = current.filter((e) => e.aiOverview === true);
  const sortedMoves = keywords.filter((k) => k.change !== null && k.change !== 0);
  return {
    domain,
    demo: Boolean(last?.demo ?? ctx.demoId),
    week: last?.week ?? null,
    previousWeek: prev?.week ?? null,
    keywords,
    distribution,
    visibility: last ? visibilityOf(current, volumes) : null,
    visibilityPrevious: prev ? visibilityOf(prev.results.filter((e) => tracked.has(e.keyword)), volumes) : null,
    share,
    competitors: shown.map(([d, v]) => ({ domain: d, keywordsInTop10: v.kws.size, avgPosition: avg(v.pos), tracked: manual.has(d) })),
    aiOverview: { keywordsWithOverview: withAio.length, citesUs: withAio.filter((e) => e.aiOverviewCitesUs).length, known: current.filter((e) => e.aiOverview !== null).length },
    movers: {
      up: [...sortedMoves].filter((k) => (k.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 5),
      down: [...sortedMoves].filter((k) => (k.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 5),
    },
    note: 'Visibilité estimée à partir d’une courbe moyenne de taux de clic par position (estimation, pas une mesure de trafic). Positions relevées depuis la France, sans personnalisation.',
  };
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface KeywordSuggestion {
  keyword: string;
  source: 'search-console' | 'labs';
  reason: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  volume: number | null;
  difficulty: number | null;
  url: string | null;
}

interface LabsCache { businessId: string; month: string; ranked: { keyword: string; position: number; url: string; volume: number | null; difficulty: number | null }[]; competitors: { domain: string; commonKeywords: number; avgPosition: number | null }[]; at: string }

/** Appels Labs mis en cache un mois (payants). Démo : fournisseur démo, sans cache. */
export async function labsData(ctx: SeoDataContext, kp: KeywordsProvider | null, now = new Date()): Promise<LabsCache | null> {
  if (!kp?.rankedKeywords || !ctx.domain || !ctx.limits.labs) return null;
  const id = `${ctx.businessId}:${monthKey(now)}`;
  if (!ctx.demoId) {
    const hit = (await getDoc<LabsCache>(LABS_CACHE, id))?.data;
    if (hit) return hit;
  }
  const loc = locationFor(ctx);
  const ranked = await kp.rankedKeywords(ctx.domain, loc, 200);
  const competitors = kp.competitors ? await kp.competitors(ctx.domain, loc, 10).catch(() => []) : [];
  const out: LabsCache = { businessId: ctx.businessId, month: monthKey(now), ranked, competitors, at: now.toISOString() };
  if (!ctx.demoId) await putDoc(LABS_CACHE, id, out, ctx.businessId);
  return out;
}

/**
 * Suggestions de mots-clés à suivre :
 *  1. Search Console : requêtes en positions 4–20 avec des impressions (« à portée de main ») ;
 *  2. Labs : mots-clés où le site se positionne déjà, triés par volume.
 * Jamais de volume inventé : null si aucun fournisseur ne le donne.
 */
export async function suggestKeywords(ctx: SeoDataContext, p: ProviderSet, now = new Date(), limit = 30): Promise<{ suggestions: KeywordSuggestion[]; sources: string[] }> {
  const config = await getRankConfig(ctx);
  const tracked = new Set(config.keywords.map((k) => k.keyword));
  const out = new Map<string, KeywordSuggestion>();
  const sources: string[] = [];
  let recent: { key: string; clicks: number; impressions: number; position: number }[] = [];
  if (ctx.demoId && p.searchConsole) {
    const end = addDays(now, -2);
    recent = (await p.searchConsole.query('', { startDate: addDays(end, -27).toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: ['query'] })).map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  } else if (p.searchConsole) {
    recent = (await loadStored(ctx.businessId)).recent?.queries ?? [];
  }
  if (recent.length) sources.push(ctx.demoId ? 'demo' : 'google-search-console');
  const minImpr = Math.max(10, Math.round((recent.reduce((s, q) => s + q.impressions, 0) / Math.max(1, recent.length)) * 0.2));
  for (const q of recent) {
    const k = normalizeKeyword(q.key);
    if (!k || tracked.has(k) || q.position < 4 || q.position > 20 || q.impressions < minImpr) continue;
    out.set(k, { keyword: k, source: 'search-console', reason: `Position moyenne ${q.position.toFixed(1).replace('.', ',')} avec ${q.impressions} impressions sur 28 jours : à portée de la première page ou du top 3.`, position: q.position, impressions: q.impressions, clicks: q.clicks, volume: null, difficulty: null, url: null });
  }
  try {
    const labs = await labsData(ctx, p.keywords, now);
    if (labs) {
      sources.push(ctx.demoId ? 'demo' : 'dataforseo');
      for (const r of labs.ranked) {
        const k = normalizeKeyword(r.keyword);
        if (tracked.has(k)) continue;
        const cur = out.get(k);
        if (cur) Object.assign(cur, { volume: r.volume, difficulty: r.difficulty, url: r.url });
        else if (r.position <= 30) out.set(k, { keyword: k, source: 'labs', reason: `Le site apparaît déjà en position ${r.position} sur ce mot-clé.`, position: r.position, impressions: null, clicks: null, volume: r.volume, difficulty: r.difficulty, url: r.url });
      }
    }
  } catch (e) {
    if (!(e instanceof SeoDataError)) throw e;
  }
  const list = [...out.values()].sort((a, b) => (b.volume ?? b.impressions ?? 0) - (a.volume ?? a.impressions ?? 0)).slice(0, limit);
  return { suggestions: list, sources: [...new Set(sources)] };
}
