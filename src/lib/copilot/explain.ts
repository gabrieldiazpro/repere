/**
 * « Expliquer ce changement » : comparaison de deux audits (adaptateur local, en attendant
 * `explainChange` de l'agent MOTEUR dans @/lib/engine — même type de sortie : ChangeExplanation).
 * Tout est calculé à partir des deux audits ; aucune cause n'est inventée.
 */
import type { ProviderId } from '@/lib/engine';
import type { ChangeConfidence, ChangeExplanation, CompetitorChange, MetricChange, ProviderChange, QuestionChange, SourceChange } from '@/lib/engine/types-v3';
import { isBrandQuery } from '@/lib/engine/queries-v2';
import { PROVIDER_LABEL } from '@/lib/alerts';
import { auditStats } from '@/lib/digest/stats';
import { plural } from '@/lib/text';
import type { AuditV2 } from './context';
import { frDate } from './context';
import { norm } from './entities';

function metric(prev: number, next: number, margin: number): MetricChange {
  const delta = Math.round((next - prev) * 1000) / 1000;
  const m = Math.max(0, margin);
  const confidence: ChangeConfidence = Math.abs(delta) > m ? 'forte' : Math.abs(delta) > m / 2 ? 'moyenne' : 'faible';
  return { prev, next, delta, margin: m, confidence };
}

/** Questions de visibilité citées (au moins une IA, au moins un passage). */
function citedQuestions(a: AuditV2): Map<string, { text: string; providers: Set<ProviderId> }> {
  const out = new Map<string, { text: string; providers: Set<ProviderId> }>();
  for (const q of a.queries) {
    if (isBrandQuery(q)) continue;
    const ms = a.mentions.filter((m) => m.queryId === q.id && m.mentioned);
    if (!ms.length) continue;
    out.set(norm(q.text), { text: q.text, providers: new Set(ms.map((m) => m.provider)) });
  }
  return out;
}

/** Taux de citation d'une IA (questions de visibilité). */
export function providerRate(a: AuditV2, p: ProviderId): number | null {
  const brand = new Set(a.queries.filter((q) => isBrandQuery(q)).map((q) => q.id));
  const ms = a.mentions.filter((m) => m.provider === p && !brand.has(m.queryId));
  return ms.length ? ms.filter((m) => m.mentioned).length / ms.length : null;
}

export function explainChangeLocal(prev: AuditV2, next: AuditV2): ChangeExplanation {
  const sp = auditStats(prev);
  const sn = auditStats(next);
  const half = (a: AuditV2) => Math.max(1, (a.range.high - a.range.low) / 2);
  const score = metric(prev.score, next.score, half(prev) + half(next));
  const rate = (s: typeof sp) => (s.answers ? s.citations / s.answers : 0);
  const rateMargin = 1.96 * Math.sqrt((rate(sp) * (1 - rate(sp))) / Math.max(1, sp.answers) + (rate(sn) * (1 - rate(sn))) / Math.max(1, sn.answers));
  const mentionRate = metric(rate(sp), rate(sn), rateMargin);
  const shareOfVoice = metric(sp.shareOfVoice, sn.shareOfVoice, rateMargin / 2);

  const qp = citedQuestions(prev);
  const qn = citedQuestions(next);
  const nextTexts = new Set(next.queries.map((q) => norm(q.text)));
  const prevTexts = new Set(prev.queries.map((q) => norm(q.text)));
  const toChange = (k: string, v: { text: string; providers: Set<ProviderId> }, a: AuditV2): QuestionChange => ({
    queryId: a.queries.find((q) => norm(q.text) === k)?.id ?? k,
    text: v.text,
    providers: [...v.providers],
  });
  const questionsGained = [...qn.entries()].filter(([k]) => !qp.has(k) && prevTexts.has(k)).map(([k, v]) => toChange(k, v, next));
  const questionsLost = [...qp.entries()].filter(([k]) => !qn.has(k) && nextTexts.has(k)).map(([k, v]) => toChange(k, v, prev));

  const providers: ProviderChange[] = [...new Set([...prev.providersUsed, ...next.providersUsed])].map((p) => {
    const a = providerRate(prev, p);
    const b = providerRate(next, p);
    return { provider: p, prevRate: a, nextRate: b, delta: Math.round(((b ?? 0) - (a ?? 0)) * 1000) / 1000 };
  });

  const dom = (a: AuditV2) => new Map((a.sources?.domains ?? []).map((d) => [d.domain, d]));
  const dp = dom(prev);
  const dn = dom(next);
  const sourcesAppeared: SourceChange[] = [...dn.values()].filter((d) => !dp.has(d.domain)).map((d) => ({ domain: d.domain, label: d.label || d.domain, citations: d.citations }));
  const sourcesDisappeared: SourceChange[] = [...dp.values()].filter((d) => !dn.has(d.domain)).map((d) => ({ domain: d.domain, label: d.label || d.domain, citations: d.citations }));
  const clientSourcesGained = [...dn.values()].filter((d) => d.clientPresence === 'present' && dp.get(d.domain)?.clientPresence !== 'present' && dp.has(d.domain)).map((d) => d.domain);
  const clientSourcesLost = [...dp.values()].filter((d) => d.clientPresence === 'present' && dn.has(d.domain) && dn.get(d.domain)?.clientPresence !== 'present').map((d) => d.domain);

  const pm = new Map(sp.rows.filter((r) => !r.isMe).map((r) => [norm(r.name), r]));
  const nm = new Map(sn.rows.filter((r) => !r.isMe).map((r) => [norm(r.name), r]));
  const competitors: CompetitorChange[] = [...new Set([...pm.keys(), ...nm.keys()])]
    .map((k) => {
      const a = pm.get(k);
      const b = nm.get(k);
      return { name: (b ?? a)!.name, prevMentions: a?.mentions ?? 0, nextMentions: b?.mentions ?? 0, delta: (b?.mentions ?? 0) - (a?.mentions ?? 0), isNew: !a };
    })
    .sort((x, y) => y.delta - x.delta);

  const comparable = prev.queries.length === next.queries.length && [...prevTexts].every((t) => nextTexts.has(t)) && prev.providersUsed.join() === next.providersUsed.join();
  const dir = score.delta > 0 ? 'monté' : score.delta < 0 ? 'baissé' : 'stable';
  const headline =
    score.delta === 0
      ? `Score stable à ${next.score}/100 entre le ${frDate(prev.createdAt)} et le ${frDate(next.createdAt)}.`
      : `Score ${dir === 'monté' ? 'en hausse' : 'en baisse'} : ${prev.score} → ${next.score}/100 (${score.delta > 0 ? '+' : ''}${score.delta} points) entre le ${frDate(prev.createdAt)} et le ${frDate(next.createdAt)}.`;
  const sentences: string[] = [];
  sentences.push(`Vous êtes cité dans ${sn.citations} réponses sur ${sn.answers}, contre ${sp.citations} sur ${sp.answers} au ${frDate(prev.createdAt)}.`);
  const subMoves = [...new Set([...prev.providersUsed, ...next.providersUsed])]
    .map((p) => ({ p, a: (prev.subScores as Partial<Record<ProviderId, number | null>>)[p], b: (next.subScores as Partial<Record<ProviderId, number | null>>)[p] }))
    .filter((x) => typeof x.a === 'number' && typeof x.b === 'number' && x.a !== x.b);
  if (subMoves.length) sentences.push(`Note par IA : ${subMoves.map((x) => `${PROVIDER_LABEL[x.p]} ${x.a} → ${x.b}`).join(' ; ')}.`);
  if (typeof prev.avgRank === 'number' && typeof next.avgRank === 'number' && prev.avgRank !== next.avgRank) {
    const f = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
    sentences.push(`Position moyenne quand vous êtes cité : ${f(prev.avgRank)} → ${f(next.avgRank)} (${next.avgRank < prev.avgRank ? 'vous êtes cité plus haut dans les listes' : 'vous êtes cité plus bas dans les listes'}).`);
  }
  const pmoves = providers.filter((p) => p.prevRate !== null && p.nextRate !== null && Math.abs(p.delta) >= 0.05).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (pmoves.length) sentences.push(`Par IA : ${pmoves.map((p) => `${PROVIDER_LABEL[p.provider]} ${Math.round(p.prevRate! * 100)} % → ${Math.round(p.nextRate! * 100)} % des réponses`).join(' ; ')}.`);
  if (questionsGained.length) sentences.push(`${plural(questionsGained.length, 'question gagnée', 'questions gagnées')} : ${questionsGained.slice(0, 3).map((q) => `« ${q.text} »`).join(', ')}.`);
  if (questionsLost.length) sentences.push(`${plural(questionsLost.length, 'question perdue', 'questions perdues')} : ${questionsLost.slice(0, 3).map((q) => `« ${q.text} »`).join(', ')}.`);
  if (clientSourcesGained.length) sentences.push(`Vous apparaissez désormais sur : ${clientSourcesGained.slice(0, 4).join(', ')}.`);
  if (clientSourcesLost.length) sentences.push(`Vous n'apparaissez plus sur : ${clientSourcesLost.slice(0, 4).join(', ')}.`);
  const up = competitors.filter((c) => c.delta > 0).slice(0, 2);
  if (up.length) sentences.push(`Concurrents en progression : ${up.map((c) => `${c.name} (${c.prevMentions} → ${c.nextMentions} citations)`).join(', ')}.`);
  const warnings: string[] = [];
  if (!comparable) warnings.push('Les deux mesures ne portent pas exactement sur les mêmes questions ou les mêmes IA : comparaison indicative.');
  if (score.confidence === 'faible') warnings.push(`La variation (${score.delta > 0 ? '+' : ''}${score.delta}) reste dans la marge d'erreur des deux mesures (± ${Math.round(score.margin)} points) : ce n'est pas un changement certain.`);
  if (prev.demo || next.demo) warnings.push('Données de démonstration.');
  return {
    from: prev.createdAt,
    to: next.createdAt,
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
