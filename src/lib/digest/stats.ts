/**
 * Chiffres clés d'un audit : UNE seule fonction de calcul, partagée par toutes les vues
 * (accueil, Concurrents, Rapports, copilote, digest, rapport public, PDF).
 *
 * Unités (toujours les mêmes) :
 * - questions      : questions de recommandation (les questions « sur votre marque » sont comptées à part) ;
 * - réponses       : réponses exploitables à ces questions = questions × IA × passages, hors erreurs ;
 * - citations      : nombre de réponses qui nomment un acteur (vous ou un concurrent), une fois par réponse ;
 * - part de voix   : citations de l'acteur / total des citations de tous les acteurs classés ;
 * - rang           : place parmi les acteurs classés (à égalité, vous passez devant).
 */
import type { AuditResult, ProviderId } from '@/lib/engine/types';
import type { AuditResultV2Ext, BenchmarkPosition, Segment } from '@/lib/engine/types-v2';
import { isNoRec, validMentions } from '@/lib/engine/scoring';

type AuditV2 = AuditResult & Partial<AuditResultV2Ext>;

/** Plateformes et annuaires : ce sont des sources, pas des concurrents. Exclues du classement partout. */
const PLATFORM_NAMES =
  /^(pages ?jaunes|google|google maps|yelp|tripadvisor|doctolib|the ?fork|la ?fourchette|treatwell|planity|facebook|instagram|houzz|trustpilot|leboncoin|wikip[ée]dia|uber eats|deliveroo|amazon|capterra|g2|appvizer|reddit|linkedin|youtube|habitatpresto|starofservice|mappy|justacote|avis v[ée]rifi[ée]s)\b/i;
export const isPlatformName = (n: string) => PLATFORM_NAMES.test(n.trim());

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export interface RankRow {
  name: string;
  mentions: number;
  share: number;
  isMe: boolean;
  /** place (1 = le plus cité) */
  pos: number;
}

export interface AuditStats {
  segment: Segment;
  /** questions de recommandation (score, classement) */
  questions: number;
  /** questions sur votre marque (vérité, perception), hors score */
  brandQuestions: number;
  providers: ProviderId[];
  runs: number;
  /** questions × IA × passages */
  plannedAnswers: number;
  /** réponses exploitables (base du score et du classement) */
  answers: number;
  /** réponses aux questions sur votre marque */
  brandAnswers: number;
  /** réponses avec sources (ChatGPT, Perplexity, Claude ; Gemini n'en fournit pas) */
  groundedAnswers: number;
  /** réponses qui vous citent */
  citations: number;
  /** questions où au moins une IA vous cite au moins une fois */
  citedQuestions: number;
  /** taux de mention = citations / answers (même valeur que `mentionRateOf`) */
  mentionRate: number;
  rows: RankRow[];
  rank: number;
  of: number;
  label: string;
  shareOfVoice: number;
  /** l'acteur juste devant vous (null si vous êtes 1er) */
  ahead: RankRow | null;
  /** « 8 questions × 3 IA × 2 passages = 48 réponses » */
  methodLabel: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function ordinalFr(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

function pluralTrade(word: string): string {
  return word
    .split(' ')
    .map((w, i) => (i === 0 && !/[sxz]$/.test(w) ? `${w}${/(eau|au)$/.test(w) ? 'x' : 's'}` : w))
    .join(' ');
}

function zoneLabel(a: AuditResult): string {
  const d = a.input.district?.trim();
  if (d) {
    const m = d.match(/^(\d{1,2})\s*(e|er|ème|eme)?$/i);
    return m ? `du ${m[1]}${m[1] === '1' ? 'ᵉʳ' : 'ᵉ'}` : `de ${d}`;
  }
  return `à ${a.input.city}`;
}

function segmentOfAudit(a: AuditV2): Segment {
  return a.segment ?? (a.input as { segment?: Segment }).segment ?? 'local';
}

function isBrandId(a: AuditResult, queryId: string): boolean {
  const q = a.queries.find((x) => x.id === queryId) as { kind?: string; id: string } | undefined;
  return (q?.kind === 'brand') || /^B\d/.test(queryId);
}

/** Libellé de rang par parcours : « 4ᵉ sur 10 plombiers du 11ᵉ ». */
export function rankLabel(a: AuditV2, rank: number, of: number): string {
  const segment = segmentOfAudit(a);
  const category = (a.input as { category?: string }).category;
  const products = (a.input as { productCategories?: string[] }).productCategories;
  if (segment === 'local') return `${ordinalFr(rank)} sur ${of} ${pluralTrade(a.input.trade)} ${zoneLabel(a)}`;
  if (segment === 'pme') return `${ordinalFr(rank)} sur ${of} acteurs cités pour « ${category || a.input.trade} »`;
  return `${ordinalFr(rank)} sur ${of} marques citées pour « ${a.input.trade || products?.[0] || ''} »`;
}

/** Réponses scorées : mêmes règles que le score (hors erreurs et « pas de recommandation »). */
function scoredMentions(a: AuditResult) {
  const ms = a.answers?.length ? validMentions(a.answers, a.mentions) : a.mentions.filter((m) => !isNoRec(m));
  return ms.filter((m) => !isBrandId(a, m.queryId));
}

const cache = new WeakMap<object, AuditStats>();

/** Chiffres clés d'un audit. Pure, mise en cache par objet. */
export function auditStats(a: AuditV2): AuditStats {
  const hit = cache.get(a);
  if (hit) return hit;
  const segment = segmentOfAudit(a);
  const ms = scoredMentions(a);
  const recoQueries = a.queries.filter((q) => !isBrandId(a, q.id));
  const brandQueries = a.queries.filter((q) => isBrandId(a, q.id));
  const providers = (a.providersUsed?.length ? a.providersUsed : [...new Set(a.mentions.map((m) => m.provider))]) as ProviderId[];
  const runs = ms.reduce((m, x) => Math.max(m, x.run), 0) || 1;
  const okAnswers = (a.answers ?? []).filter((x) => !x.error && x.text);
  const brandAnswers = okAnswers.filter((x) => isBrandId(a, x.queryId)).length;
  const groundedAnswers = okAnswers.filter((x) => x.provider !== 'gemini' && (x.citations?.length ?? 0) > 0).length;

  const own = fold(a.input.businessName);
  const mine = ms.filter((m) => m.mentioned).length;
  // Concurrents : comptés sur les MÊMES réponses que vous, une fois par réponse.
  const counts = new Map<string, { name: string; n: number }>();
  for (const m of ms) {
    const seen = new Set<string>();
    for (const c of m.competitors) {
      const k = fold(c);
      if (!k || k === own || seen.has(k) || isPlatformName(c)) continue;
      seen.add(k);
      const prev = counts.get(k);
      counts.set(k, { name: prev?.name ?? c, n: (prev?.n ?? 0) + 1 });
    }
  }
  // Mêmes acteurs que la liste du moteur (10 plus cités) quand elle existe, pour un « sur N » stable.
  const listed = (a.competitors ?? []).filter((c) => !isPlatformName(c.name) && fold(c.name) !== own);
  let comps = [...counts.values()];
  if (listed.length) {
    comps = listed.map((c) => ({ name: c.name, n: counts.get(fold(c.name))?.n ?? c.mentions }));
  } else {
    comps = comps.sort((x, y) => y.n - x.n).slice(0, 10);
  }
  comps = comps.filter((c) => c.n > 0);
  const total = Math.max(1, mine + comps.reduce((s, c) => s + c.n, 0));
  const sorted = [
    { name: a.input.businessName, mentions: mine, isMe: true },
    ...comps.map((c) => ({ name: c.name, mentions: c.n, isMe: false })),
  ].sort((x, y) => y.mentions - x.mentions || Number(y.isMe) - Number(x.isMe) || x.name.localeCompare(y.name));
  const rows: RankRow[] = sorted.map((r, i) => ({ ...r, share: r.mentions / total, pos: i + 1 }));
  const meIdx = rows.findIndex((r) => r.isMe);
  const rank = meIdx + 1;
  const of = rows.length;

  const citedQ = new Set(ms.filter((m) => m.mentioned).map((m) => m.queryId));
  const planned = recoQueries.length * providers.length * runs;
  let methodLabel = `${plural(recoQueries.length, 'question', 'questions')} × ${providers.length} IA × ${plural(runs, 'passage', 'passages')} = ${plural(planned, 'réponse', 'réponses')}`;
  if (ms.length !== planned) methodLabel += ` (${ms.length} exploitables)`;

  const stats: AuditStats = {
    segment,
    questions: recoQueries.length,
    brandQuestions: brandQueries.length,
    providers,
    runs,
    plannedAnswers: planned,
    answers: ms.length,
    brandAnswers,
    groundedAnswers,
    citations: mine,
    citedQuestions: citedQ.size,
    mentionRate: ratio(mine, ms.length),
    rows,
    rank,
    of,
    label: rankLabel(a, rank, of),
    shareOfVoice: rows[meIdx]?.share ?? 0,
    ahead: meIdx > 0 ? rows[meIdx - 1] : null,
    methodLabel,
  };
  cache.set(a, stats);
  return stats;
}

/* ------------------------------------------------------------------ */
/* LES deux pourcentages (une seule définition chacun, partout)         */
/* ------------------------------------------------------------------ */

/** Part exprimée sur [0, 1], 0 si la base est vide. */
export function ratio(part: number, base: number): number {
  return base > 0 ? part / base : 0;
}

/** Taux de mention = réponses qui citent l'acteur / réponses exploitables. */
export function mentionRateOf(s: Pick<AuditStats, 'citations' | 'answers'>): number {
  return ratio(s.citations, s.answers);
}

/** Taux de mention d'un acteur classé (concurrent ou vous) : ses réponses citantes / réponses exploitables. */
export function rowMentionRate(s: Pick<AuditStats, 'answers'>, row: Pick<RankRow, 'mentions'>): number {
  return ratio(row.mentions, s.answers);
}

/** Part de voix = citations de l'acteur / total des citations des acteurs classés (vous compris). */
export function shareOfVoiceOf(s: Pick<AuditStats, 'rows'>, name?: string): number {
  const total = s.rows.reduce((t, r) => t + r.mentions, 0);
  const row = name === undefined ? s.rows.find((r) => r.isMe) : s.rows.find((r) => fold(r.name) === fold(name) || (r.isMe && fold(name) === 'vous'));
  return ratio(row?.mentions ?? 0, total);
}

/** Ligne du classement d'un acteur (insensible aux accents et à la casse), « vous » = le client. */
export function findRow(s: Pick<AuditStats, 'rows'>, name: string): RankRow | undefined {
  const k = fold(name);
  return s.rows.find((r) => fold(r.name) === k) ?? (k === 'vous' ? s.rows.find((r) => r.isMe) : undefined);
}

/**
 * Ventilation par IA sur les MÊMES réponses que `auditStats` : réponses exploitables, réponses qui vous citent,
 * réponses qui citent `name` (une fois par réponse). La somme par IA redonne les totaux du classement.
 */
export function providerBreakdown(a: AuditV2, name?: string): { provider: ProviderId; answers: number; me: number; him: number }[] {
  const ms = scoredMentions(a);
  const s = auditStats(a);
  const k = name ? fold(name) : '';
  return s.providers
    .map((p) => {
      const pm = ms.filter((m) => m.provider === p);
      return { provider: p, answers: pm.length, me: pm.filter((m) => m.mentioned).length, him: k ? pm.filter((m) => m.competitors.some((c) => fold(c) === k)).length : 0 };
    })
    .filter((x) => x.answers > 0);
}

/** Libellés figés des deux unités (à reprendre tels quels dans les écrans). */
export const PCT_LABEL = {
  mentionRate: 'des réponses',
  shareOfVoice: 'des citations (part de voix)',
} as const;

/** Rang au format BenchmarkPosition (remplace le `benchmark` stocké, calculé sur une autre base). */
export function benchmarkOfAudit(a: AuditV2): BenchmarkPosition {
  const s = auditStats(a);
  return { rank: s.rank, of: s.of, label: s.label };
}

export type RankPeriod = 'month' | 'quarter';

export interface RankMove {
  period: RankPeriod;
  /** audit de référence (début de période) */
  fromId: string;
  /** libellé de période : « sur un mois », « sur le trimestre » */
  periodLabel: string;
  from: number;
  to: number;
  /** places gagnées (positif) ou perdues (négatif) */
  places: number;
  fromScore: number;
  toScore: number;
  scoreDelta: number;
  /** « +1 place sur un mois », « stable sur le trimestre » */
  label: string;
  /** Explication quand le score et le rang ne vont pas dans le même sens. */
  explanation: string | null;
}

const auditTime = (a: AuditResult) => new Date(a.measuredAt ?? a.createdAt).getTime();

/** Écart minimal entre deux mesures comparées (une mesure le jour même n'est pas une « évolution »). */
export const MIN_COMPARE_DAYS = 6;
/** Part minimale de questions de recommandation communes (Jaccard) pour comparer deux mesures. */
export const MIN_QUESTION_OVERLAP = 0.8;

const questionKey = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function recoQuestionSet(a: AuditV2): Set<string> {
  return new Set(a.queries.filter((q) => !isBrandId(a, q.id)).map((q) => questionKey(q.text)).filter(Boolean));
}

/**
 * Deux mesures sont comparables (B2 de qa/v3/regard-client-v3.md) si elles portent sur le même parcours, sur
 * (presque) les mêmes questions de recommandation, et sont espacées d'au moins `MIN_COMPARE_DAYS` jours. Un audit
 * gratuit de 8 questions rattaché à un espace qui en suit 5, le jour même, n'est PAS une mesure précédente.
 */
export function comparableAudits(prev: AuditV2, next: AuditV2): boolean {
  if (prev === next || prev.id === next.id) return false;
  if (segmentOfAudit(prev) !== segmentOfAudit(next)) return false;
  if (auditTime(next) - auditTime(prev) < MIN_COMPARE_DAYS * 86_400_000) return false;
  const a = recoQuestionSet(prev);
  const b = recoQuestionSet(next);
  if (!a.size || !b.size) return false;
  let common = 0;
  for (const k of a) if (b.has(k)) common++;
  return common / (a.size + b.size - common) >= MIN_QUESTION_OVERLAP;
}

/**
 * Historique comparable avec la dernière mesure, du plus ancien au plus récent (dernière mesure comprise) :
 * on remonte tant que chaque mesure est comparable à la suivante retenue. Sert au delta de score, à l'évolution du
 * rang, aux « nouveaux concurrents » et à la phrase de la semaine.
 */
export function comparableHistory<T extends AuditV2>(audits: readonly T[]): T[] {
  if (!audits.length) return [];
  const sorted = [...audits].sort((x, y) => auditTime(x) - auditTime(y));
  const out: T[] = [sorted[sorted.length - 1]];
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (comparableAudits(sorted[i], out[0])) out.unshift(sorted[i]);
  }
  return out;
}

/** Mesure précédente comparable à la dernière, ou null (première mesure, ou audit d'un autre périmètre). */
export function previousComparable<T extends AuditV2>(audits: readonly T[]): T | null {
  const h = comparableHistory(audits);
  return h.length > 1 ? h[h.length - 2] : null;
}

/**
 * Évolution du rang sur une période EXPLICITE. `audits` : du plus ancien au plus récent.
 * Mois : audit précédent. Trimestre : audit le plus proche de 3 mois avant le dernier.
 */
export function rankMove(audits: AuditV2[], period: RankPeriod = 'month'): RankMove | null {
  // Seulement entre mesures comparables (mêmes questions, au moins 6 jours d'écart).
  const sorted = comparableHistory(audits);
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  let ref = sorted[sorted.length - 2];
  if (period === 'quarter') {
    const target = auditTime(last) - 91 * 86400000;
    ref = sorted.slice(0, -1).reduce((best, a) => (Math.abs(auditTime(a) - target) < Math.abs(auditTime(best) - target) ? a : best), sorted[0]);
  }
  const s0 = auditStats(ref);
  const s1 = auditStats(last);
  const places = s0.rank - s1.rank;
  const periodLabel = period === 'month' ? 'sur un mois' : 'sur le trimestre';
  const scoreDelta = Math.round(last.score - ref.score);
  const label = places === 0 ? `stable ${periodLabel}` : `${places > 0 ? '+' : '−'}${Math.abs(places)} place${Math.abs(places) > 1 ? 's' : ''} ${periodLabel}`;
  let explanation: string | null = null;
  if (scoreDelta > 0 && places < 0) {
    // qui est passé devant ?
    const prevAhead = new Set(s0.rows.slice(0, s0.rank - 1).map((r) => fold(r.name)));
    const passer = s1.rows.slice(0, s1.rank - 1).find((r) => !prevAhead.has(fold(r.name)));
    explanation = `Vous progressez (${scoreDelta > 0 ? '+' : ''}${scoreDelta} points), mais ${passer ? `${passer.name} progresse plus vite` : 'un concurrent progresse plus vite'}.`;
  } else if (scoreDelta < 0 && places > 0) {
    explanation = `Votre score baisse (${scoreDelta} points), mais vos concurrents reculent davantage.`;
  }
  return { period, fromId: ref.id, periodLabel, from: s0.rank, to: s1.rank, places, fromScore: Math.round(ref.score), toScore: Math.round(last.score), scoreDelta, label, explanation };
}

/** Concurrents présents dans le dernier audit et absents des `window` audits précédents (vrais entrants). */
export function newEntrants(audits: AuditV2[], window = 2): string[] {
  const sorted = comparableHistory(audits);
  if (sorted.length < 2) return [];
  const last = auditStats(sorted[sorted.length - 1]);
  const before = sorted.slice(Math.max(0, sorted.length - 1 - window), -1).map((a) => new Set(auditStats(a).rows.map((r) => fold(r.name))));
  if (!before.length) return [];
  return last.rows.filter((r) => !r.isMe && before.every((s) => !s.has(fold(r.name)))).map((r) => r.name);
}

const MEASURE_STEP_DAYS: Record<'monthly' | 'weekly' | 'daily', number> = { monthly: 28, weekly: 7, daily: 1 };

/** Date indicative de la prochaine mesure planifiée (mêmes intervalles que la file de tâches). ISO. */
export function nextMeasureDate(measuredAt: string, frequency: 'monthly' | 'weekly' | 'daily'): string {
  const t = Date.parse(measuredAt);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + MEASURE_STEP_DAYS[frequency] * 86_400_000).toISOString();
}

/** « Première mesure : voici votre point de départ. Prochaine mesure vers le 8 décembre. » */
export function firstMeasureLine(nextAt?: string | null): string {
  const d = nextAt ? new Date(nextAt) : null;
  const when = d && Number.isFinite(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) : null;
  return `Première mesure : voici votre point de départ.${when ? ` Prochaine mesure vers le ${when}.` : ''}`;
}

export type MeasureFrequency = 'monthly' | 'weekly' | 'daily';

/**
 * Vocabulaire du digest « du lundi » selon le rythme de l'offre (B19 / amél. 14 de qa/v3/regard-client-v3.md) :
 * une offre à mesure mensuelle ne dit jamais « cette semaine » sans nouvelle mesure.
 * - `fresh` : une mesure a eu lieu dans les 7 derniers jours ;
 * - `period` : « cette semaine » (hebdomadaire, quotidienne) ou « ce mois-ci » (mensuelle) ;
 * - `lead` : début de la phrase de citation (« Cette semaine, », « Ce mois-ci, », « À la mesure du 3 novembre, ») ;
 * - `noNewMeasure` : phrase à ajouter quand rien n'a été mesuré cette semaine (sinon null) ;
 * - `calm` : formule de période calme adaptée (« Semaine calme », « Mois calme »).
 */
export function digestRhythm(opts: { frequency: MeasureFrequency; measuredAt: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const t = Date.parse(opts.measuredAt);
  const age = Number.isFinite(t) ? (now.getTime() - t) / 86_400_000 : 0;
  const fresh = age < 7;
  const monthly = opts.frequency === 'monthly';
  const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).replace(/^1 /, '1er ');
  const measured = Number.isFinite(t) ? day(opts.measuredAt) : null;
  const next = nextMeasureDate(opts.measuredAt, opts.frequency);
  // Prochaine mesure déjà dépassée (relance en retard) : on ne donne pas une date passée.
  const nextLabel = Date.parse(next) > now.getTime() ? day(next) : null;
  const period = monthly ? 'ce mois-ci' : 'cette semaine';
  const lead = fresh ? `${period.charAt(0).toUpperCase()}${period.slice(1)}, ` : measured ? `À la mesure du ${measured}, ` : 'À la dernière mesure, ';
  const rhythm = monthly ? 'une mesure par mois' : opts.frequency === 'daily' ? 'une mesure par jour' : 'une mesure par semaine';
  const noNewMeasure = fresh ? null : `Pas de nouvelle mesure cette semaine (${rhythm})${nextLabel ? ` : prochaine mesure le ${nextLabel}` : ''}. Voici vos actions de la semaine.`;
  const calm = monthly ? 'Mois calme : votre position tient.' : 'Semaine calme : votre position tient.';
  return { fresh, period, lead, noNewMeasure, calm, nextLabel, measuredLabel: measured };
}
