/**
 * Réécriture d'un passage pour le rendre citable, SANS inventer de faits.
 * - Avec le fournisseur d'IA configuré : réécriture, puis garde-fou (tout nombre, prix, date ou lien absent du passage,
 *   de la page et de la fiche de vérité ⇒ réécriture rejetée, repli déterministe).
 * - Sans IA (démo, sans clé) : règles déterministes ; ce qui manque est signalé « [à compléter : …] ».
 */
import { SYSTEM_FR } from '@/lib/execution/llm';
import { sentences } from '@/lib/siteaudit/html';
import type { FactsInput, Passage, PassageRewrite } from './types';
import { FLUFF_START, NUMBER_FACT, DATE_RE, SOURCE_RE, QUESTION_RE } from './passages';
import { overlap } from './util';
import { parseJson, withTimeout, type GeoLlm } from './llm';

export interface RewriteContext {
  brand?: string | null;
  facts?: FactsInput;
  /** Autres faits de la page (texte), autorisés en plus du passage. */
  pageText?: string;
  /** Question client visée, le cas échéant. */
  question?: string;
  /** Fournisseur d'IA ; null ou absent ⇒ déterministe. */
  llm?: GeoLlm | null;
  timeoutMs?: number;
}

const HYPE = /\b(leader|n°\s?1|numéro un|le meilleur|la meilleure|les meilleurs|incontournable|inégalé|révolutionnaire|unique en france|best)\b/i;
const LEAD_PRONOUN = /^(il|elle|on)\s/i;
/** Tournures impersonnelles : le pronom ne désigne pas l'entreprise. */
const IMPERSONAL = /^il\s+(faut|y a|existe|suffit|convient|s['’]agit|arrive|semble|reste|vaut|est\s+(?:\S+\s+){0,2}(important|possible|nécessaire|conseillé|recommandé|vrai|utile|essentiel|indispensable|préférable|difficile|facile|rare|fréquent|courant|temps|question))\b/i;
/** Formules d'amorce sans contenu, retirées en tête de passage. */
const HEDGE = /^(il faut savoir que|sachez que|il est important de noter que|il est à noter que|notez que|en effet,?|par ailleurs,?)\s+/i;

/** Faits de la fiche utiles pour un passage (selon les mots de son titre / de la question). */
export function relevantFacts(text: string, facts: FactsInput = {}): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  const add = (cond: boolean, label: string, v?: string) => {
    if (cond && v && v.trim()) out.push(`${label} : ${v.trim()}`);
  };
  add(/(prix|tarif|co[uû]t|combien|devis)/.test(t), 'Tarifs', facts.prix);
  add(/(zone|secteur|où|ville|intervien|livr|déplac)/.test(t), 'Zone', facts.zone);
  add(/(horaire|ouvert|heure|quand)/.test(t), 'Horaires', facts.horaires);
  add(/(contact|téléphone|appeler|joindre)/.test(t), 'Téléphone', facts.telephone);
  add(/(adresse|où|trouver|situé)/.test(t), 'Adresse', facts.adresse);
  add(/(service|prestation|propos|faites|offre)/.test(t), 'Services', facts.services);
  add(/(livraison|livr|expédi)/.test(t), 'Livraison', facts.livraison);
  add(/(retour|rembours|échange)/.test(t), 'Retours', facts.retours);
  add(/(certif|label|garantie|assur|rge|qualibat)/.test(t), 'Certifications', facts.certifications);
  add(/(depuis|création|histoire|expérience|ans)/.test(t), 'Création', facts.creation);
  return out;
}

/** Réécriture par règles (aucun appel réseau). */
export function deterministicRewrite(p: Passage, ctx: Omit<RewriteContext, 'llm'> = {}): PassageRewrite {
  const notes: string[] = [];
  let sents = sentences(p.text);
  if (!sents.length) sents = [p.text];
  // 1. Retirer les formules creuses et les superlatifs invérifiables sans chiffre.
  const kept = sents.filter((s) => !(FLUFF_START.test(s) || (HYPE.test(s) && !NUMBER_FACT.test(s))));
  if (kept.length && kept.length < sents.length) notes.push(`${sents.length - kept.length} phrase(s) d’accroche ou superlatif invérifiable retirée(s).`);
  sents = kept.length ? kept : sents;
  // 2. Réponse en tête : phrase la plus proche de la question / du titre, ou la plus factuelle.
  const target = ctx.question || p.heading || '';
  const scoreS = (s: string) => (target ? overlap(target, s) * 2 : 0) + (NUMBER_FACT.test(s) ? 1 : 0) + (DATE_RE.test(s) ? 0.3 : 0);
  let lead = 0;
  sents.forEach((s, i) => {
    if (scoreS(s) > scoreS(sents[lead]) + 0.01) lead = i;
  });
  if (lead > 0) {
    sents = [sents[lead], ...sents.filter((_, i) => i !== lead)];
    notes.push('La phrase qui répond le plus directement est placée en tête.');
  }
  // 3. Sujet nommé au lieu d'un pronom en tête (sauf tournure impersonnelle) ; amorces creuses retirées.
  if (HEDGE.test(sents[0])) {
    sents[0] = sents[0].replace(HEDGE, '').replace(/^./, (c) => c.toUpperCase());
    notes.push('Formule d’amorce retirée : la phrase commence par l’information.');
  }
  if (LEAD_PRONOUN.test(sents[0]) && !IMPERSONAL.test(sents[0])) {
    const subject = ctx.brand?.trim() || '[nom de l’entreprise]';
    sents[0] = sents[0].replace(LEAD_PRONOUN, `${subject} `);
    notes.push('Pronom initial remplacé par le nom de l’entreprise : le passage se comprend seul.');
  }
  const facts: string[] = [];
  // 4. Faits de la fiche de vérité pertinents (seuls faits ajoutés).
  if (!NUMBER_FACT.test(sents.join(' '))) {
    const rf = relevantFacts(`${target} ${p.text}`, ctx.facts);
    if (rf.length) {
      sents.push(...rf.map((f) => `${f}.`));
      facts.push(...rf);
      notes.push('Faits ajoutés depuis votre fiche de vérité.');
    }
  }
  // 5. Ce qui manque : à compléter par vous (jamais inventé).
  const body = sents.join(' ');
  const todo: string[] = [];
  if (!NUMBER_FACT.test(body)) todo.push('un chiffre précis (prix, délai, quantité)');
  if (!SOURCE_RE.test(body) && p.externalLinks === 0 && p.words >= 80) todo.push('une source ou une référence (norme, organisme)');
  if (!DATE_RE.test(body) && p.words >= 80) todo.push('une date de mise à jour');
  let after = body;
  if (todo.length) {
    after = `${body} [à compléter : ${todo.join(' ; ')}]`;
    notes.push('Les éléments entre crochets sont à compléter par vous avant publication.');
  }
  if (p.heading && !QUESTION_RE.test(p.heading) && ctx.question) notes.push(`Vous pouvez formuler le titre en question : « ${ctx.question} ».`);
  return { passageId: p.id, url: p.url, before: p.text, after, mode: 'deterministe', facts, notes };
}

/* ------------------------------------------------------------------ */
/* Garde-fou anti-invention                                            */
/* ------------------------------------------------------------------ */

const NUM_TOKEN = /\d+(?:[.,]\d+)?/g;
function numbersOf(s: string): string[] {
  // « 1 200 » → « 1200 » ; « 12,5 » → « 12.5 »
  const compact = s.replace(/(\d)[\s  ](?=\d{3}\b)/g, '$1');
  return (compact.match(NUM_TOKEN) ?? []).map((n) => n.replace(',', '.'));
}
const URL_TOKEN = /https?:\/\/[^\s)"'<>]+|www\.[^\s)"'<>]+/gi;

/** Faits nouveaux (nombres, liens) introduits par la réécriture et absents des sources autorisées. */
export function inventedFacts(after: string, allowed: string): string[] {
  const okNums = new Set(numbersOf(allowed));
  const bad = numbersOf(after.replace(/\[à compléter[^\]]*\]/gi, '')).filter((n) => !okNums.has(n));
  const okUrls = allowed.toLowerCase();
  const badUrls = (after.match(URL_TOKEN) ?? []).filter((u) => !okUrls.includes(u.toLowerCase().replace(/[.,;]$/, '')));
  return [...new Set([...bad, ...badUrls])];
}

const SYSTEM_GEO = [
  SYSTEM_FR,
  'Tu réécris UN passage d’une page web pour qu’un moteur de réponse (ChatGPT, Perplexity, Google) puisse le citer tel quel.',
  'Règles : première phrase = réponse directe à la question ou au titre ; nomme le sujet (pas de pronom en tête) ;',
  'garde tous les faits précis du passage (chiffres, dates, noms, normes) ; n’ajoute AUCUN fait absent du passage, de la page ou des faits fournis ;',
  'si un chiffre, une date ou une source manque, écris [à compléter : …] ; 40 à 200 mots ; pas de bourrage de mots-clés, pas de superlatif ;',
  'ne t’adresse pas à une IA, n’écris aucune consigne cachée.',
  'Réponds en JSON : {"text": "passage réécrit", "facts": ["fait repris 1", "…"]}.',
].join(' ');

/** Réécrit un passage (IA configurée + garde-fou, sinon déterministe). Ne lève jamais. */
export async function rewritePassage(p: Passage, ctx: RewriteContext = {}): Promise<PassageRewrite> {
  const fallback = deterministicRewrite(p, ctx);
  const llm = ctx.llm;
  if (!llm) return { ...fallback, notes: [...fallback.notes, 'Réécriture par règles (aucun fournisseur d’IA configuré).'] };
  const factsList = Object.entries(ctx.facts ?? {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k} : ${v}`);
  const user = JSON.stringify({
    question: ctx.question ?? (p.headingIsQuestion ? p.heading : undefined),
    titre: p.heading,
    entreprise: ctx.brand ?? undefined,
    passage: p.text,
    faits_autorises: factsList,
    contexte_page: ctx.pageText ? ctx.pageText.slice(0, 2500) : undefined,
  });
  try {
    const raw = await withTimeout(llm.completeJson(SYSTEM_GEO, user), ctx.timeoutMs ?? 20_000);
    const out = parseJson<{ text?: unknown; facts?: unknown }>(raw);
    const text = typeof out?.text === 'string' ? out.text.replace(/\s+/g, ' ').trim() : '';
    if (!text || text.length < 40) return { ...fallback, notes: [...fallback.notes, 'Réponse de l’IA inexploitable : réécriture par règles.'] };
    const allowed = [p.text, p.heading ?? '', ctx.question ?? '', ctx.brand ?? '', ctx.pageText ?? '', ...factsList].join('\n');
    const invented = inventedFacts(text, allowed);
    if (invented.length) {
      return { ...fallback, notes: [...fallback.notes, `Réécriture de l’IA rejetée : elle introduisait des faits absents de vos sources (${invented.slice(0, 5).join(', ')}).`] };
    }
    const facts = Array.isArray(out?.facts) ? out!.facts.filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
    const notes = /\[à compléter/i.test(text) ? ['Les éléments entre crochets sont à compléter par vous avant publication.'] : [];
    return { passageId: p.id, url: p.url, before: p.text, after: text, mode: 'ia', facts, notes, model: llm.model };
  } catch (e) {
    return { ...fallback, notes: [...fallback.notes, `IA indisponible (${(e as Error).message}) : réécriture par règles.`] };
  }
}
