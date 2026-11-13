/**
 * Cohérence des chiffres (docs/v3/09-audit-app.md § 3, D1–D4) : UNE fonction de vérité par chiffre.
 * - nombre de questions : `queryCounts` / `auditCounts` (visibilité ≠ vérification) ;
 * - réponses et citations : `scoredMentions` (même base que le score) ;
 * - ton : `sentimentShares` sur les verbatims affichés, erreurs factuelles comptées en négatif ;
 * - dates : `auditDate` (verbatims, vérification et audit portent la date de la mesure).
 */
import { norm } from './detect';
import { isBrandQuery } from './queries-v2';
import { isNoRec, validMentions } from './scoring';
import type { AuditResult, MentionResult, ProviderAnswer, ProviderId, QuerySpec } from './types';
import type { BrandQuote, FactCheckReport, PerceptionReport, Sentiment } from './types-v2';
import type { AuditCounts } from './types-v3';

/** Date de la mesure : la seule date à afficher pour un audit (verbatims, vérification, rapport). */
export function auditDate(r: Pick<AuditResult, 'measuredAt' | 'createdAt'>): string {
  return r.measuredAt || r.createdAt;
}

/**
 * Mentions comptées par le score (hors erreurs, « pas de recommandation » et démo mêlée à du réel).
 * Sans réponses brutes (historique condensé) : toutes les mentions hors « pas de recommandation ».
 */
export function scoredMentions(r: Pick<AuditResult, 'answers' | 'mentions'>): MentionResult[] {
  return r.answers?.length ? validMentions(r.answers, r.mentions) : r.mentions.filter((m) => !isNoRec(m));
}

/** Questions de visibilité (recommandation) et de vérification (marque). */
export function queryCounts(queries: Pick<QuerySpec, 'id' | 'kind'>[]): { visibility: number; factual: number; total: number } {
  const factual = queries.filter((q) => isBrandQuery(q)).length;
  return { visibility: queries.length - factual, factual, total: queries.length };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Comptages affichés partout (en-têtes, rapports, copilote) : source unique. */
export function auditCounts(r: Pick<AuditResult, 'queries' | 'answers' | 'mentions' | 'providersUsed'>): AuditCounts {
  const q = queryCounts(r.queries);
  const ms = scoredMentions(r);
  const providers = (r.providersUsed?.length ? r.providersUsed : [...new Set(r.mentions.map((m) => m.provider))]).length;
  const label =
    `${plural(q.visibility, 'question de visibilité', 'questions de visibilité')}` +
    (q.factual ? ` + ${plural(q.factual, 'vérification', 'vérifications')}` : '') +
    ` × ${providers} IA`;
  return { visibilityQuestions: q.visibility, factualQuestions: q.factual, providers, answers: ms.length, cited: ms.filter((m) => m.mentioned).length, label };
}

/** Parts de ton calculées sur les verbatims affichés (somme = 1, ou 0 partout sans verbatim). */
export function sentimentShares(quotes: Pick<BrandQuote, 'sentiment'>[]): { positif: number; neutre: number; negatif: number } {
  const n = quotes.length;
  if (!n) return { positif: 0, neutre: 0, negatif: 0 };
  const c = (s: Sentiment) => quotes.filter((q) => q.sentiment === s).length / n;
  return { positif: c('positif'), neutre: c('neutre'), negatif: c('negatif') };
}

const key = (s: string) => norm(s).slice(0, 60);

/**
 * Réconcilie perception et vérité : un verbatim porteur d'une erreur factuelle est marqué `factError` et compté en
 * négatif ; s'il manque dans les verbatims, il y est ajouté (8 verbatims au plus) ; toutes les dates = date de mesure ;
 * les parts de ton sont recalculées sur les verbatims finaux.
 */
export function reconcilePerception(
  p: PerceptionReport,
  fc: FactCheckReport | undefined,
  at: string,
  answers: Pick<ProviderAnswer, 'provider' | 'queryId' | 'text'>[] = [],
  queries: Pick<QuerySpec, 'id' | 'text'>[] = [],
): PerceptionReport {
  const quotes: BrandQuote[] = p.quotes.map((q) => ({ ...q, at }));
  const qText = new Map(queries.map((q) => [q.id, q.text]));
  for (const item of fc?.items ?? []) {
    if (item.verdict !== 'faux' || !item.quote) continue;
    const k = key(item.quote);
    const hit = quotes.find((q) => q.provider === item.provider && (key(q.text).includes(k) || k.includes(key(q.text))));
    if (hit) {
      hit.sentiment = 'negatif';
      hit.factError = true;
      continue;
    }
    const src = answers.find((a) => a.provider === item.provider && norm(a.text).includes(norm(item.quote).slice(0, 40)));
    const add: BrandQuote = {
      provider: item.provider as ProviderId,
      query: src ? qText.get(src.queryId) ?? '' : '',
      text: item.quote,
      sentiment: 'negatif',
      at,
      factError: true,
    };
    if (quotes.length >= 8) {
      const idx = [...quotes].reverse().findIndex((q) => !q.factError && q.sentiment === 'neutre');
      quotes.splice(idx >= 0 ? quotes.length - 1 - idx : quotes.length - 1, 1);
    }
    quotes.push(add);
  }
  return { ...p, quotes, sentiment: sentimentShares(quotes) };
}
