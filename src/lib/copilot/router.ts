/**
 * Routeur d'intention du mode démo (sans clé, plafond atteint ou LLM en erreur).
 * 1. normalise la question (accents, fautes de frappe, tutoiement) ;
 * 2. extrait les entités : IA, période, concurrent (correspondance floue), produit, texte entre guillemets, durée ;
 * 3. choisit une intention (ou plusieurs : question composée) et les outils à appeler ;
 * 4. compose la réponse à partir des DONNÉES renvoyées par les outils (aucune réponse générique ;
 *    hors périmètre : une phrase honnête + 3 questions proches).
 */
import type { ProviderId } from '@/lib/engine';
import { PROVIDER_LABEL } from '@/lib/alerts';
import { FACT_LABELS } from '@/lib/facts';
import { plural } from '@/lib/text';
import type { CopilotContext } from './context';
import { frDate } from './context';
import { comparison, committee, faq, firstSource, otherV2, prices, productInQuestion, productPages, reviewReply, traffic, weeklyPlan, whyCompetitor } from './demo';
import { auditStats, findRow, shareOfVoiceOf } from '@/lib/digest/stats';
import { ENGINE_LABEL, correctTypos, factTopicIn, monthLabel, norm, periodIn, providersIn, quotedText, unknownProperName, type EngineName } from './entities';
import { resolveCompetitor, runTool } from './tools';
import type { CopilotAction, CopilotIntent, Deliverable, ScriptedAnswer, SourceRef, ToolCall, ToolResult } from './types';

// ---------------------------------------------------------------------------
// Détection d'intention
// ---------------------------------------------------------------------------

const ASK = /\b(score|note|rang|classement|combien|pourquoi|quel|quelle|quels|quelles|ecris|redige|prepare|donne|dis|fais|explique|compare|exporte|ajoute|reponds|comment)\b/;

/** Une seule intention (la plus précise). L'ordre des règles compte. */
export function detectIntent(question: string): CopilotIntent {
  const raw = norm(question);
  const q = correctTypos(question);
  const words = q.split(' ').filter(Boolean).length;
  if (/^(merci|ok|parfait|super|genial|top|nickel|d accord|ca ira|au revoir|bonne journee)\b/.test(q) && (words <= 6 || /c est tout|ca ira/.test(q)) && !ASK.test(q.replace(/^merci( beaucoup)?/, ''))) return 'thanks';
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey)\b/.test(q) && words <= 4) return 'greeting';
  // Avis : « Un client m'a laissé 3 étoiles… Écris-moi une réponse » (sans le mot « avis »).
  if (/\bavis\b|\betoiles?\b|\bcommentaire\b|\b(m|nous) a laisse\b/.test(q) && /(repon|repond|\becri|\bredig)/.test(q) && !/\bfiche\b.*\bdescription\b|\bdescription\b.*\bfiche\b/.test(q)) return 'review_reply';
  if (/\b(ajoute|ajouter|ajouterais|suivre|surveille|surveiller|suis|mettre)\b.*\b(question|requete|prompt)s?\b|\ba mon suivi\b|\bdans (mon|le) suivi\b/.test(q)) return 'track_question';
  if (/\b(export|exporte|exporter|csv|excel|telecharge|telecharger)\b/.test(q)) return 'export';
  if (/\bfaq\b|questions? frequentes/.test(q)) return 'faq';
  if (/\bdescription\b.*\b(fiche|google|gbp)\b|\bfiche google\b.*\b(texte|description|redige|ecris)\b/.test(q)) return 'gbp_description';
  // « Ma fiche Google est-elle complète ? », « Que manque-t-il à ma fiche Google ? »
  if (/\b(fiche|profil|compte) (google|gbp|maps|d etablissement)\b|\bgoogle (business|maps|my business)\b/.test(q)) return 'gbp_audit';
  if (/\b(e ?mail|mail|courriel|message)\b.*\b(journaliste|media|proposition|article|redaction|redacteur|redactrice|blog|blogueur|blogueuse|sujet|presse|auteur|autrice|comparatif|testeur|testeuse)\b|\bpropos\w* (un|d un) (sujet|article)\b|\b(ecris|ecrire|redige)\b.*\b(a|pour) l auteur\b/.test(q)) return 'outreach_email';
  if (/\bbrief\b/.test(q)) return 'content_brief';
  // Part de voix dans le temps (« … face à Paylo sur les 6 derniers mois ») : avant « face à » (comparatif).
  if (/\bpart(s)? de voix\b|\bshare of voice\b/.test(q) && !/\b(export\w*|csv|fichier|tableur)\b/.test(q) && /\b(face a|contre|vs|par rapport|derniers? mois|mois|evolution|dans le temps|depuis|historique|trimestre|semaines?)\b/.test(q)) return 'share_of_voice';
  // « Qu'est-ce qui a changé depuis le mois dernier ? »
  if (/\b(qu est ce qui|ce qui|quoi) a (change|bouge|evolue)\b|\bqu est ce qui (change|bouge)\b|\bdepuis le (mois|dernier audit|derniere mesure)\b|\bquoi de neuf\b|\bpar rapport (au|a la) (mois|mesure|audit) (dernier|derniere|precedent|precedente)\b/.test(q)) return 'period_compare';
  // « Réécris la fiche de mon shampoing Onde » (fiche produit, pas fiche Google)
  if (/\b(reecri\w*|ameliore\w*|enrichi\w*|optimise\w*|redige\w*|ecri\w*)\b.*\bfiches?\b/.test(q) && !/\b(google|gbp|maps)\b/.test(q)) return 'product_pages';
  const per = periodIn(question);
  if (per.months.length >= 2 || (/\b(compare|comparer|comparaison|evolution|par rapport)\b/.test(q) && (per.months.length || per.kind === 'last_month' || per.kind === 'quarter'))) return 'period_compare';
  if (/\b(comparatif|vs|versus|face a|alternative a)\b/.test(raw)) return 'comparison';
  if (/\b(score|note|visibilite)\b.*\b(baiss|mont|augment|chut|bouge|change|progress|recul|descend|grimp)\w*|\b(explique|expliquer)\b.*\b(chang\w*|variation|evolution|baiss\w*|hauss\w*|bouge\w*)\b/.test(q)) return 'period_compare';
  if (/\bpourquoi\b.*\b(trafic|visites?|ventes?)\b.*\b(augment|baiss|mont|hausse|chut|progress)\w*/.test(q)) return 'traffic_why';
  if (/\b(concurrents?|acteurs?|marques?)\b.*\b(progress\w*|monte\w*|grimp\w*|gagne\w*|plus vite|accelere\w*)\b|\bqui progresse\b/.test(q)) return 'fastest_competitor';
  if (/(passe|passent|est|sont)\S*( \S+){0,2} devant|pourquoi .*(cite|recommand|mieux|devant|avant|plus)/.test(q)) return 'why_competitor';
  if (/\b(urls?|liens?)\b/.test(q) && /\b(cit|source|donne|renvoi|pointe)/.test(q)) return 'citations_urls';
  if (/\bquelles? (pages|sources)\b.*\b(cite|citent|citee|citees)\b.*\b(pour|sur) la question\b/.test(q)) return 'citations_urls';
  if (/\b(robots?|bots?|crawlers?|gptbot|perplexitybot)\b/.test(q) && !/\btxt\b/.test(q)) return 'crawlers';
  if (/\bshopping\b|\bmerchant\b/.test(q)) return 'shopping';
  if (/\bcitable|citabilite|reprenable\b/.test(q)) return 'page_citable';
  if (/\b(absent|absents|absente|absentes|pas cite|pas cites|jamais cite|ne (me|nous) cite\w* (pas|jamais)|invisibles?|manquons)\b/.test(q) && /\bquestions?|requetes?|prompts?\b/.test(q)) return 'missing_queries';
  if (/\b(articles?|blogs?|contenus?|sujets?)\b/.test(q) && /\b(ecrire|rediger|publier|devrions|devrais|dois|faut|faire|idees?|quels?|quelles?)\b/.test(q)) return 'content_ideas';
  if (/\b(prix|tarif|tarifs|cout|coute|coutent)\b/.test(q) && !/\b(page|fiche)s? (de )?produits?\b/.test(q)) return 'prices';
  const topic = factTopicIn(question);
  if (topic && /\b(dit|disent|dire|affirme|affirment|indique|indiquent|pense|pensent|annonce|sait|savent|raconte|parle|parlent|mentionne|mentionnent|est ce que|est ce qu)\b/.test(q)) return 'fact_lookup';
  if (/\b(erreur|erreurs|faux|fausse|fausses|inexact\w*|se trompe\w*|hallucin\w*|mauvaise information)\b/.test(q)) return 'fact_errors';
  if (/\b(score|note)\b/.test(q) && providersIn(question).length) return 'provider_score';
  if (/\b(\d+|trois|3) mois\b|\btrimestr\w*\b/.test(q) && /\b(plan|programme|feuille de route|planning|planifie)\b/.test(q)) return 'plan_quarter';
  if (/(fiche|page)s? (de )?produits?/.test(q) || /\b(quels?|mes|nos) produits?\b.*\b(cit\w*|recommand\w*|apparai\w*|mentionn\w*|ressort\w*)/.test(q)) return 'product_pages';
  if (/(\bvisites?\b|trafic|clients? .*(envoy|amen|venu)|\bventes?\b|\bcommandes?\b|conversions?|chiffre d.affaires|\bca (genere|venu|apporte|des ia)|\bappels?\b)/.test(q)) return 'traffic';
  if (/(comite|codir|conseil d.administration|reunion|point pour|bilan|direction|associe)/.test(q)) return 'committee';
  if (/source/.test(q) && /(viser|priorit|abord|commencer)/.test(q)) return 'first_source';
  if (/(cette semaine|quoi faire|que (dois je|faire)|par ou commencer|\d+ ?min|priorit|je fais quoi|qu est ce que je fais|on fait quoi)/.test(q)) return 'weekly_plan';
  // « Quelle est ma part de voix ? » : la réponse « rang » la donne (même calcul que l'app et l'export CSV).
  if (/\bpart(s)? de voix\b|\bshare of voice\b/.test(q) && !/\b(export\w*|csv|fichier|tableur)\b/.test(q)) return 'rank';
  if (/\b(rang|classement|classe|position|place|combientieme)\b/.test(q)) return 'rank';
  if (/\b(score|note|visibilite)\b/.test(q)) return 'score';
  if (/\b(reputation|image|perception)\b|\bton des (reponses|ia)\b|\b(que|qu) (dit|disent|pense|pensent) .*\b(de (moi|nous)|ma marque|mon entreprise|notre marque|notre entreprise)\b/.test(q)) return 'perception';
  if (/\bopportunit/.test(q)) return 'first_source';
  if (/source/.test(q) && /(viser|premier|priorit|abord|commencer|lequel|laquelle|quelle)/.test(q)) return 'first_source';
  if (/\b(taches?|a faire|todo|plan d action)\b/.test(q)) return 'tasks';
  if (/\bconcurrents?\b/.test(q)) return 'rank';
  return 'other';
}

/** Découpe une question composée (« Quel est mon rang et combien de visites ChatGPT ? »). */
export function splitCompound(question: string): string[] {
  const quoted = quotedText(question);
  const base = quoted ? question.replace(quoted, '…') : question;
  const parts = base
    .split(/\?\s+|\s(?:et|puis|ensuite|aussi)\s(?=(?:quel|quelle|quels|quelles|combien|pourquoi|comment|écris|ecris|rédige|redige|donne|dis|que|qu[’']|est-ce|mon|ma|mes|notre|nos|prépare|prepare|fais|exporte)\b)|;\s*/i)
    .map((p) => p.replace(/^\s*(et|puis|ensuite|aussi)\s+/i, '').trim())
    .filter((p) => p.length > 3);
  return quoted ? parts.map((p) => p.replace('…', quoted)) : parts;
}

// ---------------------------------------------------------------------------
// Utilitaires de composition
// ---------------------------------------------------------------------------

interface Composed {
  intent: CopilotIntent;
  lines: string[];
  results: ToolResult[];
  deliverables?: Deliverable[];
  actions?: CopilotAction[];
  /** réponse V2 complète (déjà sourcée par le texte) */
  v2?: ScriptedAnswer;
}

const header = (c: CopilotContext) => {
  const a = c.latest;
  return `${a ? `D'après l'audit du ${frDate(a.measuredAt ?? a.createdAt)}` : 'Sans audit disponible pour l’instant'}${c.demo ? ' (données de démonstration)' : ''} :`;
};
const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/ | /g, ' ');
const pct = (x: number) => `${Math.round(x * 100)} %`;
const providerLabel = (p: EngineName) => ENGINE_LABEL[p];
const toProvider = (p: EngineName | null | undefined): ProviderId | null => (p && p !== 'copilot' ? p : null);

function tool(c: CopilotContext, name: ToolCall['name'], args: Record<string, unknown> = {}): ToolResult {
  return runTool(c, name, args);
}

/** IA citée mais non mesurée (Copilot, Mistral ou Claude hors audit). */
function unmeasured(c: CopilotContext, p: EngineName | null): string | null {
  if (!p) return null;
  const used = c.latest?.providersUsed ?? [];
  if (p === 'copilot' || !used.includes(p as ProviderId)) {
    return `${providerLabel(p)} n’est pas mesuré dans votre audit (IA interrogées : ${used.map((x) => PROVIDER_LABEL[x]).join(', ') || 'aucune'}) : je n’ai pas cette donnée.${p === 'copilot' ? ' Repéré ne suit pas Copilot pour l’instant.' : ''}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Compositeurs par intention
// ---------------------------------------------------------------------------

type Composer = (c: CopilotContext, q: string) => Composed;

const composeScore: Composer = (c, q) => {
  const p = providersIn(q)[0] ?? null;
  const miss = unmeasured(c, p);
  if (miss) return { intent: 'provider_score', lines: [miss], results: [tool(c, 'getScore')] };
  const r = tool(c, 'getScore', p ? { provider: p } : {});
  if (!r.ok) return { intent: p ? 'provider_score' : 'score', lines: [r.text], results: [r] };
  const d = r.data as { score: number; range: { low: number; high: number }; byProvider: Record<string, number>; history: { at: string; score: number }[]; providerScore: number | null; providerRate: number | null };
  const lines = [header(c), ''];
  if (p) {
    lines.push(`**Votre note sur ${providerLabel(p)} : ${d.providerScore}/100** (score global ${d.score}/100).`);
    if (d.providerRate !== null) lines.push(`${providerLabel(p)} vous cite dans ${pct(d.providerRate)} de ses réponses aux questions de recommandation.`);
    const others = Object.entries(d.byProvider).filter(([k]) => k !== p);
    if (others.length) lines.push(`Pour comparer : ${others.map(([k, v]) => `${PROVIDER_LABEL[k as ProviderId]} ${v}/100`).join(', ')}.`);
  } else {
    lines.push(`**Score de visibilité IA : ${d.score}/100** (marge ${d.range.low}–${d.range.high}).`);
    lines.push(`Par IA : ${Object.entries(d.byProvider).map(([k, v]) => `${PROVIDER_LABEL[k as ProviderId]} ${v}/100`).join(', ')}.`);
  }
  if (d.history.length > 1) lines.push(`Évolution : ${d.history.map((h) => `${h.score} (${frDate(h.at)})`).join(' → ')}.`);
  return { intent: p ? 'provider_score' : 'score', lines, results: [r] };
};

const composeRank: Composer = (c) => {
  const r = tool(c, 'getRank');
  if (!r.ok) return { intent: 'rank', lines: [r.text], results: [r] };
  const d = r.data as { rank: number; of: number; label: string; citations: number; answers: number; shareOfVoice: number; ahead: { name: string; mentions: number } | null; rows: { name: string; mentions: number; isMe: boolean; pos: number }[]; previousRank: number | null; method: string };
  const lines = [header(c), '', `**Vous êtes ${d.label}.**`, `Vous êtes cité dans ${d.citations} réponses sur ${d.answers} (${d.method}) ; part de voix ${pct(d.shareOfVoice)}.`];
  if (d.previousRank !== null && d.previousRank !== d.rank) lines.push(`Au mois précédent : ${d.previousRank}ᵉ.`);
  lines.push('', '**Classement (citations) :**', ...d.rows.slice(0, 5).map((x) => `${x.pos}. ${x.isMe ? `**${x.name} (vous)**` : x.name} — ${x.mentions}`));
  if (!d.rows.slice(0, 5).some((x) => x.isMe)) lines.push(`…`, `${d.rank}. **${c.business.name} (vous)** — ${d.citations}`);
  if (d.ahead) lines.push('', `Pour gagner une place, l’écart avec ${d.ahead.name} est de ${d.ahead.mentions - d.citations} citation${d.ahead.mentions - d.citations > 1 ? 's' : ''}.`);
  return { intent: 'rank', lines, results: [r] };
};

const composeCompetitor: Composer = (c, q) => {
  const hit = resolveCompetitor(c, q);
  const r = tool(c, 'getCompetitor', { name: hit?.name ?? q });
  if (!r.ok) return { intent: 'competitor', lines: [r.text], results: [r] };
  const d = r.data as { name: string; mentions: number; myMentions: number; answers: number; perProvider: { provider: ProviderId; him: number; me: number }[]; presentOn: string[]; trend: { at: string; mentions: number }[]; descriptions: string[]; recommendedFirst: number };
  const lines = [header(c), '', `**${d.name}** est cité ${d.mentions} fois, vous ${d.myMentions} fois, sur les mêmes ${d.answers} réponses.`];
  lines.push(`Par IA (${d.name} contre vous) : ${d.perProvider.map((x) => `${PROVIDER_LABEL[x.provider]} ${x.him} contre ${x.me}`).join(' ; ')}.`);
  if (d.recommendedFirst) lines.push(`Recommandé en premier dans ${d.recommendedFirst} réponse${d.recommendedFirst > 1 ? 's' : ''}.`);
  if (d.descriptions.length) lines.push(`Décrit comme : ${d.descriptions.map((x) => `« ${x} »`).join(', ')}.`);
  if (d.presentOn.length) lines.push(`Présent sur des sources citées par les IA où vous n’êtes pas : ${d.presentOn.slice(0, 5).join(', ')}.`);
  if (d.trend.length > 1) lines.push(`Évolution de ses citations : ${d.trend.map((t) => t.mentions).join(' → ')} (${frDate(d.trend[0].at)} → ${frDate(d.trend.at(-1)!.at)}).`);
  return { intent: 'competitor', lines, results: [r] };
};

const composeWhyCompetitor: Composer = (c, q) => {
  const hit = resolveCompetitor(c, q);
  const unknown = !hit ? unknownProperName(q, [c.business.name]) : null;
  const results: ToolResult[] = [];
  if (hit) {
    results.push(tool(c, 'getCompetitor', { name: hit.name }));
    const v2 = whyCompetitor(c, `Pourquoi ${hit.name} passe devant moi ?`);
    const p = toProvider(providersIn(q)[0]);
    const lines = v2.content.split('\n');
    if (p) {
      const d = results[0].data as { perProvider?: { provider: ProviderId; him: number; me: number; total: number }[] };
      const pp = d.perProvider?.find((x) => x.provider === p);
      if (pp) lines.splice(2, 0, `Sur ${PROVIDER_LABEL[p]} précisément : ${hit.name} ${pp.him} citations, vous ${pp.me}, sur ${pp.total} réponses.`);
    }
    results.push(tool(c, 'getOpportunities'), tool(c, 'getTasks'));
    return { intent: 'why_competitor', lines, results };
  }
  if (unknown) {
    const r = tool(c, 'getCompetitor', { name: unknown });
    results.push(r);
    const d = r.data as { ahead: { name: string; mentions: number }[]; answers: number };
    const v2 = whyCompetitor(c, 'Pourquoi mon principal concurrent passe devant moi ?');
    const lines = [
      `**${unknown} n’apparaît dans aucune des ${d.answers} réponses analysées** : les IA ne le recommandent pas sur les questions de votre audit, je n’ai donc aucune donnée sur lui.`,
      d.ahead.length ? `Les acteurs réellement recommandés devant vous : ${d.ahead.slice(0, 4).map((x) => `${x.name} (${x.mentions})`).join(', ')}.` : '',
      `Si ${unknown} est un concurrent important pour vous, ajoutez une question qui le cite (« alternative à ${unknown} ») à votre suivi.`,
      '',
      ...v2.content.split('\n'),
    ].filter((x, i, arr) => x !== '' || arr[i - 1] !== '');
    results.push(tool(c, 'getOpportunities'));
    return { intent: 'why_competitor', lines, results, actions: [{ type: 'track_question', label: `Suivre « Quelle alternative à ${unknown} ? »`, payload: { text: `Quelle alternative à ${unknown} ?` } }] };
  }
  const v2 = whyCompetitor(c, q);
  return { intent: 'why_competitor', lines: v2.content.split('\n'), results: [tool(c, 'getRank'), tool(c, 'getOpportunities'), tool(c, 'getTasks')] };
};

const composeComparison: Composer = (c, q) => {
  const hit = resolveCompetitor(c, q);
  const v2 = comparison(c, hit ? `Écris une page comparatif ${c.business.name} vs ${hit.name}` : q);
  return { intent: 'comparison', lines: v2.content.split('\n'), results: [hit ? tool(c, 'getCompetitor', { name: hit.name }) : tool(c, 'getRank')], deliverables: v2.deliverables };
};

const composeCitationsUrls: Composer = (c, q) => {
  const p = providersIn(q)[0] ?? null;
  const miss = unmeasured(c, p);
  if (miss) return { intent: 'citations_urls', lines: [miss], results: [] };
  const quoted = quotedText(q);
  const m = /\b(?:question|requete|pour|sur)\s+(?:la question\s+)?[«"“]?([^?»"”]+)/i.exec(q.replace(/\b(chatgpt|perplexity|gemini|claude)\b/gi, ''));
  const query = quoted ?? m?.[1]?.replace(/^(la question|les questions)\s+/i, '').trim();
  const r = tool(c, 'getSources', { provider: p ?? undefined, query });
  if (!r.ok) return { intent: 'citations_urls', lines: [r.text], results: [r] };
  const d = r.data as { query: string | null; answers: number; urls: { url: string; title?: string; citations: number; bestPosition: number; providers: ProviderId[] }[] };
  const who = p ? providerLabel(p) : 'Les IA';
  const lines = [header(c), ''];
  if (!d.urls.length) lines.push(r.text);
  else {
    lines.push(`**${who}${d.query ? ` — question « ${d.query} »` : ''} : ${plural(d.urls.length, 'URL citée', 'URL citées')}** sur ${plural(d.answers, 'réponse', 'réponses')} :`, '');
    d.urls.slice(0, 8).forEach((u, i) => lines.push(`${i + 1}. ${u.title ? `${u.title} — ` : ''}${u.url} (${plural(u.citations, 'fois', 'fois')}, meilleure position ${u.bestPosition}${p ? '' : ` ; ${u.providers.map((x) => PROVIDER_LABEL[x]).join(', ')}`})`));
    if (d.urls.length > 8) lines.push(`… et ${d.urls.length - 8} autres (onglet Sources).`);
    const site = (c.facts.facts.site ?? c.business.website ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
    const mine = site ? d.urls.filter((u) => u.url.includes(site)) : [];
    lines.push('', mine.length ? `Votre site y figure : ${mine.map((u) => u.url).join(', ')}.` : 'Votre site n’y figure pas : ce sont ces pages qu’il faut viser (fiche, article, mention).');
  }
  if (p !== 'gemini' && !p) lines.push('Gemini n’est pas compté : il est interrogé sans ancrage et ne fournit pas de sources.');
  return { intent: 'citations_urls', lines, results: [r] };
};

const composeTrackQuestion: Composer = (c, q) => {
  const text = (quotedText(q) ?? q.replace(/^.*?\b(ajoute|ajouter|suivre|surveille|surveiller|suis)\b\s*(la question|les questions|la requête|la requete)?\s*/i, '').replace(/\s*(à|a|dans) (mon|le) suivi.*$/i, '')).trim().slice(0, 200);
  const r = tool(c, 'getPromptResults', { query: text });
  const close = (r.data as { questions?: { text: string; cited: number; answers: number }[] }).questions?.[0];
  const lines: string[] = [];
  if (!text || text.length < 4) return { intent: 'track_question', lines: ['Donnez-moi la question entre guillemets, par exemple : Ajoute la question « plombier pas cher Paris 11 » à mon suivi.'], results: [] };
  lines.push(`Je vous propose d’ajouter la question **« ${text} »** à votre suivi : elle sera posée aux IA mesurées à chaque audit, avec l’historique par IA.`);
  if (close && norm(close.text) !== norm(text)) lines.push(`Question proche déjà mesurée : « ${close.text} » (vous êtes cité dans ${close.cited} réponse${close.cited > 1 ? 's' : ''} sur ${close.answers}).`);
  lines.push(c.demo ? 'Compte de démonstration : rien n’est enregistré. Sur votre compte, il suffit de confirmer ci-dessous (dans la limite des questions de votre offre).' : 'Confirmez ci-dessous : rien n’est ajouté sans votre accord (dans la limite des questions de votre offre).');
  return { intent: 'track_question', lines, results: [r], actions: [{ type: 'track_question', label: `Suivre « ${text} »`, payload: { text, businessId: c.business.id, demo: c.demo } }] };
};

const composePeriod: Composer = (c, q) => {
  const per = periodIn(q);
  const args: Record<string, unknown> = {};
  if (per.months.length >= 2) {
    const [x, y] = [...per.months].sort((a, b) => a - b);
    args.fromMonth = x;
    args.toMonth = y;
  } else if (per.months.length === 1) args.fromMonth = per.months[0];
  if (per.year) args.year = per.year;
  if (per.kind === 'quarter' || per.kind === 'since_start') {
    const all = c.historyAudits ?? [];
    const back = per.kind === 'quarter' ? Math.min(3, all.length - 1) : all.length - 1;
    if (back > 0) {
      args.fromMonth = new Date(all[all.length - 1 - back].createdAt).getUTCMonth();
      args.toMonth = new Date(all[all.length - 1].createdAt).getUTCMonth();
    }
  }
  const r = tool(c, 'explainChange', args);
  if (!r.ok) return { intent: 'period_compare', lines: [r.text], results: [r] };
  const e = r.data as unknown as import('@/lib/engine/types-v3').ChangeExplanation;
  const lines = [`**${e.headline}**${c.demo ? ' (données de démonstration)' : ''}`, '', ...e.sentences.map((s) => `- ${s}`)];
  const down = e.competitors.filter((x) => x.delta < 0).slice(0, 2);
  if (down.length) lines.push(`- Concurrents en recul : ${down.map((x) => `${x.name} (${x.prevMentions} → ${x.nextMentions})`).join(', ')}.`);
  if (e.sourcesAppeared.length) lines.push(`- Nouvelles sources citées : ${e.sourcesAppeared.slice(0, 3).map((s) => s.domain).join(', ')}.`);
  lines.push('', `Fiabilité de la variation : ${e.confidence}${e.confidence === 'forte' ? ' (au-delà de la marge d’erreur des deux mesures)' : ''}.`);
  for (const w of e.warnings.filter((w) => !/démonstration/.test(w))) lines.push(`_${w}_`);
  return { intent: 'period_compare', lines, results: [r] };
};

const composeFactLookup: Composer = (c, q) => {
  const p = providersIn(q)[0] ?? null;
  const miss = unmeasured(c, p);
  if (miss) return { intent: 'fact_lookup', lines: [miss], results: [] };
  const topic = factTopicIn(q)!;
  const r = tool(c, 'checkFact', { topic: q, provider: p ?? undefined });
  const d = r.data as { label: string; fieldLabel: string; expected: string | null; passages: { provider: ProviderId; query: string; text: string }[]; claims: { provider: ProviderId; value: string; verdict: string }[]; errors: { provider: ProviderId; stated: string; expected: string }[]; providersSilent: ProviderId[] };
  const who = p ? providerLabel(p) : 'Les IA';
  const lines = [header(c), ''];
  const kw = topic.keywords.map((k) => norm(k));
  const direct = d.passages.filter((x) => kw.some((k) => ` ${norm(x.text)} `.includes(k)));
  const plain = (t: string) => t.replace(/[<>`]/g, ' ').replace(/\*\*|__/g, '').replace(/^[\s*•-]+/, '').trim();
  if (direct.length) {
    lines.push(`**Ce que ${p ? providerLabel(p) : 'les IA'} ${p ? 'dit' : 'disent'} à ce sujet (${d.label})** :`);
    for (const x of direct.slice(0, 4)) lines.push(`- ${PROVIDER_LABEL[x.provider]} : « ${plain(x.text)} »`);
    if (!d.claims.length && d.expected) lines.push(`Aucune IA ne reprend précisément votre fiche sur ce point.`);
  } else {
    lines.push(`**${who} ne ${p ? 'mentionne' : 'mentionnent'} pas ce point (${d.label})** dans les réponses analysées.`);
  }
  for (const cl of d.claims.slice(0, 3)) lines.push(`- Affirmation relevée (${PROVIDER_LABEL[cl.provider]}, ${d.fieldLabel.toLowerCase()}) : « ${cl.value} » — ${cl.verdict === 'correct' ? 'conforme à votre fiche' : cl.verdict === 'faux' ? 'FAUX par rapport à votre fiche' : cl.verdict === 'incomplet' ? 'incomplet' : 'non vérifiable'}.`);
  lines.push('', d.expected ? `Votre fiche de vérité (${d.fieldLabel.toLowerCase()}) : « ${d.expected} ».` : `Votre fiche de vérité ne renseigne pas ce point (${d.fieldLabel.toLowerCase()}) : complétez-la pour que je puisse vérifier.`);
  const allErrors = (c.factCheck?.items ?? []).filter((i) => i.field === topic.field && i.verdict === 'faux');
  for (const e of allErrors) lines.push(`**Erreur détectée** : ${PROVIDER_LABEL[e.provider]} affirme « ${e.stated} » (vrai : « ${e.expected} »).`);
  if (!allErrors.length && d.claims.length) lines.push('Aucune erreur détectée sur ce point par la vérification des faits.');
  if (!direct.length && d.expected) lines.push(`Pour que ${p ? providerLabel(p) : 'les IA'} le reprenne${p ? '' : 'nt'}, publiez cette information sur votre site (FAQ balisée) et vos fiches${c.segment === 'local' ? ' (Google, PagesJaunes)' : c.segment === 'ecommerce' ? ' produits' : ''}.`);
  const fix = c.tasks.find((t) => t.kind === 'fact_fix' && t.status !== 'done' && norm(t.title).includes(norm(FACT_LABELS[topic.field]).split(' ')[0]));
  if (fix) lines.push(`Tâche prête : « ${fix.title} » (${fix.minutes} min).`);
  return { intent: 'fact_lookup', lines, results: [r] };
};

const composeFactErrors: Composer = (c) => {
  const r = tool(c, 'getFactErrors');
  const d = r.data as { checked: number; errors: { label: string; provider: ProviderId; stated: string; expected: string; quote: string }[] };
  const lines = [header(c), '', `**${r.text}**`];
  for (const e of d.errors) lines.push(`- ${PROVIDER_LABEL[e.provider]} — ${e.label} : dit « ${e.stated} », votre fiche indique « ${e.expected} ».`);
  const fixes = c.tasks.filter((t) => t.kind === 'fact_fix' && t.status !== 'done');
  if (fixes.length) lines.push('', ...fixes.map((t) => `Tâche prête : « ${t.title} » (${t.minutes} min).`), 'La correction par l’IA n’est pas garantie et peut prendre plusieurs semaines.');
  return { intent: 'fact_errors', lines, results: [r] };
};

const composeMissing: Composer = (c, q) => {
  const p = providersIn(q)[0] ?? null;
  const miss = unmeasured(c, p);
  if (miss) return { intent: 'missing_queries', lines: [miss], results: [] };
  const r = tool(c, 'getPromptResults', { provider: p ?? undefined, absentOnly: true });
  const d = r.data as { total: number; questions: { text: string; competitors: { name: string; count: number }[]; answers: number }[] };
  const who = p ? providerLabel(p) : 'aucune IA';
  const lines = [header(c), ''];
  if (d.questions.length) {
    lines.push(`**${plural(d.questions.length, 'question', 'questions')} sur ${d.total} où ${who} ne vous cite jamais :**`, '');
    d.questions.forEach((x, i) => lines.push(`${i + 1}. « ${x.text} » — à votre place : ${x.competitors.map((k) => `${k.name} (${k.count})`).join(', ') || 'aucun acteur nommé'}`));
  } else {
    const all = tool(c, 'getPromptResults', { provider: p ?? undefined });
    const rows = (all.data as { questions: { text: string; cited: number; answers: number; competitors: { name: string }[] }[] }).questions.filter((x) => x.answers).sort((x, y) => x.cited / x.answers - y.cited / y.answers);
    lines.push(`${p ? providerLabel(p) : 'Les IA'} vous cite${p ? '' : 'nt'} au moins une fois sur chacune des ${d.total} questions. Les plus faibles :`, '');
    rows.slice(0, 3).forEach((x, i) => lines.push(`${i + 1}. « ${x.text} » — cité dans ${x.cited} réponse${x.cited > 1 ? 's' : ''} sur ${x.answers}${x.competitors[0] ? ` ; ${x.competitors[0].name} y domine` : ''}`));
    r.data = { ...d, weakest: rows.slice(0, 3) };
  }
  lines.push('', 'Je peux préparer le brief d’un contenu qui répond à l’une de ces questions (demandez « brief pour la question … »).');
  return { intent: 'missing_queries', lines, results: [r] };
};

const composeFastest: Composer = (c, q) => {
  const per = periodIn(q);
  const period = per.kind === 'since_start' ? 'start' : per.kind === 'quarter' ? 'quarter' : 'month';
  const r = tool(c, 'compareCompetitors', { period });
  if (!r.ok) return { intent: 'fastest_competitor', lines: [r.text], results: [r] };
  const d = r.data as { from: string; to: string; rows: { name: string; isMe: boolean; prev: number; next: number; delta: number }[]; fastest: { name: string; prev: number; next: number; delta: number }; me?: { prev: number; next: number; delta: number } };
  const isNew = (x: { prev: number }) => (x.prev === 0 ? ' — nouvel entrant dans le classement' : '');
  const lines = [
    `Entre l’audit du ${frDate(d.from)} et celui du ${frDate(d.to)}${c.demo ? ' (données de démonstration)' : ''} :`,
    '',
    `**${d.fastest.name} progresse le plus : ${d.fastest.prev} → ${d.fastest.next} citations (${d.fastest.delta >= 0 ? '+' : ''}${d.fastest.delta})${isNew(d.fastest)}.**`,
    '',
    'Les plus fortes progressions :',
    ...d.rows.filter((x) => !x.isMe).slice(0, 3).map((x, i) => `${i + 1}. ${x.name} : ${x.prev} → ${x.next} (${x.delta >= 0 ? '+' : ''}${x.delta})${isNew(x)}`),
  ];
  if (d.me) lines.push('', `Vous : ${d.me.prev} → ${d.me.next} (${d.me.delta >= 0 ? '+' : ''}${d.me.delta}).`);
  const g = tool(c, 'getCompetitor', { name: d.fastest.name });
  const presentOn = (g.data as { presentOn?: string[] }).presentOn ?? [];
  if (presentOn.length) lines.push(`${d.fastest.name} est présent sur ${presentOn.slice(0, 4).join(', ')}, des sources citées par les IA où vous n’êtes pas.`);
  if (period === 'month') lines.push('', '_Sur un mois, une partie de l’écart peut venir de la variabilité des réponses : regardez aussi la tendance sur 3 mois._');
  return { intent: 'fastest_competitor', lines, results: [r, g] };
};

function composeDraft(intent: CopilotIntent, kind: import('./deliverables').DeliverableKind, intro?: (d: Record<string, unknown>) => string[]): Composer {
  return (c, q) => {
    const ctx = kind === 'outreach_email' ? (resolveMedia(c, q) ?? '') : kind === 'content_brief' ? (quotedText(q) ?? '') : '';
    const r = tool(c, 'draftDeliverable', { kind, context: ctx });
    const lines = r.ok && intro ? intro(r.data) : [];
    return { intent, lines: [...(lines.length ? lines : [r.text])], results: [r], deliverables: r.deliverables };
  };
}

function resolveMedia(c: CopilotContext, q: string): string | null {
  const opps = c.latest?.sources?.opportunities ?? [];
  const n = ` ${norm(q)} `;
  const hit = opps.find((o) => n.includes(` ${norm(o.domain)} `) || n.includes(` ${norm(o.label).split(' (')[0]} `) || n.includes(` ${norm(o.domain.split('.')[0])} `));
  if (hit) return hit.domain;
  // « l'auteur d'un comparatif beauté » : le comparatif cité le plus utile (premier mot du nom dans la question, sinon le premier)
  if (/\bcomparatif|\bauteur|\btesteu/.test(n)) {
    const comps = [...opps].filter((o) => o.category === 'comparatif').sort((x, y) => y.score - x.score);
    const named = comps.find((o) => norm(o.label).split(/\s+/).some((w) => w.length >= 4 && n.includes(` ${w} `)));
    return (named ?? comps[0])?.domain ?? null;
  }
  return null;
}

const composeExport = composeDraft('export', 'export_csv', (d) => [`Voici la part de voix au format CSV (${d.rows} acteurs, colonnes : rang, citations, part de voix, citations par IA). Téléchargez le fichier ci-dessous, il s’ouvre dans Excel ou Google Sheets.`]);
const composeGbp = composeDraft('gbp_description', 'gbp_description');
const composeOutreach = composeDraft('outreach_email', 'outreach_email');

/** Fiche Google : même score et mêmes critères que l'écran /app/local/fiche-google ; sinon un renvoi honnête. */
const composeGbpAudit: Composer = (c) => {
  const href = '/app/local/fiche-google';
  const g = c.gbp;
  if (c.segment !== 'local')
    return { intent: 'gbp_audit', lines: [`L’audit de fiche Google fait partie du parcours local ; ${c.business.name} suit le parcours ${c.segment === 'ecommerce' ? 'e-commerce' : 'PME'}. Vous pouvez tout de même vérifier votre fiche depuis [Fiche Google](${href}).`], results: [] };
  if (!g)
    return {
      intent: 'gbp_audit',
      lines: [`Votre fiche Google n’a pas encore été auditée : je n’ai donc pas de score à vous donner. Ouvrez [Fiche Google](${href}) et remplissez le formulaire en regardant votre fiche sur Google Maps : le score sur 100 et la liste de ce qui manque se calculent tout de suite.`],
      results: [],
      actions: [{ type: 'open', label: 'Auditer ma fiche Google', payload: { href } }],
    };
  const lines = [`D'après l'audit de votre fiche Google du ${frDate(g.createdAt)}${g.demo ? ' (données de démonstration)' : ''} :`, ''];
  lines.push(`**Score de la fiche : ${g.score}/100** — ${plural(g.ok, 'critère rempli', 'critères remplis')} sur ${g.evaluated} évalués${g.coverage < 100 ? ` (${g.coverage} % de la grille lisible avec cette source)` : ''}.`);
  if (!g.missing.length) lines.push('', 'Rien ne manque sur les critères évalués. Gardez-la vivante : un post et des réponses aux avis chaque mois.');
  else {
    lines.push('', g.score >= 85 ? '**Elle est presque complète. Ce qui reste :**' : '**Elle n’est pas complète. À faire en priorité :**');
    g.missing.forEach((m, i) => lines.push(`${i + 1}. **${m.label}**${m.status === 'warn' ? ' (incomplet)' : ''} — ${m.fix}${m.lost ? ` (${plural(m.lost, 'point', 'points')})` : ''}`));
  }
  lines.push('', `Le détail critère par critère est dans [Fiche Google](${href}).`);
  return { intent: 'gbp_audit', lines, results: [], actions: [{ type: 'open', label: 'Ouvrir Fiche Google', payload: { href } }] };
};

const composeBrief: Composer = (c, q) => {
  const r = tool(c, 'draftDeliverable', { kind: 'content_brief', context: quotedText(q) ?? '' });
  const b = (r.data as { brief?: import('@/lib/engine/types-v3').ContentBrief }).brief;
  const lines = b ? [r.text, '', `Angle : ${b.angle}`, `Longueur : ${b.length.minWords} à ${b.length.maxWords} mots, à publier sur ${b.publishOn}.`, '', `_${b.note}_`] : [r.text];
  return { intent: 'content_brief', lines, results: [r], deliverables: r.deliverables };
};

const composeIdeas: Composer = (c) => {
  const r = tool(c, 'draftDeliverable', { kind: 'content_ideas' });
  const d = r.data as { gaps?: { text: string; competitors: string[]; answers: number; cited: number }[]; briefs?: { title: string; format: string }[] };
  if (!r.ok || !d.gaps) return { intent: 'content_ideas', lines: [r.text], results: [r] };
  const lines = [header(c), '', `**${plural(d.gaps.length, 'sujet', 'sujets')} à écrire en priorité**, là où les IA citent d’autres acteurs que vous :`, ''];
  d.gaps.forEach((g, i) => {
    lines.push(`${i + 1}. **${d.briefs![i].title}**`);
    lines.push(`   Question visée : « ${g.text} » — vous êtes cité dans ${g.cited} réponse${g.cited > 1 ? 's' : ''} sur ${g.answers}${g.competitors.length ? ` ; cités à votre place : ${g.competitors.slice(0, 3).join(', ')}` : ''}.`);
  });
  lines.push('', `Le brief complet du premier sujet est prêt ci-dessous (plan, questions à traiter, sources que les IA citent). Un contenu utile augmente vos chances d’être cité, sans garantie.`);
  return { intent: 'content_ideas', lines, results: [r], deliverables: r.deliverables };
};

const composeCrawlers: Composer = (c) => {
  const r = tool(c, 'getTraffic');
  if (!r.ok) return { intent: 'crawlers', lines: ['Je n’ai pas cette donnée : le suivi n’est pas installé. Le plugin ou le relais robots de l’onglet Trafic IA compte les passages de GPTBot, PerplexityBot, ClaudeBot…'], results: [r] };
  const d = r.data as { days: number; bots: Record<string, number> };
  const bots = Object.entries(d.bots).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const total = bots.reduce((s, [, v]) => s + v, 0);
  const check = c.tasks.find((t) => /robots/i.test(t.title));
  const lines = [`Sur les ${d.days} derniers jours${c.demo ? ' (données de démonstration)' : ''} :`, ''];
  if (bots.length) {
    lines.push(`**Oui : ${plural(total, 'passage', 'passages')} de robots d’IA sur votre site.**`, `Détail : ${bots.map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  } else lines.push('**Aucun passage de robot d’IA enregistré.** Vérifiez que votre robots.txt ne les bloque pas.');
  if (check) lines.push('', `Vérification de l’accès des robots : ${check.status === 'done' ? 'faite' : 'à faire'} (« ${check.title} »).`);
  lines.push('', 'Un passage de robot signifie que la page peut être lue, pas qu’elle sera citée.');
  return { intent: 'crawlers', lines, results: [r] };
};

const composeShopping: Composer = (c) => {
  const a = c.latest;
  const reco = a?.queries ?? [];
  const buyQ = reco.find((x) => /\b(acheter|achat|commander|prix|ou trouver)\b/.test(norm(x.text)));
  const r = buyQ ? tool(c, 'getPromptResults', { query: buyQ.text, provider: 'chatgpt' }) : null;
  const s = tool(c, 'getSources', { filter: 'all' });
  const market = ((s.data as { domains?: { domain: string; category: string; citations: number; clientPresence: string }[] }).domains ?? []).filter((d) => d.category === 'marketplace');
  const lines = [
    '**Je ne mesure pas ChatGPT Shopping** : il n’existe pas d’accès officiel à ses fiches produits, je n’ai donc pas cette donnée (et je préfère ne pas l’estimer).',
    '',
    `Ce que je mesure de plus proche${c.demo ? ' (données de démonstration)' : ''} :`,
  ];
  const row = (r?.data as { questions?: { text: string; cited: number; answers: number; competitors: { name: string }[] }[] } | undefined)?.questions?.[0];
  if (row) lines.push(`- Question d’achat « ${row.text} » : ChatGPT vous cite dans ${row.cited} réponse${row.cited > 1 ? 's' : ''} sur ${row.answers}${row.competitors[0] ? ` ; ${row.competitors.slice(0, 2).map((x) => x.name).join(', ')} y sont cités` : ''}.`);
  for (const m of market.slice(0, 2)) lines.push(`- ${m.domain} est cité ${m.citations} fois comme source ; vous y êtes ${m.clientPresence === 'present' ? 'présent' : m.clientPresence === 'absent' ? 'absent' : 'non vérifié'}.`);
  if (c.segment === 'ecommerce') lines.push('', 'Pour maximiser vos chances d’apparaître dans les fiches produits des IA : flux produit complet (Merchant Center), balisage Product avec prix et disponibilité, avis clients.');
  return { intent: 'shopping', lines, results: [...(r ? [r] : []), s] };
};

const composeCitable: Composer = (c, q) => {
  const pagePrice = /\b(tarif|tarifs|prix)\b/.test(norm(q));
  const site = (c.facts.facts.site ?? c.business.website ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  const s = tool(c, 'getSources', { filter: 'all' });
  const urls = ((s.data as { urls?: { url: string; citations: number }[] }).urls ?? []).filter((u) => site && u.url.includes(site));
  const lines = [header(c), ''];
  lines.push('Je ne peux pas analyser votre page en direct ici ; l’outil d’analyse de citabilité de Repéré le fait (réponse en tête, structure Q/R, chiffres sourcés, date, balisage). Ce que montrent vos données :', '');
  const target = urls.filter((u) => !pagePrice || /tarif|prix|pricing/.test(u.url));
  if (target.length) lines.push(`- Page citée par les IA : ${target.map((u) => `${u.url} (${u.citations} fois)`).join(', ')}.`);
  else lines.push(`- ${pagePrice ? 'Votre page tarifs n’est pas citée' : 'Aucune page de votre site n’est citée'} comme source dans l’audit${urls.length ? ` (pages de votre site citées : ${urls.map((u) => u.url).slice(0, 3).join(', ')})` : ''}.`);
  const results = [s];
  if (pagePrice) {
    const f = tool(c, 'checkFact', { topic: 'prix' });
    results.push(f);
    const d = f.data as { claims: { provider: ProviderId; value: string; verdict: string }[]; expected: string | null };
    const ok = d.claims.filter((x) => x.verdict === 'correct');
    const bad = (c.factCheck?.items ?? []).filter((i) => i.field === 'prix' && i.verdict === 'faux');
    if (ok.length) lines.push(`- Vos prix sont repris correctement par ${[...new Set(ok.map((x) => PROVIDER_LABEL[x.provider]))].join(' et ')} (« ${ok[0].value} »).`);
    for (const b of bad) lines.push(`- ${PROVIDER_LABEL[b.provider]} se trompe : « ${b.stated} » au lieu de « ${b.expected} ».`);
    lines.push('', 'Pour une page tarifs plus citable : le prix de départ en toutes lettres dans le premier paragraphe, un tableau simple par offre, une FAQ « combien coûte… » balisée, et la date de mise à jour.');
  }
  return { intent: 'page_citable', lines, results };
};

const composePlanQuarter: Composer = (c) => {
  const r = tool(c, 'draftDeliverable', { kind: 'quarter_plan' });
  const d = r.data as { months?: { n: number; minutes: number; tasks: { title: string; minutes: number }[] }[] };
  if (!r.ok || !d.months) return { intent: 'plan_quarter', lines: [r.text], results: [r] };
  const label = ['', 'Mois 1 — corriger et fiabiliser', 'Mois 2 — être présent là où les IA lisent', 'Mois 3 — publier et obtenir des mentions'];
  const lines = [`Plan sur 3 mois, construit avec vos tâches réelles${c.demo ? ' (données de démonstration)' : ''} :`, ''];
  for (const m of d.months.filter((x) => x.tasks.length)) {
    lines.push(`**${label[m.n]}** (${m.minutes} min au total)`, ...m.tasks.map((t) => `- ${t.title} (${t.minutes} min)`), '');
  }
  lines.push(`Chaque mois, l’audit mesure l’effet (score actuel : ${c.latest?.score ?? '—'}/100). Les IA décident seules : ce plan augmente vos chances, sans garantie de résultat.`);
  return { intent: 'plan_quarter', lines, results: [r, tool(c, 'getScore')], deliverables: r.deliverables };
};

const composePerception: Composer = (c, q) => {
  const p = toProvider(providersIn(q)[0]);
  const r = tool(c, 'getPerception', { provider: p ?? undefined });
  if (!r.ok) return { intent: 'perception', lines: [r.text], results: [r] };
  const d = r.data as { sentiment: { positif: number; neutre: number; negatif: number }; themes: string[]; quotes: { provider: ProviderId; text: string; sentiment: string }[] };
  const lines = [header(c), '', `**Ton des réponses sur ${c.business.name} : ${pct(d.sentiment.positif)} positif, ${pct(d.sentiment.neutre)} neutre, ${pct(d.sentiment.negatif)} négatif.**`, `Thèmes associés : ${d.themes.join(', ') || '—'}.`];
  if (d.quotes.length) lines.push('', 'Verbatims :', ...d.quotes.slice(0, 3).map((x) => `- ${PROVIDER_LABEL[x.provider]} (${x.sentiment}) : « ${x.text} »`));
  return { intent: 'perception', lines, results: [r] };
};

const composeTasks: Composer = (c) => {
  const r = tool(c, 'getTasks');
  const d = r.data as { open: number; done: number; tasks: { title: string; minutes: number }[] };
  const lines = [`**${plural(d.open, 'tâche ouverte', 'tâches ouvertes')}, ${plural(d.done, 'faite', 'faites')}**${c.demo ? ' (données de démonstration)' : ''}. Par priorité :`, '', ...d.tasks.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} (${t.minutes} min)`)];
  return { intent: 'tasks', lines, results: [r] };
};

const composeTrafficWhy: Composer = (c) => {
  const r = tool(c, 'getTraffic');
  if (!r.ok) return { intent: 'traffic_why', lines: [r.text], results: [r] };
  const d = r.data as { days: number; aiVisits: number; trend: { firstHalf: number; secondHalf: number; halfDays: number }; topLandingPages: { path: string; visits: number; engine: string }[]; byEngine: Record<string, number> };
  const rank = tool(c, 'getRank');
  const ch = tool(c, 'explainChange');
  const rk = rank.data as { label?: string; citations?: number; answers?: number };
  const e = ch.ok ? (ch.data as unknown as import('@/lib/engine/types-v3').ChangeExplanation) : null;
  const lines = [`Sur les ${d.days} derniers jours${c.demo ? ' (données de démonstration)' : ''} :`, ''];
  lines.push(`- Visites venues des IA : ${fmtInt(d.trend.firstHalf)} sur les ${d.trend.halfDays} premiers jours, ${fmtInt(d.trend.secondHalf)} sur les ${d.days - d.trend.halfDays} suivants (${fmtInt(d.aiVisits)} au total).`);
  const pages = d.topLandingPages.slice(0, 3);
  if (pages.length) lines.push(`- Elles arrivent surtout sur : ${pages.map((p) => `${p.path} (${p.visits})`).join(', ')}.`);
  if (rk.label) lines.push(`- Votre rang (${rk.label}) se mesure sur les questions de recommandation générales ; vous y êtes tout de même cité dans ${rk.citations} réponses sur ${rk.answers}.`);
  if (e && e.score.delta) {
    const rp = Math.round(e.mentionRate.prev * 100);
    const rn = Math.round(e.mentionRate.next * 100);
    lines.push(`- Entre les deux derniers audits, votre score est passé de ${e.score.prev} à ${e.score.next}${rp !== rn ? `, et vos citations de ${rp} % à ${rn} % des réponses` : ''}.`);
  }
  lines.push('', '**Ce que je ne peux pas affirmer** : les IA ne transmettent pas la question posée, je ne peux donc pas relier une visite à une question précise. Un rang moyen dans le classement n’empêche pas d’être cité : chaque citation peut amener des visites, notamment sur des questions précises (produit, marque) que le classement ne couvre pas.');
  return { intent: 'traffic_why', lines, results: [r, rank, ch] };
};

const composeThanks: Composer = (c) => ({
  intent: 'thanks',
  lines: [`Avec plaisir. Vos données ${c.demo ? 'de démonstration ' : ''}sont mises à jour à chaque audit : revenez quand vous voulez, ou consultez vos actions de la semaine dans le Centre d’actions.`],
  results: [],
});

const composeGreeting: Composer = (c) => ({
  intent: 'greeting',
  lines: [`Bonjour. Je réponds à partir des données de ${c.business.name}${c.demo ? ' (démonstration)' : ''} : audit, fiche de vérité, tâches et trafic. Par exemple :`, ...closeQuestions(c, '').map((x) => `- ${x}`)],
  results: [],
});

function v2(intent: CopilotIntent, fn: (c: CopilotContext, q: string) => ScriptedAnswer, tools: ToolCall['name'][]): Composer {
  return (c, q) => {
    const s = fn(c, q);
    const p = providersIn(q)[0];
    return { intent, lines: s.content.split('\n'), results: tools.map((t) => tool(c, t, t === 'getTraffic' || t === 'getSales' ? (p ? { engine: p } : {}) : {})), deliverables: s.deliverables, v2: s };
  };
}

// ---------------------------------------------------------------------------
// Hors périmètre : une phrase + 3 questions proches
// ---------------------------------------------------------------------------

function catalogue(c: CopilotContext): string[] {
  const top = c.latest?.gaps?.[0]?.competitor;
  const common = ['Quel est mon rang ?', 'Quel est mon score sur ChatGPT ?', 'Pourquoi mon score a-t-il bougé depuis le mois dernier ?', 'Quelles erreurs les IA disent-elles sur moi ?', 'Quelle source dois-je viser en premier ?', 'Sur quelles questions suis-je absent de ChatGPT ?', 'Quel concurrent progresse le plus vite ?', 'Fais-moi un plan sur 3 mois', 'Écris-moi la FAQ', 'Exporte la part de voix en CSV'];
  const seg =
    c.segment === 'local'
      ? ['Qu’est-ce que je fais cette semaine en 20 minutes ?', 'Combien de clients m’a envoyé ChatGPT ce mois-ci ?', 'Écris la description de ma fiche Google', 'Réponds à cet avis 3 étoiles : « Intervention correcte mais délai trop long. »']
      : c.segment === 'pme'
        ? ['Prépare mon point pour le comité de direction de lundi', 'Combien de visites et de conversions viennent des IA ?', 'Quels articles de blog devrions-nous écrire ?', 'Que dit ChatGPT de nos prix ?']
        : ['Combien de ventes viennent de ChatGPT ?', 'Quelles fiches produits dois-je corriger en premier ?', 'Que dit l’IA sur la composition de mes produits ?', 'Réponds à cet avis 2 étoiles : « Joli produit mais livraison trop lente. »'];
  return [...seg, ...(top ? [`Pourquoi ${top} passe devant moi ?`] : []), ...common];
}

/** 3 questions proches de la question posée (mots en commun), sinon les plus utiles du parcours. */
export function closeQuestions(c: CopilotContext, question: string, n = 3): string[] {
  const words = new Set(correctTypos(question).split(' ').filter((w) => w.length >= 4));
  const scored = catalogue(c).map((s, i) => ({ s, i, score: correctTypos(s).split(' ').filter((w) => words.has(w)).length }));
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, n).map((x) => x.s);
}

/** Part de voix (citations / total des citations) mesure par mesure, pour vous et le concurrent nommé. */
const composeShareOfVoice: Composer = (c, q) => {
  const all = (c.historyAudits ?? (c.latest ? [c.latest] : [])).slice(-6);
  if (!all.length) return { intent: 'share_of_voice', lines: ['Je n’ai pas encore de mesure : la part de voix apparaîtra après votre premier audit.'], results: [] };
  const hit = resolveCompetitor(c, q);
  const r = tool(c, 'getRank');
  const month = (iso: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));
  const pts = all.map((a) => {
    const s = auditStats(a);
    const row = hit ? findRow(s, hit.name) : undefined;
    return { at: a.measuredAt ?? a.createdAt, me: shareOfVoiceOf(s), him: hit ? shareOfVoiceOf(s, hit.name) : null, himMentions: row?.mentions ?? 0, myMentions: s.citations, total: s.rows.reduce((t, x) => t + x.mentions, 0) };
  });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lines = [header(c), '', `**Part de voix${hit ? ` : ${c.business.name} face à ${hit.name}` : ` de ${c.business.name}`}, sur ${plural(pts.length, 'mesure', 'mesures')}** (part des citations, vous compris) :`, ''];
  for (const p of pts) lines.push(`- ${month(p.at)} : vous ${pct(p.me)} (${p.myMentions} sur ${p.total} citations)${hit ? ` ; ${hit.name} ${pct(p.him ?? 0)} (${p.himMentions})` : ''}`);
  const dMe = Math.round((last.me - first.me) * 100);
  lines.push('', `Sur la période : vous ${dMe >= 0 ? '+' : '−'}${Math.abs(dMe)} point${Math.abs(dMe) > 1 ? 's' : ''}${hit && last.him !== null && first.him !== null ? `, ${hit.name} ${Math.round((last.him - first.him) * 100) >= 0 ? '+' : '−'}${Math.abs(Math.round((last.him - first.him) * 100))} point${Math.abs(Math.round((last.him - first.him) * 100)) > 1 ? 's' : ''}` : ''}. Même calcul que l’onglet Concurrents (graphique « Part de voix dans le temps »).`);
  if (!hit && /\b(face a|contre|vs)\b/.test(correctTypos(q))) lines.push('', 'Je n’ai pas reconnu le concurrent : citez-le tel qu’il apparaît dans l’onglet Concurrents.');
  return { intent: 'share_of_voice', lines, results: [r] };
};

const composeOther: Composer = (c, q) => {
  const a = c.latest;
  void otherV2;
  return {
    intent: 'other',
    lines: [
      `Je n’ai pas de donnée pour répondre à cette question : je réponds uniquement à partir de l’audit${a ? ` du ${frDate(a.createdAt)}` : ''}, de la fiche de vérité, des tâches et du trafic de ${c.business.name}. Questions proches :`,
      ...closeQuestions(c, q).map((x) => `- ${x}`),
    ],
    results: [],
  };
};

const COMPOSERS: Record<CopilotIntent, Composer> = {
  why_competitor: composeWhyCompetitor,
  faq: v2('faq', (c) => faq(c), ['draftDeliverable']),
  prices: v2('prices', prices, ['checkFact']),
  review_reply: (c, q) => {
    const r = tool(c, 'draftDeliverable', { kind: 'review_reply', context: q });
    return { intent: 'review_reply', lines: r.text.split('\n'), results: [r], deliverables: r.deliverables };
  },
  committee: v2('committee', (c) => committee(c), ['getScore', 'getRank', 'getFactErrors', 'getTraffic', 'getTasks']),
  first_source: v2('first_source', (c) => firstSource(c), ['getOpportunities']),
  traffic: v2('traffic', traffic, ['getTraffic', 'getSales']),
  sales: v2('traffic', traffic, ['getSales']),
  weekly_plan: v2('weekly_plan', weeklyPlan, ['getTasks']),
  comparison: composeComparison,
  product_pages: v2('product_pages', (c, q) => productPages(c, q), ['getPromptResults']),
  share_of_voice: composeShareOfVoice,
  score: composeScore,
  provider_score: composeScore,
  rank: composeRank,
  competitor: composeCompetitor,
  citations_urls: composeCitationsUrls,
  track_question: composeTrackQuestion,
  period_compare: composePeriod,
  fact_lookup: composeFactLookup,
  fact_errors: composeFactErrors,
  missing_queries: composeMissing,
  fastest_competitor: composeFastest,
  export: composeExport,
  content_ideas: composeIdeas,
  content_brief: composeBrief,
  outreach_email: composeOutreach,
  gbp_description: composeGbp,
  gbp_audit: composeGbpAudit,
  crawlers: composeCrawlers,
  plan_quarter: composePlanQuarter,
  page_citable: composeCitable,
  perception: composePerception,
  shopping: composeShopping,
  traffic_why: composeTrafficWhy,
  opportunities: v2('first_source', (c) => firstSource(c), ['getOpportunities']),
  tasks: composeTasks,
  compound: composeOther,
  thanks: composeThanks,
  greeting: composeGreeting,
  other: composeOther,
};

/** Intention finale : un nom de concurrent connu seul (« Et Atelier Henry ? ») → fiche concurrent. */
function refine(c: CopilotContext, q: string, intent: CopilotIntent): CopilotIntent {
  // Produit du catalogue nommé avec « fiche », « description », « texte » → la fiche de CE produit.
  if (intent === 'product_pages' && c.segment === 'local') return /\bfiche\b/.test(correctTypos(q)) ? 'gbp_description' : intent;
  if (c.catalog?.length && (intent === 'other' || intent === 'gbp_description' || intent === 'product_pages') && /\b(fiche|description|texte|page)\b/.test(correctTypos(q)) && productInQuestion(c, q)) return 'product_pages';
  if (intent === 'other' || intent === 'rank') {
    const hit = resolveCompetitor(c, q);
    if (hit && !/\b(rang|classement)\b/.test(correctTypos(q))) return 'competitor';
  }
  return intent;
}

function sourcesLine(results: ToolResult[]): { refs: SourceRef[]; line: string | null } {
  const seen = new Set<string>();
  const refs: SourceRef[] = [];
  for (const r of results) {
    if (!r.ok || seen.has(r.source.href + r.source.label)) continue;
    seen.add(r.source.href + r.source.label);
    refs.push(r.source);
  }
  return { refs, line: refs.length ? `Source${refs.length > 1 ? 's' : ''} : ${refs.map((s) => `[${s.label}](${s.href})`).join(' ; ')}` : null };
}

function finalize(parts: Composed[]): ScriptedAnswer {
  const results = parts.flatMap((p) => p.results);
  const { refs, line } = sourcesLine(results);
  const body =
    parts.length === 1
      ? parts[0].lines
      : parts.flatMap((p, i) => [...(i ? ['', '---', ''] : []), ...p.lines]);
  const content = [...body, ...(line ? ['', line] : [])]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    intent: parts.length > 1 ? 'compound' : parts[0].intent,
    content,
    deliverables: parts.flatMap((p) => p.deliverables ?? []),
    tools: results.map((r) => ({ name: r.tool, args: r.args })),
    sources: refs,
    actions: parts.flatMap((p) => p.actions ?? []),
  };
}

/** Réponse du mode démo, composée à partir des outils. */
export function scriptedAnswer(c: CopilotContext, question: string): ScriptedAnswer {
  const parts = splitCompound(question);
  if (parts.length > 1) {
    const intents = parts.map((p) => refine(c, p, detectIntent(p)));
    const useful = parts.map((p, i) => ({ p, intent: intents[i] })).filter((x) => x.intent !== 'other' && x.intent !== 'thanks' && x.intent !== 'greeting');
    const distinct = new Set(useful.map((x) => x.intent));
    if (useful.length > 1 && distinct.size > 1) return finalize(useful.slice(0, 3).map((x) => COMPOSERS[x.intent](c, x.p)));
  }
  const intent = refine(c, question, detectIntent(question));
  return finalize([COMPOSERS[intent](c, question)]);
}

export { monthLabel };
