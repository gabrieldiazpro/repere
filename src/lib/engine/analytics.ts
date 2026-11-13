/**
 * Indicateurs V3 : marge d'erreur par indicateur (bootstrap par question, docs/v3/01 « échantillonnage statistique »)
 * et part de voix par thème × IA (grille GEO, docs/v3/03), avec les 10 premiers concurrents.
 */
import { auditDate, scoredMentions } from './coherence';
import { norm, normName } from './detect';
import { isBrandQuery } from './queries-v2';
import { themeOf } from './queries-v3';
import { BOOTSTRAP_B, bootstrapSamples, components, p5p95 } from './scoring';
import type { AuditResult, MentionResult, ProviderId } from './types';
import type { MarginReport, MarginStat, TopCompetitor, UrlStat, VoiceCell, VoiceEntity, VoiceMatrix } from './types-v3';

type MarginSource = Pick<AuditResult, 'id' | 'answers' | 'mentions' | 'providersUsed' | 'score' | 'mentionRate' | 'shareOfVoice' | 'range'>;

function stat(value: number, lo: number, hi: number, digits: number): MarginStat {
  const f = 10 ** digits;
  const r = (x: number) => Math.round(x * f) / f;
  const low = Math.min(lo, value);
  const high = Math.max(hi, value);
  return { value: r(value), low: r(low), high: r(high), margin: r((high - low) / 2) };
}

function usedProviders(r: Pick<AuditResult, 'providersUsed'>, valid: MentionResult[]): ProviderId[] {
  const base = r.providersUsed?.length ? r.providersUsed : [...new Set(valid.map((m) => m.provider))];
  return base.filter((p) => valid.some((m) => m.provider === p));
}

/**
 * Marges à 90 % du score, du taux de mention et de la part de voix : mêmes tirages que la fourchette du score
 * (graine = id d'audit, 500 rééchantillonnages des questions). La fourchette du score reste `range`.
 */
export function computeMargins(r: MarginSource, B = BOOTSTRAP_B): MarginReport {
  const valid = scoredMentions(r);
  const used = usedProviders(r, valid);
  const bs = bootstrapSamples(valid, used, r.id, B);
  const [mLo, mHi] = bs ? p5p95(bs.mentionRate) : [r.mentionRate, r.mentionRate];
  const [vLo, vHi] = bs ? p5p95(bs.shareOfVoice) : [r.shareOfVoice, r.shareOfVoice];
  const range = r.range ?? { low: r.score, high: r.score };
  const score = stat(r.score, range.low, range.high, 0);
  return {
    method: 'bootstrap-questions',
    samples: bs ? B : 0,
    level: 0.9,
    questions: bs?.questions ?? 0,
    score,
    mentionRate: stat(r.mentionRate, mLo, mHi, 3),
    shareOfVoice: stat(r.shareOfVoice, vLo, vHi, 3),
    label: `Score ${score.value} ± ${Math.round(score.margin)} (intervalle à 90 %, ${bs?.questions ?? 0} questions rééchantillonnées)`,
  };
}

/* ------------------------------------------------------------------ */
/* Part de voix thème × IA                                             */
/* ------------------------------------------------------------------ */

function rate(k: number, n: number): number {
  return n ? Math.round((k / n) * 1000) / 1000 : 0;
}

/** Part de voix par thème × IA et 10 premiers concurrents, sur les réponses valides du score. */
export function buildVoiceMatrix(r: Pick<AuditResult, 'answers' | 'mentions' | 'queries' | 'providersUsed' | 'input'>): VoiceMatrix {
  const valid = scoredMentions(r);
  const qById = new Map(r.queries.map((q) => [q.id, q]));
  const theme = (id: string) => {
    const q = qById.get(id);
    return q ? themeOf(q) : 'Autres questions';
  };
  const themes: string[] = [];
  for (const q of r.queries) if (!isBrandQuery(q) && !themes.includes(themeOf(q))) themes.push(themeOf(q));
  for (const m of valid) if (!themes.includes(theme(m.queryId))) themes.push(theme(m.queryId));
  const providers = usedProviders(r, valid);

  const cell = (ms: MentionResult[], th: string, p: ProviderId): VoiceCell | null => {
    if (!ms.length) return null;
    const c = components(ms, [p]);
    // Total des citations de la cellule (client + tous les concurrents, pas seulement les 10 listés).
    const total = c.sov > 0 ? Math.round(c.k / c.sov) : c.competitors.reduce((a, x) => a + x.mentions, 0);
    const leaders: VoiceEntity[] = [
      { name: r.input.businessName, client: true, mentions: c.k, share: rate(c.k, total) },
      ...c.competitors.map((x) => ({ name: x.name, client: false, mentions: x.mentions, share: rate(x.mentions, total) })),
    ]
      .filter((e) => e.mentions > 0)
      .sort((a, b) => b.mentions - a.mentions || Number(b.client) - Number(a.client) || a.name.localeCompare(b.name))
      .slice(0, 5);
    return { theme: th, provider: p, answers: ms.length, cited: c.k, mentionRate: rate(c.k, ms.length), shareOfVoice: Math.round(c.sov * 1000) / 1000, leaders };
  };

  const cells = themes.map((th) => providers.map((p) => cell(valid.filter((m) => m.provider === p && theme(m.queryId) === th), th, p)));
  const byTheme = themes.map((th) => {
    const ms = valid.filter((m) => theme(m.queryId) === th);
    const c = components(ms, providers);
    return { theme: th, answers: ms.length, mentionRate: rate(c.k, ms.length), shareOfVoice: Math.round(c.sov * 1000) / 1000 };
  });
  const byProvider = providers.map((p) => {
    const ms = valid.filter((m) => m.provider === p);
    const c = components(ms, [p]);
    return { provider: p, answers: ms.length, mentionRate: rate(c.k, ms.length), shareOfVoice: Math.round(c.sov * 1000) / 1000 };
  });

  // 10 premiers concurrents : même comptage que `competitors` (une citation par réponse), détaillé par IA et par thème.
  const top = components(valid, providers).competitors;
  const detail = new Map<string, TopCompetitor>(top.map((c) => [normName(c.name) || norm(c.name), { name: c.name, mentions: c.mentions, share: c.share, byProvider: {}, byTheme: {} }]));
  for (const m of valid) {
    const seen = new Set<string>();
    for (const c of m.competitors) {
      const k = normName(c) || norm(c);
      const d = detail.get(k);
      if (!d || seen.has(k)) continue;
      seen.add(k);
      d.byProvider[m.provider] = (d.byProvider[m.provider] ?? 0) + 1;
      const th = theme(m.queryId);
      d.byTheme[th] = (d.byTheme[th] ?? 0) + 1;
    }
  }
  return { themes, providers, cells, byTheme, byProvider, topCompetitors: [...detail.values()].slice(0, 10) };
}

/* ------------------------------------------------------------------ */
/* Historique des URL citées                                           */
/* ------------------------------------------------------------------ */

/**
 * Fusionne les URL citées de plusieurs audits (explorateur de citations sur une période) : citations additionnées,
 * IA et questions réunies, `firstSeen` / `lastSeen` = dates de mesure. Présence du client : celle de la mesure la plus récente.
 */
export function mergeUrlHistory(results: Pick<AuditResult, 'measuredAt' | 'createdAt' | 'sources'>[]): UrlStat[] {
  const sorted = [...results].sort((a, b) => auditDate(a).localeCompare(auditDate(b)));
  const out = new Map<string, UrlStat>();
  for (const r of sorted) {
    const at = auditDate(r);
    for (const u of r.sources?.urls ?? []) {
      const prev = out.get(u.url);
      if (!prev) {
        out.set(u.url, { ...u, providers: [...u.providers], queries: [...u.queries], competitorsPresent: [...u.competitorsPresent], firstSeen: at, lastSeen: at });
        continue;
      }
      out.set(u.url, {
        ...prev,
        title: u.title ?? prev.title,
        providers: [...new Set([...prev.providers, ...u.providers])],
        queries: [...new Set([...prev.queries, ...u.queries])],
        citations: prev.citations + u.citations,
        bestPosition: prev.bestPosition == null ? u.bestPosition : u.bestPosition == null ? prev.bestPosition : Math.min(prev.bestPosition, u.bestPosition),
        clientPresent: u.clientPresent,
        competitorsPresent: [...new Set([...prev.competitorsPresent, ...u.competitorsPresent])],
        lastSeen: at,
      });
    }
  }
  return [...out.values()].sort((a, b) => b.citations - a.citations || a.url.localeCompare(b.url));
}
