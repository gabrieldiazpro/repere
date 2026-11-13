/**
 * Livrables du copilote (mode démo comme mode LLM) : FAQ (HTML + JSON-LD), réponse à un avis, brief de contenu,
 * e-mail de proposition d'article, description de fiche Google, export CSV de la part de voix, plan sur 3 mois.
 * Tout est tiré des données du compte (fiche de vérité, audit, tâches générées par src/lib/execution) ;
 * ce qui manque reste « [à compléter] », jamais inventé.
 */
import type { ProviderId } from '@/lib/engine';
import type { ContentBrief, QueryGap } from '@/lib/engine/types-v3';
import type { ExecTask } from '@/lib/engine/types-v2';
import { isBrandQuery } from '@/lib/engine/queries-v2';
import { scoredMentions } from '@/lib/engine/coherence';
import { auditStats } from '@/lib/digest/stats';
import { GBP_DESCRIPTION_MAX } from '@/lib/execution/tasks';
import { plural } from '@/lib/text';
import type { CopilotContext } from './context';
import { frDate } from './context';
import { buildFaqItems, faqHtml, faqJsonLd, openTasks, reviewReply } from './demo';
import { fold, matchName, norm } from './entities';
import type { Deliverable } from './types';

export type DeliverableKind =
  | 'faq'
  | 'review_reply'
  | 'content_brief'
  | 'content_ideas'
  | 'outreach_email'
  | 'gbp_description'
  | 'export_csv'
  | 'quarter_plan';

export const DELIVERABLE_KINDS: DeliverableKind[] = ['faq', 'review_reply', 'content_brief', 'content_ideas', 'outreach_email', 'gbp_description', 'export_csv', 'quarter_plan'];

export interface DraftResult {
  ok: boolean;
  /** résumé en français (déjà rédigé pour l'utilisateur) */
  text: string;
  deliverables: Deliverable[];
  data: Record<string, unknown>;
}

const TODO = '[à compléter]';

// ---------------------------------------------------------------------------
// Questions perdues (base des briefs et idées d'articles)
// ---------------------------------------------------------------------------

export interface LostQuery extends QueryGap {
  answers: number;
  cited: number;
}

/** Questions de visibilité classées par réponses où le client n'est pas cité. */
export function lostQueries(c: CopilotContext, provider?: ProviderId | null): LostQuery[] {
  const a = c.latest;
  if (!a) return [];
  const ms = scoredMentions(a).filter((m) => !provider || m.provider === provider);
  const out: LostQuery[] = [];
  for (const q of a.queries) {
    if (isBrandQuery(q)) continue;
    const qm = ms.filter((m) => m.queryId === q.id);
    if (!qm.length) continue;
    const comp = new Map<string, number>();
    for (const m of qm) for (const n of new Set(m.competitors)) if (fold(n) !== fold(c.business.name)) comp.set(n, (comp.get(n) ?? 0) + 1);
    out.push({
      queryId: q.id,
      text: q.text,
      competitors: [...comp.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n),
      providers: [...new Set(qm.filter((m) => !m.mentioned).map((m) => m.provider))],
      answers: qm.length,
      cited: qm.filter((m) => m.mentioned).length,
    });
  }
  return out.sort((x, y) => y.answers - y.cited - (x.answers - x.cited) || x.cited - y.cited);
}

/** Pages citées par les IA pour une question (titre et URL), les plus fréquentes d'abord. */
export function urlsForQuery(c: CopilotContext, queryId: string, provider?: ProviderId | null): { url: string; title?: string; count: number; providers: ProviderId[] }[] {
  const a = c.latest;
  if (!a) return [];
  const map = new Map<string, { url: string; title?: string; count: number; providers: Set<ProviderId> }>();
  for (const ans of a.answers ?? []) {
    if (ans.queryId !== queryId || ans.error || (provider && ans.provider !== provider)) continue;
    const srcs = ans.sources?.length ? ans.sources : (ans.citations ?? []).map((u) => ({ url: u, title: undefined as string | undefined }));
    for (const s of srcs) {
      const cur = map.get(s.url) ?? { url: s.url, title: s.title, count: 0, providers: new Set<ProviderId>() };
      cur.count++;
      cur.providers.add(ans.provider);
      map.set(s.url, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count).map((x) => ({ ...x, providers: [...x.providers] }));
}

// ---------------------------------------------------------------------------
// Brief de contenu (adaptateur local de buildContentBrief, agent MOTEUR)
// ---------------------------------------------------------------------------

function briefFormat(text: string, segment: CopilotContext['segment']): ContentBrief['format'] {
  const q = norm(text);
  if (/alternative|\bou\b.*lequel|\bvs\b|versus/.test(q)) return 'comparatif';
  if (/combien|prix|tarif|cout/.test(q)) return segment === 'local' ? 'page_service' : 'guide';
  if (/avis/.test(q)) return 'faq';
  if (segment === 'local') return 'page_service';
  return 'guide';
}

const FORMAT_LABEL: Record<ContentBrief['format'], string> = {
  comparatif: 'page comparatif',
  guide: 'guide',
  page_service: 'page de service',
  faq: 'page de questions-réponses',
  article_invite: 'article invité',
  fiche: 'fiche',
};

export function buildBrief(c: CopilotContext, gap: LostQuery): ContentBrief {
  const f = c.facts.facts;
  const format = briefFormat(gap.text, c.segment);
  const name = c.business.name;
  const comps = gap.competitors.slice(0, 3);
  const urls = urlsForQuery(c, gap.queryId).slice(0, 4);
  const domainOf = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  };
  const related = (c.latest?.queries ?? []).filter((q) => !isBrandQuery(q) && q.id !== gap.queryId).slice(0, 2).map((q) => q.text);
  const named = comps.find((n) => norm(gap.text).includes(norm(n)));
  const title =
    format === 'comparatif' && named
      ? `${name} ou ${named} : comment choisir`
      : format === 'comparatif'
        ? `${gap.text.replace(/\?$/, '').trim()} : comparatif honnête`
      : format === 'page_service'
        ? `${f.services?.split(/[,;]/)[0]?.trim() || c.business.trade} à ${c.business.city}${c.business.district ? ` ${c.business.district}` : ''} : délais, prix, zone`
        : `${gap.text.replace(/\?$/, '').trim()} : le guide`;
  const factLines = (['prix', 'zone', 'horaires', 'services', 'livraison', 'retours', 'ingredients', 'certifications', 'clients'] as const)
    .filter((k) => f[k])
    .map((k) => `${k} : ${f[k]}`);
  return {
    id: `brief-${gap.queryId}`,
    title,
    format,
    angle: `Répondre directement à « ${gap.text} », question où les IA citent ${comps.length ? comps.join(', ') : 'd’autres acteurs'} et pas ${name} (${gap.cited} réponse${gap.cited > 1 ? 's' : ''} sur ${gap.answers} vous citent).`,
    audience: c.segment === 'local' ? `Particuliers de ${c.business.city}${c.business.district ? ` ${c.business.district}` : ''} qui cherchent un ${c.business.trade}` : c.segment === 'pme' ? `Décideurs qui comparent les offres de ${c.business.trade}` : `Acheteurs en ligne de ${c.business.trade}`,
    questions: [gap.text, ...related],
    sources: urls.map((u) => ({ domain: domainOf(u.url), label: u.title ?? domainOf(u.url), url: u.url, why: `citée ${u.count} fois pour cette question` })),
    competitors: comps,
    outline: [
      { heading: 'La réponse en deux phrases', points: ['Répondre à la question dès le premier paragraphe, avec les faits vérifiables de votre fiche.'] },
      { heading: 'Les faits', points: factLines.length ? factLines : [`${TODO} : prix, zone, délais`] },
      ...(format === 'comparatif' ? [{ heading: 'Tableau comparatif', points: ['Une ligne par critère ; cellules du concurrent « [à vérifier sur leur site] ».'] }] : []),
      { heading: 'Questions fréquentes', points: [gap.text, ...related].map((q) => `Q/R : ${q}`) },
      { heading: 'Qui sommes-nous', points: [`Auteur identifié${f.dirigeant ? ` (${f.dirigeant})` : ''}, date de mise à jour, coordonnées.`] },
    ],
    length: format === 'page_service' ? { minWords: 500, maxWords: 900 } : { minWords: 900, maxWords: 1600 },
    publishOn: c.facts.facts.site ?? c.business.website ?? 'votre site',
    checklist: ['Réponse en tête de page', 'Chiffres sourcés et datés', 'Balisage FAQPage sur la partie Q/R', 'Auteur et date visibles', 'Lien depuis la page d’accueil'],
    note: 'Ce contenu augmente vos chances d’être cité ; aucune IA ne garantit de le reprendre.',
  };
}

export function briefMarkdown(b: ContentBrief): string {
  return [
    `# Brief : ${b.title}`,
    '',
    `Format : ${FORMAT_LABEL[b.format]} (${b.length.minWords} à ${b.length.maxWords} mots) — à publier sur ${b.publishOn}.`,
    `Angle : ${b.angle}`,
    `Lecteur : ${b.audience}`,
    '',
    '## Questions à traiter',
    ...b.questions.map((q) => `- ${q}`),
    '',
    '## Plan',
    ...b.outline.flatMap((o) => [`### ${o.heading}`, ...o.points.map((p) => `- ${p}`)]),
    '',
    '## Sources que les IA citent sur cette question',
    ...(b.sources.length ? b.sources.map((s) => `- ${s.label} (${s.url ?? s.domain}) — ${s.why}`) : ['- Aucune source fournie pour cette question (Gemini n’en donne pas).']),
    '',
    '## Avant publication',
    ...b.checklist.map((x) => `- [ ] ${x}`),
    '',
    `_${b.note}_`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// E-mail de proposition d'article
// ---------------------------------------------------------------------------

function outreachEmail(c: CopilotContext, target?: string): DraftResult {
  const a = c.latest;
  const opps = [...(a?.sources?.opportunities ?? [])].sort((x, y) => y.score - x.score);
  const media = opps.filter((o) => /media|comparatif|blog/.test(o.category));
  let o = target ? opps.find((x) => x.domain === target) ?? null : null;
  if (!o && target) {
    const m = matchName(target, opps.flatMap((x) => [x.label, x.domain]), { threshold: 0.75 });
    o = m ? opps.find((x) => x.label === m.name || x.domain === m.name) ?? null : null;
  }
  o = o ?? media[0] ?? opps[0] ?? null;
  if (!o) return { ok: false, text: 'Je n’ai pas de média ou de site cité par les IA à vous proposer pour l’instant.', deliverables: [], data: {} };
  const task = c.tasks.find((t) => t.kind === 'source_outreach' && (t.sourceDomain === o!.domain || norm(t.title).includes(norm(o!.label))) && t.deliverable?.length);
  const subject = task?.deliverable?.find((d) => /objet/i.test(d.label ?? ''))?.content;
  const body = task?.deliverable?.find((d) => /e-mail|mail/i.test(d.label ?? ''))?.content;
  const f = c.facts.facts;
  const finalSubject = subject ?? `Proposition de sujet : ${c.business.trade}${c.segment === 'local' ? ` à ${c.business.city}` : ''}`;
  const finalBody =
    body ??
    [
      'Bonjour,',
      '',
      `Vos articles sur ${o.label} sont souvent repris quand on cherche ${c.segment === 'local' ? `un ${c.business.trade} à ${c.business.city}` : `« ${c.business.trade} »`}. Je vous propose un sujet : ${TODO} (angle concret, utile à vos lecteurs).`,
      '',
      `Quelques faits sur ${c.business.name} :`,
      `• Activité : ${f.services ?? c.business.trade}`,
      `• Depuis : ${f.creation ?? TODO}`,
      `• Prix : ${f.prix ?? TODO}`,
      '',
      'Je reste disponible pour un échange rapide.',
      'Bien cordialement,',
      `${f.dirigeant ?? TODO} — ${c.business.name}${f.telephone ? ` — ${f.telephone}` : ''}`,
    ].join('\n');
  return {
    ok: true,
    text: `E-mail de proposition à ${o.label} (${o.domain})${task ? `, repris de la tâche « ${task.title} »` : ''}. ${o.why} Aucune publication n’est garantie : c’est une proposition.`,
    deliverables: [
      { type: 'text', label: 'Objet', content: finalSubject },
      { type: 'text', label: `E-mail de proposition (${o.label})`, content: finalBody },
    ],
    data: { domain: o.domain, label: o.label, fromTask: task?.title ?? null },
  };
}

// ---------------------------------------------------------------------------
// Description de fiche Google (750 caractères)
// ---------------------------------------------------------------------------

function gbpDescription(c: CopilotContext): DraftResult {
  const task = c.tasks.find((t) => t.kind === 'gbp_profile' && t.deliverable?.length);
  let text = task?.deliverable?.find((d) => /description/i.test(d.label ?? ''))?.content;
  const f = c.facts.facts;
  if (!text) {
    const parts = [
      `${c.business.name}, ${c.business.trade} à ${c.business.city}${c.business.district ? ` ${c.business.district}` : ''}${f.creation ? ` depuis ${f.creation}` : ''}.`,
      f.services ? `Services : ${f.services}.` : '',
      f.zone ? `Zone : ${f.zone}.` : '',
      f.horaires ? `Horaires : ${f.horaires}.` : '',
      f.prix ? `Tarifs : ${f.prix}.` : '',
    ].filter(Boolean);
    text = parts.join(' ');
  }
  text = text.slice(0, GBP_DESCRIPTION_MAX);
  const missing = (['services', 'zone', 'horaires'] as const).filter((k) => !f[k]);
  return {
    ok: true,
    text: `Description de fiche Google (${text.length} caractères sur ${GBP_DESCRIPTION_MAX} autorisés), rédigée à partir de votre fiche de vérité${task ? ` (tâche « ${task.title} »)` : ''}.${missing.length ? ` À compléter dans la fiche de vérité : ${missing.join(', ')}.` : ''} Google refuse les liens, les prix promotionnels en majuscules et les superlatifs non prouvés.`,
    deliverables: [{ type: 'text', label: `Description de fiche Google (${GBP_DESCRIPTION_MAX} caractères max)`, content: text }],
    data: { length: text.length, max: GBP_DESCRIPTION_MAX, fromTask: task?.title ?? null },
  };
}

// ---------------------------------------------------------------------------
// Export CSV de la part de voix (total et par IA)
// ---------------------------------------------------------------------------

export function shareOfVoiceCsv(c: CopilotContext): { csv: string; rows: number } | null {
  const a = c.latest;
  if (!a) return null;
  const s = auditStats(a);
  const ms = scoredMentions(a).filter((m) => !isBrandQuery(a.queries.find((q) => q.id === m.queryId)));
  const providers = s.providers;
  const per = (name: string, isMe: boolean, p: ProviderId) =>
    ms.filter((m) => m.provider === p && (isMe ? m.mentioned : m.competitors.some((n) => fold(n) === fold(name)))).length;
  const cell = (x: string) => (/[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const lines = [
    ['rang', 'acteur', 'citations', 'part_de_voix', ...providers.map((p) => `citations_${p}`), 'vous'].join(';'),
    ...s.rows.map((r) => [String(r.pos), cell(r.name), String(r.mentions), r.share.toFixed(3).replace('.', ','), ...providers.map((p) => String(per(r.name, r.isMe, p))), r.isMe ? 'oui' : 'non'].join(';')),
  ];
  return { csv: lines.join('\n'), rows: s.rows.length };
}

// ---------------------------------------------------------------------------
// Plan sur 3 mois (tâches réelles réparties)
// ---------------------------------------------------------------------------

const MONTH_OF: Partial<Record<ExecTask['kind'], 1 | 2 | 3>> = {
  fact_fix: 1,
  gbp_profile: 1,
  schema: 1,
  faq_page: 1,
  bing_places: 1,
  review_request: 1,
  directory: 2,
  product_feed: 2,
  source_outreach: 3,
  content: 3,
};

export function quarterPlan(c: CopilotContext): { months: { n: 1 | 2 | 3; tasks: ExecTask[]; minutes: number }[] } {
  const open = openTasks(c);
  const months = ([1, 2, 3] as const).map((n) => ({ n, tasks: [] as ExecTask[], minutes: 0 }));
  for (const t of open) {
    let n = MONTH_OF[t.kind] ?? (t.minutes <= 20 ? 1 : 2);
    // pas plus de 5 tâches par mois : le surplus glisse au mois suivant
    while (n < 3 && months[n - 1].tasks.length >= 5) n = (n + 1) as 1 | 2 | 3;
    months[n - 1].tasks.push(t);
    months[n - 1].minutes += t.minutes;
  }
  return { months };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export function draft(c: CopilotContext, kind: DeliverableKind, context = ''): DraftResult {
  switch (kind) {
    case 'faq': {
      const items = buildFaqItems(c);
      if (items.length < 3) return { ok: false, text: `Il me faut au moins 3 informations de votre fiche de vérité pour une FAQ fiable (elle en contient ${Object.keys(c.facts.facts).length}).`, deliverables: [], data: { items: items.length } };
      return {
        ok: true,
        text: `FAQ de ${items.length} questions/réponses tirées de votre fiche de vérité, en HTML et en balisage FAQPage (JSON-LD).`,
        deliverables: [
          { type: 'html', label: 'FAQ (HTML)', content: faqHtml(items) },
          { type: 'jsonld', label: 'Balisage FAQPage (JSON-LD)', content: faqJsonLd(items) },
        ],
        data: { items },
      };
    }
    case 'review_reply': {
      const r = reviewReply(c, context);
      return { ok: r.deliverables.length > 0, text: r.content, deliverables: r.deliverables, data: {} };
    }
    case 'content_brief': {
      const gaps = lostQueries(c);
      const wanted = context ? gaps.find((g) => norm(g.text).includes(norm(context))) ?? null : null;
      const gap = wanted ?? gaps[0];
      if (!gap) return { ok: false, text: 'Je n’ai pas de question perdue dans votre audit pour bâtir un brief.', deliverables: [], data: {} };
      const b = buildBrief(c, gap);
      return { ok: true, text: `Brief « ${b.title} » (${FORMAT_LABEL[b.format]}), pour la question « ${gap.text} ».`, deliverables: [{ type: 'text', label: `Brief de contenu : ${b.title}`, content: briefMarkdown(b) }], data: { brief: b } };
    }
    case 'content_ideas': {
      const gaps = lostQueries(c).filter((g) => g.cited < g.answers).slice(0, 3);
      if (!gaps.length) return { ok: false, text: 'Vous êtes cité sur toutes les questions de l’audit : pas d’article prioritaire à en déduire.', deliverables: [], data: {} };
      const briefs = gaps.map((g) => buildBrief(c, g));
      return {
        ok: true,
        text: `${plural(briefs.length, 'sujet', 'sujets')} tiré${briefs.length > 1 ? 's' : ''} des questions où les IA ne vous citent pas.`,
        deliverables: [{ type: 'text', label: `Brief de contenu : ${briefs[0].title}`, content: briefMarkdown(briefs[0]) }],
        data: { gaps, briefs },
      };
    }
    case 'outreach_email':
      return outreachEmail(c, context || undefined);
    case 'gbp_description':
      return gbpDescription(c);
    case 'export_csv': {
      const r = shareOfVoiceCsv(c);
      if (!r) return { ok: false, text: 'Pas encore d’audit : rien à exporter.', deliverables: [], data: {} };
      return {
        ok: true,
        text: `Part de voix de ${plural(r.rows, 'acteur', 'acteurs')} (audit du ${frDate(c.latest!.createdAt)}), au format CSV (séparateur point-virgule, lisible par Excel).`,
        deliverables: [{ type: 'csv', label: `Part de voix — ${c.business.name} — ${c.latest!.createdAt.slice(0, 10)}.csv`, content: r.csv }],
        data: { rows: r.rows },
      };
    }
    case 'quarter_plan': {
      const p = quarterPlan(c);
      const n = p.months.reduce((s, m) => s + m.tasks.length, 0);
      if (!n) return { ok: false, text: 'Aucune tâche ouverte : le prochain audit en proposera de nouvelles.', deliverables: [], data: {} };
      const md = p.months
        .filter((m) => m.tasks.length)
        .map((m) => [`Mois ${m.n} (${m.minutes} min au total)`, ...m.tasks.map((t) => `- [ ] ${t.title} (${t.minutes} min)`)].join('\n'))
        .join('\n\n');
      return { ok: true, text: `Plan sur 3 mois : ${plural(n, 'tâche', 'tâches')} ouvertes réparties.`, deliverables: [{ type: 'text', label: 'Plan sur 3 mois (liste à cocher)', content: md }], data: { months: p.months.map((m) => ({ n: m.n, minutes: m.minutes, tasks: m.tasks.map((t) => ({ title: t.title, minutes: t.minutes, kind: t.kind })) })) } };
    }
  }
}
