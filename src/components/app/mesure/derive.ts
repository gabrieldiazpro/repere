/**
 * Calculs d'affichage des écrans Mesure (fonctions pures, testées). Les chiffres viennent du moteur
 * (marges, matrice de voix, URL) et de src/lib/digest/stats.ts : ici on sélectionne, filtre et met en forme,
 * on ne recalcule aucun indicateur publié ailleurs.
 */
import type { AuditResult, MarginStat, MentionResult, ProviderId, UrlStat } from '@/lib/engine';
import type { SourceCategory } from '@/lib/engine/types-v2';
import { highlightText, type Highlight, type PromptHistory } from '@/lib/prompts/history';
import { PERIODS, type PeriodKey, type VsKey } from './params';

type Dated = Pick<AuditResult, 'measuredAt' | 'createdAt'>;
export const dateOf = (a: Dated) => a.measuredAt || a.createdAt;
const time = (a: Dated) => new Date(dateOf(a)).getTime();

function monthsBefore(iso: string, months: number): number {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() - months);
  // marge d'une semaine : une mesure du 3 reste dans « 3 mois » si la dernière est du 5
  return d.getTime() - 7 * 86_400_000;
}

export interface PeriodSelection<A> {
  /** audits de la période, du plus ancien au plus récent */
  audits: A[];
  current: A | null;
  /** audit de comparaison (null si aucun) */
  reference: A | null;
  /** des audits plus anciens existent mais sont hors de la profondeur d'historique de l'offre */
  limitedByPlan: boolean;
  from: string | null;
  to: string | null;
}

/**
 * Audits d'une période, bornés par la profondeur d'historique de l'offre (`historyMonths`, null = illimité).
 * Référence : la mesure précédente (même hors période) ou la première mesure de la période.
 */
export function selectPeriod<A extends Dated>(all: readonly A[], periode: PeriodKey, vs: VsKey, historyMonths: number | null = null): PeriodSelection<A> {
  const sorted = [...all].sort((x, y) => time(x) - time(y));
  const current = sorted.at(-1) ?? null;
  if (!current) return { audits: [], current: null, reference: null, limitedByPlan: false, from: null, to: null };
  const last = dateOf(current);
  const allowed = historyMonths == null ? sorted : sorted.filter((a) => time(a) >= monthsBefore(last, historyMonths));
  const limitedByPlan = allowed.length < sorted.length;
  const months = PERIODS.find((p) => p.key === periode)?.months ?? null;
  const audits = months === 0 ? [current] : months == null ? allowed : allowed.filter((a) => time(a) >= monthsBefore(last, months));
  const prevIdx = allowed.indexOf(current) - 1;
  const reference = vs === 'debut' ? (audits.length > 1 ? audits[0] : null) : prevIdx >= 0 ? allowed[prevIdx] : null;
  return { audits, current, reference, limitedByPlan, from: dateOf(audits[0]).slice(0, 10), to: last.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Marges d'erreur
// ---------------------------------------------------------------------------

/** « ± 6 » (score) ou « ± 4 pts » (taux, parts) ; null si la marge n'est pas connue. */
export function marginText(m: MarginStat | null | undefined, unit: 'score' | 'rate'): string | null {
  if (!m || !Number.isFinite(m.margin)) return null;
  const v = unit === 'rate' ? Math.round(m.margin * 100) : Math.round(m.margin);
  return unit === 'rate' ? `± ${v} pt${v > 1 ? 's' : ''}` : `± ${v}`;
}

/**
 * Marge (demi-intervalle à 90 %) d'une proportion k/n mesurée sur n réponses, approximation de Wilson.
 * Sert aux cellules (question × IA, thème × IA) où le moteur ne fournit pas de bootstrap.
 */
export function proportionMargin(k: number, n: number): number {
  if (n <= 0) return 1;
  const z = 1.645;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  return (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
}

export function pts(x: number): string {
  return `${Math.round(x * 100)}`;
}

// ---------------------------------------------------------------------------
// Tendances
// ---------------------------------------------------------------------------
export type Trend = 'hausse' | 'baisse' | 'stable';

/** Tendance d'une série (première moitié contre seconde moitié), null sous deux points. */
export function trendOf(values: (number | null)[], tolerance = 0.05): Trend | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  if (v.length < 2) return null;
  const half = Math.floor(v.length / 2);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const d = avg(v.slice(v.length - half)) - avg(v.slice(0, half));
  return d > tolerance ? 'hausse' : d < -tolerance ? 'baisse' : 'stable';
}

export const TREND_LABEL: Record<Trend, string> = { hausse: 'En hausse', baisse: 'En baisse', stable: 'Stable' };

// ---------------------------------------------------------------------------
// Réponses brutes
// ---------------------------------------------------------------------------
export interface AnswerItem {
  key: string;
  auditId: string;
  date: string;
  provider: ProviderId;
  queryId: string;
  question: string;
  theme?: string;
  brand: boolean;
  run: number;
  text: string;
  cited: boolean;
  rank: number | null;
  competitors: string[];
  sources: { url: string; title?: string; domain: string }[];
  highlights: Highlight[];
  model?: string;
  error?: string;
  demo: boolean;
}

export function domainOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].toLowerCase();
  }
}

export interface AnswerFilter {
  ia?: ProviderId | null;
  queryId?: string | null;
  auditId?: string | null;
  notCited?: boolean;
  /** recherche dans le texte de la question ou de la réponse */
  q?: string;
  /** garder les questions de marque (vérification) ; défaut : oui */
  brand?: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Réponses brutes des audits (les plus récentes d'abord), avec surlignage vous / concurrents / sources. */
export function listAnswers(
  audits: readonly Pick<AuditResult, 'id' | 'measuredAt' | 'createdAt' | 'answers' | 'mentions' | 'queries' | 'competitors' | 'input' | 'demo'>[],
  clientNames: string[],
  f: AnswerFilter = {},
): AnswerItem[] {
  const out: AnswerItem[] = [];
  const needle = f.q ? fold(f.q) : '';
  for (const a of [...audits].sort((x, y) => time(y) - time(x))) {
    if (f.auditId && a.id !== f.auditId) continue;
    const comps = a.competitors.map((c) => c.name);
    const byKey = new Map<string, MentionResult>();
    for (const m of a.mentions) byKey.set(`${m.provider}|${m.queryId}|${m.run}`, m);
    for (const ans of a.answers ?? []) {
      if (f.ia && ans.provider !== f.ia) continue;
      if (f.queryId && ans.queryId !== f.queryId) continue;
      const q = a.queries.find((x) => x.id === ans.queryId);
      const brand = q?.kind === 'brand';
      if (f.brand === false && brand) continue;
      const m = byKey.get(`${ans.provider}|${ans.queryId}|${ans.run}`);
      const cited = Boolean(m?.mentioned);
      if (f.notCited && (cited || brand || ans.error)) continue;
      const question = q?.text ?? ans.queryId;
      if (needle && !fold(question).includes(needle) && !fold(ans.text).includes(needle)) continue;
      const seen = new Set<string>();
      const sources: AnswerItem['sources'] = [];
      for (const s of ans.sources ?? []) {
        if (!s?.url || seen.has(s.url) || s.kind === 'retrieved') continue;
        seen.add(s.url);
        sources.push({ url: s.url, title: s.title, domain: domainOfUrl(s.url) });
      }
      for (const url of ans.citations ?? []) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({ url, domain: domainOfUrl(url) });
      }
      const competitors = [...new Set([...(m?.competitors ?? [])])];
      out.push({
        key: `${a.id}|${ans.provider}|${ans.queryId}|${ans.run}`,
        auditId: a.id,
        date: dateOf(a),
        provider: ans.provider,
        queryId: ans.queryId,
        question,
        theme: q?.theme,
        brand,
        run: ans.run,
        text: ans.text,
        cited,
        rank: m?.rank ?? null,
        competitors,
        sources,
        highlights: highlightText(ans.text, { client: clientNames, competitors: [...new Set([...comps, ...competitors])], sources: sources.map((s) => s.url) }),
        model: ans.model,
        error: ans.error,
        demo: Boolean(ans.demo || a.demo),
      });
    }
  }
  return out;
}

export interface Segment {
  text: string;
  kind?: Highlight['kind'];
  label?: string;
}

/** Découpe un texte selon des surlignages triés et sans chevauchement. */
export function segmentsOf(text: string, highlights: readonly Highlight[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  for (const h of [...highlights].sort((a, b) => a.start - b.start)) {
    if (h.start < i || h.end > text.length || h.end <= h.start) continue;
    if (h.start > i) out.push({ text: text.slice(i, h.start) });
    out.push({ text: text.slice(h.start, h.end), kind: h.kind, label: h.label });
    i = h.end;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

/** Noms qui désignent le client dans une réponse (nom, domaine du site). */
export function clientNamesOf(name: string, website?: string | null): string[] {
  const out = [name];
  if (website) {
    const d = domainOfUrl(website.includes('://') ? website : `https://${website}`);
    if (d && d.includes('.')) out.push(d);
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Citations URL par URL
// ---------------------------------------------------------------------------
export type UrlSort = 'citations' | 'position' | 'recent' | 'domaine';
export const URL_SORTS: { key: UrlSort; label: string }[] = [
  { key: 'citations', label: 'Plus citées' },
  { key: 'position', label: 'Meilleure position' },
  { key: 'recent', label: 'Vues récemment' },
  { key: 'domaine', label: 'Domaine (A → Z)' },
];

export interface UrlFilter {
  ia?: ProviderId | null;
  category?: SourceCategory | null;
  /** seulement les pages où vous n'êtes pas présent */
  absent?: boolean;
  /** seulement les pages où au moins un concurrent est présent */
  competitor?: string | null;
  q?: string;
}

export function filterUrls<U extends UrlStat>(urls: readonly U[], f: UrlFilter): U[] {
  const needle = f.q ? fold(f.q) : '';
  return urls.filter(
    (u) =>
      (!f.ia || u.providers.includes(f.ia)) &&
      (!f.category || u.category === f.category) &&
      (!f.absent || !u.clientPresent) &&
      (!f.competitor || u.competitorsPresent.includes(f.competitor)) &&
      (!needle || fold(`${u.url} ${u.title ?? ''} ${u.domain}`).includes(needle)),
  );
}

export function sortUrls<U extends UrlStat>(urls: readonly U[], sort: UrlSort): U[] {
  const list = [...urls];
  const tie = (a: UrlStat, b: UrlStat) => b.citations - a.citations || a.url.localeCompare(b.url);
  if (sort === 'position') return list.sort((a, b) => (a.bestPosition ?? 99) - (b.bestPosition ?? 99) || tie(a, b));
  if (sort === 'recent') return list.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '') || tie(a, b));
  if (sort === 'domaine') return list.sort((a, b) => a.domain.localeCompare(b.domain) || tie(a, b));
  return list.sort(tie);
}

/**
 * Fusionne l'historique (première et dernière vue, sur la période) avec l'état de la dernière mesure
 * (présence du client et des concurrents). Les URL qui ne sont plus citées restent visibles, marquées.
 */
export function urlsWithHistory(latest: readonly UrlStat[], history: readonly UrlStat[]): (UrlStat & { stillCited: boolean })[] {
  const byUrl = new Map(history.map((u) => [u.url, u]));
  const now = latest.map((u) => ({ ...u, firstSeen: byUrl.get(u.url)?.firstSeen ?? u.firstSeen, lastSeen: byUrl.get(u.url)?.lastSeen ?? u.lastSeen, stillCited: true }));
  const seen = new Set(latest.map((u) => u.url));
  const gone = history.filter((u) => !seen.has(u.url)).map((u) => ({ ...u, stillCited: false }));
  return [...now, ...gone];
}

export { markersFor, heat } from './chart';

// ---------------------------------------------------------------------------
// Questions suivies : dernier résultat par IA et tendance
// ---------------------------------------------------------------------------
export interface QuestionResult {
  /** dernier état par IA de l'offre (null = non mesuré sur la dernière mesure) */
  last: { provider: ProviderId; cited: boolean | null; rank: number | null }[];
  /** part des IA qui citent le client, mesure par mesure (du plus ancien au plus récent) */
  series: { date: string; rate: number }[];
  trend: Trend | null;
  /** jamais mesurée (question ajoutée depuis la dernière mesure) */
  measured: boolean;
}

export function questionResult(
  h: Pick<PromptHistory, 'series'>,
  providers: readonly ProviderId[],
): QuestionResult {
  const byAudit = new Map<string, { date: string; points: PromptHistory['series'] }>();
  for (const p of h.series) {
    const e = byAudit.get(p.auditId) ?? { date: p.date, points: [] };
    e.points.push(p);
    byAudit.set(p.auditId, e);
  }
  const audits = [...byAudit.values()].sort((a, b) => a.date.localeCompare(b.date));
  const series = audits.map((a) => {
    const valid = a.points.filter((p) => !p.noRec);
    return { date: a.date, rate: valid.length ? valid.filter((p) => p.cited).length / valid.length : 0 };
  });
  const lastPts = audits.at(-1)?.points ?? [];
  const last = providers.map((provider) => {
    const p = lastPts.find((x) => x.provider === provider);
    return { provider, cited: p ? p.cited : null, rank: p?.rank ?? null };
  });
  return { last, series, trend: trendOf(series.map((s) => s.rate), 0.1), measured: audits.length > 0 };
}

/** Texte brut des IA : on retire les marqueurs Markdown (gras, puces) sans toucher aux positions de surlignage. */
export function plainAnswer(text: string, first: boolean): string {
  return text
    .replace(/\*\*|__/g, '')
    .replace(first ? /(^|\n)[*-] /g : /(\n)[*-] /g, '$1• ')
    .replace(/(^|\n)#{1,4} /g, '$1');
}
