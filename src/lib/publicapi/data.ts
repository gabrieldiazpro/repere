/**
 * Représentations publiques (API REST et MCP) des données d'un espace. Fonctions pures (testées) + chargeurs.
 *
 * Règles : aucune donnée inventée (une mesure absente = null, jamais 0) ; chaque mesure des IA porte sa marge
 * (intervalle à 90 %) ; tout ce qui vient des comptes démo porte `demo: true` ; aucune donnée de contact.
 */
import type { AuditResult, ProviderId } from '@/lib/engine/types';
import type { SeoReport, Finding } from '@/lib/seoaudit/types';
import type { GeoReport } from '@/lib/geo/types';
import type { ChangeSet } from '@/lib/publish/types';
import type { TrackedPrompt } from '@/lib/prompts/types';
import type { BusinessRecord } from '@/lib/db';
import { TIER_NAMES, type Entitlements } from '@/lib/entitlements';
import { auditStats } from '@/lib/digest/stats';
import { computeMargins } from '@/lib/engine/analytics';
import { wilson } from '@/lib/engine/scoring';
import { isDemoBusinessId } from '@/lib/demo-v2';

const PROVIDER_NAMES: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral Vibe', copilot: 'Copilot (Bing)', deepseek: 'DeepSeek', ai_overviews: 'Google AI Overviews', ai_mode: 'Google AI Mode', google_aio: 'Google AI Overviews', google_ai_mode: 'Google AI Mode', grok: 'Grok' };
export const providerName = (p: string) => PROVIDER_NAMES[p] ?? p;

const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const auditAt = (a: Pick<AuditResult, 'measuredAt' | 'createdAt'>) => a.measuredAt || a.createdAt;
const day = (iso: string) => (iso || '').slice(0, 10);

// ---------------------------------------------------------------------------
// Espaces
// ---------------------------------------------------------------------------
export interface SpaceView {
  id: string;
  name: string;
  segment: 'local' | 'pme' | 'ecommerce';
  trade: string | null;
  city: string | null;
  website: string | null;
  plan: string;
  demo: boolean;
  measurements: number;
  lastMeasuredAt: string | null;
}

export function spaceView(b: BusinessRecord, e: Pick<Entitlements, 'tier'>, audits: Pick<AuditResult, 'measuredAt' | 'createdAt'>[]): SpaceView {
  const last = audits.at(-1);
  return {
    id: b.id,
    name: b.name,
    segment: b.segment === 'pme' || b.segment === 'ecommerce' ? b.segment : 'local',
    trade: b.trade || null,
    city: [b.district, b.city].filter(Boolean).join(' ') || null,
    website: b.website || null,
    plan: TIER_NAMES[e.tier],
    demo: isDemoBusinessId(b.id),
    measurements: audits.length,
    lastMeasuredAt: last ? auditAt(last) : null,
  };
}

// ---------------------------------------------------------------------------
// Visibilité dans les IA (score, marges, par IA)
// ---------------------------------------------------------------------------
export interface Interval {
  value: number;
  low: number;
  high: number;
  margin: number;
}

export interface VisibilityView {
  measurementId: string;
  measuredAt: string;
  /** score de visibilité dans les IA, sur 100 */
  score: Interval;
  /** niveau de l'intervalle (0,9 = 90 %) */
  level: number;
  confidence: string;
  mentionRate: Interval;
  shareOfVoice: Interval;
  rank: number | null;
  rankedActors: number;
  byProvider: { provider: string; name: string; score: number | null }[];
  method: string;
  demo: boolean;
}

export function visibilityOf(a: AuditResult): VisibilityView {
  const m = computeMargins(a);
  const s = auditStats(a);
  const subs = (a.subScores ?? {}) as Partial<Record<ProviderId, number | null>>;
  const providers = (a.providersUsed?.length ? a.providersUsed : (Object.keys(subs) as ProviderId[])).filter((p, i, l) => l.indexOf(p) === i);
  return {
    measurementId: a.id,
    measuredAt: auditAt(a),
    score: m.score,
    level: m.level,
    confidence: a.confidence,
    mentionRate: m.mentionRate,
    shareOfVoice: m.shareOfVoice,
    rank: s.rank || null,
    rankedActors: s.of,
    byProvider: providers.map((p) => ({ provider: p, name: providerName(p), score: typeof subs[p] === 'number' ? (subs[p] as number) : null })),
    method: m.label,
    demo: !!a.demo,
  };
}

export interface VisibilityPoint {
  type: 'ai_visibility';
  measurementId: string;
  measuredAt: string;
  score: number;
  low: number;
  high: number;
  mentionRate: number;
  shareOfVoice: number;
  confidence: string;
  byProvider: Record<string, number | null>;
  demo: boolean;
}

export function visibilityPoint(a: AuditResult): VisibilityPoint {
  const s = auditStats(a);
  return {
    type: 'ai_visibility',
    measurementId: a.id,
    measuredAt: auditAt(a),
    score: a.score,
    low: a.range?.low ?? a.score,
    high: a.range?.high ?? a.score,
    mentionRate: r3(a.mentionRate),
    shareOfVoice: r3(s.shareOfVoice),
    confidence: a.confidence,
    byProvider: { ...((a.subScores ?? {}) as Record<string, number | null>) },
    demo: !!a.demo,
  };
}

// ---------------------------------------------------------------------------
// Site : scores SEO et GEO (explorations)
// ---------------------------------------------------------------------------
/** Forme minimale d'une exploration enregistrée (`appseo.run`, src/components/app/seo/model.ts SeoRun). */
export interface SiteRun {
  id: string;
  businessId: string;
  at: string;
  demo: boolean;
  pagesCrawled: number;
  seo: Pick<SeoReport, 'score' | 'grade' | 'sections' | 'topFixes'>;
  geo: Pick<GeoReport, 'score' | 'sections' | 'topFixes'>;
}

export interface SitePoint {
  type: 'seo' | 'geo';
  runId: string;
  measuredAt: string;
  score: number;
  pagesCrawled: number;
  demo: boolean;
}

export function sitePoints(runs: SiteRun[]): SitePoint[] {
  return runs.flatMap((r) => [
    { type: 'seo' as const, runId: r.id, measuredAt: r.at, score: r.seo.score, pagesCrawled: r.pagesCrawled, demo: r.demo },
    { type: 'geo' as const, runId: r.id, measuredAt: r.at, score: r.geo.score, pagesCrawled: r.pagesCrawled, demo: r.demo },
  ]);
}

export interface ScoresView {
  aiVisibility: VisibilityView | null;
  seo: { score: number; grade: string; measuredAt: string; pagesCrawled: number; demo: boolean } | null;
  geo: { score: number; measuredAt: string; demo: boolean } | null;
  notes: string[];
}

export function scoresView(audits: AuditResult[], runs: SiteRun[]): ScoresView {
  const last = audits.at(-1) ?? null;
  const run = runs.at(-1) ?? null;
  const notes: string[] = [];
  if (!last) notes.push('Aucune mesure des IA pour l’instant : la première mesure remplira « aiVisibility ».');
  if (!run) notes.push('Aucune exploration du site enregistrée : lancez-la depuis l’app (SEO › Relancer l’exploration) pour obtenir les scores SEO et GEO.');
  notes.push('Les scores des IA sont des mesures sur un échantillon de réponses : comparez-les avec leur marge (low–high), jamais au point près.');
  return {
    aiVisibility: last ? visibilityOf(last) : null,
    seo: run ? { score: run.seo.score, grade: run.seo.grade, measuredAt: run.at, pagesCrawled: run.pagesCrawled, demo: run.demo } : null,
    geo: run ? { score: run.geo.score, measuredAt: run.at, demo: run.demo } : null,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Questions suivies et résultats par IA
// ---------------------------------------------------------------------------
export interface ProviderResult {
  provider: string;
  name: string;
  answers: number;
  cited: number;
  /** part des réponses qui vous citent (0–1) */
  rate: number;
  /** intervalle de Wilson à 90 % sur `rate` */
  low: number;
  high: number;
  bestRank: number | null;
}

export interface QuestionView {
  id: string;
  text: string;
  intent: string;
  theme: string;
  tags: string[];
  active: boolean;
  origin: string;
  createdAt: string;
  latest: { measurementId: string; measuredAt: string; queryId: string; byProvider: ProviderResult[]; demo: boolean } | null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Question de l'audit correspondant à une question suivie (identifiant de requête, sinon texte normalisé). */
export function matchQueryId(p: Pick<TrackedPrompt, 'text' | 'queryId'>, a: Pick<AuditResult, 'queries'>): string | null {
  if (p.queryId) {
    const q = a.queries.find((x) => x.id === p.queryId);
    if (q) return q.id;
  }
  const n = normalize(p.text);
  return a.queries.find((q) => normalize(q.text) === n)?.id ?? null;
}

export function providerResults(a: AuditResult, queryId: string): ProviderResult[] {
  const ms = a.mentions.filter((m) => m.queryId === queryId);
  const providers = [...new Set(ms.map((m) => m.provider))];
  return providers.map((p) => {
    const list = ms.filter((m) => m.provider === p);
    const cited = list.filter((m) => m.mentioned);
    const ranks = cited.map((m) => m.rank).filter((x): x is number => typeof x === 'number');
    const [lo, hi] = wilson(cited.length, list.length);
    return {
      provider: p,
      name: providerName(p),
      answers: list.length,
      cited: cited.length,
      rate: list.length ? r3(cited.length / list.length) : 0,
      low: list.length ? r3(lo) : 0,
      high: list.length ? r3(hi) : 0,
      bestRank: ranks.length ? Math.min(...ranks) : null,
    };
  });
}

export function questionView(p: TrackedPrompt, latest: AuditResult | null): QuestionView {
  const qid = latest ? matchQueryId(p, latest) : null;
  return {
    id: p.id,
    text: p.text,
    intent: p.intent,
    theme: p.theme,
    tags: [...p.tags],
    active: p.active,
    origin: p.origin,
    createdAt: p.createdAt,
    latest:
      latest && qid
        ? { measurementId: latest.id, measuredAt: auditAt(latest), queryId: qid, byProvider: providerResults(latest, qid), demo: !!latest.demo }
        : null,
  };
}

export interface AnswerView {
  provider: string;
  name: string;
  run: number;
  model: string | null;
  at: string;
  mentioned: boolean;
  rank: number | null;
  competitors: string[];
  sources: string[];
  text: string;
  demo: boolean;
}

export function answersFor(a: AuditResult, queryId: string): AnswerView[] {
  const out: AnswerView[] = [];
  for (const ans of a.answers ?? []) {
    if (ans.queryId !== queryId || (ans.error && !ans.text)) continue;
    const m = a.mentions.find((x) => x.queryId === ans.queryId && x.provider === ans.provider && x.run === ans.run);
    const sources = ans.sources?.length ? ans.sources.filter((s) => s.kind !== 'retrieved').map((s) => s.url) : (ans.citations ?? []);
    out.push({
      provider: ans.provider,
      name: providerName(ans.provider),
      run: ans.run,
      model: ans.model ?? null,
      at: ans.at || auditAt(a),
      mentioned: !!m?.mentioned,
      rank: m?.rank ?? null,
      competitors: m?.competitors ?? [],
      sources,
      text: ans.text,
      demo: !!(ans.demo || a.demo),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concurrents, part de voix, sources
// ---------------------------------------------------------------------------
export interface CompetitorsView {
  measurementId: string;
  measuredAt: string;
  rankedActors: number;
  you: { rank: number | null; shareOfVoice: Interval };
  actors: { rank: number; name: string; isYou: boolean; mentions: number; shareOfVoice: number }[];
  demo: boolean;
}

export function competitorsView(a: AuditResult): CompetitorsView {
  const s = auditStats(a);
  const m = computeMargins(a);
  return {
    measurementId: a.id,
    measuredAt: auditAt(a),
    rankedActors: s.of,
    you: { rank: s.rank || null, shareOfVoice: m.shareOfVoice },
    actors: s.rows.map((r) => ({ rank: r.pos, name: r.name, isYou: r.isMe, mentions: r.mentions, shareOfVoice: r3(r.share) })),
    demo: !!a.demo,
  };
}

export interface SourceView {
  domain: string;
  label: string;
  category: string;
  citations: number;
  share: number;
  providers: string[];
  questions: number;
  yourPresence: string;
  competitorsPresent: string[];
  sampleUrls: string[];
}

export function sourcesOf(a: AuditResult): SourceView[] {
  return (a.sources?.domains ?? []).map((d) => ({
    domain: d.domain,
    label: d.label,
    category: d.category,
    citations: d.citations,
    share: r3(d.citationShare),
    providers: d.providers.map(providerName),
    questions: d.queries.length,
    yourPresence: d.clientPresence,
    competitorsPresent: [...d.competitorsPresent],
    sampleUrls: d.sampleUrls.slice(0, 5),
  }));
}

// ---------------------------------------------------------------------------
// Constats et priorités (dernière exploration du site)
// ---------------------------------------------------------------------------
export interface FindingView {
  id: string;
  source: 'seo' | 'geo';
  category: string;
  severity: string;
  title: string;
  why: string;
  fix: string;
  affectedCount: number;
  sampleUrls: string[];
  impact: number;
  effort: number;
  /** priorité calculée : gravité × impact ÷ effort (plus haut = plus urgent) */
  priority: number;
  autoFixable: boolean;
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export function priorityOf(f: Pick<Finding, 'severity' | 'impact' | 'effort'>): number {
  return Math.round(((SEVERITY_WEIGHT[f.severity] ?? 1) * (f.impact || 1)) / (f.effort || 1) * 100) / 100;
}

function findingView(f: Finding, source: 'seo' | 'geo'): FindingView {
  return {
    id: f.id,
    source,
    category: f.category,
    severity: f.severity,
    title: f.title,
    why: f.why,
    fix: f.fix,
    affectedCount: f.affectedCount,
    sampleUrls: (f.affected ?? []).slice(0, 5).map((x) => x.url),
    impact: f.impact,
    effort: f.effort,
    priority: priorityOf(f),
    autoFixable: !!f.autoFix,
  };
}

/** Tous les constats de la dernière exploration (SEO + GEO), triés par priorité décroissante, sans doublon. */
export function findingsOf(run: SiteRun | null): FindingView[] {
  if (!run) return [];
  const seen = new Set<string>();
  const out: FindingView[] = [];
  const add = (f: Finding, src: 'seo' | 'geo') => {
    const k = `${src}:${f.id}`;
    if (seen.has(k) || f.severity === 'info') return;
    seen.add(k);
    out.push(findingView(f, src));
  };
  for (const s of run.seo.sections ?? []) for (const f of s.findings ?? []) add(f, 'seo');
  for (const f of run.seo.topFixes ?? []) add(f, 'seo');
  for (const s of run.geo.sections ?? []) for (const f of s.findings ?? []) add(f as Finding, 'geo');
  for (const f of run.geo.topFixes ?? []) add(f as Finding, 'geo');
  return out.sort((a, b) => b.priority - a.priority || (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) || a.id.localeCompare(b.id));
}

/** Les priorités : correctifs mis en avant par les audits SEO et GEO, classés, 10 au plus. */
export function prioritiesOf(run: SiteRun | null, max = 10): FindingView[] {
  if (!run) return [];
  const top = new Set([...(run.seo.topFixes ?? []).map((f) => `seo:${f.id}`), ...(run.geo.topFixes ?? []).map((f) => `geo:${f.id}`)]);
  const all = findingsOf(run);
  const picked = all.filter((f) => top.has(`${f.source}:${f.id}`));
  return (picked.length ? picked : all).slice(0, max);
}

// ---------------------------------------------------------------------------
// Propositions de l'agent (lecture seule : la validation reste humaine, dans l'app)
// ---------------------------------------------------------------------------
export interface ProposalView {
  id: string;
  title: string;
  status: string;
  platform: string;
  risk: string;
  createdAt: string;
  proposedAt: string | null;
  validatedAt: string | null;
  appliedAt: string | null;
  finding: { id: string; title: string | null; severity: string | null };
  changes: { id: string; kind: string; before: string | null; after: string | null; rationale: string; status: string }[];
  /** où un humain la valide ou la refuse (jamais par l'API) */
  reviewUrl: string;
  demo: boolean;
}

export function proposalView(c: ChangeSet, base: string): ProposalView {
  return {
    id: c.id,
    title: c.title,
    status: c.status,
    platform: c.platform,
    risk: c.risk,
    createdAt: c.createdAt,
    proposedAt: c.proposedAt ?? null,
    validatedAt: c.validation?.at ?? null,
    appliedAt: c.appliedAt ?? null,
    finding: { id: c.origin.findingId, title: c.origin.findingTitle ?? null, severity: c.origin.severity ?? null },
    changes: c.changes.map((x) => ({ id: x.id, kind: x.kind, before: x.before, after: x.after, rationale: x.rationale, status: x.status })),
    reviewUrl: `${base}/app/agent`,
    demo: !!c.demo,
  };
}

// ---------------------------------------------------------------------------
// Mesures et rapports
// ---------------------------------------------------------------------------
export interface MeasurementView {
  id: string;
  measuredAt: string;
  score: number;
  low: number;
  high: number;
  providers: string[];
  questions: number;
  answers: number;
  demo: boolean;
}

export function measurementView(a: AuditResult): MeasurementView {
  return {
    id: a.id,
    measuredAt: auditAt(a),
    score: a.score,
    low: a.range?.low ?? a.score,
    high: a.range?.high ?? a.score,
    providers: (a.providersUsed ?? []).map(String),
    questions: a.queries.length,
    answers: (a.answers ?? []).filter((x) => !x.error && x.text).length,
    demo: !!a.demo,
  };
}

export interface ReportView {
  id: string;
  kind: 'measurement' | 'monthly';
  title: string;
  date: string;
  /** rapport PDF (ouvert avec une session de l'app ou un lien de partage) */
  pdfUrl: string | null;
  appUrl: string;
  demo: boolean;
}

export function reportsOf(audits: AuditResult[], base: string): ReportView[] {
  const list: ReportView[] = [...audits].reverse().map((a) => ({
    id: a.id,
    kind: 'measurement' as const,
    title: `Rapport de mesure du ${new Date(auditAt(a)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })}`,
    date: day(auditAt(a)),
    pdfUrl: `${base}/api/report/${encodeURIComponent(a.id)}/pdf`,
    appUrl: `${base}/app/rapports`,
    demo: !!a.demo,
  }));
  if (audits.length) {
    const last = audits.at(-1)!;
    list.unshift({ id: `mensuel-${day(auditAt(last)).slice(0, 7)}`, kind: 'monthly', title: 'Rapport mensuel (imprimable)', date: day(auditAt(last)), pdfUrl: null, appUrl: `${base}/app/rapports/mensuel`, demo: !!last.demo });
  }
  return list;
}

// ---------------------------------------------------------------------------
// Chargeurs (serveur)
// ---------------------------------------------------------------------------
export async function loadAudits(businessId: string): Promise<AuditResult[]> {
  const { listAuditsForBusiness } = await import('@/lib/db');
  const list = await listAuditsForBusiness(businessId).catch(() => [] as AuditResult[]);
  return [...list].sort((a, b) => auditAt(a).localeCompare(auditAt(b)));
}

/** Collection des explorations enregistrées par l'app (src/components/app/seo/data.ts, RUN_COLLECTION). */
export const SEO_RUNS = 'appseo.run';

const demoRunMemo = new Map<string, SiteRun[]>();

/** Explorations du site : réelles (`appseo.run`) ou, pour la démo, explorations de démonstration (étiquetées). */
export async function loadSiteRuns(b: Pick<BusinessRecord, 'id' | 'name' | 'segment' | 'trade'>, now: Date = new Date()): Promise<SiteRun[]> {
  if (isDemoBusinessId(b.id)) {
    const key = `${b.id}:${now.toISOString().slice(0, 10)}`;
    const hit = demoRunMemo.get(key);
    if (hit) return hit;
    const { demoSiteCrawl, demoStageDate, DEMO_CRAWL_STAGES } = await import('@/lib/seoaudit/demo-crawl');
    const { auditSeo } = await import('@/lib/seoaudit');
    const { auditGeo } = await import('@/lib/geo');
    const siteType = b.segment === 'ecommerce' ? 'ecommerce' : b.segment === 'pme' ? 'pme' : 'local';
    const runs: SiteRun[] = [];
    for (let s = 0; s < DEMO_CRAWL_STAGES; s++) {
      try {
        const crawl = demoSiteCrawl(b.id, s, now);
        const seo = auditSeo(crawl, { siteType });
        const geo = auditGeo(crawl, { brand: b.name, siteType, trade: b.trade || undefined, now: crawl.startedAt });
        runs.push({ id: `${b.id}:demo:${s}`, businessId: b.id, at: demoStageDate(s, now), demo: true, pagesCrawled: crawl.pages.length, seo, geo });
      } catch {
        /* exploration de démonstration indisponible : étape ignorée */
      }
    }
    demoRunMemo.clear();
    demoRunMemo.set(key, runs);
    return runs;
  }
  const { listDocs } = await import('@/lib/store');
  const docs = await listDocs<SiteRun>(SEO_RUNS, { businessId: b.id, limit: 40 }).catch(() => []);
  return docs
    .map((d) => d.data)
    .filter((r) => r && r.businessId === b.id && r.seo && r.geo && typeof r.seo.score === 'number')
    .sort((x, y) => x.at.localeCompare(y.at));
}

export async function loadPrompts(businessId: string): Promise<TrackedPrompt[]> {
  const { listPrompts } = await import('@/lib/prompts/repo');
  return (await listPrompts(businessId).catch(() => [] as TrackedPrompt[])).filter((p) => p.businessId === businessId);
}

export async function loadProposals(businessId: string): Promise<ChangeSet[]> {
  const { listChangeSets } = await import('@/lib/publish');
  return (await listChangeSets(businessId).catch(() => [] as ChangeSet[])).filter((c) => c.businessId === businessId);
}
