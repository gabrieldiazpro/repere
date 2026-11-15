/**
 * Portefeuille d'une agence (V6) : tous les espaces clients sur une page — score IA (visibilité dans les réponses des
 * IA, avec sa marge), score Google (audit SEO du site), évolution, alertes, propositions de l'agent en attente.
 *
 * Calcul pur (`portfolioRow`, `sortClients`, `filterClients`, `portfolioSummary`) + chargeurs (comptes réels, démo).
 * Aucun chiffre inventé : un client sans mesure affiche « première mesure à venir », jamais un score.
 */
import type { Segment } from '@/lib/engine/types-v2';

export interface AiPoint {
  score: number;
  low: number;
  high: number;
  at: string;
  /** erreurs des IA sur les informations du client (vérification des faits) */
  errors: number;
}

export interface ClientInput {
  id: string;
  name: string;
  segment: Segment;
  descriptor: string;
  demo: boolean;
  needsSetup?: boolean;
  /** dernière mesure IA et précédente COMPARABLE (mêmes questions, ≥ 6 jours) */
  ai: AiPoint | null;
  aiPrev: { score: number } | null;
  /** 6 derniers scores IA, du plus ancien au plus récent (mini-courbe) */
  aiTrend: number[];
  seo: { score: number; at: string } | null;
  seoPrev: { score: number } | null;
  /** propositions de l'agent en attente de validation */
  pending: number;
  /** clients invités (accès client actif) */
  clientSeats: number;
  /** lien d'ouverture (null : espace d'exemple non ouvrable) */
  openable?: boolean;
}

export type AlertTone = 'bad' | 'warn' | 'info';

export interface ClientAlert {
  kind: 'ai_drop' | 'seo_drop' | 'fact_errors' | 'stale' | 'no_data' | 'setup' | 'ai_up';
  tone: AlertTone;
  label: string;
}

export type ClientStatus = 'alert' | 'watch' | 'ok' | 'setup';

export interface PortfolioClient {
  id: string;
  name: string;
  segment: Segment;
  descriptor: string;
  demo: boolean;
  openable: boolean;
  ai: { score: number; delta: number | null; margin: number; at: string; low: number; high: number } | null;
  aiTrend: number[];
  seo: { score: number; delta: number | null; at: string } | null;
  pending: number;
  clientSeats: number;
  alerts: ClientAlert[];
  status: ClientStatus;
}

export const STALE_DAYS = 45;
export const SEO_DROP_WARN = 5;
export const SEO_DROP_BAD = 10;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Une ligne du portefeuille (pur). */
export function portfolioRow(c: ClientInput, now: Date = new Date()): PortfolioClient {
  const alerts: ClientAlert[] = [];
  let ai: PortfolioClient['ai'] = null;
  if (c.ai) {
    const score = Math.round(c.ai.score);
    const margin = Math.max(1, Math.round((c.ai.high - c.ai.low) / 2));
    const delta = c.aiPrev ? score - Math.round(c.aiPrev.score) : null;
    ai = { score, delta, margin, at: c.ai.at, low: Math.round(c.ai.low), high: Math.round(c.ai.high) };
    // Une baisse n'est une alerte que si elle dépasse la marge d'erreur de la mesure.
    if (delta !== null && delta < -margin) alerts.push({ kind: 'ai_drop', tone: 'bad', label: `IA : −${-delta} points, au-delà de la marge (± ${margin})` });
    if (delta !== null && delta > margin) alerts.push({ kind: 'ai_up', tone: 'info', label: `IA : +${delta} points` });
    if (c.ai.errors > 0) alerts.push({ kind: 'fact_errors', tone: c.ai.errors >= 3 ? 'bad' : 'warn', label: `${plural(c.ai.errors, 'erreur des IA', 'erreurs des IA')} sur ses informations` });
    const age = Math.floor((now.getTime() - Date.parse(c.ai.at)) / 86_400_000);
    if (Number.isFinite(age) && age > STALE_DAYS) alerts.push({ kind: 'stale', tone: 'warn', label: `Pas de mesure depuis ${age} jours` });
  } else {
    alerts.push(c.needsSetup ? { kind: 'setup', tone: 'info', label: 'Espace à compléter (métier, ville)' } : { kind: 'no_data', tone: 'info', label: 'Première mesure à venir' });
  }
  let seo: PortfolioClient['seo'] = null;
  if (c.seo) {
    const delta = c.seoPrev ? Math.round(c.seo.score - c.seoPrev.score) : null;
    seo = { score: Math.round(c.seo.score), delta, at: c.seo.at };
    if (delta !== null && delta <= -SEO_DROP_WARN) alerts.push({ kind: 'seo_drop', tone: delta <= -SEO_DROP_BAD ? 'bad' : 'warn', label: `Google : −${-delta} points à l’audit du site` });
  }
  const status: ClientStatus = alerts.some((a) => a.tone === 'bad')
    ? 'alert'
    : alerts.some((a) => a.tone === 'warn')
      ? 'watch'
      : !ai
        ? 'setup'
        : 'ok';
  return {
    id: c.id,
    name: c.name,
    segment: c.segment,
    descriptor: c.descriptor,
    demo: c.demo,
    openable: c.openable !== false,
    ai,
    aiTrend: c.aiTrend.slice(-6).map((x) => Math.round(x)),
    seo,
    pending: c.pending,
    clientSeats: c.clientSeats,
    alerts,
    status,
  };
}

export type SortKey = 'priority' | 'name' | 'ai' | 'aiDelta' | 'seo' | 'seoDelta' | 'pending';
export type SortDir = 'asc' | 'desc';

const STATUS_RANK: Record<ClientStatus, number> = { alert: 4, watch: 3, setup: 1, ok: 0 };
/** Ordre « à traiter d'abord » : alerte, à surveiller, propositions à valider, démarrage, au vert. */
const priorityOf = (c: PortfolioClient) => Math.max(STATUS_RANK[c.status], c.pending > 0 ? 2 : 0);
const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/** Valeur triable ; les clients sans valeur vont TOUJOURS en fin de liste, quel que soit le sens. */
function keyOf(c: PortfolioClient, k: SortKey): number | null {
  switch (k) {
    case 'ai':
      return c.ai?.score ?? null;
    case 'aiDelta':
      return c.ai?.delta ?? null;
    case 'seo':
      return c.seo?.score ?? null;
    case 'seoDelta':
      return c.seo?.delta ?? null;
    case 'pending':
      return c.pending;
    default:
      return null;
  }
}

export function sortClients(list: readonly PortfolioClient[], key: SortKey = 'priority', dir: SortDir = 'desc'): PortfolioClient[] {
  const out = [...list];
  if (key === 'name') return out.sort((a, b) => (dir === 'asc' ? 1 : -1) * collator.compare(a.name, b.name));
  if (key === 'priority') {
    // À traiter d'abord : alerte, puis propositions en attente, puis surveillance ; à égalité, ordre alphabétique.
    return out.sort((a, b) => priorityOf(b) - priorityOf(a) || b.pending - a.pending || collator.compare(a.name, b.name));
  }
  return out.sort((a, b) => {
    const x = keyOf(a, key);
    const y = keyOf(b, key);
    if (x === null && y === null) return collator.compare(a.name, b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return (dir === 'asc' ? x - y : y - x) || collator.compare(a.name, b.name);
  });
}

export interface PortfolioFilter {
  q?: string;
  segment?: Segment | 'all';
  view?: 'all' | 'alert' | 'pending' | 'ok';
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterClients(list: readonly PortfolioClient[], f: PortfolioFilter = {}): PortfolioClient[] {
  const q = f.q ? fold(f.q.trim()) : '';
  return list.filter((c) => {
    if (q && !fold(`${c.name} ${c.descriptor}`).includes(q)) return false;
    if (f.segment && f.segment !== 'all' && c.segment !== f.segment) return false;
    if (f.view === 'alert' && c.status !== 'alert' && c.status !== 'watch') return false;
    if (f.view === 'pending' && c.pending === 0) return false;
    if (f.view === 'ok' && c.status !== 'ok') return false;
    return true;
  });
}

export interface PortfolioSummary {
  clients: number;
  measured: number;
  avgAi: number | null;
  avgSeo: number | null;
  /** clients en alerte (rouge) ou à surveiller (ambre) */
  needAttention: number;
  pending: number;
  /** clients dont le score IA a progressé au-delà de la marge */
  up: number;
}

export function portfolioSummary(list: readonly PortfolioClient[]): PortfolioSummary {
  const ai = list.filter((c) => c.ai).map((c) => c.ai!.score);
  const seo = list.filter((c) => c.seo).map((c) => c.seo!.score);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  return {
    clients: list.length,
    measured: ai.length,
    avgAi: avg(ai),
    avgSeo: avg(seo),
    needAttention: list.filter((c) => c.status === 'alert' || c.status === 'watch').length,
    pending: list.reduce((s, c) => s + c.pending, 0),
    up: list.filter((c) => c.alerts.some((a) => a.kind === 'ai_up')).length,
  };
}

export const SEGMENT_LABEL: Record<Segment, string> = { local: 'Commerce local', pme: 'PME', ecommerce: 'E-commerce' };
