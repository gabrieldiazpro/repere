/**
 * Outils du copilote V3 : 15 fonctions typées sur les données du compte (audit, historique, sources, perception,
 * fiche de vérité, tâches, trafic, ventes). Chacune renvoie des données structurées + une phrase sourcée.
 * Utilisés par le routeur du mode démo ET par la boucle d'appels d'outils du mode LLM (TOOL_DEFS).
 * Aucun outil n'écrit quoi que ce soit : les actions (suivre une question, ajouter une tâche) sont PROPOSÉES.
 */
import type { ProviderId } from '@/lib/engine';
import type { AiEngine, BrandFactField, ExecTask } from '@/lib/engine/types-v2';
import { isBrandQuery } from '@/lib/engine/queries-v2';
import { scoredMentions } from '@/lib/engine/coherence';
import { PROVIDER_LABEL } from '@/lib/alerts';
import { auditStats, previousComparable } from '@/lib/digest/stats';
import { compareFact, FACT_LABELS } from '@/lib/facts';
import type { AuditV2, CopilotContext } from './context';
import { frDate } from './context';
import { DELIVERABLE_KINDS, draft, type DeliverableKind } from './deliverables';
import { openTasks } from './demo';
import { ENGINE_LABEL, factTopicIn, fold, matchName, matchQuery, norm, type EngineName } from './entities';
import { explainChangeLocal, providerRate } from './explain';
import type { SourceRef, ToolName, ToolResult } from './types';

type Args = Record<string, unknown>;
export type ToolFn = (c: CopilotContext, args: Args) => ToolResult;

const PROVIDERS: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'mistral'];
const ENGINES: AiEngine[] = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'other_ai'];

/** Arguments venus d'un LLM : chaînes bornées, énumérations vérifiées. */
const str = (v: unknown, n = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : undefined;
};
const providerArg = (v: unknown): ProviderId | undefined => {
  const s = str(v, 30);
  if (!s) return undefined;
  const k = norm(s).replace(/[^a-z]/g, '');
  return PROVIDERS.find((p) => k.startsWith(p) || (p === 'chatgpt' && /gpt|openai/.test(k)) || (p === 'mistral' && k === 'lechat'));
};
const engineArg = (v: unknown): AiEngine | undefined => {
  const s = str(v, 30);
  if (!s) return undefined;
  const k = norm(s).replace(/[^a-z_]/g, '');
  return ENGINES.find((e) => k.startsWith(e.replace('_', '')) || k === e || (e === 'chatgpt' && /gpt|openai/.test(k)));
};

const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/ | /g, ' ');
const fmtEur = (n: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n).replace(/ | /g, ' ')} €`;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const auditDate = (a: AuditV2) => frDate(a.measuredAt ?? a.createdAt);

function src(label: string, href: string, a?: AuditV2 | null): SourceRef {
  return a ? { label: `${label} · audit du ${auditDate(a)}${a.demo ? ' (démo)' : ''}`, href, date: a.createdAt } : { label, href };
}

function noAudit(tool: ToolName, args: Args): ToolResult {
  return { tool, args, ok: false, data: {}, text: 'Aucun audit disponible pour l’instant : je n’ai pas cette donnée.', source: src('Lundi', '/app') };
}

const audits = (c: CopilotContext): AuditV2[] => (c.historyAudits?.length ? c.historyAudits : c.latest ? [c.latest] : []);

/** Mentions de visibilité (hors questions sur la marque), mêmes règles que le score. */
function recoMentions(a: AuditV2) {
  const brand = new Set(a.queries.filter((q) => isBrandQuery(q)).map((q) => q.id));
  return scoredMentions(a).filter((m) => !brand.has(m.queryId));
}

function competitorCandidates(c: CopilotContext): string[] {
  const a = c.latest;
  if (!a) return [];
  const own = fold(c.business.name);
  const names = [
    ...auditStats(a).rows.filter((r) => !r.isMe).map((r) => r.name),
    ...(a.gaps ?? []).map((g) => g.competitor),
    ...((a.input as { knownCompetitors?: string[] }).knownCompetitors ?? []),
  ];
  return [...new Set(names)].filter((n) => fold(n) !== own);
}

/** Concurrent nommé (correspondance floue) ; null si absent des données. */
export function resolveCompetitor(c: CopilotContext, text: string): { name: string; ambiguous: string[] } | null {
  const m = matchName(text, competitorCandidates(c), { exclude: [c.business.name] });
  return m ? { name: m.name, ambiguous: m.ambiguous } : null;
}

// ---------------------------------------------------------------------------
// 1. Score
// ---------------------------------------------------------------------------

const getScore: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getScore', args);
  const p = providerArg(args.provider);
  const sub = a.subScores as Partial<Record<ProviderId, number | null>>;
  const byProvider = Object.fromEntries(Object.entries(sub).filter(([, v]) => v !== null && v !== undefined)) as Record<string, number>;
  const history = c.history.map((h) => ({ at: h.at, score: h.score }));
  const data = { score: a.score, range: a.range, confidence: a.confidence, byProvider, history, provider: p ?? null, providerScore: p ? (sub[p] ?? null) : null, providerRate: p ? providerRate(a, p) : null, measuredAt: a.measuredAt ?? a.createdAt };
  let text: string;
  if (p) {
    const v = sub[p];
    text =
      v === null || v === undefined
        ? `${PROVIDER_LABEL[p]} n’a pas été interrogé lors de l’audit du ${auditDate(a)} : je n’ai pas de note pour cette IA. IA mesurées : ${a.providersUsed.map((x) => PROVIDER_LABEL[x]).join(', ')}.`
        : `Votre note sur ${PROVIDER_LABEL[p]} est de ${v}/100 (score global ${a.score}/100, marge ${a.range.low}–${a.range.high}) d’après l’audit du ${auditDate(a)}.`;
  } else {
    text = `Votre score est de ${a.score}/100 (marge ${a.range.low}–${a.range.high}) d’après l’audit du ${auditDate(a)} ; par IA : ${Object.entries(byProvider).map(([k, v]) => `${PROVIDER_LABEL[k as ProviderId]} ${v}`).join(', ')}.`;
  }
  return { tool: 'getScore', args, ok: true, data, text, source: src('Lundi', '/app', a) };
};

// ---------------------------------------------------------------------------
// 2. Rang
// ---------------------------------------------------------------------------

const getRank: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getRank', args);
  const s = auditStats(a);
  const all = audits(c);
  const base = previousComparable(all);
  const prev = base ? auditStats(base) : null;
  const data = { rank: s.rank, of: s.of, label: s.label, citations: s.citations, answers: s.answers, shareOfVoice: s.shareOfVoice, ahead: s.ahead, leader: s.rows[0], rows: s.rows.slice(0, 10), previousRank: prev?.rank ?? null, method: s.methodLabel };
  const text = `Vous êtes ${s.label} : cité dans ${s.citations} réponses sur ${s.answers} (${s.methodLabel}), part de voix ${pct(s.shareOfVoice)}${s.ahead ? ` ; juste devant vous : ${s.ahead.name} (${s.ahead.mentions})` : ''}.`;
  return { tool: 'getRank', args, ok: true, data, text, source: src('Concurrents', '/app/concurrents', a) };
};

// ---------------------------------------------------------------------------
// 3. Un concurrent
// ---------------------------------------------------------------------------

const getCompetitor: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getCompetitor', args);
  const asked = str(args.name, 120) ?? '';
  const s = auditStats(a);
  const hit = asked ? resolveCompetitor(c, asked) : null;
  if (!hit) {
    const ahead = s.rows.filter((r) => !r.isMe && r.mentions > s.citations);
    return {
      tool: 'getCompetitor',
      args,
      ok: false,
      data: { asked, inData: false, answers: s.answers, ahead: ahead.slice(0, 5), known: s.rows.filter((r) => !r.isMe).map((r) => r.name) },
      text: `${asked || 'Ce concurrent'} n’apparaît dans aucune des ${s.answers} réponses analysées lors de l’audit du ${auditDate(a)} : je n’ai aucune donnée sur lui.`,
      source: src('Concurrents', '/app/concurrents', a),
    };
  }
  const name = hit.name;
  const row = s.rows.find((r) => fold(r.name) === fold(name));
  const ms = recoMentions(a);
  const perProvider = a.providersUsed.map((p) => {
    const pm = ms.filter((m) => m.provider === p);
    return { provider: p, him: pm.filter((m) => m.competitors.some((n) => fold(n) === fold(name))).length, me: pm.filter((m) => m.mentioned).length, total: pm.length };
  });
  const first = ms.filter((m) => fold(m.competitors[0] ?? '') === fold(name)).length;
  const gap = a.gaps?.find((g) => fold(g.competitor) === fold(name));
  const presentOn =
    gap?.presentOn ?? (a.sources?.domains ?? []).filter((d) => d.clientPresence !== 'present' && d.competitorsPresent.some((n) => fold(n) === fold(name))).map((d) => d.domain);
  const trend = audits(c).map((x) => ({ at: x.createdAt, mentions: auditStats(x).rows.find((r) => fold(r.name) === fold(name))?.mentions ?? 0 }));
  const descriptions = (gap?.reasons ?? []).map((r) => /décrit ainsi : « (.+?) »/.exec(r)?.[1]).filter(Boolean) as string[];
  const data = { name, inData: true, ambiguous: hit.ambiguous, mentions: row?.mentions ?? 0, myMentions: s.citations, answers: s.answers, pos: row?.pos ?? null, ahead: (row?.mentions ?? 0) > s.citations, perProvider, recommendedFirst: first, presentOn, reasons: gap?.reasons ?? [], descriptions, trend, method: s.methodLabel };
  const text = `${name} est cité ${row?.mentions ?? 0} fois, vous ${s.citations} fois, sur les mêmes ${s.answers} réponses (audit du ${auditDate(a)}).`;
  return { tool: 'getCompetitor', args, ok: true, data, text, source: src('Concurrents', '/app/concurrents', a) };
};

// ---------------------------------------------------------------------------
// 4. Comparer les concurrents dans le temps
// ---------------------------------------------------------------------------

const compareCompetitors: ToolFn = (c, args) => {
  const all = audits(c);
  const a = c.latest;
  if (!a) return noAudit('compareCompetitors', args);
  const period = str(args.period, 20) === 'start' ? 'start' : str(args.period, 20) === 'quarter' ? 'quarter' : 'month';
  if (all.length < 2) {
    return { tool: 'compareCompetitors', args, ok: false, data: { audits: all.length }, text: 'Un seul audit disponible : je ne peux pas encore mesurer de progression.', source: src('Historique', '/app/historique', a) };
  }
  const back = period === 'start' ? all.length - 1 : period === 'quarter' ? Math.min(3, all.length - 1) : 1;
  const prev = all[all.length - 1 - back];
  const sp = auditStats(prev);
  const sn = auditStats(a);
  const own = fold(c.business.name);
  const names = [...new Set([...sp.rows, ...sn.rows].map((r) => r.name))];
  const rows = names
    .map((n) => {
      const b = sp.rows.find((r) => fold(r.name) === fold(n));
      const x = sn.rows.find((r) => fold(r.name) === fold(n));
      return { name: n, isMe: fold(n) === own, prev: b?.mentions ?? 0, next: x?.mentions ?? 0, delta: (x?.mentions ?? 0) - (b?.mentions ?? 0), prevShare: b?.share ?? 0, nextShare: x?.share ?? 0 };
    })
    .sort((x, y) => y.delta - x.delta || y.next - x.next);
  const others = rows.filter((r) => !r.isMe);
  const fastest = others[0];
  const me = rows.find((r) => r.isMe);
  const data = { from: prev.createdAt, to: a.createdAt, period, rows, fastest, me };
  const text = `Entre l’audit du ${auditDate(prev)} et celui du ${auditDate(a)}, ${fastest.name} progresse le plus : ${fastest.prev} → ${fastest.next} citations (${fastest.delta >= 0 ? '+' : ''}${fastest.delta})${me ? ` ; vous : ${me.prev} → ${me.next}` : ''}.`;
  return { tool: 'compareCompetitors', args, ok: true, data, text, source: src('Concurrents', '/app/concurrents', a) };
};

// ---------------------------------------------------------------------------
// 5. Sources citées (domaines, ou URL exactes par question et par IA)
// ---------------------------------------------------------------------------

const getSources: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getSources', args);
  const p = providerArg(args.provider);
  const queryText = str(args.query, 200);
  const filter = str(args.filter, 20);
  const reco = a.queries.filter((q) => !isBrandQuery(q));
  if (p === 'gemini') {
    return { tool: 'getSources', args, ok: false, data: { provider: p, urls: [] }, text: 'Gemini est interrogé sans ancrage : il ne fournit pas de sources, je n’ai donc aucune URL pour lui.', source: src('Sources', '/app/sources', a) };
  }
  if (p || queryText) {
    const mq = queryText ? matchQuery(queryText, reco.map((q) => q.text)) : { index: -1, score: 0 };
    const q = mq.index >= 0 ? reco[mq.index] : null;
    if (queryText && !q) {
      return {
        tool: 'getSources',
        args,
        ok: false,
        data: { query: queryText, queries: reco.map((x) => x.text) },
        text: `Aucune question de votre audit ne correspond à « ${queryText} ». Questions mesurées : ${reco.slice(0, 4).map((x) => `« ${x.text} »`).join(', ')}…`,
        source: src('Sources', '/app/sources', a),
      };
    }
    const map = new Map<string, { url: string; title?: string; count: number; providers: Set<ProviderId>; queries: Set<string>; best: number }>();
    let answers = 0;
    for (const ans of a.answers ?? []) {
      if (ans.error || (p && ans.provider !== p) || (q && ans.queryId !== q.id) || isBrandQuery(a.queries.find((x) => x.id === ans.queryId))) continue;
      answers++;
      const list = ans.sources?.length ? ans.sources : (ans.citations ?? []).map((u) => ({ url: u, title: undefined as string | undefined }));
      list.forEach((sx, i) => {
        const cur = map.get(sx.url) ?? { url: sx.url, title: sx.title, count: 0, providers: new Set<ProviderId>(), queries: new Set<string>(), best: 99 };
        cur.count++;
        cur.providers.add(ans.provider);
        cur.queries.add(ans.queryId);
        cur.best = Math.min(cur.best, i + 1);
        map.set(sx.url, cur);
      });
    }
    const urls = [...map.values()].sort((x, y) => y.count - x.count).map((u) => ({ url: u.url, title: u.title, citations: u.count, providers: [...u.providers], bestPosition: u.best, queries: u.queries.size }));
    const who = p ? PROVIDER_LABEL[p] : 'les IA';
    const text = urls.length
      ? `${who} cite${p ? '' : 'nt'} ${urls.length} URL distincte${urls.length > 1 ? 's' : ''}${q ? ` pour « ${q.text} »` : ''} sur ${answers} réponse${answers > 1 ? 's' : ''} (audit du ${auditDate(a)}).`
      : `${who} ne cite${p ? '' : 'nt'} aucune URL${q ? ` pour « ${q.text} »` : ''} dans l’audit du ${auditDate(a)}.`;
    return { tool: 'getSources', args, ok: true, data: { provider: p ?? null, query: q?.text ?? null, queryId: q?.id ?? null, answers, urls }, text, source: src('Sources', '/app/sources', a) };
  }
  let domains = a.sources?.domains ?? [];
  if (filter === 'absent') domains = domains.filter((d) => d.clientPresence === 'absent');
  else if (filter === 'present') domains = domains.filter((d) => d.clientPresence === 'present');
  const top = domains.slice(0, 10).map((d) => ({ domain: d.domain, label: d.label, category: d.category, citations: d.citations, clientPresence: d.clientPresence, competitorsPresent: d.competitorsPresent.slice(0, 5) }));
  const text = top.length
    ? `Sources les plus citées${filter === 'absent' ? ' où vous êtes absent' : filter === 'present' ? ' où vous êtes présent' : ''} : ${top.slice(0, 5).map((d) => `${d.domain} (${d.citations})`).join(', ')} — ${a.sources?.totalCitations ?? 0} citations au total (audit du ${auditDate(a)}).`
    : 'Je n’ai pas de sources pour cet audit (Gemini, sans ancrage, n’en fournit pas).';
  return { tool: 'getSources', args, ok: top.length > 0, data: { filter: filter ?? 'all', total: a.sources?.totalCitations ?? 0, domains: top, urls: (a.sources?.urls ?? []).slice(0, 10) }, text, source: src('Sources', '/app/sources', a) };
};

// ---------------------------------------------------------------------------
// 6. Opportunités
// ---------------------------------------------------------------------------

const getOpportunities: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getOpportunities', args);
  const limit = num(args.limit, 1, 10) ?? 3;
  const opps = [...(a.sources?.opportunities ?? [])].sort((x, y) => y.score - x.score).slice(0, limit);
  const text = opps.length ? `Première opportunité : ${opps[0].label} (${opps[0].domain}), score ${opps[0].score}/100, effort ${opps[0].effort} — ${opps[0].action}` : 'Aucune opportunité de source classée dans cet audit.';
  return { tool: 'getOpportunities', args, ok: opps.length > 0, data: { opportunities: opps }, text, source: src('Sources', '/app/sources', a) };
};

// ---------------------------------------------------------------------------
// 7. Perception (ce que disent les IA)
// ---------------------------------------------------------------------------

/** Passages (phrases) des réponses qui parlent de la marque et contiennent un mot-clé. */
function passages(c: CopilotContext, keywords: string[], provider?: ProviderId): { provider: ProviderId; query: string; text: string }[] {
  const a = c.latest;
  if (!a) return [];
  const brand = fold(c.business.name);
  const kws = keywords.map((k) => norm(k));
  const out: { provider: ProviderId; query: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const ans of a.answers ?? []) {
    if (ans.error || !ans.text || (provider && ans.provider !== provider)) continue;
    const q = a.queries.find((x) => x.id === ans.queryId);
    const aboutBrand = isBrandQuery(q) || fold(ans.text).includes(brand);
    if (!aboutBrand) continue;
    for (const sentence of ans.text.split(/(?<=[.!?])\s+|\n+/)) {
      const n = ` ${norm(sentence)} `;
      if (!kws.some((k) => n.includes(k))) continue;
      if (!isBrandQuery(q) && !fold(sentence).includes(brand)) continue;
      const key = `${ans.provider}|${norm(sentence)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ provider: ans.provider, query: q?.text ?? '', text: sentence.trim().slice(0, 300) });
    }
  }
  return out;
}

const getPerception: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getPerception', args);
  const p = providerArg(args.provider);
  const topic = str(args.topic, 80);
  const per = a.perception;
  const quotes = (per?.quotes ?? []).filter((q) => !p || q.provider === p);
  const claims = (per?.claims ?? []).filter((q) => !p || q.provider === p);
  const data = { sentiment: per?.sentiment ?? null, themes: per?.themes ?? [], quotes: quotes.slice(0, 6), claims: claims.slice(0, 10), provider: p ?? null, topicPassages: topic ? passages(c, [topic], p) : [] };
  const s = per?.sentiment;
  const text = per
    ? `Ton des réponses sur votre marque : ${pct(s!.positif)} positif, ${pct(s!.neutre)} neutre, ${pct(s!.negatif)} négatif ; thèmes : ${per.themes.join(', ') || '—'} (audit du ${auditDate(a)}).`
    : 'Pas d’analyse de perception pour cet audit.';
  return { tool: 'getPerception', args, ok: Boolean(per), data, text, source: src('Ce que disent les IA', '/app/ia', a) };
};

// ---------------------------------------------------------------------------
// 8. Erreurs factuelles + 9. Vérifier une information
// ---------------------------------------------------------------------------

const getFactErrors: ToolFn = (c, args) => {
  const fc = c.factCheck;
  // Une même erreur relevée sur plusieurs passages n'est comptée qu'une fois (même IA, même champ, même affirmation).
  const seen = new Set<string>();
  const errors = (fc?.items ?? []).filter((i) => i.verdict === 'faux' && !seen.has(`${i.provider}|${i.field}|${i.stated}`) && Boolean(seen.add(`${i.provider}|${i.field}|${i.stated}`))).map((i) => ({ field: i.field, label: FACT_LABELS[i.field], provider: i.provider, stated: i.stated, expected: i.expected, severity: i.severity, quote: i.quote }));
  const text = !fc
    ? 'Pas encore de vérification des faits : complétez votre fiche de vérité.'
    : errors.length
      ? `${errors.length} information${errors.length > 1 ? 's' : ''} fausse${errors.length > 1 ? 's' : ''} sur ${fc.items.length} vérifiée${fc.items.length > 1 ? 's' : ''} : ${errors.map((e) => `${PROVIDER_LABEL[e.provider]} sur ${e.label.toLowerCase()} (dit « ${e.stated} »)`).join(' ; ')}.`
      : `Aucune erreur sur les ${fc.items.length} affirmations vérifiées.`;
  return { tool: 'getFactErrors', args, ok: Boolean(fc), data: { checked: fc?.items.length ?? 0, errors }, text, source: src('Vérité', '/app/verite', c.latest) };
};

const checkFact: ToolFn = (c, args) => {
  const topicText = str(args.topic, 120) ?? '';
  const p = providerArg(args.provider);
  const topic = factTopicIn(topicText) ?? (FACT_LABELS[topicText as BrandFactField] ? { field: topicText as BrandFactField, keywords: [topicText], label: FACT_LABELS[topicText as BrandFactField] } : null);
  if (!topic) {
    return { tool: 'checkFact', args, ok: false, data: { topic: topicText }, text: `Je ne sais pas rattacher « ${topicText} » à une information de votre fiche de vérité (horaires, prix, adresse, livraison, composition…).`, source: src('Vérité', '/app/verite', c.latest) };
  }
  const a = c.latest;
  const expected = c.facts.facts[topic.field] ?? null;
  const claims = (a?.perception?.claims ?? []).filter((cl) => cl.field === topic.field && (!p || cl.provider === p));
  const uniq = new Map<string, (typeof claims)[number]>();
  for (const cl of claims) uniq.set(`${cl.provider}|${norm(cl.value)}`, cl);
  const checked = [...uniq.values()].map((cl) => ({ provider: cl.provider, value: cl.value, quote: cl.quote, verdict: expected ? compareFact(topic.field, expected, cl.value) : ('non_verifiable' as const) }));
  const errors = (c.factCheck?.items ?? []).filter((i) => i.field === topic.field && i.verdict === 'faux' && (!p || i.provider === p));
  const found = passages(c, topic.keywords, p);
  const said = new Set(found.map((x) => x.provider));
  const providers = a?.providersUsed ?? [];
  const data = { field: topic.field, label: topic.label, fieldLabel: FACT_LABELS[topic.field], expected, provider: p ?? null, claims: checked, errors, passages: found.slice(0, 6), providersMentioning: [...said], providersSilent: providers.filter((x) => !said.has(x) && (!p || x === p)) };
  const who = p ? PROVIDER_LABEL[p] : 'Les IA';
  const text = found.length
    ? `${who} ${p ? 'en parle' : 'en parlent'} dans ${found.length} passage${found.length > 1 ? 's' : ''} (${topic.label}) ; votre fiche de vérité indique : « ${expected ?? 'non renseigné'} ».`
    : `${who} ne ${p ? 'mentionne' : 'mentionnent'} pas ce point (${topic.label}) dans les réponses analysées.`;
  return { tool: 'checkFact', args, ok: true, data, text, source: src('Vérité', '/app/verite', a) };
};

// ---------------------------------------------------------------------------
// 10. Tâches
// ---------------------------------------------------------------------------

const getTasks: ToolFn = (c, args) => {
  const status = str(args.status, 20);
  const budget = num(args.budgetMinutes, 5, 600);
  let list: ExecTask[] = status === 'done' ? c.tasks.filter((t) => t.status === 'done') : status === 'all' ? c.tasks : openTasks(c);
  if (budget && status !== 'done') {
    const pick: ExecTask[] = [];
    let left = budget;
    for (const t of list) {
      if (pick.length >= 3) break;
      if (t.minutes <= left) {
        pick.push(t);
        left -= t.minutes;
      }
    }
    list = pick.length ? pick : list.slice(0, 1);
  }
  const tasks = list.map((t) => ({ id: t.id, title: t.title, minutes: t.minutes, impact: t.impact, status: t.status, kind: t.kind, why: t.why, deliverable: t.deliverable?.[0]?.label ?? null }));
  const open = openTasks(c).length;
  const done = c.tasks.filter((t) => t.status === 'done').length;
  const text = `${open} tâche${open > 1 ? 's' : ''} ouverte${open > 1 ? 's' : ''}, ${done} faite${done > 1 ? 's' : ''}${tasks[0] ? ` ; prioritaire : « ${tasks[0].title} » (${tasks[0].minutes} min)` : ''}.`;
  return { tool: 'getTasks', args, ok: true, data: { status: status ?? 'open', budgetMinutes: budget ?? null, open, done, tasks }, text, source: { label: 'Actions', href: '/app/actions' } };
};

// ---------------------------------------------------------------------------
// 11. Trafic + 12. Ventes
// ---------------------------------------------------------------------------

const getTraffic: ToolFn = (c, args) => {
  const t = c.traffic;
  if (!t || (!t.installed && !t.demo)) {
    return { tool: 'getTraffic', args, ok: false, data: { installed: false }, text: 'Le suivi des visites venues des IA n’est pas installé : je n’ai pas cette donnée.', source: { label: 'Trafic IA', href: '/app/trafic' } };
  }
  const engine = engineArg(args.engine);
  const days = num(args.days, 1, 30) ?? 30;
  const slice = t.days.slice(-days);
  const sum = (ds: typeof slice, e?: AiEngine) => ds.reduce((s, d) => s + (e ? (d.visits[e] ?? 0) : Object.values(d.visits).reduce((x, y) => x + (y ?? 0), 0)), 0);
  const conv = (ds: typeof slice) => ds.reduce((s, d) => s + Object.values(d.conversions).reduce((x, y) => x + (y ?? 0), 0), 0);
  const useTotals = days >= t.days.length;
  const aiVisits = useTotals ? t.totals.aiVisits : sum(slice);
  const engineVisits = engine ? (useTotals ? (t.totals.byEngine[engine] ?? 0) : sum(slice, engine)) : null;
  const allVisits = slice.reduce((s, d) => s + d.totalVisits, 0);
  const half = Math.floor(slice.length / 2);
  const firstHalf = sum(slice.slice(0, half), engine);
  const secondHalf = sum(slice.slice(half), engine);
  const bots: Record<string, number> = {};
  for (const d of slice) for (const [k, v] of Object.entries(d.bots ?? {})) bots[k] = (bots[k] ?? 0) + v;
  const data = {
    days: slice.length,
    from: slice[0]?.date ?? t.from,
    to: slice.at(-1)?.date ?? t.to,
    aiVisits,
    aiShare: useTotals ? t.totals.aiShare : allVisits ? aiVisits / allVisits : 0,
    conversions: useTotals ? t.totals.conversions : conv(slice),
    byEngine: t.totals.byEngine,
    engine: engine ?? null,
    engineVisits,
    topLandingPages: t.topLandingPages.filter((x) => !engine || x.engine === engine).slice(0, 5),
    trend: { firstHalf, secondHalf, halfDays: half },
    bots,
    demo: t.demo,
  };
  const who = engine ? ENGINE_LABEL[engine] : 'les IA';
  const text = engine
    ? `${ENGINE_LABEL[engine]} vous a envoyé ${fmtInt(engineVisits ?? 0)} visites sur ${slice.length} jours (${fmtInt(aiVisits)} venues de toutes les IA).`
    : `${fmtInt(aiVisits)} visites venues de ${who} sur ${slice.length} jours, ${pct(data.aiShare)} de votre trafic.`;
  return { tool: 'getTraffic', args, ok: true, data, text, source: { label: `Trafic IA · ${slice.length} jours${t.demo ? ' (démo)' : ''}`, href: '/app/trafic' } };
};

const getSales: ToolFn = (c, args) => {
  const k = c.traffic?.commerce;
  const engine = engineArg(args.engine);
  if (!k) {
    return { tool: 'getSales', args, ok: false, data: { connected: false }, text: 'Vos ventes ne sont pas connectées (Shopify ou GA4) : je n’ai pas de commandes ni de CA attribués aux IA.', source: { label: 'Trafic IA', href: '/app/trafic' } };
  }
  const e = engine ? k.byEngine[engine] ?? { orders: 0, revenueEur: 0 } : null;
  const best = [...k.products].sort((x, y) => y.revenueEur - x.revenueEur)[0] ?? null;
  const data = { source: k.source, orders: k.orders, revenueEur: k.revenueEur, engine: engine ?? null, engineOrders: e?.orders ?? null, engineRevenueEur: e?.revenueEur ?? null, byEngine: k.byEngine, products: k.products, best };
  const text = engine
    ? `${ENGINE_LABEL[engine]} : ${e!.orders} commande${e!.orders > 1 ? 's' : ''}, ${fmtEur(e!.revenueEur)} (sur ${k.orders} commandes et ${fmtEur(k.revenueEur)} venues des IA en 30 jours).`
    : `${k.orders} commandes et ${fmtEur(k.revenueEur)} de CA venus des IA en 30 jours.`;
  return { tool: 'getSales', args, ok: true, data, text, source: { label: `Trafic IA · ventes (${k.source === 'demo' ? 'démo' : k.source})`, href: '/app/trafic' } };
};

// ---------------------------------------------------------------------------
// 13. Résultats par question
// ---------------------------------------------------------------------------

const getPromptResults: ToolFn = (c, args) => {
  const a = c.latest;
  if (!a) return noAudit('getPromptResults', args);
  const p = providerArg(args.provider);
  const queryText = str(args.query, 200);
  const absentOnly = args.absentOnly === true || args.absentOnly === 'true';
  const ms = recoMentions(a);
  const reco = a.queries.filter((q) => !isBrandQuery(q));
  let rows = reco.map((q) => {
    const qm = ms.filter((m) => m.queryId === q.id && (!p || m.provider === p));
    const byProvider = a.providersUsed.map((pp) => {
      const x = ms.filter((m) => m.queryId === q.id && m.provider === pp);
      return { provider: pp, cited: x.filter((m) => m.mentioned).length, answers: x.length };
    });
    const comp = new Map<string, number>();
    for (const m of qm) for (const n of new Set(m.competitors)) if (fold(n) !== fold(c.business.name)) comp.set(n, (comp.get(n) ?? 0) + 1);
    return { queryId: q.id, text: q.text, cited: qm.filter((m) => m.mentioned).length, answers: qm.length, byProvider, competitors: [...comp.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n, k]) => ({ name: n, count: k })) };
  });
  if (queryText) {
    const mq = matchQuery(queryText, rows.map((r) => r.text));
    rows = mq.index >= 0 ? [rows[mq.index]] : [];
  }
  if (absentOnly) rows = rows.filter((r) => r.answers > 0 && r.cited === 0);
  const who = p ? PROVIDER_LABEL[p] : 'les IA';
  const text = absentOnly
    ? `${rows.length} question${rows.length > 1 ? 's' : ''} sur ${reco.length} où ${who} ne vous cite${p ? '' : 'nt'} jamais (audit du ${auditDate(a)}).`
    : `${rows.length} question${rows.length > 1 ? 's' : ''} analysée${rows.length > 1 ? 's' : ''}${p ? ` pour ${who}` : ''} (audit du ${auditDate(a)}).`;
  return { tool: 'getPromptResults', args, ok: true, data: { provider: p ?? null, absentOnly, total: reco.length, questions: rows }, text, source: src('Ce que disent les IA', '/app/ia', a) };
};

// ---------------------------------------------------------------------------
// 14. Expliquer un changement
// ---------------------------------------------------------------------------

function auditForMonth(all: AuditV2[], month: number, year?: number): AuditV2 | null {
  return [...all].reverse().find((x) => {
    const d = new Date(x.createdAt);
    return d.getUTCMonth() === month && (!year || d.getUTCFullYear() === year);
  }) ?? null;
}

const explainChange: ToolFn = (c, args) => {
  const all = audits(c);
  const a = c.latest;
  if (!a) return noAudit('explainChange', args);
  if (all.length < 2) return { tool: 'explainChange', args, ok: false, data: { audits: all.length }, text: 'Un seul audit disponible : rien à comparer pour l’instant.', source: src('Historique', '/app/historique', a) };
  const fromM = num(args.fromMonth, 0, 11);
  const toM = num(args.toMonth, 0, 11);
  const year = num(args.year, 2000, 2100);
  // Par défaut : la dernière mesure COMPARABLE (mêmes questions, ≥ 6 jours), sinon l'audit précédent est signalé hors périmètre.
  let prev: AuditV2 | null = previousComparable(all);
  let next: AuditV2 | null = a;
  const missing: number[] = [];
  if (fromM !== undefined) {
    prev = auditForMonth(all, fromM, year);
    if (!prev) missing.push(fromM);
  }
  if (toM !== undefined) {
    next = auditForMonth(all, toM, year);
    if (!next) missing.push(toM);
  } else if (fromM !== undefined && prev) {
    const i = all.indexOf(prev);
    next = all[i + 1] ?? a;
  }
  if (!prev && fromM === undefined && toM === undefined) {
    return {
      tool: 'explainChange',
      args,
      ok: false,
      data: { comparable: false, available: all.map((x) => x.createdAt) },
      text: `Pas encore de mesure comparable (mêmes questions, au moins 6 jours d’écart) : la mesure du ${frDate(a.createdAt)} est votre première mesure de référence, aucun écart n’est annoncé.`,
      source: src('Historique', '/app/historique', a),
    };
  }
  if (!prev || !next || prev === next) {
    return {
      tool: 'explainChange',
      args,
      ok: false,
      data: { missing, available: all.map((x) => x.createdAt) },
      text: `Je n’ai pas d’audit pour ${missing.length ? 'ce mois' : 'cette période'}. Audits disponibles : ${all.map((x) => frDate(x.createdAt)).join(', ')}.`,
      source: src('Historique', '/app/historique', a),
    };
  }
  if (new Date(prev.createdAt) > new Date(next.createdAt)) [prev, next] = [next, prev];
  const e = explainChangeLocal(prev, next);
  return { tool: 'explainChange', args, ok: true, data: e as unknown as Record<string, unknown>, text: e.headline, source: { label: `Historique · ${frDate(prev.createdAt)} → ${frDate(next.createdAt)}${a.demo ? ' (démo)' : ''}`, href: '/app/historique' } };
};

// ---------------------------------------------------------------------------
// 15. Livrables
// ---------------------------------------------------------------------------

const draftDeliverable: ToolFn = (c, args) => {
  const kind = str(args.kind, 30) as DeliverableKind | undefined;
  if (!kind || !DELIVERABLE_KINDS.includes(kind)) {
    return { tool: 'draftDeliverable', args, ok: false, data: { kinds: DELIVERABLE_KINDS }, text: `Livrable inconnu. Possibles : ${DELIVERABLE_KINDS.join(', ')}.`, source: { label: 'Actions', href: '/app/actions' } };
  }
  const r = draft(c, kind, str(args.context, 2000) ?? '');
  return { tool: 'draftDeliverable', args, ok: r.ok, data: r.data, text: r.text, source: { label: kind === 'export_csv' ? 'Concurrents' : 'Actions', href: kind === 'export_csv' ? '/app/concurrents' : '/app/actions' }, deliverables: r.deliverables };
};

// ---------------------------------------------------------------------------
// Registre + définitions JSON Schema (mode LLM)
// ---------------------------------------------------------------------------

export const TOOLS: Record<ToolName, ToolFn> = {
  getScore,
  getRank,
  getCompetitor,
  compareCompetitors,
  getSources,
  getOpportunities,
  getPerception,
  getFactErrors,
  checkFact,
  getTasks,
  getTraffic,
  getSales,
  getPromptResults,
  explainChange,
  draftDeliverable,
};

export function runTool(c: CopilotContext, name: string, args: unknown): ToolResult {
  const fn = (TOOLS as Record<string, ToolFn | undefined>)[name];
  const safe = args && typeof args === 'object' && !Array.isArray(args) ? (args as Args) : {};
  if (!fn) return { tool: name as ToolName, args: safe, ok: false, data: {}, text: `Outil inconnu : ${String(name).slice(0, 40)}.`, source: { label: 'Copilote', href: '/app/copilote' } };
  try {
    return fn(c, safe);
  } catch (e) {
    console.warn('[copilot] outil en erreur', name, e instanceof Error ? e.message : e);
    return { tool: name as ToolName, args: safe, ok: false, data: {}, text: 'Donnée indisponible (erreur de lecture).', source: { label: 'Copilote', href: '/app/copilote' } };
  }
}

const P = { type: 'string', enum: ['chatgpt', 'perplexity', 'gemini', 'claude', 'mistral'], description: 'IA concernée (facultatif)' };
const E = { type: 'string', enum: ENGINES, description: 'IA d’origine des visites (facultatif)' };

export interface ToolDef {
  name: ToolName;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const TOOL_DEFS: ToolDef[] = [
  { name: 'getScore', description: 'Score de visibilité IA (global, marge, par IA, historique).', parameters: { type: 'object', properties: { provider: P } } },
  { name: 'getRank', description: 'Rang du client parmi les acteurs cités, citations, part de voix, classement.', parameters: { type: 'object', properties: {} } },
  { name: 'getCompetitor', description: 'Données sur un concurrent nommé (correspondance floue) : citations, par IA, sources où il est présent, raisons, évolution.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'compareCompetitors', description: 'Évolution des citations de chaque concurrent entre deux audits (qui progresse le plus).', parameters: { type: 'object', properties: { period: { type: 'string', enum: ['month', 'quarter', 'start'] } } } },
  { name: 'getSources', description: 'Sources citées : domaines (filter absent/present/all) ou URL exactes pour une IA et/ou une question.', parameters: { type: 'object', properties: { filter: { type: 'string', enum: ['all', 'absent', 'present'] }, provider: P, query: { type: 'string', description: 'formulation libre d’une question de l’audit' } } } },
  { name: 'getOpportunities', description: 'Sources à viser en priorité (score, effort, action).', parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } } } },
  { name: 'getPerception', description: 'Ton, thèmes, verbatims et affirmations des IA sur la marque.', parameters: { type: 'object', properties: { provider: P, topic: { type: 'string' } } } },
  { name: 'getFactErrors', description: 'Informations fausses données par les IA (comparées à la fiche de vérité).', parameters: { type: 'object', properties: {} } },
  { name: 'checkFact', description: 'Ce que disent les IA sur un sujet de la fiche (horaires, dimanche, prix, livraison, composition…) comparé à la fiche.', parameters: { type: 'object', properties: { topic: { type: 'string' }, provider: P }, required: ['topic'] } },
  { name: 'getTasks', description: 'Tâches du plan (ouvertes par priorité, faites, ou sélection tenant dans un budget de minutes).', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'done', 'all'] }, budgetMinutes: { type: 'integer' } } } },
  { name: 'getTraffic', description: 'Visites venues des IA (30 jours max), par IA, pages d’arrivée, tendance, robots IA.', parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 30 }, engine: E } } },
  { name: 'getSales', description: 'Commandes et CA attribués aux IA (e-commerce, Shopify ou GA4).', parameters: { type: 'object', properties: { engine: E } } },
  { name: 'getPromptResults', description: 'Résultats par question de l’audit : citations par IA, concurrents cités ; absentOnly pour les questions où le client n’est jamais cité.', parameters: { type: 'object', properties: { query: { type: 'string' }, provider: P, absentOnly: { type: 'boolean' } } } },
  { name: 'explainChange', description: 'Explique la variation entre deux audits (mois 0 = janvier … 11 = décembre ; par défaut les deux derniers).', parameters: { type: 'object', properties: { fromMonth: { type: 'integer', minimum: 0, maximum: 11 }, toMonth: { type: 'integer', minimum: 0, maximum: 11 }, year: { type: 'integer' } } } },
  { name: 'draftDeliverable', description: 'Prépare un livrable à partir des données : faq, review_reply (context = texte de l’avis), content_brief, content_ideas, outreach_email (context = média visé), gbp_description, export_csv, quarter_plan.', parameters: { type: 'object', properties: { kind: { type: 'string', enum: DELIVERABLE_KINDS }, context: { type: 'string' } }, required: ['kind'] } },
];

export type { EngineName };
