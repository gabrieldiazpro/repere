/**
 * « Expliquer ce changement » (docs/v3/01 § Investigate) : pourquoi le score a bougé entre deux mesures.
 * Questions gagnées ou perdues, IA, sources apparues ou disparues, concurrents ; chaque variation est comparée
 * à la marge d'erreur des deux mesures (bootstrap) pour dire si elle sort du bruit.
 */
import { computeMargins } from './analytics';
import { auditDate, scoredMentions } from './coherence';
import { norm, normName } from './detect';
import { isBrandQuery } from './queries-v2';
import { themeOf } from './queries-v3';
import { PROVIDER_LABELS, type AuditResult, type ProviderId } from './types';
import type {
  ChangeConfidence,
  ChangeExplanation,
  CompetitorChange,
  MarginReport,
  MetricChange,
  ProviderChange,
  QuestionChange,
  SourceChange,
} from './types-v3';

export type ExplainSource = Pick<
  AuditResult,
  'id' | 'input' | 'createdAt' | 'measuredAt' | 'score' | 'mentionRate' | 'shareOfVoice' | 'range' | 'queries' | 'answers' | 'mentions' | 'providersUsed' | 'competitors' | 'sources' | 'margins'
>;

function margins(r: ExplainSource): MarginReport {
  return r.margins ?? computeMargins(r);
}

/** Confiance d'une variation au regard de la marge combinée des deux mesures. */
export function changeConfidence(delta: number, margin: number): ChangeConfidence {
  const d = Math.abs(delta);
  if (d === 0) return 'faible';
  if (margin <= 0) return 'forte';
  if (d > margin) return 'forte';
  if (d > margin / 2) return 'moyenne';
  return 'faible';
}

function metric(prev: number, next: number, mPrev: number, mNext: number, digits: number): MetricChange {
  const f = 10 ** digits;
  const r = (x: number) => Math.round(x * f) / f;
  const margin = r(Math.sqrt(mPrev ** 2 + mNext ** 2));
  const delta = r(next - prev);
  return { prev: r(prev), next: r(next), delta, margin, confidence: changeConfidence(delta, margin) };
}

const qKey = (text: string) => norm(text);

/** IA où le client est cité, par question (texte normalisé), sur les réponses valides du score. */
function citedByQuestion(r: ExplainSource): Map<string, { id: string; text: string; theme: string; cited: Set<ProviderId>; answered: Set<ProviderId> }> {
  const out = new Map<string, { id: string; text: string; theme: string; cited: Set<ProviderId>; answered: Set<ProviderId> }>();
  const byId = new Map(r.queries.map((q) => [q.id, q]));
  for (const q of r.queries) if (!isBrandQuery(q)) out.set(qKey(q.text), { id: q.id, text: q.text, theme: themeOf(q), cited: new Set(), answered: new Set() });
  for (const m of scoredMentions(r)) {
    const q = byId.get(m.queryId);
    const e = q && out.get(qKey(q.text));
    if (!e) continue;
    e.answered.add(m.provider);
    if (m.mentioned) e.cited.add(m.provider);
  }
  return out;
}

function providerRates(r: ExplainSource): Map<ProviderId, number> {
  const n = new Map<ProviderId, { k: number; n: number }>();
  for (const m of scoredMentions(r)) {
    const e = n.get(m.provider) ?? { k: 0, n: 0 };
    e.n++;
    if (m.mentioned) e.k++;
    n.set(m.provider, e);
  }
  return new Map([...n].map(([p, e]) => [p, e.n ? e.k / e.n : 0]));
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const pts = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)} point${Math.abs(Math.round(x)) > 1 ? 's' : ''}`;
const ptsRate = (x: number) => pts(x * 100);

function dateFr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}

function listFr(xs: string[], max = 3): string {
  const ys = xs.slice(0, max);
  const more = xs.length - ys.length;
  const base = ys.length <= 1 ? ys.join('') : `${ys.slice(0, -1).join(', ')} et ${ys[ys.length - 1]}`;
  return more > 0 ? `${ys.join(', ')} et ${more} autre${more > 1 ? 's' : ''}` : base;
}

const CONF_LABEL: Record<ChangeConfidence, string> = {
  forte: 'variation nette, au-delà de la marge d’erreur',
  moyenne: 'variation probable, proche de la marge d’erreur',
  faible: 'variation dans la marge d’erreur : à confirmer à la prochaine mesure',
};

/**
 * Explication structurée d'une variation entre deux audits du même commerce (`prev` plus ancien que `next`).
 * Phrases en français, vouvoiement ; aucune cause inventée : uniquement ce qui a changé dans les réponses mesurées.
 */
export function explainChange(prev: ExplainSource, next: ExplainSource): ChangeExplanation {
  const mp = margins(prev);
  const mn = margins(next);
  const score = metric(prev.score, next.score, mp.score.margin, mn.score.margin, 0);
  const mentionRate = metric(prev.mentionRate, next.mentionRate, mp.mentionRate.margin, mn.mentionRate.margin, 3);
  const shareOfVoice = metric(prev.shareOfVoice, next.shareOfVoice, mp.shareOfVoice.margin, mn.shareOfVoice.margin, 3);

  // Questions
  const qp = citedByQuestion(prev);
  const qn = citedByQuestion(next);
  const questionsGained: QuestionChange[] = [];
  const questionsLost: QuestionChange[] = [];
  for (const [k, n] of qn) {
    const p = qp.get(k);
    if (!p) continue;
    const gained = [...n.cited].filter((x) => !p.cited.has(x) && p.answered.has(x));
    const lost = [...p.cited].filter((x) => !n.cited.has(x) && n.answered.has(x));
    if (!p.cited.size && n.cited.size) questionsGained.push({ queryId: n.id, text: n.text, theme: n.theme, providers: [...n.cited] });
    else if (p.cited.size && !n.cited.size) questionsLost.push({ queryId: n.id, text: n.text, theme: n.theme, providers: [...p.cited] });
    else if (gained.length > lost.length) questionsGained.push({ queryId: n.id, text: n.text, theme: n.theme, providers: gained });
    else if (lost.length > gained.length) questionsLost.push({ queryId: n.id, text: n.text, theme: n.theme, providers: lost });
  }
  const sameQuestions = qp.size === qn.size && [...qn.keys()].every((k) => qp.has(k));

  // IA
  const rp = providerRates(prev);
  const rn = providerRates(next);
  const allProviders = [...new Set([...(prev.providersUsed ?? []), ...(next.providersUsed ?? []), ...rp.keys(), ...rn.keys()])];
  const providers: ProviderChange[] = allProviders
    .map((p) => {
      const a = rp.has(p) ? rp.get(p)! : null;
      const b = rn.has(p) ? rn.get(p)! : null;
      return { provider: p, prevRate: a == null ? null : Math.round(a * 1000) / 1000, nextRate: b == null ? null : Math.round(b * 1000) / 1000, delta: Math.round(((b ?? 0) - (a ?? 0)) * 1000) / 1000 };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const sameProviders = rp.size === rn.size && [...rn.keys()].every((p) => rp.has(p));

  // Sources
  const dp = new Map((prev.sources?.domains ?? []).map((d) => [d.domain, d]));
  const dn = new Map((next.sources?.domains ?? []).map((d) => [d.domain, d]));
  const sourcesAppeared: SourceChange[] = [...dn.values()]
    .filter((d) => !dp.has(d.domain))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 10)
    .map((d) => ({ domain: d.domain, label: d.label, citations: d.citations }));
  const sourcesDisappeared: SourceChange[] = [...dp.values()]
    .filter((d) => !dn.has(d.domain))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 10)
    .map((d) => ({ domain: d.domain, label: d.label, citations: d.citations }));
  const clientSourcesGained = [...dn.values()].filter((d) => d.clientPresence === 'present' && dp.get(d.domain)?.clientPresence !== 'present').map((d) => d.domain);
  const clientSourcesLost = [...dp.values()].filter((d) => d.clientPresence === 'present' && dn.has(d.domain) && dn.get(d.domain)!.clientPresence === 'absent').map((d) => d.domain);

  // Concurrents
  const cp = new Map(prev.competitors.map((c) => [normName(c.name) || norm(c.name), c]));
  const cn = new Map(next.competitors.map((c) => [normName(c.name) || norm(c.name), c]));
  const competitors: CompetitorChange[] = [...new Set([...cn.keys(), ...cp.keys()])]
    .map((k) => {
      const a = cp.get(k);
      const b = cn.get(k);
      return { name: (b ?? a)!.name, prevMentions: a?.mentions ?? 0, nextMentions: b?.mentions ?? 0, delta: (b?.mentions ?? 0) - (a?.mentions ?? 0), isNew: !a && !!b };
    })
    .filter((c) => c.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.name.localeCompare(y.name))
    .slice(0, 10);

  // Phrases
  const from = auditDate(prev);
  const to = auditDate(next);
  const comparable = sameQuestions && sameProviders;
  const warnings: string[] = [];
  if (!sameQuestions) warnings.push('Les questions suivies ont changé entre les deux mesures : une partie de la variation vient de ce changement.');
  if (!sameProviders) warnings.push('Les IA interrogées ne sont pas les mêmes entre les deux mesures.');
  if (prev.input.businessName !== next.input.businessName) warnings.push('Les deux mesures ne portent pas sur le même nom d’entreprise.');

  const dir = score.delta > 0 ? 'progresse' : score.delta < 0 ? 'recule' : 'est stable';
  const headline =
    score.delta === 0
      ? `Votre score est stable à ${score.next}/100 entre le ${dateFr(from)} et le ${dateFr(to)}.`
      : `Votre score ${dir} de ${Math.abs(score.delta)} point${Math.abs(score.delta) > 1 ? 's' : ''} (${score.prev} → ${score.next}) : ${CONF_LABEL[score.confidence]}.`;

  const sentences: string[] = [];
  if (mentionRate.delta !== 0)
    sentences.push(`Vous êtes cité dans ${pct(mentionRate.next)} des réponses contre ${pct(mentionRate.prev)} (${ptsRate(mentionRate.delta)}, marge ± ${pct(mentionRate.margin)}).`);
  if (questionsGained.length)
    sentences.push(`Questions gagnées : ${listFr(questionsGained.map((q) => `« ${q.text} » (${listFr(q.providers.map((p) => PROVIDER_LABELS[p]))})`), 2)}.`);
  if (questionsLost.length)
    sentences.push(`Questions perdues : ${listFr(questionsLost.map((q) => `« ${q.text} » (${listFr(q.providers.map((p) => PROVIDER_LABELS[p]))})`), 2)}.`);
  const movers = providers.filter((p) => p.prevRate != null && p.nextRate != null && Math.abs(p.delta) >= 0.1).slice(0, 2);
  for (const p of movers)
    sentences.push(`${PROVIDER_LABELS[p.provider]} vous cite ${p.delta > 0 ? 'plus' : 'moins'} souvent : ${pct(p.prevRate!)} → ${pct(p.nextRate!)} des réponses.`);
  for (const p of providers.filter((x) => x.prevRate == null && x.nextRate != null)) sentences.push(`${PROVIDER_LABELS[p.provider]} est mesuré pour la première fois (${pct(p.nextRate!)} des réponses vous citent).`);
  if (sourcesAppeared.length) sentences.push(`Nouvelles sources citées par les IA : ${listFr(sourcesAppeared.map((s) => s.domain))}.`);
  if (sourcesDisappeared.length) sentences.push(`Sources qui ne sont plus citées : ${listFr(sourcesDisappeared.map((s) => s.domain))}.`);
  if (clientSourcesGained.length) sentences.push(`Vous apparaissez désormais sur ${listFr(clientSourcesGained)}.`);
  const newComp = competitors.find((c) => c.isNew && c.nextMentions >= 2);
  if (newComp) sentences.push(`Nouveau concurrent cité : ${newComp.name} (${newComp.nextMentions} réponses).`);
  const topUp = competitors.find((c) => !c.isNew && c.delta > 0);
  if (topUp) sentences.push(`${topUp.name} est cité plus souvent (${topUp.prevMentions} → ${topUp.nextMentions} réponses).`);
  const topDown = competitors.find((c) => c.delta < 0 && c.nextMentions > 0);
  if (topDown) sentences.push(`${topDown.name} est cité moins souvent (${topDown.prevMentions} → ${topDown.nextMentions} réponses).`);
  if (!sentences.length) sentences.push('Aucune question, IA ou source ne change de façon notable entre les deux mesures.');
  if (score.confidence === 'faible' && score.delta !== 0)
    sentences.push(`La marge d’erreur combinée est de ± ${Math.round(score.margin)} points : attendez la prochaine mesure avant de conclure.`);

  return {
    from,
    to,
    comparable,
    score,
    mentionRate,
    shareOfVoice,
    questionsGained,
    questionsLost,
    providers,
    sourcesAppeared,
    sourcesDisappeared,
    clientSourcesGained,
    clientSourcesLost,
    competitors,
    confidence: score.confidence,
    headline,
    sentences,
    warnings,
  };
}
