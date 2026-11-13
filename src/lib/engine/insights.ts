/**
 * « Pourquoi ils passent devant » (CompetitorGap) et benchmark (« 4ᵉ sur 12 … »).
 * docs/v2/03-sources.md § 5.5 et docs/v2/06-indispensable.md § 6.1. Sans réseau.
 */
import { norm, normName, splitSegments } from './detect';
import { resolveTrade, zoneInfo } from './queries';
import { segmentOf } from './queries-v2';
import { validMentions } from './scoring';
import { competitorNamedIn, type CollectedCitation } from './sources';
import { PROVIDER_LABELS, type AuditInput, type AuditResult, type MentionResult, type ProviderAnswer, type ProviderId } from './types';
import type { BenchmarkPosition, CompetitorGap, SourcesReport } from './types-v2';
import { benchmarkOfAudit } from '@/lib/digest/stats';

const PROVIDER_LABEL: Record<ProviderId, string> = PROVIDER_LABELS;

/** Ordinal typographique : 1 → « 1ᵉʳ », 4 → « 4ᵉ ». */
export function ordinalSup(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

function listFr(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`;
}

/** Description courte d'un concurrent dans une réponse (« – intervention rapide et devis clair »). */
function descriptionOf(segText: string, name: string): string | null {
  const t = segText.replace(/\*\*/g, '').replace(/^[\s\-*•#\d.)]+/, '').split('\n')[0];
  const i = norm(t).indexOf(normName(name));
  if (i < 0 && !competitorNamedIn(t, name)) return null;
  const m = /(?:\s[–—-]\s|\s:\s|:\s|,\s)(.{12,140})$/.exec(t);
  const d = (m?.[1] ?? '').replace(/^\(?[^)]*\)\s*[–—-]?\s*/, '').replace(/[.;\s]+$/, '').trim();
  if (!d || d.length < 8 || competitorNamedIn(d, name)) return null;
  return d;
}

/** Mentions par entité (client + concurrents) sur les réponses valides du score. */
export function entityCounts(result: Pick<AuditResult, 'answers' | 'mentions'>): { client: number; competitors: Map<string, { name: string; n: number; top: number }> } {
  const valid = validMentions(result.answers, result.mentions);
  const comps = new Map<string, { name: string; n: number; top: number }>();
  for (const m of valid) {
    const seen = new Set<string>();
    m.competitors.forEach((c, i) => {
      const k = normName(c) || norm(c);
      if (!k || seen.has(k)) return;
      seen.add(k);
      const prev = comps.get(k) ?? { name: c, n: 0, top: 0 };
      prev.n++;
      if (i === 0) prev.top++;
      comps.set(k, prev);
    });
  }
  return { client: valid.filter((m) => m.mentioned).length, competitors: comps };
}

export interface GapContext {
  sources?: SourcesReport;
  citations?: CollectedCitation[];
  max?: number;
}

/** Pourquoi les concurrents les plus cités passent devant. */
export function buildGaps(result: Pick<AuditResult, 'answers' | 'mentions' | 'competitors' | 'queries'>, ctx: GapContext = {}): CompetitorGap[] {
  const max = ctx.max ?? 5;
  const { client } = entityCounts(result);
  const byKey = new Map<string, MentionResult>(result.mentions.map((m) => [`${m.provider}|${m.queryId}|${m.run}`, m]));
  const anyReal = result.answers.some((a) => !a.demo && !a.error);
  const answers = result.answers.filter((a): a is ProviderAnswer => !a.error && !!a.text && (!anyReal || !a.demo));
  const out: CompetitorGap[] = [];
  // Seuls les concurrents qui passent VRAIMENT devant (plus de citations que vous, même base de comptage).
  for (const c of result.competitors.filter((x) => x.mentions > client).slice(0, max)) {
    const reasons: string[] = [];
    reasons.push(`Cité ${c.mentions} fois contre ${client} pour vous (citations sur les mêmes réponses).`);
    // Rang
    let firsts = 0;
    let ranked = 0;
    for (const m of result.mentions) {
      const i = m.competitors.findIndex((x) => normName(x) === normName(c.name));
      if (i < 0) continue;
      ranked++;
      if (i === 0) firsts++;
    }
    if (firsts >= 2 && firsts >= ranked / 3) reasons.push(`Souvent recommandé en premier (${firsts} fois).`);
    // Sources où il est présent et pas vous
    const presentOn = (ctx.sources?.domains ?? [])
      .filter((d) => d.category !== 'client' && d.category !== 'concurrent' && d.competitorsPresent.includes(c.name) && d.clientPresence !== 'present')
      .sort((a, b) => b.citations - a.citations)
      .map((d) => d.domain);
    if (presentOn.length) {
      const labels = (ctx.sources?.domains ?? []).filter((d) => presentOn.slice(0, 3).includes(d.domain)).map((d) => d.label);
      reasons.push(`Présent sur ${listFr(labels)}, des sources lues par les IA où vous n'apparaissez pas.`);
    }
    const own = (ctx.sources?.domains ?? []).find((d) => d.category === 'concurrent' && d.label === c.name);
    if (own) reasons.push(`Son site est cité ${own.citations} fois comme source.`);
    // Description tirée des réponses (verbatim court)
    for (const a of answers) {
      const m = byKey.get(`${a.provider}|${a.queryId}|${a.run}`);
      if (m && !m.competitors.some((x) => normName(x) === normName(c.name))) continue;
      const seg = splitSegments(a.text).find((s) => competitorNamedIn(s.text, c.name));
      const d = seg ? descriptionOf(seg.text, c.name) : null;
      if (d) {
        reasons.push(`${PROVIDER_LABEL[a.provider]} le décrit ainsi : « ${d} ».`);
        break;
      }
    }
    out.push({ competitor: c.name, mentions: c.mentions, share: c.share, presentOn, reasons: reasons.slice(0, 4) });
  }
  return out;
}

/** Libellé de cohorte : « plombiers cités par les IA à Paris 11e », « acteurs cités pour « logiciel de paie » ». */
export function cohortLabel(input: AuditInput): string {
  const seg = segmentOf(input);
  if (seg === 'pme') return `acteurs cités par les IA pour « ${input.category || input.trade} »`;
  if (seg === 'ecommerce') return `marques citées par les IA pour « ${input.productCategories?.[0] || input.category || input.trade} »`;
  const t = resolveTrade(input.trade);
  return `${t.plural} cités par les IA à ${zoneInfo(input).zone}`;
}

/** Rang du client parmi les entités citées (client inclus), par nombre de mentions. */
export function buildBenchmark(result: AuditResult): BenchmarkPosition {
  // Calcul unique partagé par toutes les vues (src/lib/digest/stats.ts).
  return benchmarkOfAudit(result);
}
