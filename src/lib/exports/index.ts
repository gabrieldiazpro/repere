/**
 * Exports CSV de toutes les vues (docs/v3/09-audit-app.md amélioration n° 5).
 * Fonctions pures de mise en lignes (testables) + `buildExport` qui charge les données d'un commerce.
 * Jamais d'e-mail ni de donnée de contact dans un export.
 */
import type { AuditResult, ProviderId } from '@/lib/engine/types';
import type { ExecTask } from '@/lib/engine/types-v2';
import { auditStats } from '@/lib/digest/stats';
import { listAuditsForBusiness } from '@/lib/db';
import { listTasks } from '@/lib/execution';
import { getAiTraffic, ENGINES } from '@/lib/tracking';
import type { AiTrafficSummary } from '@/lib/engine/types-v2';
import { csvFilename, toCsv, type CsvColumn } from './csv';

export * from './csv';

export const EXPORT_KINDS = ['questions', 'answers', 'sources', 'urls', 'competitors', 'tasks', 'traffic', 'scores'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export const isExportKind = (v: unknown): v is ExportKind => typeof v === 'string' && (EXPORT_KINDS as readonly string[]).includes(v);

export const EXPORT_LABELS: Record<ExportKind, string> = {
  questions: 'Questions suivies, par IA',
  answers: 'Réponses brutes des IA',
  sources: 'Sources citées (domaines)',
  urls: 'Pages citées (URL)',
  competitors: 'Concurrents et part de voix',
  tasks: 'Tâches',
  traffic: 'Trafic venu des IA (par jour)',
  scores: 'Historique des scores',
};

const PROVIDER_NAMES: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral (Le Chat)', copilot: 'Copilot', other_ai: 'Autres IA' };
export const providerName = (p: string) => PROVIDER_NAMES[p] ?? p;

type Audit = AuditResult;
const auditDate = (a: Audit) => (a.measuredAt || a.createdAt || '').slice(0, 10);
const isBrandQuery = (a: Audit, queryId: string) => a.queries.find((q) => q.id === queryId)?.kind === 'brand' || /^B\d/.test(queryId);
const STATUS_FR: Record<string, string> = { todo: 'à faire', in_progress: 'en cours', done: 'faite', skipped: 'écartée' };
const AUTOMATION_FR: Record<string, string> = { auto: 'automatique', semi: 'semi-automatique', guide: 'guidée' };
const PRESENCE_FR: Record<string, string> = { present: 'présent', absent: 'absent', unknown: 'inconnu' };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function normUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|ref)$/i.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

// ---------------------------------------------------------------------------
// Lignes par vue (pures)
// ---------------------------------------------------------------------------
export interface QuestionRow { date: string; queryId: string; question: string; type: string; intent: string; angle: string; provider: string; answers: number; cited: number; rate: number; bestRank: number | null; competitors: string[] }

export function questionRows(audits: Audit[]): QuestionRow[] {
  const out: QuestionRow[] = [];
  for (const a of audits) {
    for (const q of a.queries) {
      const providers = [...new Set(a.mentions.filter((m) => m.queryId === q.id).map((m) => m.provider))];
      for (const p of providers) {
        const ms = a.mentions.filter((m) => m.queryId === q.id && m.provider === p);
        const cited = ms.filter((m) => m.mentioned);
        const ranks = cited.map((m) => m.rank).filter((r): r is number => typeof r === 'number');
        out.push({
          date: auditDate(a), queryId: q.id, question: q.text, type: isBrandQuery(a, q.id) ? 'marque' : 'recommandation', intent: q.intent, angle: q.angle ?? '',
          provider: providerName(p), answers: ms.length, cited: cited.length, rate: ms.length ? cited.length / ms.length : 0,
          bestRank: ranks.length ? Math.min(...ranks) : null, competitors: [...new Set(ms.flatMap((m) => m.competitors))].slice(0, 10),
        });
      }
    }
  }
  return out;
}

export interface AnswerRow { date: string; question: string; provider: string; run: number; model: string; mentioned: boolean; rank: number | null; competitors: string[]; sources: string[]; text: string; demo: boolean }

export function answerRows(audits: Audit[]): AnswerRow[] {
  const out: AnswerRow[] = [];
  for (const a of audits) {
    const qText = new Map(a.queries.map((q) => [q.id, q.text]));
    for (const ans of a.answers ?? []) {
      if (ans.error && !ans.text) continue;
      const m = a.mentions.find((x) => x.queryId === ans.queryId && x.provider === ans.provider && x.run === ans.run);
      const sources = ans.sources?.length ? ans.sources.filter((s) => s.kind !== 'retrieved').map((s) => s.url) : ans.citations ?? [];
      out.push({
        date: (ans.at || auditDate(a)).slice(0, 10), question: qText.get(ans.queryId) ?? ans.queryId, provider: providerName(ans.provider), run: ans.run,
        model: ans.model ?? '', mentioned: !!m?.mentioned, rank: m?.rank ?? null, competitors: m?.competitors ?? [], sources, text: ans.text, demo: !!ans.demo,
      });
    }
  }
  return out;
}

export interface SourceRow { date: string; domain: string; label: string; category: string; citations: number; share: number; providers: string[]; questions: number; presence: string; competitors: string[]; urls: string[] }

export function sourceRows(audits: Audit[]): SourceRow[] {
  const out: SourceRow[] = [];
  for (const a of audits) {
    for (const d of a.sources?.domains ?? []) {
      out.push({
        date: auditDate(a), domain: d.domain, label: d.label, category: d.category, citations: d.citations, share: d.citationShare,
        providers: d.providers.map(providerName), questions: d.queries.length, presence: PRESENCE_FR[d.clientPresence] ?? d.clientPresence,
        competitors: d.competitorsPresent, urls: d.sampleUrls.slice(0, 5),
      });
    }
  }
  return out;
}

export interface UrlRow { url: string; domain: string; title: string; citations: number; providers: string[]; questions: string[]; firstSeen: string; lastSeen: string }

/** Agrégat URL par URL sur la période (URL normalisées, paramètres de suivi retirés). */
export function urlRows(audits: Audit[]): UrlRow[] {
  const map = new Map<string, UrlRow & { _p: Set<string>; _q: Set<string> }>();
  for (const a of audits) {
    const date = auditDate(a);
    const qText = new Map(a.queries.map((q) => [q.id, q.text]));
    for (const ans of a.answers ?? []) {
      const list = ans.sources?.length
        ? ans.sources.filter((s) => s.kind !== 'retrieved').map((s) => ({ url: s.url, title: s.title ?? '' }))
        : (ans.citations ?? []).map((url) => ({ url, title: '' }));
      for (const s of list) {
        if (!/^https?:\/\//i.test(s.url)) continue;
        const k = normUrl(s.url);
        let r = map.get(k);
        if (!r) map.set(k, (r = { url: k, domain: hostOf(k), title: s.title, citations: 0, providers: [], questions: [], firstSeen: date, lastSeen: date, _p: new Set(), _q: new Set() }));
        r.citations++;
        r._p.add(providerName(ans.provider));
        r._q.add(qText.get(ans.queryId) ?? ans.queryId);
        if (!r.title && s.title) r.title = s.title;
        if (date < r.firstSeen) r.firstSeen = date;
        if (date > r.lastSeen) r.lastSeen = date;
      }
    }
  }
  return [...map.values()]
    .map(({ _p, _q, ...r }) => ({ ...r, providers: [..._p], questions: [..._q] }))
    .sort((x, y) => y.citations - x.citations || x.url.localeCompare(y.url));
}

export interface CompetitorRow { date: string; pos: number; name: string; isMe: boolean; mentions: number; share: number; of: number }

export function competitorRows(audits: Audit[]): CompetitorRow[] {
  return audits.flatMap((a) => {
    const s = auditStats(a);
    return s.rows.map((r) => ({ date: auditDate(a), pos: r.pos, name: r.name, isMe: r.isMe, mentions: r.mentions, share: r.share, of: s.of }));
  });
}

export interface ScoreRow { date: string; auditId: string; score: number; low: number; high: number; mentionRate: number; shareOfVoice: number; rank: number; of: number; avgRank: number | null; confidence: string; providers: string[]; sub: Partial<Record<ProviderId, number | null>>; demo: boolean }

export function scoreRows(audits: Audit[]): ScoreRow[] {
  return audits.map((a) => {
    const s = auditStats(a);
    return {
      date: auditDate(a), auditId: a.id, score: a.score, low: a.range?.low ?? a.score, high: a.range?.high ?? a.score, mentionRate: a.mentionRate,
      shareOfVoice: s.shareOfVoice, rank: s.rank, of: s.of, avgRank: a.avgRank, confidence: a.confidence, providers: (a.providersUsed ?? []).map(providerName),
      sub: a.subScores ?? {}, demo: !!a.demo,
    };
  });
}

export interface TrafficRow { date: string; total: number; ai: number; conversions: number; byEngine: Record<string, number> }

export function trafficRows(t: AiTrafficSummary): TrafficRow[] {
  return t.days.map((d) => ({
    date: d.date, total: d.totalVisits,
    ai: Object.values(d.visits).reduce((s, n) => s + (n ?? 0), 0),
    conversions: Object.values(d.conversions).reduce((s, n) => s + (n ?? 0), 0),
    byEngine: Object.fromEntries(ENGINES.map((e) => [e, d.visits[e] ?? 0])),
  }));
}

// ---------------------------------------------------------------------------
// Colonnes (libellés français)
// ---------------------------------------------------------------------------
const SCORE_PROVIDERS: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

export const COLUMNS = {
  questions: [
    { key: 'date', label: 'Date de mesure', value: (r: QuestionRow) => r.date },
    { key: 'id', label: 'Identifiant', value: (r: QuestionRow) => r.queryId },
    { key: 'q', label: 'Question', value: (r: QuestionRow) => r.question },
    { key: 'type', label: 'Type', value: (r: QuestionRow) => r.type },
    { key: 'intent', label: 'Intention', value: (r: QuestionRow) => r.intent },
    { key: 'angle', label: 'Angle', value: (r: QuestionRow) => r.angle },
    { key: 'ia', label: 'IA', value: (r: QuestionRow) => r.provider },
    { key: 'n', label: 'Réponses', value: (r: QuestionRow) => r.answers },
    { key: 'cited', label: 'Réponses qui vous citent', value: (r: QuestionRow) => r.cited },
    { key: 'rate', label: 'Taux de mention', value: (r: QuestionRow) => r.rate },
    { key: 'rank', label: 'Meilleure position', value: (r: QuestionRow) => r.bestRank },
    { key: 'comp', label: 'Concurrents cités', value: (r: QuestionRow) => r.competitors },
  ] satisfies CsvColumn<QuestionRow>[],
  answers: [
    { key: 'date', label: 'Date', value: (r: AnswerRow) => r.date },
    { key: 'q', label: 'Question', value: (r: AnswerRow) => r.question },
    { key: 'ia', label: 'IA', value: (r: AnswerRow) => r.provider },
    { key: 'run', label: 'Passage', value: (r: AnswerRow) => r.run },
    { key: 'model', label: 'Modèle', value: (r: AnswerRow) => r.model },
    { key: 'm', label: 'Vous cite', value: (r: AnswerRow) => r.mentioned },
    { key: 'rank', label: 'Position', value: (r: AnswerRow) => r.rank },
    { key: 'comp', label: 'Concurrents cités', value: (r: AnswerRow) => r.competitors },
    { key: 'src', label: 'Sources citées', value: (r: AnswerRow) => r.sources.join(' | ') },
    { key: 'text', label: 'Réponse complète', value: (r: AnswerRow) => r.text },
    { key: 'demo', label: 'Donnée de démonstration', value: (r: AnswerRow) => r.demo },
  ] satisfies CsvColumn<AnswerRow>[],
  sources: [
    { key: 'date', label: 'Date de mesure', value: (r: SourceRow) => r.date },
    { key: 'domain', label: 'Domaine', value: (r: SourceRow) => r.domain },
    { key: 'label', label: 'Nom', value: (r: SourceRow) => r.label },
    { key: 'cat', label: 'Catégorie', value: (r: SourceRow) => r.category },
    { key: 'n', label: 'Citations', value: (r: SourceRow) => r.citations },
    { key: 'share', label: 'Part des citations', value: (r: SourceRow) => r.share },
    { key: 'ia', label: 'IA', value: (r: SourceRow) => r.providers },
    { key: 'q', label: 'Questions concernées', value: (r: SourceRow) => r.questions },
    { key: 'me', label: 'Votre présence', value: (r: SourceRow) => r.presence },
    { key: 'comp', label: 'Concurrents présents', value: (r: SourceRow) => r.competitors },
    { key: 'urls', label: 'Exemples d’URL', value: (r: SourceRow) => r.urls.join(' | ') },
  ] satisfies CsvColumn<SourceRow>[],
  urls: [
    { key: 'url', label: 'URL', value: (r: UrlRow) => r.url },
    { key: 'domain', label: 'Domaine', value: (r: UrlRow) => r.domain },
    { key: 'title', label: 'Titre', value: (r: UrlRow) => r.title },
    { key: 'n', label: 'Citations', value: (r: UrlRow) => r.citations },
    { key: 'ia', label: 'IA', value: (r: UrlRow) => r.providers },
    { key: 'q', label: 'Questions', value: (r: UrlRow) => r.questions.join(' | ') },
    { key: 'first', label: 'Première citation', value: (r: UrlRow) => r.firstSeen },
    { key: 'last', label: 'Dernière citation', value: (r: UrlRow) => r.lastSeen },
  ] satisfies CsvColumn<UrlRow>[],
  competitors: [
    { key: 'date', label: 'Date de mesure', value: (r: CompetitorRow) => r.date },
    { key: 'pos', label: 'Rang', value: (r: CompetitorRow) => r.pos },
    { key: 'of', label: 'Acteurs classés', value: (r: CompetitorRow) => r.of },
    { key: 'name', label: 'Acteur', value: (r: CompetitorRow) => r.name },
    { key: 'me', label: 'Vous', value: (r: CompetitorRow) => r.isMe },
    { key: 'n', label: 'Réponses qui le citent', value: (r: CompetitorRow) => r.mentions },
    { key: 'sov', label: 'Part de voix', value: (r: CompetitorRow) => r.share },
  ] satisfies CsvColumn<CompetitorRow>[],
  tasks: [
    { key: 'id', label: 'Identifiant', value: (t: ExecTask) => t.id },
    { key: 'title', label: 'Tâche', value: (t: ExecTask) => t.title },
    { key: 'kind', label: 'Type', value: (t: ExecTask) => t.kind },
    { key: 'status', label: 'Statut', value: (t: ExecTask) => STATUS_FR[t.status] ?? t.status },
    { key: 'auto', label: 'Automatisation', value: (t: ExecTask) => AUTOMATION_FR[t.automation] ?? t.automation },
    { key: 'min', label: 'Temps estimé (min)', value: (t: ExecTask) => t.minutes },
    { key: 'impact', label: 'Impact (1 à 3)', value: (t: ExecTask) => t.impact },
    { key: 'src', label: 'Source visée', value: (t: ExecTask) => t.sourceDomain ?? '' },
    { key: 'week', label: 'Semaine', value: (t: ExecTask) => t.week ?? '' },
    { key: 'created', label: 'Créée le', value: (t: ExecTask) => t.createdAt.slice(0, 10) },
    { key: 'done', label: 'Faite le', value: (t: ExecTask) => t.doneAt?.slice(0, 10) ?? '' },
    { key: 'why', label: 'Pourquoi', value: (t: ExecTask) => t.why },
  ] satisfies CsvColumn<ExecTask>[],
  traffic: [
    { key: 'date', label: 'Date', value: (r: TrafficRow) => r.date },
    { key: 'total', label: 'Visites totales', value: (r: TrafficRow) => r.total },
    { key: 'ai', label: 'Visites venues des IA', value: (r: TrafficRow) => r.ai },
    ...ENGINES.map((e) => ({ key: e, label: `Visites ${providerName(e)}`, value: (r: TrafficRow) => r.byEngine[e] ?? 0 })),
    { key: 'conv', label: 'Conversions venues des IA', value: (r: TrafficRow) => r.conversions },
  ] satisfies CsvColumn<TrafficRow>[],
  scores: [
    { key: 'date', label: 'Date de mesure', value: (r: ScoreRow) => r.date },
    { key: 'id', label: 'Audit', value: (r: ScoreRow) => r.auditId },
    { key: 'score', label: 'Score /100', value: (r: ScoreRow) => r.score },
    { key: 'low', label: 'Marge basse', value: (r: ScoreRow) => r.low },
    { key: 'high', label: 'Marge haute', value: (r: ScoreRow) => r.high },
    { key: 'mr', label: 'Taux de mention', value: (r: ScoreRow) => r.mentionRate },
    { key: 'sov', label: 'Part de voix', value: (r: ScoreRow) => r.shareOfVoice },
    { key: 'rank', label: 'Rang', value: (r: ScoreRow) => r.rank },
    { key: 'of', label: 'Acteurs classés', value: (r: ScoreRow) => r.of },
    { key: 'avg', label: 'Position moyenne', value: (r: ScoreRow) => r.avgRank },
    { key: 'conf', label: 'Confiance', value: (r: ScoreRow) => r.confidence },
    { key: 'ia', label: 'IA mesurées', value: (r: ScoreRow) => r.providers },
    ...SCORE_PROVIDERS.map((p) => ({ key: `s_${p}`, label: `Score ${providerName(p)}`, value: (r: ScoreRow) => r.sub[p] ?? null })),
    { key: 'demo', label: 'Donnée de démonstration', value: (r: ScoreRow) => r.demo },
  ] satisfies CsvColumn<ScoreRow>[],
};

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
export interface ExportPeriod { from?: string; to?: string }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function filterAudits(audits: Audit[], p: ExportPeriod): Audit[] {
  return audits.filter((a) => {
    const d = auditDate(a);
    return (!p.from || !DATE_RE.test(p.from) || d >= p.from) && (!p.to || !DATE_RE.test(p.to) || d <= p.to);
  });
}

function trafficDays(p: ExportPeriod, today: string): number {
  if (p.from && DATE_RE.test(p.from)) {
    const n = Math.round((Date.parse(today) - Date.parse(p.from)) / 86_400_000) + 1;
    return Math.min(400, Math.max(1, n));
  }
  return 90;
}

/** Construit le CSV d'une vue. `latestOnly` (questions, réponses, sources, concurrents) : dernier audit de la période. */
export async function buildExport(
  business: { id: string; name: string },
  kind: ExportKind,
  period: ExportPeriod = {},
  opts: { now?: Date; allAudits?: boolean } = {},
): Promise<{ filename: string; csv: string; rows: number }> {
  const now = opts.now ?? new Date();
  const fname = csvFilename(kind, business.name, now);
  const csvOf = <T,>(rows: T[], cols: CsvColumn<T>[]) => ({ filename: fname, csv: toCsv(rows, cols), rows: rows.length });

  if (kind === 'tasks') {
    const tasks = (await listTasks(business.id)).filter((t) => {
      const d = t.createdAt.slice(0, 10);
      return (!period.from || d >= period.from || (t.doneAt ?? '') >= period.from) && (!period.to || d <= period.to);
    });
    return csvOf(tasks, COLUMNS.tasks);
  }
  if (kind === 'traffic') {
    const today = period.to && DATE_RE.test(period.to) ? period.to : now.toISOString().slice(0, 10);
    const t = await getAiTraffic(business.id, trafficDays(period, today), today);
    return csvOf(trafficRows(t), COLUMNS.traffic);
  }
  const audits = filterAudits(await listAuditsForBusiness(business.id), period);
  const scoped = kind === 'scores' || kind === 'urls' || kind === 'competitors' || opts.allAudits || (period.from && period.to) ? audits : audits.slice(-1);
  switch (kind) {
    case 'questions': return csvOf(questionRows(scoped), COLUMNS.questions);
    case 'answers': return csvOf(answerRows(scoped), COLUMNS.answers);
    case 'sources': return csvOf(sourceRows(scoped), COLUMNS.sources);
    case 'urls': return csvOf(urlRows(scoped), COLUMNS.urls);
    case 'competitors': return csvOf(competitorRows(scoped), COLUMNS.competitors);
    case 'scores': return csvOf(scoreRows(scoped), COLUMNS.scores);
  }
}
