/**
 * Noms d'entreprises cités par les IA : nettoyage, clé de normalisation, fusion des variantes, règles de publication.
 *
 * Fusion (union-find), dans l'ordre :
 *  1. même clé normalisée (accents, casse, formes juridiques, préfixes « chez / ets / maison », ville retirés) ;
 *  2. alias saisis à la main dans le catalogue (après vérification humaine) ;
 *  3. même site (domaine enregistrable) associé au nom par une IA ;
 *  4. même « cœur » (clé sans les mots du métier) : ensemble de mots identique (« Martin Plomberie » = « Plomberie Martin »)
 *     ou similarité ≥ 0,9 (fautes de frappe), si le cœur fait au moins 5 caractères.
 * On ne fusionne JAMAIS sur une simple inclusion (« Martin » ≠ « Martin Frères ») : mieux vaut deux lignes qu'une fausse fusion.
 */
import { norm, normName, similarity, tradeWordsFor } from '../engine/detect';
import { classifyDomain } from '../engine/sources/classify';
import { slugify } from './catalog';
import type { BarometreDef } from './types';

const CITY_WORDS = [
  'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'nice', 'nantes', 'lille', 'montpellier', 'strasbourg', 'rennes', 'grenoble',
  'france', 'ile de france', 'idf',
];
const GENERIC_WORDS = new Set(
  ['groupe', 'group', 'france', 'fr', 'sas', 'sarl', 'eurl', 'sa', 'officiel', 'official', 'the', 'co', 'cie', 'compagnie', 'services', 'service'].map(norm),
);

export interface NameContext {
  /** mots du métier / de la catégorie retirés pour obtenir le « cœur » */
  tradeWords: Set<string>;
  /** villes et lieux retirés en fin de nom (« Plomberie Martin Lyon ») */
  places: string[];
  /** alias manuels : clé de variante → clé canonique */
  aliasKeys: Map<string, string>;
}

export function nameContext(def: BarometreDef): NameContext {
  const words = new Set<string>();
  if (def.segment === 'local' && def.trade) for (const w of tradeWordsFor(def.trade)) words.add(w);
  for (const src of [def.category, def.productCategory, def.subject]) {
    for (const w of norm(src ?? '').split(' ')) if (w.length > 2 && !['pour', 'des', 'les', 'pme'].includes(w)) words.add(w);
  }
  for (const w of ['logiciel', 'logiciels', 'marque', 'marques', 'solution', 'solutions', 'plateforme', 'application', 'app']) words.add(w);
  const places = [...new Set([...(def.city ? [norm(def.city)] : []), ...CITY_WORDS.map(norm)])];
  const ctx: NameContext = { tradeWords: words, places, aliasKeys: new Map() };
  for (const [canonical, variants] of Object.entries(def.aliases ?? {})) {
    const ck = nameKey(canonical, ctx);
    for (const v of variants) ctx.aliasKeys.set(nameKey(v, ctx), ck);
  }
  return ctx;
}

/** Nettoie un nom tel qu'écrit dans une réponse (markdown, parenthèses, « – Lyon 3e », ponctuation). */
export function cleanName(raw: string): string {
  return raw
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+[–—-]\s+.*$/, '')
    .replace(/^[\s\d.)\-*•#]+/, '')
    .replace(/[\s:;,.!?–—-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clé normalisée : normName + retrait des lieux en fin de nom et des mots génériques en fin de nom. */
export function nameKey(name: string, ctx: Pick<NameContext, 'places'>): string {
  let k = normName(cleanName(name)).replace(/\b(sarl|sas|sasu|eurl|sa)\b/g, ' ').replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of ctx.places) {
      if (p && k.endsWith(` ${p}`) && k.length > p.length + 3) {
        k = k.slice(0, -p.length - 1).trim();
        changed = true;
      }
    }
    const toks = k.split(' ');
    if (toks.length > 1 && GENERIC_WORDS.has(toks[toks.length - 1])) {
      k = toks.slice(0, -1).join(' ');
      changed = true;
    }
    const arr = /\s(\d{1,2}(e|er|eme)?|\d{5})$/.exec(k);
    if (arr && toks.length > 1) {
      k = k.slice(0, arr.index).trim();
      changed = true;
    }
  }
  return k;
}

/** Cœur du nom : clé sans les mots du métier (ensemble trié de mots). */
export function coreOf(key: string, ctx: Pick<NameContext, 'tradeWords'>): string {
  return [...new Set(key.split(' ').filter((t) => t && !ctx.tradeWords.has(t) && !GENERIC_WORDS.has(t)))].sort().join(' ');
}

/* ------------------------------------------------------------------ */
/* Personnes physiques                                                 */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = new Set(
  [
    'jean', 'pierre', 'michel', 'andre', 'philippe', 'alain', 'nicolas', 'christophe', 'patrick', 'daniel', 'francois', 'laurent',
    'stephane', 'eric', 'olivier', 'david', 'julien', 'thomas', 'sebastien', 'frederic', 'vincent', 'antoine', 'paul', 'marc',
    'jacques', 'bernard', 'louis', 'lucas', 'hugo', 'maxime', 'alexandre', 'mathieu', 'romain', 'guillaume', 'kevin', 'mohamed',
    'marie', 'nathalie', 'isabelle', 'sylvie', 'catherine', 'christine', 'sophie', 'sandrine', 'valerie', 'celine', 'julie',
    'aurelie', 'camille', 'claire', 'emilie', 'laura', 'sarah', 'lea', 'manon', 'emma', 'chloe', 'ines', 'anne', 'martine', 'karim',
  ].map(norm),
);

/**
 * « Jean Dupont » seul (prénom + nom, sans mot d'entreprise) : personne physique, jamais publiée.
 * « Plomberie Jean Dupont » ou « Dupont et Fils » restent des noms commerciaux.
 */
export function looksLikePersonName(name: string, ctx: Pick<NameContext, 'tradeWords'>): boolean {
  const toks = norm(cleanName(name)).split(' ').filter(Boolean);
  if (toks.length < 2 || toks.length > 3) return false;
  if (!FIRST_NAMES.has(toks[0])) return false;
  if (toks.some((t) => ctx.tradeWords.has(t) || GENERIC_WORDS.has(t) || ['et', 'fils', 'freres', 'associes', 'cie'].includes(t))) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Fusion                                                              */
/* ------------------------------------------------------------------ */

export interface NameObservation {
  name: string;
  /** domaine associé au nom dans cette réponse (site public), s'il y en a un */
  domain?: string;
}

export interface NameCluster {
  id: string;
  key: string;
  label: string;
  variants: string[];
  domain?: string;
  /** indices des observations d'entrée */
  members: number[];
}

class UnionFind {
  p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.p[i] !== i) {
      this.p[i] = this.p[this.p[i]];
      i = this.p[i];
    }
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

/**
 * Faute de frappe seulement : mêmes mots sauf UN, et ce mot (≥ 5 lettres des deux côtés) est très proche
 * (« martin » / « martinn », « lumiere » / « lumieres »). « beta » / « zeta » ou « dupont » / « durand » restent distincts.
 */
function typoOnly(ca: string, cb: string): boolean {
  const ta = ca.split(' ');
  const tb = cb.split(' ');
  if (ta.length !== tb.length) return false;
  const ra = ta.filter((t) => !tb.includes(t));
  const rb = tb.filter((t) => !ta.includes(t));
  if (ra.length !== 1 || rb.length !== 1) return false;
  if (Math.min(ra[0].length, rb[0].length) < 5) return false;
  return similarity(ra[0], rb[0]) >= 0.88;
}

/** Regroupe les observations en entreprises. Libellé = orthographe la plus fréquente (puis la plus courte). */
export function mergeNames(obs: NameObservation[], ctx: NameContext): NameCluster[] {
  const keys = obs.map((o) => {
    const k = nameKey(o.name, ctx);
    return ctx.aliasKeys.get(k) ?? k;
  });
  const distinct = [...new Set(keys)].filter(Boolean);
  const idx = new Map(distinct.map((k, i) => [k, i]));
  const uf = new UnionFind(distinct.length);
  // 3. même domaine
  const byDomain = new Map<string, number>();
  obs.forEach((o, i) => {
    if (!o.domain || !keys[i]) return;
    const j = idx.get(keys[i])!;
    const prev = byDomain.get(o.domain);
    if (prev == null) byDomain.set(o.domain, j);
    else uf.union(prev, j);
  });
  // 4. même cœur ou cœur très proche
  const cores = distinct.map((k) => coreOf(k, ctx));
  for (let a = 0; a < distinct.length; a++) {
    for (let b = a + 1; b < distinct.length; b++) {
      const ca = cores[a];
      const cb = cores[b];
      if (!ca || !cb || Math.min(ca.length, cb.length) < 5) continue;
      if (ca === cb || typoOnly(ca, cb)) uf.union(a, b);
    }
  }
  const groups = new Map<number, number[]>();
  obs.forEach((_, i) => {
    if (!keys[i]) return;
    const r = uf.find(idx.get(keys[i])!);
    const arr = groups.get(r);
    if (arr) arr.push(i);
    else groups.set(r, [i]);
  });
  const out: NameCluster[] = [];
  for (const members of groups.values()) {
    const freq = new Map<string, number>();
    for (const i of members) {
      const n = cleanName(obs[i].name);
      freq.set(n, (freq.get(n) ?? 0) + 1);
    }
    const label = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0].length - y[0].length || x[0].localeCompare(y[0]))[0][0];
    const dfreq = new Map<string, number>();
    for (const i of members) if (obs[i].domain) dfreq.set(obs[i].domain!, (dfreq.get(obs[i].domain!) ?? 0) + 1);
    const domain = [...dfreq.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    const key = nameKey(label, ctx);
    out.push({ id: slugify(key) || slugify(label), key, label, variants: [...freq.keys()].sort(), domain, members });
  }
  return out;
}

/**
 * Le domaine correspond-il au nom ? Version stricte (sans similarité floue : « plombier-exemple-gamma » ne doit pas
 * être rattaché à « Plombier Exemple Alpha ») : libellé identique au nom compacté, ou l'un contient l'autre
 * avec au moins 60 % de la longueur.
 */
export function domainMatchesNameStrict(domain: string, name: string): boolean {
  const label = domain.split('.')[0].replace(/-/g, '');
  const c = normName(cleanName(name)).replace(/\s+/g, '');
  if (!label || c.length < 4) return false;
  if (label === c) return true;
  if (label.length >= 5 && label.includes(c) && c.length >= label.length * 0.6) return true;
  return c.includes(label) && label.length >= 5 && label.length >= c.length * 0.6;
}

/** Domaine d'un site d'entreprise associé au nom (on écarte annuaires, médias, plateformes connues). */
export function companyDomainFor(name: string, urls: string[]): string | undefined {
  for (const u of urls) {
    const cls = classifyDomain(u);
    if (cls.source === 'table' || cls.source === 'rule') continue;
    if (domainMatchesNameStrict(cls.domain, name)) return cls.domain;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export type ExclusionReason = 'person' | 'unverified' | 'withdrawn' | 'generic';

/**
 * Règle de vérification : un nom n'est publié que s'il est corroboré — cité par au moins 2 IA différentes,
 * OU cité dans au moins 2 réponses avec un site public associé. Un nom vu une seule fois n'est jamais publié
 * (possible invention d'une IA).
 */
export function isVerifiable(s: { providers: number; answers: number; domain?: string }): boolean {
  if (s.answers < 2) return false;
  return s.providers >= 2 || !!s.domain;
}

/** Nom générique (« Plombier », « Lyon », enseigne nationale ambiguë seule) : jamais une ligne du classement. */
export function isGenericName(key: string, ctx: NameContext): boolean {
  if (!key || key.length < 2) return true;
  const toks = key.split(' ');
  if (toks.every((t) => ctx.tradeWords.has(t) || ctx.places.includes(t) || GENERIC_WORDS.has(t))) return true;
  return false;
}

/** Clé de retrait (procédure de demande) : comparée à la clé normalisée et aux variantes. */
export function withdrawalKey(name: string): string {
  return normName(cleanName(name));
}
