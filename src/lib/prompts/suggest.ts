/**
 * Suggestions de questions à suivre, étiquetées « suggestion » :
 * 1. depuis le site (titres de la page d'accueil, via la récupération sûre d'AUDIT-SITE si disponible),
 *    sinon depuis la catégorie et l'offre déclarées ;
 * 2. depuis le secteur et le parcours (gabarits du moteur, y compris les variantes non retenues par l'audit) ;
 * 3. depuis les questions où les concurrents sont cités et pas le client.
 * Classées par intention, sans doublons (forme canonique + similarité de Jaccard ≥ 0,8), 20 au plus.
 * Déterministe : aucun LLM, aucune donnée inventée.
 */
import type { Business } from '@/lib/db';
import { buildQueries, resolveTrade, zoneInfo } from '@/lib/engine/queries';
import { buildBrandQueries, buildSegmentQueries, indef, pluralHead, segmentOf } from '@/lib/engine/queries-v2';
import type { AuditInput, AuditResult, QuerySpec } from '@/lib/engine/types';
import { capitalize } from '@/lib/engine/util';
import type { SiteSnapshot } from './adapters';
import { demandIndex, type DemandContext } from './demand';
import { intentOfQuery } from './engine';
import { classifyIntent, dedupeTexts, isDuplicate, normalizeQuestion, tagsForIntent, validateText } from './text';
import { INTENT_LABEL, INTENT_STAGE, PROMPT_INTENTS, type PromptIntent, type PromptSuggestion, type SuggestionSource } from './types';

export const SUGGESTION_COUNT = 20;

export interface SuggestContext {
  business: Pick<Business, 'id' | 'name' | 'trade' | 'city' | 'district' | 'website' | 'segment'>;
  /** audits du commerce, du plus ancien au plus récent */
  audits?: AuditResult[];
  /** questions déjà suivies (actives ou non) : jamais re-suggérées */
  existing?: { text: string }[];
  /** surcharge déclarée par le client */
  category?: string;
  offering?: string;
  /** page d'accueil récupérée par @/lib/siteaudit (sinon null) */
  site?: SiteSnapshot | null;
  limit?: number;
}

interface Candidate {
  text: string;
  intent: PromptIntent;
  source: SuggestionSource;
  why: string;
  tags?: string[];
  theme?: string;
  queryId?: string;
}

const SOURCE_PRIORITY: Record<SuggestionSource, number> = { concurrents: 0, site: 1, offre: 2, secteur: 3 };
const DEMAND_RANK = { fort: 0, moyen: 1, faible: 2 } as const;

/** Entrée d'audit reconstituée : celle du dernier audit, complétée par la fiche du commerce et les surcharges. */
export function inputFor(ctx: SuggestContext): AuditInput {
  const last = ctx.audits?.length ? ctx.audits[ctx.audits.length - 1].input : undefined;
  const b = ctx.business;
  return {
    ...(last ?? {}),
    businessName: last?.businessName || b.name,
    trade: last?.trade || b.trade,
    city: last?.city || b.city,
    district: last?.district ?? b.district,
    website: last?.website ?? b.website,
    segment: last?.segment ?? b.segment ?? 'local',
    ...(ctx.category ? { category: ctx.category } : {}),
    ...(ctx.offering ? { offering: ctx.offering } : {}),
  };
}

function fromQuery(q: QuerySpec, source: SuggestionSource, why: string): Candidate {
  return { text: q.text, intent: intentOfQuery(q), source, why, queryId: q.id };
}

function isFem(phrase: string): boolean {
  return indef(phrase).startsWith('une ');
}

function categoryOf(input: AuditInput): string {
  const seg = segmentOf(input);
  if (seg === 'ecommerce') return (input.productCategories?.[0] || input.category || input.trade || '').trim();
  if (seg === 'pme') {
    const full = (input.category || input.trade || '').trim();
    return full.replace(/\s+pour\s+(?:les\s+|une\s+|des\s+)?(?:pme|tpe|eti|startups?|entreprises?|ind[ée]pendants)\b.*$/i, '') || full;
  }
  return resolveTrade(input.trade).label;
}

// ---------------------------------------------------------------------------
// 1. Secteur et parcours (gabarits du moteur)
// ---------------------------------------------------------------------------
function partitive(s: string): string {
  if (/^le\s/i.test(s)) return `du ${s.slice(3)}`;
  if (/^les\s/i.test(s)) return `des ${s.slice(4)}`;
  return `de ${s}`;
}

export function sectorCandidates(input: AuditInput): Candidate[] {
  const seg = segmentOf(input);
  const why = 'Question type de votre secteur, posée par les clients qui cherchent un prestataire.';
  const out: Candidate[] = [];
  const pool = seg === 'local' ? buildQueries(input, 12) : buildSegmentQueries(input, 12);
  for (const q of pool) out.push(fromQuery(q, 'secteur', why));
  for (const q of buildBrandQueries(input, 'paid')) out.push(fromQuery(q, 'secteur', 'Ce que les IA disent de vous quand on vous cite par votre nom.'));
  if (seg === 'local') {
    const t = resolveTrade(input.trade);
    const z = zoneInfo(input);
    for (const s of t.services.slice(2)) {
      out.push({ text: `Qui fait ${partitive(s)} à ${z.zone} ?`, intent: 'service', source: 'secteur', why: 'Service courant de votre métier, pas encore suivi.' });
    }
    const fem = t.g === 'f';
    out.push({ text: `Combien coûte ${fem ? 'une' : 'un'} ${t.label} à ${z.city} ?`, intent: 'prix', source: 'secteur', why: 'Les questions de prix précèdent souvent la prise de contact.' });
    out.push({ text: `${capitalize(t.label)} ouvert le dimanche à ${z.city} ?`, intent: 'urgence', source: 'secteur', why: 'Disponibilité : un critère fréquent dans les questions locales.' });
  } else if (seg === 'ecommerce') {
    for (const pc of (input.productCategories ?? []).slice(2)) {
      out.push({ text: `Quelles sont les meilleures marques de ${pc} ?`, intent: 'recommandation', source: 'secteur', why: 'Catégorie de produits déclarée, pas encore suivie.' });
      out.push({ text: `${capitalize(pc)} : quelles marques ont les meilleurs avis ?`, intent: 'avis', source: 'secteur', why: 'Catégorie de produits déclarée, pas encore suivie.' });
    }
  }
  return out;
}

/**
 * Variantes par intention (gabarits Repéré) : couvrent les intentions que les gabarits de l'audit ne posent pas
 * (prix, avis, comparatif, alternative, achat…), pour proposer un éventail complet.
 */
export function variantCandidates(input: AuditInput): Candidate[] {
  const seg = segmentOf(input);
  const why = 'Variante courante de question dans votre secteur, sur une intention pas encore couverte.';
  const out: Candidate[] = [];
  const push = (text: string, intent: PromptIntent, theme?: string) => out.push({ text, intent, source: 'secteur', why, ...(theme ? { theme } : {}) });
  if (seg === 'local') {
    const t = resolveTrade(input.trade);
    const z = zoneInfo(input);
    const fem = t.g === 'f';
    const un = fem ? 'Une' : 'Un';
    const quel = fem ? 'Quelle' : 'Quel';
    const T = capitalize(t.label);
    push(`${un} ${t.label} de confiance à ${z.city}, vous en connaissez ?`, 'recommandation');
    push(`${quel} ${t.label} près de chez moi à ${z.zone} ?`, 'proximite');
    push(`${quel} ${t.label} intervient le soir à ${z.zone} ?`, 'urgence');
    push(`${quel} ${t.label} est le mieux noté à ${z.city} ?`, 'avis');
    push(`${T} pas cher à ${z.city} : ${fem ? 'laquelle' : 'lequel'} choisir ?`, 'prix');
    push(`${T} indépendant ou grande enseigne à ${z.city} : que choisir ?`, 'comparatif');
    push(`${quel} ${t.label} accepte les petits travaux à ${z.city} ?`, 'service');
    push(`${quel} ${t.label} est ${fem ? 'recommandée' : 'recommandé'} par ses clients à ${z.city} ?`, 'avis');
    push(`${T} à ${z.city} : comment éviter les arnaques ?`, 'avis');
    for (const sv of t.services.slice(0, 2)) push(`${capitalize(sv)} à ${z.city} : combien ça coûte ?`, 'prix', capitalize(sv));
  } else if (seg === 'pme') {
    const cat = categoryOf(input);
    if (!cat) return out;
    const fem = isFem(cat);
    const quel = fem ? 'Quelle' : 'Quel';
    const C = capitalize(cat);
    push(`${quel} ${cat} choisir pour une entreprise de 10 salariés ?`, 'recommandation');
    push(`${quel} ${cat} est le plus simple à prendre en main ?`, 'service');
    push(`Combien coûte ${indef(cat)} par mois ?`, 'prix');
    push(`${C} : que disent les avis des utilisateurs ?`, 'avis');
    push(`${C} : solution française ou internationale, que choisir ?`, 'comparatif');
    push(`${C} : quelles alternatives aux leaders du marché ?`, 'alternative');
    push(`${C} : ${fem ? 'laquelle' : 'lequel'} offre le meilleur support client ?`, 'service');
    push(`${quel} ${cat} pour une start-up en croissance ?`, 'recommandation');
    push(`${C} : ${fem ? 'laquelle' : 'lequel'} a le meilleur rapport qualité-prix ?`, 'prix');
    push(`${C} : quelles questions poser avant de choisir ?`, 'service');
  } else {
    const cats = (input.productCategories?.length ? input.productCategories : [categoryOf(input)]).filter(Boolean).slice(0, 3);
    for (const pc of cats) {
      const P = capitalize(pc);
      push(`${P} : où l'acheter en ligne ?`, 'achat', P);
      push(`${P} : quel prix pour une bonne qualité ?`, 'prix', P);
      push(`${P} : quelles marques ont les meilleurs avis ?`, 'avis', P);
      push(`${P} : quelles alternatives aux grandes marques ?`, 'alternative', P);
      push(`Quelle marque de ${pc} offrir en cadeau ?`, 'recommandation', P);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Site (titres) ou, à défaut, catégorie et offre
// ---------------------------------------------------------------------------
const SKIP_HEADING = /^(accueil|contact|contactez|mentions|blog|actualit|a propos|qui sommes|nos clients|avis|faq|panier|connexion|compte|menu|newsletter|cookies|recrutement|carri|plan du site|cgv|conditions|politique|suivez|nous trouver|livraison offerte|copyright)/;

export function siteCandidates(input: AuditInput, site: SiteSnapshot): Candidate[] {
  const seg = segmentOf(input);
  const z = zoneInfo(input);
  const brand = normalizeQuestion(input.businessName);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of [...site.headings, site.title ?? ''].slice(0, 40)) {
    const h = raw.split(/[|–—:·]/)[0].replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
    const n = normalizeQuestion(h);
    const words = n.split(' ').filter(Boolean);
    if (words.length < 1 || words.length > 6 || h.length < 4 || h.length > 60) continue;
    if (SKIP_HEADING.test(n) || (brand && n.includes(brand)) || seen.has(n)) continue;
    if (/\d{2}[ .]?\d{2}[ .]?\d{2}/.test(h) || /@/.test(h)) continue;
    seen.add(n);
    const service = /^[A-ZÀ-Ý]{2,}/.test(h) ? h : h.charAt(0).toLowerCase() + h.slice(1);
    const text =
      seg === 'local'
        ? `${capitalize(service)} à ${z.zone} : à qui s'adresser ?`
        : seg === 'pme'
          ? `${capitalize(service)} : quelle entreprise choisir pour une PME ?`
          : `${capitalize(service)} : quelle marque choisir ?`;
    out.push({ text, intent: classifyIntent(text, [input.businessName]) === 'recommandation' ? 'service' : classifyIntent(text), source: 'site', why: `Rubrique « ${h} » de votre site : les IA vous citent-elles sur ce sujet ?`, theme: capitalize(service) });
    if (out.length >= 8) break;
  }
  return out;
}

const QUALIFIERS: { re: RegExp; label: (m: RegExpMatchArray) => string }[] = [
  { re: /\ben ligne\b/i, label: () => 'en ligne' },
  { re: /fabriqu\w*\s+(en france|à [A-ZÀ-Ý][\wÀ-ÿ-]+)/i, label: (m) => `fabriqué ${m[1].toLowerCase().startsWith('en') ? 'en France' : m[1]}` },
  { re: /z[ée]ro d[ée]chet/i, label: () => 'zéro déchet' },
  { re: /\bbio(logique)?\b/i, label: () => 'bio' },
  { re: /\bvegan\b/i, label: () => 'vegan' },
  { re: /sans engagement/i, label: () => 'sans engagement' },
  { re: /sur mesure/i, label: () => 'sur mesure' },
  { re: /\b(24 ?h ?\/ ?24|7 ?j ?\/ ?7)\b/i, label: () => '7 jours sur 7' },
  { re: /à domicile/i, label: () => 'à domicile' },
];

export function offerCandidates(input: AuditInput): Candidate[] {
  const seg = segmentOf(input);
  const cat = categoryOf(input);
  if (!cat) return [];
  const offering = (input.offering ?? '').trim();
  const fem = seg === 'local' ? resolveTrade(input.trade).g === 'f' : isFem(cat);
  const quel = fem ? 'Quelle' : 'Quel';
  const lequel = fem ? 'laquelle' : 'lequel';
  const out: Candidate[] = [];
  const why = 'Tiré de votre offre déclarée.';
  for (const q of QUALIFIERS) {
    const m = offering.match(q.re);
    if (!m) continue;
    const qual = q.label(m);
    if (normalizeQuestion(cat).includes(normalizeQuestion(qual))) continue;
    out.push({ text: `${quel} ${cat} ${qual} recommandes-tu ?`, intent: 'recommandation', source: 'offre', why });
  }
  // Fonctions courtes listées après une virgule (« DSN et absences inclus » → DSN, absences).
  const tail = offering.split(',').slice(1).join(' et ');
  const features = tail
    .replace(/\b(inclus|incluses?|compris|comprises?|offerts?|offertes?)\b/gi, '')
    .split(/\bet\b|\+|\//i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && s.split(' ').length <= 3 && !/\bpour\b|\d/.test(s));
  for (const f of features.slice(0, 3)) {
    out.push({ text: `${capitalize(cat)} avec ${f} : ${lequel} choisir ?`, intent: 'comparatif', source: 'offre', why, theme: capitalize(f) });
  }
  if (seg === 'pme') {
    out.push({ text: `Les ${pluralHead(cat)} les plus recommandés pour une PME en ${input.market || 'France'} ?`, intent: 'recommandation', source: 'offre', why });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Questions où les concurrents sont cités
// ---------------------------------------------------------------------------
export function competitorCandidates(input: AuditInput, audit: AuditResult | undefined): Candidate[] {
  if (!audit) return [];
  const seg = segmentOf(input);
  const out: Candidate[] = [];
  // Questions de l'audit où, sur la majorité des IA, des concurrents sont cités et pas le client.
  for (const q of audit.queries) {
    if (q.kind === 'brand' || /^B\d/.test(q.id)) continue;
    const ms = audit.mentions.filter((m) => m.queryId === q.id);
    if (!ms.length) continue;
    const lost = ms.filter((m) => !m.mentioned && m.competitors.length > 0);
    if (lost.length * 2 < ms.length) continue;
    const names = [...new Set(lost.flatMap((m) => m.competitors))].slice(0, 3);
    out.push({ ...fromQuery(q, 'concurrents', `Les IA y citent ${names.join(', ')}, pas vous.`), tags: ['concurrents'] });
  }
  const top = audit.competitors.slice(0, 3).map((c) => c.name);
  const z = zoneInfo(input);
  const cat = categoryOf(input);
  for (const c of top) {
    const text =
      seg === 'local'
        ? `Quelle alternative à ${c} pour un ${resolveTrade(input.trade).label} à ${z.city} ?`
        : seg === 'pme'
          ? `Quelle alternative à ${c} pour une PME ?`
          : `Quelle alternative à ${c} en ${cat} ?`;
    out.push({ text, intent: 'alternative', source: 'concurrents', why: `${c} est le concurrent le plus cité : captez ceux qui cherchent une alternative.`, tags: ['concurrents'] });
  }
  if (top.length >= 2 && seg !== 'local') {
    const [a, b] = top;
    out.push({ text: `${a} ou ${b} : ${seg === 'ecommerce' ? 'laquelle' : 'lequel'} choisir ?`, intent: 'comparatif', source: 'concurrents', why: 'Comparatif entre vos deux concurrents les plus cités : y êtes-vous proposé en troisième voie ?', tags: ['concurrents'] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------
function rankWithinIntent(a: PromptSuggestion, b: PromptSuggestion): number {
  return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source] || DEMAND_RANK[a.demand.level] - DEMAND_RANK[b.demand.level];
}

export function suggestPrompts(ctx: SuggestContext): PromptSuggestion[] {
  const limit = Math.max(1, Math.min(ctx.limit ?? SUGGESTION_COUNT, 50));
  const input = inputFor(ctx);
  const latest = ctx.audits?.length ? ctx.audits[ctx.audits.length - 1] : undefined;
  const competitors = latest?.competitors.map((c) => c.name) ?? input.knownCompetitors ?? [];
  const dctx: DemandContext = { city: input.city, district: input.district, names: [input.businessName, ...competitors] };

  const raw: Candidate[] = [
    ...competitorCandidates(input, latest),
    ...(ctx.site ? siteCandidates(input, ctx.site) : []),
    ...offerCandidates(input),
    ...sectorCandidates(input),
    ...variantCandidates(input),
  ];
  const valid = raw.filter((c) => validateText(c.text).ok);
  const unique = dedupeTexts(valid, ctx.existing ?? []);

  const all: PromptSuggestion[] = unique.map((c) => ({
    text: c.text,
    intent: c.intent,
    intentLabel: INTENT_LABEL[c.intent],
    stage: INTENT_STAGE[c.intent],
    theme: c.theme ?? INTENT_LABEL[c.intent],
    tags: [...new Set([...(c.tags ?? []), ...tagsForIntent(c.intent)])],
    source: c.source,
    why: c.why,
    demand: demandIndex(c.text, c.intent, dctx),
    label: 'suggestion' as const,
    ...(c.queryId ? { queryId: c.queryId } : {}),
  }));

  // Répartition équilibrée : tour à tour une suggestion par intention, puis classement par intention.
  const byIntent = new Map<PromptIntent, PromptSuggestion[]>();
  for (const s of all) byIntent.set(s.intent, [...(byIntent.get(s.intent) ?? []), s]);
  for (const list of byIntent.values()) list.sort(rankWithinIntent);
  const picked: PromptSuggestion[] = [];
  let round = 0;
  while (picked.length < limit) {
    let added = false;
    for (const intent of PROMPT_INTENTS) {
      const s = byIntent.get(intent)?.[round];
      if (s && picked.length < limit) {
        picked.push(s);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  const order = (i: PromptIntent) => PROMPT_INTENTS.indexOf(i);
  return picked.sort((a, b) => order(a.intent) - order(b.intent) || rankWithinIntent(a, b));
}

/** Vrai si `text` correspond à une suggestion (utile pour marquer l'origine « suggestion » à l'ajout). */
export function matchesSuggestion(text: string, suggestions: PromptSuggestion[]): boolean {
  return suggestions.some((s) => isDuplicate(text, s.text));
}
