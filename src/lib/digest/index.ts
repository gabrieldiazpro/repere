/**
 * Digest du lundi (docs/v2/06-indispensable.md § 2.1) : « le produit vient au client ».
 * buildWeeklyDigest(businessId) assemble la phrase de la semaine, le rang, la meilleure citation, la citation à corriger,
 * les erreurs factuelles, les nouveaux concurrents, 3 tâches et les visites venues des IA. Jamais vide.
 * Stockage : `digest.weekly` (id `${businessId}:${week}`) ; envois : `digest.sent` (même id, idempotence du cron).
 */
import type { AuditResult, ProviderId } from '@/lib/engine';
import type {
  AuditResultV2Ext,
  BenchmarkPosition,
  BrandQuote,
  ExecTask,
  Segment,
  WeeklyDigest,
} from '@/lib/engine/types-v2';
import { getBusinessRecord, listAuditsForBusiness, type BusinessRecord } from '@/lib/db';
import { detectAlerts, PROVIDER_LABEL, type DetectedAlert } from '@/lib/alerts';
import { FACT_LABELS, getFacts, getLatestFactCheck } from '@/lib/facts';
import { getDoc, putDoc } from '@/lib/store';
import { rankInAudit } from './benchmark';
import { getAiTraffic, listTasks, openFallbackTasks, weeklyTasks } from './deps';
import { digestRhythm, firstMeasureLine, nextMeasureDate, previousComparable, rankMove, type RankMove } from './stats';
import { getEntitlements } from '@/lib/entitlements';
import { frequencyOfAudits } from './fixes';
import { frSpaces } from '@/lib/text';

export const DIGEST_COLLECTION = 'digest.weekly';
export const DIGEST_SENT_COLLECTION = 'digest.sent';

type AuditV2 = AuditResult & AuditResultV2Ext;

export interface DigestFactError {
  field: string;
  label: string;
  stated: string;
  expected: string;
  provider: ProviderId;
}

/** WeeklyDigest (contrat) + éléments d'affichage de l'e-mail et de l'accueil. */
export interface WeeklyDigestView extends WeeklyDigest {
  businessName: string;
  segment: Segment;
  demo: boolean;
  subject: string;
  /** semaine calme : rien n'a bougé au-delà de la marge (jamais vrai sans mesure précédente comparable) */
  calm: boolean;
  /** première mesure (aucune mesure précédente comparable) : pas de comparaison possible */
  firstMeasure?: boolean;
  /** date indicative de la prochaine mesure (selon la fréquence de l'offre) */
  nextMeasureAt?: string;
  /** rythme de mesure de l'offre (le vocabulaire du digest le suit) */
  frequency?: 'monthly' | 'weekly' | 'daily';
  /** aucune mesure dans les 7 derniers jours (offre mensuelle entre deux mesures) */
  noNewMeasure?: boolean;
  /** places gagnées (positif) ou perdues (négatif) depuis la mesure précédente */
  rankDelta: number | null;
  measuredAt: string | null;
  alerts: Pick<DetectedAlert, 'type' | 'severity' | 'title'>[];
  factErrorItems: DigestFactError[];
  totalMinutes: number;
  createdAt: string;
  /** Sous-titre de la phrase : la citation fautive et la valeur juste (quand une IA se trompe). */
  headlineSub?: string;
  /** Ligne secondaire (la phrase de citation, quand l'erreur IA prend la tête). */
  secondLine?: string;
  /** Tâche de correction à ouvrir depuis le bouton « Corriger en N min ». */
  fixTask?: { id: string; minutes: number };
  /** Évolution du rang avec sa période explicite. */
  rankMove?: RankMove | null;
}

/** « Gemini donne de mauvais horaires pour Plomberie Martin » (doc 06 § 2.1, priorité 1). */
export function factErrorHeadline(provider: ProviderId, field: string, businessName: string): string {
  const who = PROVIDER_LABEL[provider] ?? provider;
  switch (field) {
    case 'horaires':
      return `${who} donne de mauvais horaires pour ${businessName}`;
    case 'prix':
      return `${who} annonce de mauvais prix pour ${businessName}`;
    case 'adresse':
      return `${who} donne une mauvaise adresse pour ${businessName}`;
    case 'telephone':
      return `${who} donne un mauvais numéro pour ${businessName}`;
    case 'livraison':
      return `${who} se trompe sur la livraison de ${businessName}`;
    case 'retours':
      return `${who} se trompe sur les retours de ${businessName}`;
    case 'ingredients':
      return `${who} se trompe sur la composition des produits de ${businessName}`;
    case 'services':
    case 'produits':
      return `${who} se trompe sur l’offre de ${businessName}`;
    default:
      return `${who} donne une information fausse sur ${businessName} (${(FACT_LABELS as Record<string, string>)[field]?.toLowerCase() ?? field})`;
  }
}

/** Lundi (YYYY-MM-DD) de la semaine de `d`, en Europe/Paris. */
export function weekOf(d: Date = new Date()): string {
  const paris = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const day = new Date(`${paris}T12:00:00Z`);
  const shift = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - shift);
  return day.toISOString().slice(0, 10);
}

function mainProvider(a: AuditV2): ProviderId {
  const used = a.providersUsed?.length ? a.providersUsed : (Object.keys(a.subScores) as ProviderId[]);
  return used.includes('chatgpt') ? 'chatgpt' : used[0] ?? 'chatgpt';
}

/**
 * Questions (distinctes) où l'IA cite le client de façon stable (dans plus de la moitié des passages),
 * sur le total des questions posées à cette IA.
 */
export function citedQuestions(a: AuditV2, p: ProviderId): { cited: number; total: number } {
  const runs = new Map<string, { n: number; hit: number }>();
  for (const m of a.mentions) {
    if (m.provider !== p) continue;
    const r = runs.get(m.queryId) ?? { n: 0, hit: 0 };
    r.n++;
    if (m.mentioned) r.hit++;
    runs.set(m.queryId, r);
  }
  let cited = 0;
  for (const r of runs.values()) if (r.hit * 2 > r.n) cited++;
  return { cited, total: runs.size };
}

function queryText(a: AuditV2, queryId: string): string {
  return a.queries.find((q) => q.id === queryId)?.text ?? '';
}

function pickQuotes(a: AuditV2, factQuote: BrandQuote | undefined): { best?: BrandQuote; toFix?: BrandQuote } {
  const quotes = a.perception?.quotes ?? [];
  let best = quotes.find((q) => q.sentiment === 'positif') ?? quotes.find((q) => q.sentiment === 'neutre');
  let toFix = quotes.find((q) => q.sentiment === 'negatif') ?? factQuote;
  const at = a.measuredAt ?? a.createdAt;
  if (!best) {
    const ex = a.excerpts.find((e) => e.mentioned);
    if (ex) best = { provider: ex.provider, query: ex.query, text: ex.text.slice(0, 400), sentiment: 'neutre', at };
  }
  if (!toFix) {
    const ex = a.excerpts.find((e) => !e.mentioned && e.competitorsHighlighted.length > 0);
    if (ex) toFix = { provider: ex.provider, query: ex.query, text: ex.text.slice(0, 400), sentiment: 'neutre', at };
  }
  return { best, toFix };
}

function subjectFor(d: Omit<WeeklyDigestView, 'subject'>, alerts: DetectedAlert[]): string {
  const fact = alerts.find((a) => a.type === 'fact_error') ?? null;
  if (d.factErrorItems.length) {
    const e = d.factErrorItems[0];
    return `Alerte : ${factErrorHeadline(e.provider, e.field, d.businessName)}`;
  }
  if (fact) return fact.title;
  const over = alerts.find((a) => a.type === 'competitor_overtook');
  if (over) return over.title;
  if (d.rankDelta && d.rankDelta > 0 && d.benchmark) {
    return `Vous gagnez ${d.rankDelta} place${d.rankDelta > 1 ? 's' : ''} : ${d.benchmark.label}`;
  }
  if (d.tasks.length) return `Vos ${d.tasks.length} tâches de la semaine (${d.totalMinutes} min)`;
  return d.headline;
}

/**
 * Construit le digest de la semaine pour un commerce (pas d'envoi). Fonctionne pour les comptes démo.
 * @throws si le commerce est inconnu
 */
export async function buildWeeklyDigest(businessId: string, now: Date = new Date()): Promise<WeeklyDigestView> {
  const business: BusinessRecord | null = await getBusinessRecord(businessId);
  if (!business) throw new Error(`Commerce inconnu : ${businessId}`);
  const audits = (await listAuditsForBusiness(businessId)) as AuditV2[];
  const latest = audits.at(-1) ?? null;
  // Mesure précédente COMPARABLE seulement (mêmes questions, ≥ 6 jours) : jamais un audit d'un autre périmètre (B2).
  const prev = previousComparable(audits);
  const week = weekOf(now);
  const segment: Segment = business.segment ?? latest?.segment ?? 'local';

  const [facts, check, traffic, tasksRaw] = await Promise.all([
    getFacts(businessId),
    getLatestFactCheck(businessId),
    getAiTraffic(businessId, 7),
    weeklyTasks(businessId),
  ]);
  const tasks: ExecTask[] = (tasksRaw.length ? tasksRaw : await openFallbackTasks(businessId, latest, now)).slice(0, 3);
  const totalMinutes = tasks.reduce((s, t) => s + (t.minutes || 0), 0);

  if (!latest) {
    const headline = `Votre première mesure est en préparation : nous interrogeons les IA sur ${business.name}.`;
    const base: Omit<WeeklyDigestView, 'subject'> = {
      businessId, week, headline, scoreDelta: null, factErrors: 0, newCompetitors: [], tasks,
      aiVisits: traffic?.installed || traffic?.demo ? traffic.totals.aiVisits : undefined,
      businessName: business.name, segment, demo: false, calm: true, rankDelta: null, measuredAt: null,
      alerts: [], factErrorItems: [], totalMinutes, createdAt: now.toISOString(),
    };
    return { ...base, subject: subjectFor(base, []) };
  }

  const p = mainProvider(latest);
  const nowQ = citedQuestions(latest, p);
  const prevQ = prev ? citedQuestions(prev, p) : null;
  const qDelta = prevQ ? nowQ.cited - prevQ.cited : null;
  // « stable » seulement si le score l'est aussi (sinon la phrase contredirait la tendance affichée à côté).
  const scoreMoved = prev ? Math.abs(latest.score - prev.score) >= 5 : false;
  const deltaTxt = qDelta === null ? '' : qDelta === 0 ? (scoreMoved ? '' : ' (stable)') : ` (${qDelta > 0 ? '+' : ''}${qDelta})`;

  const alerts = detectAlerts(prev, latest, facts);
  const benchmark: BenchmarkPosition = rankInAudit(latest);
  const prevRank = prev ? rankInAudit(prev).rank : null;
  const rankDelta = prevRank === null ? null : prevRank - benchmark.rank;

  const report = check?.report ?? latest.factCheck ?? null;
  const errors = (report?.items ?? []).filter((i) => i.verdict === 'faux');
  const factErrorItems: DigestFactError[] = errors.slice(0, 3).map((i) => ({
    field: i.field,
    label: FACT_LABELS[i.field],
    stated: i.stated,
    expected: i.expected,
    provider: i.provider,
  }));
  const factQuote: BrandQuote | undefined = errors[0]
    ? { provider: errors[0].provider, query: `Information « ${FACT_LABELS[errors[0].field].toLowerCase()} »`, text: errors[0].quote || errors[0].stated, sentiment: 'negatif', at: check?.report.checkedAt ?? latest.createdAt }
    : undefined;
  const { best, toFix } = pickQuotes(latest, factQuote);

  const newCompetitors = alerts.filter((a) => a.type === 'new_competitor').map((a) => String(a.payload.competitor));
  const significant = alerts.some((a) => a.type !== 'new_competitor');
  const calm = !!prev && !significant && !errors.length && (qDelta === null || qDelta === 0);

  // Démo : le rythme est celui des données de démonstration (une mesure par mois), pas celui des droits de visite.
  const frequency = latest.demo ? frequencyOfAudits(audits) : getEntitlements(business).frequency;
  const rhythm = digestRhythm({ frequency, measuredAt: latest.measuredAt ?? latest.createdAt, now });
  const citedLine = `${rhythm.lead}${PROVIDER_LABEL[p]} vous cite dans ${nowQ.cited} question${nowQ.cited > 1 ? 's' : ''} sur ${nowQ.total}${deltaTxt}.`;
  let headline = citedLine;
  let headlineSub: string | undefined;
  let secondLine: string | undefined;
  let fixTask: { id: string; minutes: number } | undefined;
  if (errors.length) {
    // Priorité 1 (doc 06 § 2.1) : l'erreur d'une IA prend la tête ; la phrase de citation descend en 2ᵉ ligne.
    const e = errors[0];
    headline = `${factErrorHeadline(e.provider, e.field, business.name)}.`;
    headlineSub = `${PROVIDER_LABEL[e.provider]} dit « ${e.stated.replace(/^[A-Za-zÀ-ÿ’' ]{2,20}\s?:\s*/, '').replace(/\.$/, '')} » ; la bonne information est « ${e.expected} ».`;
    secondLine = citedLine;
    const all = await listTasks(businessId).catch(() => [] as ExecTask[]);
    const fix = all.find((t) => t.kind === 'fact_fix' && t.status !== 'done' && t.title.toLowerCase().includes(String(FACT_LABELS[e.field]).toLowerCase())) ?? all.find((t) => t.kind === 'fact_fix' && t.status !== 'done');
    if (fix) fixTask = { id: fix.id, minutes: fix.minutes };
  } else if (!prev && rhythm.fresh) {
    headline += ` ${firstMeasureLine(nextMeasureDate(latest.measuredAt ?? latest.createdAt, frequency))}`;
  } else if (!rhythm.fresh) {
    // Offre mensuelle entre deux mesures : on le dit, au lieu d'annoncer « cette semaine » ce qui date du mois.
    headline = `${rhythm.noNewMeasure} ${citedLine}`;
  } else if (calm) headline += ` ${rhythm.calm}`;

  const base: Omit<WeeklyDigestView, 'subject'> = {
    businessId,
    week,
    headline,
    scoreDelta: prev ? latest.score - prev.score : null,
    benchmark,
    bestQuote: best,
    quoteToFix: toFix,
    factErrors: errors.length,
    newCompetitors,
    tasks,
    aiVisits: traffic && (traffic.installed || traffic.demo) ? traffic.totals.aiVisits : undefined,
    businessName: business.name,
    segment,
    demo: Boolean(latest.demo),
    calm,
    rankDelta,
    measuredAt: latest.measuredAt ?? latest.createdAt,
    alerts: alerts.map(({ type, severity, title }) => ({ type, severity, title })),
    factErrorItems,
    totalMinutes,
    createdAt: now.toISOString(),
    headlineSub,
    secondLine,
    fixTask,
    rankMove: rankMove(audits, 'month'),
    firstMeasure: !prev,
    nextMeasureAt: nextMeasureDate(latest.measuredAt ?? latest.createdAt, frequency),
    frequency,
    noNewMeasure: !rhythm.fresh,
  };
  return { ...base, headline: frSpaces(base.headline), headlineSub: base.headlineSub && frSpaces(base.headlineSub), subject: subjectFor(base, alerts) };
}

export async function saveDigest(d: WeeklyDigestView): Promise<void> {
  await putDoc(DIGEST_COLLECTION, `${d.businessId}:${d.week}`, d, d.businessId);
}

export async function getStoredDigest(businessId: string, week: string = weekOf()): Promise<WeeklyDigestView | null> {
  return (await getDoc<WeeklyDigestView>(DIGEST_COLLECTION, `${businessId}:${week}`))?.data ?? null;
}

export async function wasDigestSent(businessId: string, week: string): Promise<boolean> {
  return Boolean(await getDoc(DIGEST_SENT_COLLECTION, `${businessId}:${week}`));
}

export async function markDigestSent(businessId: string, week: string, info: { status: string; to: string }): Promise<void> {
  await putDoc(DIGEST_SENT_COLLECTION, `${businessId}:${week}`, { ...info, at: new Date().toISOString() }, businessId);
}

export { rankInAudit, sectorBenchmark, clientMentions, MIN_COHORT } from './benchmark';
export { auditStats, rankMove, newEntrants, benchmarkOfAudit, comparableAudits, comparableHistory, previousComparable, firstMeasureLine, nextMeasureDate, digestRhythm, type AuditStats, type RankMove } from './stats';
export { doneUrl, signDoneToken, verifyDoneToken } from './sign';
