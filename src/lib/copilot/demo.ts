/**
 * Mode sans clé (ou plafond atteint) : réponses scriptées, calculées à partir des VRAIES données du compte
 * (audit, sources, fiche de vérité, tâches, trafic).
 *
 * Règle anti-hallucination : aucun chiffre, aucun nom, aucune promesse qui ne vienne des données du compte.
 * Quand une donnée manque, la réponse le dit (« je n'ai pas cette donnée ») et indique comment l'obtenir.
 * Les chiffres de rang, citations et réponses viennent TOUS de `auditStats` (src/lib/digest/stats.ts).
 */
import type { ProviderId } from '@/lib/engine';
import type { AiEngine, BrandFactField, ExecTask } from '@/lib/engine/types-v2';
import { PROVIDER_LABEL } from '@/lib/alerts';
import { compareFact, FACT_LABELS } from '@/lib/facts';
import { auditStats, providerBreakdown } from '@/lib/digest/stats';
import { buildFaq } from '@/lib/execution/jsonld';
import { buildComparisonPage, buildProductSheets } from '@/lib/execution/content';
import { competitorNotes } from '@/lib/execution/tasks';
import { draftReviewReply, ratingIn, reviewTone, type ReviewTone } from '@/lib/execution/reviews';
import { plural } from '@/lib/text';
import { frDate, type CopilotContext } from './context';
import { providerIn } from './entities';
import type { CopilotIntent, Deliverable, ScriptedAnswer } from './types';

export type { CopilotIntent, Deliverable, ScriptedAnswer };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/ /g, ' ');
const fmtEur = (n: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n).replace(/ /g, ' ')} €`;
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const pct1 = (x: number) => String(Math.round(x * 1000) / 10).replace('.', ',');

function header(c: CopilotContext): string {
  const a = c.latest;
  const when = a ? `D'après l'audit du ${frDate(a.measuredAt ?? a.createdAt)}` : 'Sans audit disponible pour l’instant';
  return `${when}${c.demo ? ' (données de démonstration)' : ''} :`;
}

function providerInQuestion(q: string): ProviderId | null {
  const p = providerIn(q);
  return p === 'copilot' ? null : p;
}

const ENGINE_LABEL: Record<AiEngine, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', copilot: 'Copilot', claude: 'Claude', other_ai: 'autres IA' };

/** Tâches ouvertes, par priorité : correction d'erreur d'abord, puis impact sur temps. */
export function openTasks(c: CopilotContext): ExecTask[] {
  const prio = (t: ExecTask) => (t.kind === 'fact_fix' ? 1000 : 0) + (t.impact * t.impact * 10) / Math.max(5, t.minutes);
  return c.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').sort((a, b) => prio(b) - prio(a));
}

// ---------------------------------------------------------------------------
// 1. Pourquoi X passe devant moi ?
// ---------------------------------------------------------------------------

export function whyCompetitor(c: CopilotContext, question: string): ScriptedAnswer {
  const a = c.latest;
  if (!a || !a.competitors.length) {
    return { intent: 'why_competitor', content: `${header(c)} je n'ai pas encore de concurrent cité par les IA à comparer avec vous.`, deliverables: [] };
  }
  const s = auditStats(a);
  const q = norm(question);
  const others = s.rows.filter((r) => !r.isMe);
  const byName = others.find((x) => q.includes(norm(x.name)));
  const ahead = others.filter((r) => r.mentions > s.citations);
  const comp = byName ?? (a.gaps?.[0] ? others.find((x) => norm(x.name) === norm(a.gaps![0].competitor)) : undefined) ?? ahead[0] ?? others[0];
  const lines: string[] = [header(c), ''];
  if (comp.mentions <= s.citations) {
    lines.push(`**${comp.name}** ne passe pas devant vous : ${plural(comp.mentions, 'citation', 'citations')} contre ${s.citations} pour vous (${s.methodLabel}).`);
    if (ahead.length) lines.push(`Ceux qui passent devant : ${ahead.map((r) => `${r.name} (${r.mentions})`).join(', ')}.`);
    return { intent: 'why_competitor', content: lines.join('\n'), deliverables: [] };
  }
  lines.push(`**${comp.name}** est cité ${comp.mentions} fois, vous ${s.citations} fois, sur les mêmes ${s.answers} réponses (${s.methodLabel}).`);

  // Mêmes réponses que le classement (la somme par IA redonne ${comp.mentions} contre ${s.citations}).
  const perProvider = providerBreakdown(a, comp.name).map((x) => `${PROVIDER_LABEL[x.provider]} : ${x.him} contre ${x.me}`);
  if (perProvider.length) lines.push(`Par IA (${comp.name} contre vous) : ${perProvider.join(' ; ')}.`);

  const gap = a.gaps?.find((g) => norm(g.competitor) === norm(comp.name));
  const presentOn =
    gap?.presentOn ??
    (a.sources?.domains ?? [])
      .filter((d) => d.clientPresence !== 'present' && d.competitorsPresent.some((n) => norm(n) === norm(comp.name)))
      .map((d) => d.domain);
  lines.push('', '**Ce qui l’explique, d’après les données :**');
  if (presentOn.length) lines.push(`- Il est présent sur des sources que les IA citent et pas vous : ${presentOn.slice(0, 5).join(', ')}.`);
  // le décompte est déjà donné plus haut (même base que le classement) : on ne répète pas celui du moteur
  const reasons = (gap?.reasons ?? []).filter((r) => !/^Cité (dans )?\d+ (fois|réponses?)/i.test(r) && !/^Présent sur /.test(r));
  for (const r of reasons) lines.push(`- ${r}`);
  if (!presentOn.length && !reasons.length) lines.push('- Je n’ai pas de donnée de sources ou d’avis assez précise pour l’expliquer ; l’écart porte sur le nombre de citations.');

  const opps = (a.sources?.opportunities ?? []).filter((o) => presentOn.includes(o.domain) || o.competitorsPresent.some((n) => norm(n) === norm(comp.name)));
  const tasks = opps.slice(0, 2).map((o) => `${o.action} (effort ${o.effort})`);
  const todo = openTasks(c).slice(0, 3 - tasks.length).map((t) => `${t.title} (${t.minutes} min)`);
  lines.push('', '**Tâches proposées (à ajouter à votre plan) :**', ...[...tasks, ...todo].slice(0, 3).map((t, i) => `${i + 1}. ${t}`));
  lines.push('', 'Ces actions augmentent vos chances d’être cité ; le résultat dépend des IA et n’est pas garanti.');
  return { intent: 'why_competitor', content: lines.join('\n'), deliverables: [] };
}

// ---------------------------------------------------------------------------
// 2. Écris-moi la FAQ (questions factuelles, sans question de classement ni réponse répétée)
// ---------------------------------------------------------------------------

const RANKING_Q = /(meilleur|lequel|laquelle|choisir|conseiller un bon|recommand|\btop\b|le plus)/i;

export function buildFaqItems(c: CopilotContext): { q: string; a: string }[] {
  const n = c.business.name;
  const f = c.facts.facts;
  const base = buildFaq(c.latest ?? { input: { businessName: n, trade: c.business.trade, city: c.business.city, segment: c.segment } as never }, c.facts, c.business);
  const extra: { q: string; a: string }[] = [];
  if (f.dirigeant) extra.push({ q: `Qui dirige ${n} ?`, a: `${n} est dirigé par ${f.dirigeant}.` });
  if (f.site && !base.some((i) => i.a.includes(f.site!))) extra.push({ q: `Quel est le site officiel de ${n} ?`, a: `Le site officiel est ${f.site}.` });
  if (f.zone && c.segment !== 'local' && !base.some((i) => i.a.includes(f.zone!))) extra.push({ q: `Où ${n} est-il disponible ?`, a: `${f.zone}.` });
  const out: { q: string; a: string }[] = [];
  const seen = new Set<string>();
  for (const i of [...base, ...extra]) {
    if (RANKING_Q.test(i.q)) continue;
    const k = norm(i.a).replace(/[^a-z0-9]/g, '');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out.slice(0, 12);
}

export function faqHtml(items: { q: string; a: string }[]): string {
  return [
    '<section class="faq" id="faq">',
    '  <h2>Questions fréquentes</h2>',
    ...items.map((i) => `  <details>\n    <summary>${esc(i.q)}</summary>\n    <p>${esc(i.a)}</p>\n  </details>`),
    '</section>',
  ].join('\n');
}

export function faqJsonLd(items: { q: string; a: string }[]): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
    null,
    2,
  );
}

export function faq(c: CopilotContext): ScriptedAnswer {
  const items = buildFaqItems(c);
  if (items.length < 3) {
    return {
      intent: 'faq',
      content: `Pour écrire une FAQ fiable, il me faut au moins 3 informations de votre fiche de vérité (horaires, prix, services, zone…). Elle en contient ${Object.keys(c.facts.facts).length} : complétez-la dans l’onglet Vérité, puis redemandez-moi.`,
      deliverables: [],
    };
  }
  const content = [
    `Voici ${items.length} questions/réponses tirées de votre fiche de vérité${c.demo ? ' (données de démonstration)' : ''}. Uniquement des questions factuelles : pas de « quel est le meilleur… », que Google peut considérer comme autopromotionnel dans un balisage FAQ.`,
    '',
    ...items.map((i) => `**${i.q}**\n${i.a}`),
    '',
    'À faire : collez le HTML sur une page de votre site (ou utilisez la page FAQ hébergée), et le JSON-LD dans une balise <script type="application/ld+json"> de cette même page. Ajoutez 2 ou 3 questions que vos clients vous posent vraiment. Relisez chaque réponse avant publication.',
  ].join('\n');
  return {
    intent: 'faq',
    content,
    deliverables: [
      { type: 'html', label: 'FAQ (HTML)', content: faqHtml(items) },
      { type: 'jsonld', label: 'Balisage FAQPage (JSON-LD)', content: faqJsonLd(items) },
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. Que dit ChatGPT de mes prix ?
// ---------------------------------------------------------------------------

export function prices(c: CopilotContext, question: string): ScriptedAnswer {
  const a = c.latest;
  const p = providerInQuestion(question);
  const who = p ? PROVIDER_LABEL[p] : 'les IA';
  const expected = c.facts.facts.prix;
  const lines = [header(c), ''];
  const claims = (a?.perception?.claims ?? []).filter((cl) => cl.field === 'prix' && (!p || cl.provider === p));
  const quotes = (a?.perception?.quotes ?? []).filter((q) => (!p || q.provider === p) && /prix|tarif|€|euro|cher|abordable|co[uû]t/i.test(q.text));
  // E-commerce : erreurs de prix relevées sur le catalogue (même liste que Prix et avis, dédoublonnée).
  const catalogue = (c.factCheck?.items ?? []).filter((i) => i.source === 'catalogue' && i.verdict === 'faux' && (!p || i.provider === p));
  if (!claims.length && !quotes.length && !catalogue.length) {
    lines.push(`${who} ne mentionne${p ? '' : 'nt'} pas vos prix dans les réponses analysées. Je n'ai pas d'autre donnée sur ce point.`);
    if (expected) lines.push('', `Pour que vos tarifs (« ${expected} ») soient repris, publiez-les sur votre site et dans votre FAQ, avec le balisage schema.org.`);
    return { intent: 'prices', content: lines.join('\n'), deliverables: [] };
  }
  // Un même verbatim (souvent repris par plusieurs IA ou pour plusieurs valeurs) n'est affiché qu'une fois.
  const tagOf = (value: string) => {
    const verdict = expected ? compareFact('prix', expected, value) : 'non_verifiable';
    return verdict === 'correct' ? 'conforme à votre fiche' : verdict === 'faux' ? 'FAUX par rapport à votre fiche' : verdict === 'incomplet' ? 'incomplet' : 'non vérifiable (fiche de vérité sans prix)';
  };
  const groups = new Map<string, { quote: string; providers: string[]; values: { value: string; tag: string }[] }>();
  for (const cl of claims) {
    const k = norm(cl.quote || cl.value);
    const g = groups.get(k) ?? { quote: cl.quote, providers: [], values: [] };
    const label = PROVIDER_LABEL[cl.provider];
    if (!g.providers.includes(label)) g.providers.push(label);
    if (!g.values.some((v) => norm(v.value) === norm(cl.value))) g.values.push({ value: cl.value, tag: tagOf(cl.value) });
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    const vals = g.values.map((v) => `« ${v.value} » — ${v.tag}`).join(' ; ');
    lines.push(`- ${g.providers.join(', ')} : ${vals}${g.quote ? `\n  Verbatim : « ${g.quote} »` : ''}`);
  }
  for (const i of catalogue) lines.push(`- ${PROVIDER_LABEL[i.provider]} : « ${i.stated} » — FAUX par rapport à votre catalogue (${i.expected})`);
  const shown = new Set([...groups.keys()]);
  const extra = quotes.filter((q) => {
    const k = norm(q.text);
    if (shown.has(k)) return false;
    shown.add(k);
    return true;
  });
  for (const q of extra.slice(0, 3)) lines.push(`- ${PROVIDER_LABEL[q.provider]} (« ${q.query} », ton ${q.sentiment}) : « ${q.text} »`);
  if (expected) lines.push('', `Votre fiche de vérité indique : « ${expected} ».`);
  if (catalogue.length || claims.some((cl) => expected && compareFact('prix', expected, cl.value) === 'faux')) {
    const fix = c.tasks.find((t) => t.kind === 'fact_fix' && t.status !== 'done');
    const where = c.segment === 'local' ? 'votre site, votre fiche Google et votre FAQ balisée' : c.segment === 'pme' ? 'votre page Tarifs, votre FAQ et vos profils G2 et Capterra' : 'vos fiches produits, votre FAQ et votre flux Merchant Center';
    lines.push('', `**Tâche proposée :** mettre à jour vos prix sur ${where}${fix ? ` (tâche « ${fix.title} », ${fix.minutes} min)` : ''}. La correction par l’IA n’est pas garantie et peut prendre plusieurs semaines.`);
  }
  return { intent: 'prices', content: lines.join('\n'), deliverables: [] };
}

// ---------------------------------------------------------------------------
// 4. Réponds à cet avis (tonalité détectée)
// ---------------------------------------------------------------------------

const TONE_LABEL: Record<ReviewTone, string> = { positif: 'positif', mitige: 'mitigé (un point positif, une critique)', negatif: 'critique' };

export function reviewReply(c: CopilotContext, question: string): ScriptedAnswer {
  // Texte de l'avis : entre guillemets, après « : », ou rapporté (« … en disant que la facture était plus chère que le devis »).
  const m =
    question.match(/[«"“]([\s\S]+?)[»"”]/) ??
    question.match(/:\s*([\s\S]+)$/) ??
    question.match(/\b(?:en (?:disant|écrivant|ecrivant|expliquant|se plaignant)|qui (?:dit|écrit|ecrit|explique)|il (?:dit|écrit|ecrit)|elle (?:dit|écrit|ecrit))\s+(?:que\s+|qu[’'])?([\s\S]+?)(?:[.!?]\s+(?:[ÉEé]cri|R[ée]dig|R[ée]pond|Propose|Aide)[\s\S]*)?$/i);
  const review = (m?.[1] ?? '').replace(/^[\s.…]+|[\s.…]+$/g, '').trim();
  const rating = ratingIn(question);
  const signature = c.facts.facts.dirigeant ? `${c.facts.facts.dirigeant}, ${c.business.name}` : `L’équipe ${c.business.name}`;
  const contact = c.facts.facts.telephone ?? c.facts.facts.site;
  if (!review || review.length < 4) {
    return {
      intent: 'review_reply',
      content: 'Collez le texte de l’avis entre guillemets (et sa note si vous l’avez : « 3 étoiles »), par exemple : Réponds à cet avis 3 étoiles : « Intervention correcte mais délai trop long. » Je rédige une réponse adaptée à son ton.',
      deliverables: [],
    };
  }
  const tone = reviewTone(review, rating);
  const text = draftReviewReply({ rating: rating ?? 0, text: review }, { businessName: c.business.name, contact, signature });
  const notes =
    tone === 'mitige'
      ? 'Complétez la phrase entre crochets par ce qui change réellement (ou supprimez-la) : une promesse non tenue se retourne contre vous.'
      : tone === 'negatif'
        ? 'Restez factuel, sans contester publiquement ; proposez un échange direct.'
        : 'Ajoutez si possible un détail précis de la prestation : une réponse personnalisée est plus crédible.';
  return {
    intent: 'review_reply',
    content: [
      `Avis ${TONE_LABEL[tone]}${rating ? ` (${rating} étoile${rating > 1 ? 's' : ''})` : ''}. Voici un brouillon de réponse :`,
      '',
      text,
      '',
      notes,
      'Rappels : répondez sous 48 h, sans donnée personnelle du client ; ne proposez jamais de contrepartie contre un avis et ne sollicitez pas d’avis uniquement auprès des clients satisfaits.',
    ].join('\n'),
    deliverables: [{ type: 'text', label: 'Réponse à coller', content: text }],
  };
}

// ---------------------------------------------------------------------------
// 5. Point pour le comité
// ---------------------------------------------------------------------------

export function committee(c: CopilotContext): ScriptedAnswer {
  const a = c.latest;
  if (!a) return { intent: 'committee', content: 'Je n’ai pas encore d’audit pour préparer ce point.', deliverables: [] };
  const s = auditStats(a);
  const first = c.history[0];
  const errors = c.factCheck?.items.filter((i) => i.verdict === 'faux').length ?? 0;
  const todo = openTasks(c).slice(0, 3);
  const done = c.tasks.filter((t) => t.status === 'done').length;
  const t = c.traffic && (c.traffic.installed || c.traffic.demo) ? c.traffic : null;
  const convLabel = c.segment === 'local' ? 'appels ou e-mails déclenchés' : c.segment === 'pme' ? 'conversions suivies (démo, contact)' : 'commandes';
  const trafficLine = !t
    ? 'Trafic venu des IA : pas encore mesuré (snippet à installer).'
    : t.commerce
      ? `Ventes venues des IA (30 j) : ${plural(t.commerce.orders, 'commande', 'commandes')}, ${fmtEur(t.commerce.revenueEur)} de CA, pour ${fmtInt(t.totals.aiVisits)} visites.`
      : `Trafic venu des IA (30 j) : ${fmtInt(t.totals.aiVisits)} visites, ${fmtInt(t.totals.conversions)} ${convLabel}.`;
  const bullets = [
    `Visibilité IA : ${a.score}/100 au ${frDate(a.createdAt)}${first && first.at !== a.createdAt ? `, contre ${first.score} au ${frDate(first.at)}` : ''} (marge ${a.range.low}–${a.range.high}).`,
    `Position : ${s.label} ; part de voix ${Math.round(s.shareOfVoice * 100)} % des citations (${s.methodLabel}).`,
    `Exactitude : ${errors ? `${plural(errors, 'information fausse', 'informations fausses')} à corriger` : 'aucune erreur détectée sur les informations vérifiées'}.`,
    trafficLine,
    `Actions : ${plural(done, 'faite', 'faites')} ; prochaines : ${todo.map((x) => x.title).join(' ; ') || 'à définir'}.`,
  ];
  // le client toujours en 2ᵉ ligne du tableau (repère du graphique), puis les 8 acteurs les plus cités
  const line = (r: { name: string; mentions: number; share: number }) => `${r.name.replace(/;/g, ',')};${r.mentions};${r.share.toFixed(2).replace('.', ',')}`;
  const meRow = s.rows.find((r) => r.isMe)!;
  const table = ['acteur;citations;part', line(meRow), ...s.rows.filter((r) => !r.isMe).slice(0, 8).map(line)].join('\n');
  return {
    intent: 'committee',
    content: [`Point visibilité IA — ${c.business.name}${c.demo ? ' (démonstration)' : ''}`, '', ...bullets.map((b) => `- ${b}`), '', 'Graphique conseillé : barres de part de voix (tableau ci-joint). Mesure sur échantillon de questions, sans garantie d’évolution.'].join('\n'),
    deliverables: [
      { type: 'text', label: '5 puces pour le comité', content: bullets.map((b) => `• ${b}`).join('\n') },
      { type: 'csv', label: 'Part de voix (tableau)', content: table },
    ],
  };
}

// ---------------------------------------------------------------------------
// 6. Quelle source viser en premier ?
// ---------------------------------------------------------------------------

export function firstSource(c: CopilotContext): ScriptedAnswer {
  const a = c.latest;
  const opps = [...(a?.sources?.opportunities ?? [])].sort((x, y) => y.score - x.score);
  const lines = [header(c), ''];
  if (opps.length) {
    opps.slice(0, 3).forEach((o, i) => {
      lines.push(`${i + 1}. **${o.label}** (${o.domain}) — ${o.action}`);
      lines.push(`   Pourquoi : ${o.why} Effort ${o.effort}, impact ${o.impact}/3${o.competitorsPresent.length ? ` ; concurrents présents : ${o.competitorsPresent.slice(0, 3).join(', ')}` : ''}.`);
      if (o.howTo.length) lines.push(`   Comment : ${o.howTo.slice(0, 3).join(' ; ')}`);
    });
    lines.push('', `Je commencerais par **${opps[0].label}** : c’est le meilleur rapport fréquence de citation / facilité d’accès.`);
  } else {
    const absent = (a?.sources?.domains ?? []).filter((d) => d.clientPresence === 'absent').sort((x, y) => y.citations - x.citations);
    if (absent.length) {
      absent.slice(0, 3).forEach((d, i) => lines.push(`${i + 1}. ${d.label || d.domain} — cité ${d.citations} fois, vous n’y êtes pas.`));
    } else {
      lines.push('Je n’ai pas de données de sources pour cet audit (seules ChatGPT, Perplexity et Claude fournissent les pages citées ; Gemini est utilisé sans ancrage).');
    }
  }
  return { intent: 'first_source', content: lines.join('\n'), deliverables: [] };
}

// ---------------------------------------------------------------------------
// 7. Trafic et ventes venus des IA
// ---------------------------------------------------------------------------

export function traffic(c: CopilotContext, question: string): ScriptedAnswer {
  const t = c.traffic;
  const p = providerInQuestion(question);
  if (!t || (!t.installed && !t.demo)) {
    return {
      intent: 'traffic',
      content: [
        'Je n’ai pas cette donnée : le suivi des visites venues des IA n’est pas encore installé sur votre site.',
        '',
        'Installez le snippet (onglet Trafic IA, 2 minutes) : il compte les visites arrivant de ChatGPT, Perplexity, Gemini, Copilot et Claude, sans cookie.',
        c.segment === 'ecommerce' ? 'Pour les commandes et le CA, connectez Shopify ou GA4 dans le même onglet.' : c.segment === 'local' ? 'Il compte aussi les clics sur votre numéro de téléphone (appels déclenchés).' : '',
      ]
        .filter(Boolean)
        .join('\n'),
      deliverables: [],
    };
  }
  const tot = t.totals;
  const engine = (p ?? null) as AiEngine | null;
  const ev = engine ? (tot.byEngine[engine] ?? 0) : tot.aiVisits;
  const who = engine ? ENGINE_LABEL[engine] : 'les IA';
  const lines: string[] = [`Sur les 30 derniers jours${t.demo ? ' (données de démonstration)' : ''} :`, ''];
  if (engine) {
    lines.push(`- **${who} vous a envoyé ${plural(ev, 'visite', 'visites')}**, soit ${pctOf(ev, tot.aiVisits)} % de vos ${fmtInt(tot.aiVisits)} visites venues des IA (${pct1(tot.aiShare)} % de tout votre trafic).`);
  } else {
    lines.push(`- **${fmtInt(tot.aiVisits)} visites venues des IA**, soit ${pct1(tot.aiShare)} % de tout votre trafic.`);
    const byE = (Object.entries(tot.byEngine) as [AiEngine, number][]).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    if (byE.length) lines.push(`- Par IA : ${byE.map(([e, v]) => `${ENGINE_LABEL[e]} ${fmtInt(v)}`).join(', ')}.`);
  }
  const pages = t.topLandingPages.filter((x) => !engine || x.engine === engine).slice(0, 3);
  if (pages.length) lines.push(`- Pages d’arrivée${engine ? ` depuis ${who}` : ''} : ${pages.map((x) => `${x.path} (${fmtInt(x.visits)})`).join(', ')}.`);

  if (c.segment === 'ecommerce') {
    if (t.commerce) {
      const k = t.commerce;
      const e = engine ? k.byEngine[engine] : null;
      lines.push(
        engine
          ? `- **Ventes attribuées à ${who} : ${plural(e?.orders ?? 0, 'commande', 'commandes')}, ${fmtEur(e?.revenueEur ?? 0)}** (sur ${plural(k.orders, 'commande', 'commandes')} et ${fmtEur(k.revenueEur)} venues de toutes les IA).`
          : `- **Ventes venues des IA : ${plural(k.orders, 'commande', 'commandes')}, ${fmtEur(k.revenueEur)} de CA.**`,
      );
      const best = [...k.products].sort((x, y) => y.revenueEur - x.revenueEur)[0];
      if (best && best.orders) lines.push(`- Produit qui vend le plus depuis les IA : ${best.name} (${plural(best.orders, 'commande', 'commandes')}, ${fmtEur(best.revenueEur)}).`);
      lines.push(`  Source : ${k.source === 'demo' ? 'démonstration' : k.source === 'shopify' ? 'Shopify (commandes dont la session d’arrivée vient d’une IA)' : 'GA4'}.`);
    } else {
      lines.push(`- Je n’ai pas vos commandes : ${plural(tot.conversions, 'conversion suivie', 'conversions suivies')} seulement. Connectez Shopify ou GA4 (onglet Trafic IA) pour voir commandes et CA venus des IA.`);
    }
  } else if (c.segment === 'local') {
    lines.push(`- **${plural(tot.conversions, 'appel ou e-mail déclenché', 'appels ou e-mails déclenchés')}** depuis ces visites (clics sur votre numéro ou votre adresse e-mail).`);
  } else {
    lines.push(`- **${plural(tot.conversions, 'conversion suivie', 'conversions suivies')}** (demandes de démo, contacts) depuis ces visites.`);
  }
  lines.push('', 'C’est un plancher : une partie des visites venues des IA arrive sans référent et n’est pas attribuable.');
  return { intent: 'traffic', content: lines.join('\n'), deliverables: [] };
}

// ---------------------------------------------------------------------------
// 8. Que faire cette semaine (en N minutes) ?
// ---------------------------------------------------------------------------

export function weeklyPlan(c: CopilotContext, question: string): ScriptedAnswer {
  const budget = Number(/(\d{1,3})\s*(?:min|minutes)\b/.exec(norm(question))?.[1] ?? 0) || null;
  const open = openTasks(c);
  if (!open.length) return { intent: 'weekly_plan', content: 'Aucune tâche ouverte : votre plan est à jour. Le prochain audit en proposera de nouvelles.', deliverables: [] };
  let pick: ExecTask[] = [];
  if (budget) {
    let left = budget;
    for (const t of open) {
      if (pick.length >= 3) break;
      if (t.minutes <= left) {
        pick.push(t);
        left -= t.minutes;
      }
    }
    if (!pick.length) pick = [[...open].sort((a, b) => a.minutes - b.minutes)[0]];
  } else pick = open.slice(0, 3);
  const total = pick.reduce((s, t) => s + t.minutes, 0);
  const lines = [`${budget ? `En ${budget} minutes` : 'Cette semaine'}, je vous propose ${plural(pick.length, 'tâche', 'tâches')} (${total} min au total)${c.demo ? ' — données de démonstration' : ''} :`, ''];
  pick.forEach((t, i) => {
    lines.push(`${i + 1}. **${t.title}** — ${t.minutes} min`);
    lines.push(`   Pourquoi : ${t.why}`);
    const d = t.deliverable?.[0];
    if (d) lines.push(`   Livrable prêt : ${d.label ?? 'texte à copier'} (Centre d’actions).`);
  });
  if (budget && total > budget) lines.push('', `La tâche la plus courte dépasse ${budget} minutes : commencez-la, elle se termine en deux fois.`);
  const fix = pick.find((t) => t.kind === 'fact_fix');
  if (fix) lines.push('', 'La correction d’erreur passe en premier : une IA qui donne une mauvaise information vous coûte des clients dès maintenant.');
  const first = pick[0];
  return {
    intent: 'weekly_plan',
    content: lines.join('\n'),
    deliverables: first?.deliverable?.[0] ? [{ type: first.deliverable[0].type === 'html' ? 'html' : first.deliverable[0].type === 'jsonld' ? 'jsonld' : 'text', label: `${first.title} — ${first.deliverable[0].label ?? 'livrable'}`, content: first.deliverable[0].content }] : [],
  };
}

// ---------------------------------------------------------------------------
// 9. Page comparatif (rédigée)
// ---------------------------------------------------------------------------

/**
 * Ce qui est publiquement vérifiable sur un concurrent dans les données du compte : les sources citées par les IA où
 * il apparaît (et si vous y êtes), la façon dont les IA le décrivent. Rien d'autre (prix, offre : « à compléter »).
 */
export function competitorPublicRows(
  c: CopilotContext,
  name: string,
  gap?: { presentOn: string[]; reasons: string[] } | null,
): { label: string; mine: string | null; them: { value: string; source: string } }[] {
  const a = c.latest;
  const n = norm(name);
  const domains = a?.sources?.domains ?? [];
  const his = [...new Set([...(gap?.presentOn ?? []), ...domains.filter((d) => d.competitorsPresent.some((x) => norm(x) === n)).map((d) => d.domain)])].slice(0, 4);
  const rows: { label: string; mine: string | null; them: { value: string; source: string } }[] = [];
  if (his.length) {
    const mine = his.filter((dom) => domains.find((d) => d.domain === dom)?.clientPresence === 'present');
    rows.push({
      label: 'Présent sur les sources citées par les IA',
      mine: mine.length ? mine.join(', ') : `absent de ${his.length > 1 ? 'ces sources' : 'cette source'}`,
      them: { value: his.join(', '), source: 'sources citées par les IA' },
    });
  }
  const descs = (gap?.reasons ?? []).map((r) => /décrit ainsi : « (.+?) »/.exec(r)?.[1]).filter((x): x is string => Boolean(x));
  if (descs.length) rows.push({ label: 'Décrit par les IA comme', mine: null, them: { value: descs.slice(0, 2).map((d) => `« ${d} »`).join(', '), source: 'réponses des IA' } });
  return rows;
}

export function comparison(c: CopilotContext, question: string): ScriptedAnswer {
  const a = c.latest;
  const s = a ? auditStats(a) : null;
  const known = s?.rows.filter((r) => !r.isMe) ?? [];
  const q = norm(question);
  let name = known.find((r) => q.includes(norm(r.name)))?.name ?? null;
  if (!name) {
    const m = /(?:\bvs\.?|versus|face à|face a|alternative à|alternative a|contre)\s+([A-ZÀ-Ý0-9][\w&'’.+-]*(?:\s+[A-ZÀ-Ý&][\w&'’.+-]*)*)/.exec(question);
    if (m && norm(m[1]) !== norm(c.business.name)) name = m[1].trim();
  }
  const gapName = a?.gaps?.find((g) => s && (s.rows.find((r) => r.name === g.competitor)?.mentions ?? 0) > s.citations)?.competitor;
  name = name ?? gapName ?? known[0]?.name ?? null;
  if (!name) return { intent: 'comparison', content: 'Dites-moi avec quel concurrent comparer (« page comparatif vs NomDuConcurrent ») : votre audit ne cite aucun concurrent pour l’instant.', deliverables: [] };
  const inData = known.find((r) => norm(r.name) === norm(name!));
  const gap = a?.gaps?.find((g) => norm(g.competitor) === norm(name!));
  // Même gabarit que le Centre d'actions : aucune donnée d'audit (« cité 39 fois contre 18 ») dans la page publique.
  const notes = gap ? competitorNotes(gap) : [];
  const auditLine = inData && s ? `Dans votre audit, ${name} est cité ${inData.mentions} fois contre ${s.citations} pour ${c.business.name} (donnée interne : elle n’est pas dans la page).` : '';
  const activity = (a?.input as { category?: string } | undefined)?.category || (c.segment === 'ecommerce' ? (a?.input.productCategories?.[0] ?? c.business.trade) : c.business.trade);
  const page = buildComparisonPage({
    name: c.business.name,
    segment: c.segment,
    activity,
    offering: (a?.input as { offering?: string } | undefined)?.offering,
    facts: c.facts.facts,
    competitor: name,
    competitorNotes: notes,
    date: new Date().toISOString(),
    extraRows: competitorPublicRows(c, name, gap),
  });
  return {
    intent: 'comparison',
    content: [
      `Voici la page « ${page.title} », rédigée à partir de votre fiche de vérité${inData ? ' et de ce que les IA disent de ' + name : ''}${c.demo ? ' (données de démonstration)' : ''}. Les cellules du concurrent reprennent ce qui est publiquement relevé (sources citées par les IA, descriptions), avec la date ; les autres sont marquées « à compléter ».`,
      inData ? auditLine : `Je n’ai aucune donnée sur ${name} dans votre audit : tout ce qui le concerne est marqué « [à vérifier sur leur site] ».`,
      '',
      page.markdown,
      '',
      'Avant publication : remplissez chaque cellule « à compléter » et revérifiez les autres sur leurs pages publiques, et complétez honnêtement « Pour qui choisir ». Un comparatif qui reconnaît les points forts de l’autre est plus crédible, pour vos lecteurs comme pour les IA.',
    ]
      .filter((x, i, arr) => !(x === '' && arr[i - 1] === ''))
      .join('\n'),
    deliverables: [
      { type: 'text', label: 'Page comparatif (Markdown)', content: page.markdown },
      { type: 'html', label: 'Page comparatif (HTML)', content: page.html },
    ],
  };
}

// ---------------------------------------------------------------------------
// 10. Quelles fiches produits corriger en premier ?
// ---------------------------------------------------------------------------

/** Produit du catalogue nommé dans la question (« Onde », « shampoing Onde »), sinon null. */
export function productInQuestion(c: CopilotContext, question: string): import('@/lib/ecommerce/types').CatalogProduct | null {
  const q = ` ${norm(question).replace(/[^a-z0-9]+/g, ' ')} `;
  const clean = (x: string) => norm(x).replace(/[^a-z0-9]+/g, ' ').trim();
  let best: { p: import('@/lib/ecommerce/types').CatalogProduct; len: number } | null = null;
  for (const p of c.catalog ?? []) {
    const cat = clean(p.category ?? '');
    const names = [p.name, ...(p.aliases ?? [])].map(clean).filter(Boolean);
    // le nom propre du produit (« onde ») = le nom moins sa catégorie
    const own = names.map((n) => (cat ? n.replace(cat, '').trim() : n)).filter((n) => n.length >= 3);
    for (const n of [...names, ...own]) if (q.includes(` ${n} `) && (!best || n.length > best.len)) best = { p, len: n.length };
  }
  return best?.p ?? null;
}

export function productPages(c: CopilotContext, question = ''): ScriptedAnswer {
  const a = c.latest;
  const named = productInQuestion(c, question);
  const stats = c.products ?? [];
  const cats = (a?.input.productCategories?.length ? a.input.productCategories : (c.facts.facts.produits ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean)).slice(0, 6);
  if (!a || (!stats.length && !cats.length && !named)) {
    return {
      intent: 'product_pages',
      content: 'Je n’ai pas la liste de vos produits : ajoutez vos fiches produit dans l’onglet Produits (ou vos catégories phares dans votre fiche de vérité).',
      deliverables: [],
    };
  }
  const sheetFor = (p: import('@/lib/ecommerce/types').CatalogProduct | string) =>
    buildProductSheets({
      name: c.business.name,
      website: c.facts.facts.site ?? c.business.website,
      facts: c.facts.facts,
      products: [typeof p === 'string' ? p : { name: p.name, category: p.category, description: p.description, price: p.price, gtin: p.gtin, sku: p.sku, url: p.url }],
      city: c.business.city,
    })[0];
  const lines = [header(c), ''];
  let target: import('@/lib/ecommerce/types').CatalogProduct | string;
  if (named) {
    // « Réécris la fiche de mon shampoing Onde » : la fiche de CE produit.
    const st = stats.find((x) => x.productId === named.id);
    lines.push(
      st && st.answers
        ? `**${named.name}** apparaît dans ${st.appearances} réponse${st.appearances > 1 ? 's' : ''} sur ${st.answers} (réponses qui portent sur sa catégorie, comme dans l’onglet Produits).`
        : `**${named.name}** : aucune réponse de l’audit ne porte sur sa catégorie, je ne peux pas mesurer sa présence.`,
    );
    target = named;
  } else if (stats.length) {
    // Mêmes chiffres que l'écran Produits : présence du PRODUIT dans les réponses de sa catégorie.
    const ranked = [...stats].sort((x, y) => y.answers - y.appearances - (x.answers - x.appearances) || y.answers - x.answers);
    lines.push('Vos produits, du plus absent au plus présent (réponses qui portent sur leur catégorie, mêmes chiffres que l’onglet Produits) :', '');
    ranked.forEach((r, i) => {
      if (!r.answers) {
        lines.push(`${i + 1}. **${r.name}** — aucune réponse de l’audit ne porte sur sa catégorie : je ne peux pas le classer.`);
        return;
      }
      const instead = r.recommendedInstead[0];
      lines.push(
        `${i + 1}. **${r.name}** — absent de ${r.answers - r.appearances} réponse${r.answers - r.appearances > 1 ? 's' : ''} sur ${r.answers} (présent dans ${r.appearances})${instead ? ` ; ${instead.label} y est recommandé ${plural(instead.count, 'fois', 'fois')} à sa place` : ''}.`,
      );
    });
    const top = ranked.find((r) => r.answers) ?? ranked[0];
    target = (c.catalog ?? []).find((p) => p.id === top.productId) ?? top.name;
    lines.push('', `**Je commencerais par « ${typeof target === 'string' ? target : target.name} »** : voici sa fiche enrichie.`);
  } else {
    lines.push(`Je n’ai pas encore votre catalogue suivi : je raisonne par catégorie (${cats.join(', ')}). Ajoutez vos fiches dans l’onglet Produits pour une fiche par produit.`);
    target = cats[0];
  }
  const sheet = sheetFor(target);
  lines.push('', sheet.text);
  if (sheet.faq.length) lines.push('', '**FAQ produit**', ...sheet.faq.map((x) => `- ${x.q} ${x.a}`));
  if (sheet.missing.length) lines.push('', `Il manque, pour une fiche qui vend : ${sheet.missing.join(' ; ')}.`);
  const label = typeof target === 'string' ? target : target.name;
  return {
    intent: 'product_pages',
    content: lines.join('\n'),
    deliverables: [
      { type: 'text', label: `Fiche ${label} (texte)`, content: sheet.text },
      { type: 'jsonld', label: 'Balisage Product, Offer et FAQ produit', content: JSON.stringify(sheet.jsonLd, null, 2) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Repli : ce que je sais faire, selon le parcours
// ---------------------------------------------------------------------------

export function otherV2(c: CopilotContext): ScriptedAnswer {
  const a = c.latest;
  const s = a ? auditStats(a) : null;
  const ideas =
    c.segment === 'local'
      ? ['Ce que je fais cette semaine en 20 minutes', 'Combien de clients m’a envoyé ChatGPT', 'Pourquoi un concurrent passe devant moi', 'Répondre à un avis (collez-le entre guillemets)', 'Écrire ma FAQ', 'Quelle source viser en premier']
      : c.segment === 'pme'
        ? ['Pourquoi un concurrent passe devant nous', 'Écrire une page comparatif face à un concurrent', 'Préparer le point pour le comité', 'Combien de visites et de conversions viennent des IA', 'Ce que ChatGPT dit de nos prix', 'Quelle source viser en premier']
        : ['Combien de ventes viennent de ChatGPT', 'Quelles fiches produits corriger en premier', 'Pourquoi une marque est recommandée et pas moi', 'Écrire ma FAQ (livraison, retours, composition)', 'Répondre à un avis client', 'Quelle source viser en premier'];
  const lines = [
    a && s ? `${header(c)} votre score est de ${a.score}/100 (${s.label}).` : 'Je n’ai pas encore d’audit pour vous répondre précisément.',
    '',
    'Je réponds à partir de vos données uniquement. Vous pouvez par exemple me demander :',
    ...ideas.map((x) => `- ${x}`),
  ];
  return { intent: 'other', content: lines.join('\n'), deliverables: [] };
}

/** Libellé lisible d'un champ de la fiche (réexport pratique). */
export const factLabel = (f: BrandFactField) => FACT_LABELS[f];
