/**
 * Détection de la mention du commerce et extraction des concurrents (méthode 03 § 4).
 * Déterministe, sans dépendance. L'extraction LLM (§ 4.6) est optionnelle ; l'heuristique (§ 4.7) sert de repli.
 */
import { z } from 'zod';
import type { AuditInput, ExtractedEntity, MentionResult, ProviderAnswer } from './types';
import { COMMON_TRADE_WORDS, TRADES, resolveTrade, zoneInfo, ordinalFr } from './queries';
import type { Extractor } from './providers/http';
import { escapeRe, stripAccents } from './util';

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

const LEGAL = /\b(sarl|sasu|sas|eurl|sa|snc|sci|eirl|ei|scop|selarl|selas|micro entreprise|auto entrepreneur)\b/g;
const PREFIX = /^(le|la|les|l|chez|ets|etablissements|maison|societe|ste|cabinet|groupe)\s+/;

/** Cache borné de norm() : fonction pure, appelée des milliers de fois sur les mêmes segments (profil du mock). */
const NORM_CACHE = new Map<string, string>();
const NORM_CACHE_MAX = 20_000;

/** Normalisation § 4.1 (étapes 1 à 3). */
export function norm(s: string): string {
  const hit = NORM_CACHE.get(s);
  if (hit !== undefined) return hit;
  const out = normUncached(s);
  if (s.length <= 2_000) {
    if (NORM_CACHE.size >= NORM_CACHE_MAX) NORM_CACHE.clear();
    NORM_CACHE.set(s, out);
  }
  return out;
}

function normUncached(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/['’`]/g, ' ')
    .replace(/[-_./]/g, ' ')
    .replace(/[^a-z0-9À-ɏ\s]/g, ' ')
    .replace(LEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** norm() puis retrait des préfixes de liaison (« le », « chez », « ets »…). */
export function normName(s: string): string {
  let n = norm(s);
  let prev = '';
  while (prev !== n) {
    prev = n;
    n = n.replace(PREFIX, '');
  }
  return n;
}

/** Domaine enregistrable : « https://www.plomberie-dupont.fr/contact » → « plomberie-dupont.fr ». */
export function registrableDomain(url: string): string {
  let h = url.trim().toLowerCase();
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\d?\./, '');
  h = h.split(/[/?#:]/)[0];
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const two = labels.slice(-2).join('.');
  const keep3 = /^(co|com|org|gouv|asso|net|ac|gov)\.[a-z]{2}$/.test(two);
  return labels.slice(keep3 ? -3 : -2).join('.');
}

/* ------------------------------------------------------------------ */
/* Similarités                                                         */
/* ------------------------------------------------------------------ */

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array<boolean>(la).fill(false);
  const mb = new Array<boolean>(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, lb);
    for (let j = lo; j < hi; j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true;
      m++;
      break;
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < Math.min(4, la, lb) && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

export function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[lb] / Math.max(la, lb);
}

/**
 * Similarité utilisée pour la correspondance floue : moyenne de Jaro-Winkler et de 1 − Levenshtein normalisé.
 * Jaro-Winkler seul sur-récompense les préfixes communs (« martin » ≈ « martinez » = 0,95).
 */
export function similarity(a: string, b: string): number {
  return (jaroWinkler(a, b) + levenshteinSim(a, b)) / 2;
}

/** Meilleure similarité entre `variant` et une fenêtre glissante de k±1 tokens de `segNorm`. */
export function matchScore(segNorm: string, variant: string, sim: (a: string, b: string) => number = similarity): number {
  if (!variant || !segNorm) return 0;
  if (new RegExp(`(^|\\s)${escapeRe(variant)}(\\s|$)`).test(segNorm)) return 1;
  const k = variant.split(' ').length;
  const toks = segNorm.split(' ');
  let best = 0;
  for (let w = Math.max(1, k - 1); w <= k + 1; w++) {
    for (let i = 0; i + w <= toks.length; i++) best = Math.max(best, sim(toks.slice(i, i + w).join(' '), variant));
  }
  return best;
}

function hasWord(hayNorm: string, needleNorm: string): boolean {
  return !!needleNorm && ` ${hayNorm} `.includes(` ${needleNorm} `);
}

/* ------------------------------------------------------------------ */
/* Variantes du nom                                                    */
/* ------------------------------------------------------------------ */

/** Noms génériques et enseignes connues : une mention exige une preuve géographique (§ 4.4). */
export const COMMON_NAMES = new Set(
  [
    'bistrot', 'le bistrot', 'le petit bistrot', 'cafe de paris', 'cafe de la paix', 'cafe de la gare', 'le comptoir', 'comptoir',
    'la table', 'table', 'chez nous', 'l atelier', 'atelier', 'la boulangerie', 'paris plomberie', 'plomberie parisienne',
    'le relais', 'relais', 'la brasserie', 'le cafe', 'la terrasse', 'le jardin', 'le central', 'le saint', 'la cave',
  ].map(norm),
);

export const CHAINS = new Set(
  [
    'franck provost', 'jean louis david', 'dessange', 'camille albane', 'saint algue', 'tchip', 'body minute', 'yves rocher',
    'century 21', 'orpi', 'laforet', 'guy hoquet', 'stephane plaza immobilier', 'era immobilier', 'speedy', 'midas', 'norauto',
    'feu vert', 'point s', 'alain afflelou', 'afflelou', 'optic 2000', 'krys', 'general d optique', 'generale d optique',
    'la mie caline', 'paul', 'marie blachere', 'brioche doree', 'dominos', 'domino s pizza', 'pizza hut', 'sushi shop',
    'planet sushi', 'nicolas', 'v and b', 'hippopotamus', 'buffalo grill', 'courtepaille', 'leon de bruxelles', '5 a sec',
  ].map(norm),
);

const NUM_WORDS: Record<string, string> = {
  '1': 'un', '2': 'deux', '3': 'trois', '4': 'quatre', '5': 'cinq', '6': 'six', '7': 'sept', '8': 'huit', '9': 'neuf', '10': 'dix',
};

export interface NameVariants {
  full: string;
  core: string;
  /** nom normalisé en conservant le préfixe (« chez gege ») */
  prefixed: string;
  alts: string[];
  acronym?: string;
  ambiguous: boolean;
  chain: boolean;
  domain?: string;
}

export function tradeWordsFor(trade: string): string[] {
  const t = resolveTrade(trade);
  const labelWords = TRADES.flatMap((x) => [x.key, ...x.aliases, norm(x.label)].join(' ').split(' '));
  return [...new Set([...t.words.map(norm), ...COMMON_TRADE_WORDS, ...labelWords])].filter((w) => w.length > 1);
}

export function buildVariants(input: AuditInput, extraAliases: string[] = []): NameVariants {
  const tradeWords = new Set(tradeWordsFor(input.trade));
  const prefixed = norm(input.businessName);
  const full = normName(input.businessName) || prefixed;
  let core = full
    .split(' ')
    .filter((t) => !tradeWords.has(t))
    .join(' ')
    .trim();
  const coreEmpty = !core;
  if (!core) core = full;

  const words = input.businessName
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^A-Za-z0-9\u00c0-\u024f]/g, ''))
    .filter((w) => w.length > 2 && !new RegExp(`^${LEGAL.source}$`).test(norm(w)));
  const acronym = words.length >= 3 ? words.map((w) => w[0]).join('').toUpperCase() : undefined;

  const alts: string[] = [];
  if (full.length <= 14) {
    const swapped = full
      .split(' ')
      .map((t) => NUM_WORDS[t] ?? Object.keys(NUM_WORDS).find((k) => NUM_WORDS[k] === t) ?? t)
      .join(' ');
    if (swapped !== full) alts.push(swapped);
  }
  for (const a of extraAliases) {
    const n = normName(a);
    if (n) alts.push(n);
  }

  const chain = CHAINS.has(full) || CHAINS.has(prefixed);
  const ambiguous = core.length <= 4 || coreEmpty || COMMON_NAMES.has(core) || COMMON_NAMES.has(full) || chain;
  return {
    full,
    core,
    prefixed,
    alts,
    acronym,
    ambiguous,
    chain,
    domain: input.website ? registrableDomain(input.website) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Géographie : preuves et contre-preuves                              */
/* ------------------------------------------------------------------ */

const BIG_CITIES = [
  'paris', 'lyon', 'marseille', 'toulouse', 'nice', 'nantes', 'montpellier', 'strasbourg', 'bordeaux', 'lille', 'rennes',
  'reims', 'toulon', 'grenoble', 'dijon', 'angers', 'nimes', 'villeurbanne', 'clermont ferrand', 'le mans', 'aix en provence',
  'brest', 'tours', 'amiens', 'limoges', 'annecy', 'perpignan', 'metz', 'besancon', 'orleans', 'rouen', 'mulhouse', 'caen',
  'nancy', 'argenteuil', 'montreuil', 'boulogne billancourt', 'saint denis', 'bruxelles', 'geneve', 'lausanne',
];

export interface GeoContext {
  proofs: string[];
  otherPlaces: string[];
  /** lieux à ne pas prendre pour des noms de commerce */
  placeTokens: string[];
}

export function geoContext(input: Pick<AuditInput, 'city' | 'district'>): GeoContext {
  const zi = zoneInfo(input);
  const city = norm(zi.city);
  const proofs: string[] = [];
  if (zi.quartier) proofs.push(norm(zi.quartier));
  if (zi.arrNum != null) {
    const n = zi.arrNum;
    proofs.push(norm(`${zi.city} ${ordinalFr(n)}`), norm(ordinalFr(n)), `${n}eme`, `${n} eme`, `${n}e arrondissement`, `${n}eme arrondissement`);
    if (n === 1) proofs.push('1ere', '1er arrondissement');
  }
  if (zi.cp) proofs.push(zi.cp);

  const otherPlaces = BIG_CITIES.filter((c) => c !== city && !city.includes(c) && !c.includes(city));
  if (zi.arrNum != null) {
    const max = city === 'paris' ? 20 : city === 'marseille' ? 16 : city === 'lyon' ? 9 : 0;
    for (let i = 1; i <= max; i++) {
      if (i === zi.arrNum) continue;
      otherPlaces.push(norm(`${zi.city} ${ordinalFr(i)}`), `${i}eme arrondissement`, `${i}e arrondissement`);
      if (city === 'paris') otherPlaces.push(`750${String(i).padStart(2, '0')}`);
    }
  }
  const placeTokens = [city, ...(zi.quartier ? [norm(zi.quartier)] : []), 'paris', 'france', 'ile de france', ...BIG_CITIES];
  return { proofs: [...new Set(proofs.filter(Boolean))], otherPlaces: [...new Set(otherPlaces)], placeTokens };
}

/* ------------------------------------------------------------------ */
/* Segmentation                                                        */
/* ------------------------------------------------------------------ */

export interface Segment {
  text: string;
  norm: string;
  start: number;
  listIndex: number | null;
}

const LIST_RE = /^\s{0,1}(\d+[.)]|[-*•])\s+/;
const HEADING_RE = /^\s*#{1,6}\s+\S/;
const BOLD_LINE_RE = /^\s*\*\*[^*]+\*\*/;

export function isListLine(line: string): boolean {
  return LIST_RE.test(line) || HEADING_RE.test(line) || BOLD_LINE_RE.test(line);
}

function sentences(text: string, offset: number): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[.!?…]+(\s+|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const s = text.slice(last, end);
    if (s.trim()) out.push({ text: s.trim(), start: offset + last + (s.length - s.trimStart().length) });
    last = end;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length && text.slice(last).trim()) {
    const s = text.slice(last);
    out.push({ text: s.trim(), start: offset + last + (s.length - s.trimStart().length) });
  }
  return out;
}

/** Découpe en éléments de liste (rang = index 1-based) et, hors liste, en phrases. */
export function splitSegments(text: string): Segment[] {
  const lines: { text: string; start: number }[] = [];
  let pos = 0;
  for (const l of text.split('\n')) {
    lines.push({ text: l, start: pos });
    pos += l.length + 1;
  }
  const hasList = lines.some((l) => isListLine(l.text));
  const segs: Segment[] = [];
  const push = (t: string, start: number, listIndex: number | null) => {
    if (t.trim()) segs.push({ text: t.trim(), norm: norm(t), start, listIndex });
  };
  if (!hasList) {
    for (const l of lines) for (const s of sentences(l.text, l.start)) push(s.text, s.start, null);
    return segs;
  }
  let idx = 0;
  let cur: { text: string; start: number; listIndex: number } | null = null;
  const flush = () => {
    if (cur) push(cur.text, cur.start, cur.listIndex);
    cur = null;
  };
  for (const l of lines) {
    const indentedSub = /^\s{2,}([-*•]|\d+[.)])\s+/.test(l.text);
    if (isListLine(l.text) && !(indentedSub && cur)) {
      flush();
      idx++;
      cur = { text: l.text, start: l.start, listIndex: idx };
    } else if (!l.text.trim()) {
      flush();
    } else if (cur) {
      (cur as { text: string }).text += `\n${l.text}`;
    } else {
      for (const s of sentences(l.text, l.start)) push(s.text, s.start, null);
    }
  }
  flush();
  return segs;
}

function contextAround(text: string, seg: Segment, radius: number): string {
  return text.slice(Math.max(0, seg.start - radius), Math.min(text.length, seg.start + seg.text.length + radius));
}

/* ------------------------------------------------------------------ */
/* Extraction heuristique des entités (§ 4.7)                          */
/* ------------------------------------------------------------------ */

export const PLATFORMS = [
  'google', 'google maps', 'google my business', 'google business profile', 'fiche google', 'pagesjaunes', 'pages jaunes', 'yelp',
  'thefork', 'the fork', 'la fourchette', 'tripadvisor', 'trip advisor', 'doctolib', 'maiia', 'habitatpresto', 'starofservice',
  'star of service', 'facebook', 'instagram', 'trustpilot', 'leboncoin', 'houzz', 'mappy', 'bing', 'bing places', 'apple plans',
  'waze', 'allovoisins', 'nextdoor', 'reddit', 'planity', 'treatwell', 'seloger', 'meilleurs agents', 'meilleursagents', 'yoojo',
  'travaux com', 'quotatis', 'mesdepanneurs', 'uber eats', 'deliveroo', 'michelin', 'guide michelin', 'le fooding', 'gault et millau',
  'solocal', 'fooding', 'justacote', 'kelkoo', 'chatgpt', 'perplexity', 'gemini', 'wikipedia', 'linkedin', 'tiktok', 'youtube', 'qualibat', 'rge',
];
const GENERIC = new Set(
  [
    'artisan', 'conseil', 'conseils', 'astuce', 'astuces', 'voici', 'note', 'remarque', 'important', 'conclusion', 'en resume', 'resume',
    'recommandation', 'recommandations', 'option', 'options', 'adresse', 'adresses', 'avis', 'prix', 'tarif', 'tarifs', 'horaires',
    'contact', 'telephone', 'site', 'site web', 'source', 'sources', 'pourquoi', 'comment', 'points forts', 'points cles', 'a savoir',
    'bon a savoir', 'en bref', 'quelques', 'les', 'mes', 'nos', 'pour', 'si', 'attention', 'alternative', 'alternatives', 'urgence',
    'devis', 'disponibilite', 'specialites', 'specialite', 'services', 'service', 'criteres', 'selection', 'notre selection', 'top',
    'meilleur', 'meilleurs', 'meilleure', 'meilleures', 'bon', 'bonne', 'pensez', 'verifiez', 'comparez', 'je', 'il', 'elle', 'vous',
    'parmi', 'selon', 'd apres', 'plusieurs', 'ces', 'cette', 'ce', 'un', 'une', 'des', 'du', 'de', 'la', 'le', 'et', 'ou', 'a', 'au',
    'aux', 'en', 'sur', 'avec', 'sans', 'chez', 'rue', 'avenue', 'boulevard', 'place', 'quartier', 'arrondissement', 'centre',
  ].map(norm),
);
const STOP_START = /^(voici|les|mes|nos|quelques|pour|en|si|pensez|v[ée]rifiez|comparez|parmi|selon|d'apr[eè]s|attention|astuce|conseil|note|remarque|il|elle|je|vous|ils|on|ce|cette|ces|leur|son|sa|ses|tous|toutes|plusieurs|certains|cela|ici|enfin|ensuite|puis|aussi|sinon|dans|sur|avec|chaque|un|une|des|du|de|le|la)$/i;

function isPlatform(n: string): boolean {
  return PLATFORMS.some((p) => n === p || n.startsWith(`${p} `));
}

function isNoise(name: string, ctx: { tradeWords: Set<string>; geo: GeoContext }): boolean {
  const n = normName(name);
  if (!n || n.length < 2) return true;
  if (isPlatform(n)) return true;
  if (/^\d+$/.test(n.replace(/\s/g, ''))) return true;
  const toks = n.split(' ');
  const places = new Set(ctx.geo.placeTokens.flatMap((p) => p.split(' ')));
  if (toks.every((t) => GENERIC.has(t) || ctx.tradeWords.has(t) || places.has(t) || /^\d+(e|er|eme)?$/.test(t))) return true;
  if (ctx.geo.placeTokens.includes(n)) return true;
  if (toks.length > 7) return true;
  return false;
}

const CAP = /^[A-ZÀ-ÖØ-Þ0-9][A-Za-z0-9\u00c0-\u024f'’&.-]*$/;
const CONNECTORS = new Set(['de', 'du', 'des', "d'", 'd’', '&', 'et', 'la', 'le', 'les', "l'", 'di', 'da', 'del', 'en', 'sur', 'à']);

function cleanCandidate(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/^[\s\-*•#\d.)]+/, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/^\[|\]\([^)]*\)$/g, ''))
    .replace(/[\s:;,.–—-]+$/, '')
    .trim();
}

function firstChunk(s: string): string {
  const seps = [' – ', ' — ', ' - ', ':', '(', ',', ' : '];
  let cut = s.length;
  for (const sep of seps) {
    const i = s.indexOf(sep);
    if (i > 0 && i < cut) cut = i;
  }
  return s.slice(0, cut).trim().split(/\s+/).slice(0, 6).join(' ');
}

function capitalizedRuns(text: string): string[] {
  const out: string[] = [];
  const re = /[^\s]+/g;
  const toks: { w: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) toks.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  let i = 0;
  while (i < toks.length) {
    const clean = (w: string) => w.replace(/^[«"(“*]+|[»")”*,;:.!?]+$/g, '');
    const w0 = clean(toks[i].w);
    if (!CAP.test(w0)) {
      i++;
      continue;
    }
    const prevTok = i > 0 ? toks[i - 1].w : '';
    const sentenceStart = i === 0 || /[.!?:]$/.test(prevTok) || /^[-*•]$/.test(prevTok);
    const run: string[] = [w0];
    let j = i + 1;
    let endedBySep = /[,;:(–—]$/.test(toks[i].w);
    while (j < toks.length && run.length < 7 && !endedBySep && !/[.!?]$/.test(toks[j - 1].w)) {
      const w = clean(toks[j].w);
      if (CAP.test(w)) run.push(w);
      else if (CONNECTORS.has(w.toLowerCase()) && j + 1 < toks.length && CAP.test(clean(toks[j + 1].w))) run.push(w);
      else break;
      endedBySep = /[,;:(–—)]$/.test(toks[j].w);
      j++;
    }
    const next = toks[j]?.w ?? '';
    const followedBySep = endedBySep || /^[(–—-]/.test(next) || next === ':' || /[,;:]$/.test(toks[j - 1].w);
    while (run.length && CONNECTORS.has(run[run.length - 1].toLowerCase())) run.pop();
    let candidate = run;
    if (sentenceStart && STOP_START.test(run[0])) candidate = run.slice(1);
    if (!sentenceStart || followedBySep || candidate !== run) {
      // « Atelier Roux et Ets Bernard » = deux noms ; « Dupont et Fils » = un seul.
      const parts: string[][] = [[]];
      candidate.forEach((w, idx) => {
        const cur = parts[parts.length - 1];
        const rest = candidate.slice(idx + 1);
        if ((w === 'et' || w === '&') && cur.length >= 2 && rest.length >= 2) parts.push([]);
        else cur.push(w);
      });
      for (const part of parts) if (part.length >= 2 && part.length <= 5) out.push(part.join(' '));
    }
    i = j > i ? j : i + 1;
  }
  return out;
}

/** Extraction heuristique (§ 4.7) : éléments de liste (gras ou texte avant séparateur), sinon suites capitalisées. */
export function extractHeuristic(text: string, input: AuditInput): ExtractedEntity[] {
  const tradeWords = new Set(tradeWordsFor(input.trade));
  const geo = geoContext(input);
  const segs = splitSegments(text);
  const listSegs = segs.filter((s) => s.listIndex != null);
  const found: { name: string; pos: number }[] = [];
  const add = (raw: string, pos: number) => {
    const name = cleanCandidate(raw);
    if (!name || isNoise(name, { tradeWords, geo })) return;
    if (STOP_START.test(name.split(/\s+/)[0]) && name.split(/\s+/).length < 2) return;
    const n = normName(name);
    if (found.some((f) => similarity(normName(f.name), n) >= 0.92)) return;
    found.push({ name, pos });
  };
  if (listSegs.length) {
    for (const s of listSegs) {
      const firstLine = s.text.split('\n')[0];
      const bold = /\*\*([^*]+)\*\*/.exec(firstLine);
      const heading = HEADING_RE.test(firstLine) ? firstLine.replace(/^\s*#+\s*/, '') : null;
      const raw = bold ? bold[1] : firstChunk((heading ?? firstLine).replace(LIST_RE, ''));
      add(firstChunk(raw.replace(/^\d+[.)]\s*/, '')) || raw, s.start);
    }
  } else {
    for (const s of segs) {
      const re = /\*\*([^*]+)\*\*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s.text))) add(m[1], s.start + m.index);
      for (const c of capitalizedRuns(s.text.replace(/\*\*/g, ''))) add(c, s.start + Math.max(0, s.text.indexOf(c)));
    }
  }
  found.sort((a, b) => a.pos - b.pos);
  return found.map((f, i) => ({ name: f.name, rank: i + 1, locationHint: null }));
}

/* ------------------------------------------------------------------ */
/* Extraction LLM (§ 4.6)                                              */
/* ------------------------------------------------------------------ */

export const EXTRACT_SYSTEM =
  "Tu es un extracteur d'entités. Tu lis une réponse d'assistant IA à une question de recherche de commerce local et tu renvoies UNIQUEMENT du JSON valide.";

export function buildExtractionPrompt(query: string, input: AuditInput, answer: ProviderAnswer): string {
  const zone = zoneInfo(input).zone;
  return `Question posée : «${query}»
Commerce audité : «${input.businessName}» (site : ${input.website || 'aucun'}, zone : ${zone})
Réponse à analyser :
"""
${answer.text}
"""
Sources citées : ${JSON.stringify(answer.citations.slice(0, 15))}

Liste, dans l'ordre d'apparition, chaque commerce, artisan ou établissement
précis recommandé ou cité (pas les plateformes : Google Maps, PagesJaunes,
Yelp, TheFork, Doctolib, Habitatpresto, StarOfService… vont dans "platforms").
Ne crée aucun nom qui n'est pas écrit dans la réponse.

Format :
{
  "recommends_businesses": true|false,
  "businesses": [
    {"name": "nom exact tel qu'écrit", "rank": 1,
     "is_target": true|false,
     "location_hint": "quartier/arrondissement/ville mentionné à côté ou null",
     "url": "url ou domaine associé ou null"}
  ],
  "platforms": ["..."]
}
"is_target" = true seulement si c'est très probablement le commerce audité
(même nom à l'orthographe près, même zone).`;
}

const ExtractionSchema = z.object({
  recommends_businesses: z.boolean().optional().default(true),
  businesses: z
    .array(
      z.object({
        name: z.string().min(1),
        rank: z.number().optional(),
        is_target: z.boolean().optional().default(false),
        location_hint: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      }),
    )
    .default([]),
  platforms: z.array(z.string()).optional().default([]),
});

export interface Extraction {
  entities: ExtractedEntity[];
  recommends: boolean;
  via: 'llm' | 'heuristic';
  llmTarget: boolean | null;
}

/** Valide la sortie JSON du LLM ; rejette les noms introuvables dans la réponse (hallucinations). */
export function parseExtraction(raw: string, answerText: string): Extraction | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = ExtractionSchema.safeParse(json);
  if (!parsed.success) return null;
  const textNorm = norm(answerText);
  const ents: ExtractedEntity[] = [];
  let llmTarget = false;
  for (const b of parsed.data.businesses) {
    const n = norm(b.name);
    if (!n || matchScore(textNorm, n, jaroWinkler) < 0.85) continue;
    if (isPlatform(normName(b.name))) continue;
    if (b.is_target) llmTarget = true;
    ents.push({ name: b.name.trim(), rank: ents.length + 1, locationHint: b.location_hint ?? null, url: b.url ?? null, isTarget: b.is_target });
  }
  return { entities: ents, recommends: parsed.data.recommends_businesses && ents.length > 0, via: 'llm', llmTarget };
}

/** Extraction des entités : LLM si disponible (et réponse non démo), sinon heuristique. */
export async function extractEntities(
  answer: ProviderAnswer,
  input: AuditInput,
  query: string,
  extractor: Extractor | null,
): Promise<Extraction> {
  if (extractor && !answer.demo && !answer.error && answer.text) {
    try {
      const raw = await extractor.completeJson(EXTRACT_SYSTEM, buildExtractionPrompt(query, input, answer));
      const res = parseExtraction(raw, answer.text);
      if (res) return res;
    } catch {
      /* repli heuristique */
    }
  }
  const entities = answer.text ? extractHeuristic(answer.text, input) : [];
  return { entities, recommends: entities.length > 0, via: 'heuristic', llmTarget: null };
}

/* ------------------------------------------------------------------ */
/* Détection de la mention (§ 4.3 – 4.5)                               */
/* ------------------------------------------------------------------ */

export const NO_REC_SNIPPET = '[aucune recommandation]';

function threshold(len: number, cited: boolean): number {
  if (len <= 4) return Infinity; // exact uniquement
  if (cited) return 0.8;
  return len >= 8 ? 0.9 : 0.94;
}

interface SegMatch {
  seg: Segment;
  score: number;
  /** correspondance exacte d'une variante longue et non générique */
  distinctive: boolean;
  acronym: boolean;
}

function scoreSegment(seg: Segment, v: NameVariants, cited: boolean, domainInText: boolean): SegMatch {
  let score = 0;
  let distinctive = false;
  let acronym = false;
  const exactVariants = [v.full, v.core, v.prefixed, ...v.alts];
  for (const variant of exactVariants) {
    if (variant && hasWord(seg.norm, variant)) {
      score = 1;
      if (variant.length >= 8 && !COMMON_NAMES.has(variant) && !CHAINS.has(variant) && variant !== v.core) distinctive = true;
      if (variant === v.core && !v.ambiguous) distinctive = true;
    }
  }
  if (score < 1) {
    // Floue sur la partie distinctive (core), et sur full quand core = full.
    for (const variant of [v.core, ...v.alts]) {
      const thr = threshold(variant.length, cited);
      if (!Number.isFinite(thr)) continue;
      const s = matchScore(seg.norm, variant);
      if (s >= thr && s > score) score = s;
    }
  }
  if (score < 0.85 && v.acronym && new RegExp(`(^|[^A-Za-z0-9])${escapeRe(v.acronym)}([^A-Za-z0-9]|$)`).test(seg.text)) {
    score = 0.85;
    acronym = true;
  }
  if (score < 1 && domainInText && v.domain && seg.norm.includes(norm(v.domain))) {
    score = 1;
    distinctive = true;
  }
  return { seg, score, distinctive, acronym };
}

export interface DetectOptions {
  variants?: NameVariants;
  geo?: GeoContext;
}

/**
 * Détecte si `answer` mentionne le commerce. `extracted` = entités extraites (§ 4.6/4.7) ;
 * si absent, extraction heuristique. Les réponses en erreur renvoient mentioned:false.
 */
export function detectMention(
  answer: ProviderAnswer,
  input: AuditInput,
  extracted?: ExtractedEntity[],
  opts: DetectOptions = {},
): MentionResult {
  const base = { provider: answer.provider, queryId: answer.queryId, run: answer.run };
  if (answer.error || !answer.text) return { ...base, mentioned: false, rank: null, competitors: [] };
  const v = opts.variants ?? buildVariants(input);
  const geo = opts.geo ?? geoContext(input);
  const ents = extracted ?? extractHeuristic(answer.text, input);

  const segments = splitSegments(answer.text);
  const citedDomain = !!v.domain && answer.citations.some((u) => registrableDomain(u) === v.domain);
  const domainInText = !!v.domain && norm(answer.text).includes(norm(v.domain));

  // Meilleur segment valide (on essaie les candidats par score décroissant : un homonyme ne masque pas la cible).
  const matches = segments
    .map((s) => scoreSegment(s, v, citedDomain, domainInText))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.seg.start - b.seg.start);

  let chosen: SegMatch | null = null;
  const rejectedHomonyms: string[] = [];
  for (const m of matches) {
    const ctx = norm(contextAround(answer.text, m.seg, 200));
    const segN = m.seg.norm;
    const proofInSeg = geo.proofs.some((p) => hasWord(segN, p));
    const hasProof = geo.proofs.some((p) => hasWord(ctx, p)) || citedDomain || (domainInText && segN.includes(norm(v.domain ?? '#')));
    const contradicts = geo.otherPlaces.some((p) => hasWord(segN, p)) && !proofInSeg;
    if (contradicts) {
      const ent = ents.find((e) => segN.includes(normName(e.name)) || hasWord(segN, normName(e.name)));
      if (ent) rejectedHomonyms.push(ent.name);
      continue;
    }
    if (m.acronym && !hasProof) continue;
    if (v.ambiguous && !m.distinctive && !hasProof) continue;
    chosen = m;
    break;
  }
  const mentioned = !!chosen;

  const isTargetLike = (name: string) => {
    const n = normName(name);
    return n === v.full || n === v.core || similarity(n, v.full) >= 0.9 || (v.core.length > 4 && matchScore(n, v.core) >= 0.94);
  };
  // Concurrents = entités ≠ cible. Un homonyme rejeté (autre ville) est compté comme concurrent ;
  // une entité qui ressemble à la cible sans preuve n'est comptée ni comme cible ni comme concurrent.
  const competitors = ents.filter((e) => !isTargetLike(e.name) || rejectedHomonyms.includes(e.name)).map((e) => e.name);
  for (const h of rejectedHomonyms) if (!competitors.includes(h)) competitors.push(h);

  let rank: number | null = null;
  if (chosen) rank = chosen.seg.listIndex ?? orderOfAppearance(answer.text, targetOffset(answer.text, chosen.seg, input), ents, isTargetLike);

  const noRec = ents.length === 0 && !mentioned;
  return {
    ...base,
    mentioned,
    rank,
    competitors,
    snippet: noRec ? NO_REC_SNIPPET : chosen ? chosen.seg.text.slice(0, 280) : undefined,
    noRec: noRec || undefined,
    citedDomain: citedDomain || undefined,
  };
}

/**
 * Position du nom de la cible DANS le segment retenu (phrase « on trouve A, B et la cible ») : le rang hors liste
 * se lit à la place du nom, pas au début de la phrase. Repli : début du segment.
 */
function targetOffset(text: string, seg: Segment, input: AuditInput): number {
  const lower = stripAccents(text).toLowerCase();
  const end = seg.start + seg.text.length;
  const forms = [input.businessName, input.businessName.replace(/\b(SARL|SASU|SAS|EURL|SNC|EIRL|EI)\b\.?/g, '').replace(/\s+/g, ' ')]
    .map((x) => stripAccents(x).toLowerCase().trim())
    .filter((x) => x.length >= 2);
  let best = -1;
  for (const f of forms) {
    const i = lower.indexOf(f, seg.start);
    if (i >= 0 && i < end && (best < 0 || i < best)) best = i;
  }
  return best >= 0 ? best : seg.start;
}

function orderOfAppearance(
  text: string,
  targetStart: number,
  ents: ExtractedEntity[],
  isTargetLike: (n: string) => boolean,
): number {
  const lower = stripAccents(text).toLowerCase();
  let before = 0;
  for (const e of ents) {
    if (isTargetLike(e.name)) continue;
    const i = lower.indexOf(stripAccents(e.name).toLowerCase());
    if (i >= 0 && i < targetStart) before++;
  }
  return before + 1;
}

/* ------------------------------------------------------------------ */
/* Dédoublonnage des concurrents au niveau de l'audit (§ 4.7.4)        */
/* ------------------------------------------------------------------ */

/** Regroupe les variantes d'un même concurrent (JW ≥ 0,92 sur normName) et remplace par le libellé le plus fréquent. */
export function canonicalizeCompetitors(mentions: MentionResult[]): MentionResult[] {
  const freq = new Map<string, number>();
  for (const m of mentions) for (const c of m.competitors) freq.set(c, (freq.get(c) ?? 0) + 1);
  const clusters: { key: string; members: string[] }[] = [];
  const byName = new Map<string, number>();
  const names = [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b));
  for (const name of names) {
    const k = normName(name) || norm(name);
    let idx = clusters.findIndex((c) => c.key === k || jaroWinkler(c.key, k) >= 0.92);
    if (idx < 0) {
      clusters.push({ key: k, members: [] });
      idx = clusters.length - 1;
    }
    clusters[idx].members.push(name);
    byName.set(name, idx);
  }
  const label = clusters.map((c) =>
    c.members.reduce((best, n) => ((freq.get(n) ?? 0) > (freq.get(best) ?? 0) ? n : best), c.members[0]),
  );
  return mentions.map((m) => ({
    ...m,
    competitors: [...new Set(m.competitors.map((c) => label[byName.get(c) ?? -1] ?? c))],
  }));
}
