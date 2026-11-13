/**
 * Vérification des affirmations des IA contre la fiche de vérité (docs/v2/06-indispensable.md § 5.2).
 * Tolérances : formats de téléphone, horaires équivalents (« 8h-19h » = « 08:00 à 19:00 »),
 * abréviations d'adresse, prix à ± 20 %.
 */
import { norm, registrableDomain, similarity } from './detect';
import { buildPerceptionHeuristic } from './perception';
import type { AuditResult } from './types';
import type { BrandClaim, BrandFactField, BrandFacts, FactCheckItem, FactCheckReport } from './types-v2';

type Facts = Partial<Record<BrandFactField, string>>;

/* ------------------------------------------------------------------ */
/* Normalisations                                                      */
/* ------------------------------------------------------------------ */

/** « +33 (0)1 43 55 12 34 », « 01.43.55.12.34 » → « 0143551234 ». */
export function normalizePhone(s: string): string {
  let d = s.replace(/[^\d+]/g, '');
  if (d.startsWith('+33')) d = `0${d.slice(3)}`;
  if (d.startsWith('0033')) d = `0${d.slice(4)}`;
  if (d.startsWith('00')) d = d.slice(1);
  d = d.replace(/^0+(?=[1-9]\d{8}$)/, '0');
  if (/^[1-9]\d{8}$/.test(d)) d = `0${d}`;
  return d.replace(/\D/g, '');
}

/** Toutes les plages horaires, en minutes : « 8h30-12h, 14h à 19h » → [[510,720],[840,1140]]. */
export function parseTimeRanges(s: string): [number, number][] {
  const t = s.toLowerCase().replace(/midi/g, '12h').replace(/minuit/g, '24h');
  const re = /(\d{1,2})\s?(?:h|:)\s?(\d{2})?\s?(?:à|a|-|–|—|jusqu'à|jusqu’à)\s?(\d{1,2})\s?(?:h|:)?\s?(\d{2})?/g;
  const out: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
    const b = Number(m[3]) * 60 + Number(m[4] ?? 0);
    if (a < 24 * 60 && b <= 24 * 60 && b > a) out.push([a, b]);
  }
  return out;
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Jours mentionnés comme ouverts (« du lundi au vendredi » → 0..4) ; null si aucun jour cité. */
export function parseDays(s: string): Set<number> | null {
  const t = norm(s);
  if (/tous les jours|7j 7|7 j 7|7 7/.test(t)) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const out = new Set<number>();
  const range = /du (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) au (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = range.exec(t))) {
    found = true;
    const a = DAYS.indexOf(m[1]);
    const b = DAYS.indexOf(m[2]);
    for (let i = a; ; i = (i + 1) % 7) {
      out.add(i);
      if (i === b) break;
    }
  }
  const closed = new Set<number>();
  const closedRe = /ferme(?:e)?s? (?:le |les )?((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:s)?(?: et (?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche))?)/g;
  while ((m = closedRe.exec(t))) for (const d of DAYS) if (m[1].includes(d)) closed.add(DAYS.indexOf(d));
  const stripped = t.replace(range, ' ').replace(closedRe, ' ');
  DAYS.forEach((d, i) => {
    if (new RegExp(`\\b${d}s?\\b`).test(stripped)) {
      out.add(i);
      found = true;
    }
  });
  for (const c of closed) out.delete(c);
  return found ? out : closed.size ? new Set(DAYS.map((_, i) => i).filter((i) => !closed.has(i))) : null;
}

const ABBR: [RegExp, string][] = [
  [/\bav\b/g, 'avenue'],
  [/\bbd\b|\bboul\b/g, 'boulevard'],
  [/\bst\b/g, 'saint'],
  [/\bste\b/g, 'sainte'],
  [/\bpl\b/g, 'place'],
  [/\bfg\b|\bfbg\b/g, 'faubourg'],
  [/\bimp\b/g, 'impasse'],
  [/\bche\b|\bchem\b/g, 'chemin'],
  [/\bqu\b/g, 'quai'],
];

const STREET = '(?:rue|avenue|boulevard|place|quai|impasse|allee|chemin|cours|passage|faubourg|route|square|villa|cite)';

export function normalizeAddress(s: string): { number: string | null; cp: string | null; street: string } {
  let n = norm(s);
  for (const [re, rep] of ABBR) n = n.replace(re, rep);
  const cp = /\b(\d{5})\b/.exec(n)?.[1] ?? null;
  const m = new RegExp(`(?:(\\d{1,4})(?:\\s?(bis|ter))?\\s)?(${STREET}\\b.*?)(?=\\s\\d{5}\\b|$)`).exec(n);
  if (m) return { number: m[1] ? `${m[1]}${m[2] ?? ''}` : null, cp, street: m[3].replace(/\b(france|cedex)\b/g, '').trim() };
  const num = /^(\d{1,4})(?:\s?(bis|ter))?\b/.exec(n);
  const street = n
    .replace(/\b\d{5}\b.*$/, '')
    .replace(/^(\d{1,4})(\s?(bis|ter))?\s*/, '')
    .replace(/\b(france|cedex)\b/g, '')
    .trim();
  return { number: num ? `${num[1]}${num[2] ?? ''}` : null, cp, street };
}

/** Montants en euros (« 9,90 € », « 1 200 euros ») → nombres. */
export function parsePrices(s: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,6}(?:[  ]\d{3})*(?:[,.]\d{1,2})?)\s?(?:€|euros?|eur\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(Number(m[1].replace(/[  ]/g, '').replace(',', '.')));
  return out.filter((x) => Number.isFinite(x));
}

function tokens(s: string): string[] {
  return norm(s)
    .split(' ')
    .filter((t) => t.length > 2 && !['les', 'des', 'pour', 'avec', 'sur', 'aux', 'est', 'une', 'par', 'dans'].includes(t));
}

/* ------------------------------------------------------------------ */
/* Comparaison champ par champ                                         */
/* ------------------------------------------------------------------ */

const HIGH: BrandFactField[] = ['telephone', 'adresse', 'horaires', 'statut', 'prix', 'livraison', 'retours', 'ingredients'];
const MEDIUM: BrandFactField[] = ['site', 'services', 'produits', 'zone', 'certifications'];

type Verdict = FactCheckItem['verdict'];

export function compareFact(field: BrandFactField, expected: string, stated: string): Verdict {
  const e = expected.trim();
  const s = stated.trim();
  if (!e) return 'non_verifiable';
  switch (field) {
    case 'telephone': {
      const a = normalizePhone(e);
      const b = normalizePhone(s);
      if (b.length < 9) return 'non_verifiable';
      return a === b ? 'correct' : 'faux';
    }
    case 'horaires': {
      const er = parseTimeRanges(e);
      const sr = parseTimeRanges(s);
      if (!sr.length || !er.length) return 'non_verifiable';
      const key = (r: [number, number][]) => r.map(([a, b]) => `${a}-${b}`).sort().join(',');
      const ed = parseDays(e);
      const sd = parseDays(s);
      const daysMismatch = !!(ed && sd && [...sd].some((d) => !ed.has(d)));
      if (daysMismatch) return 'faux';
      if (key(er) === key(sr)) return 'correct';
      // Couverture : chaque plage annoncée doit être incluse dans une plage réelle et coïncider à une extrémité.
      const eSet = new Set(er.map(([a, b]) => `${a}-${b}`));
      const allKnown = sr.every(([a, b]) => eSet.has(`${a}-${b}`));
      return allKnown ? 'incomplet' : 'faux';
    }
    case 'adresse': {
      const a = normalizeAddress(e);
      const b = normalizeAddress(s);
      if (a.number && b.number && a.number !== b.number) return 'faux';
      if (a.cp && b.cp && a.cp !== b.cp) return 'faux';
      const sim = a.street && b.street ? similarity(a.street, b.street) : 0;
      const contains = !!a.street && !!b.street && (a.street.includes(b.street) || b.street.includes(a.street));
      if (sim >= 0.85 || contains) return a.number && !b.number ? 'incomplet' : 'correct';
      return b.street ? 'faux' : 'non_verifiable';
    }
    case 'prix': {
      const ep = parsePrices(e);
      const sp = parsePrices(s);
      if (!ep.length || !sp.length) return 'non_verifiable';
      const ok = sp.every((x) => ep.some((y) => Math.abs(x - y) <= 0.2 * Math.max(y, 0.01)));
      return ok ? 'correct' : 'faux';
    }
    case 'site': {
      const a = registrableDomain(e);
      const b = registrableDomain(s);
      return a === b ? 'correct' : 'faux';
    }
    case 'statut': {
      const closedS = /ferm|cess|n existe plus|liquidation/.test(norm(s));
      const closedE = /ferm|cess|liquidation/.test(norm(e));
      return closedS === closedE ? 'correct' : 'faux';
    }
    case 'creation': {
      const ya = /(19|20)\d{2}/.exec(e)?.[0];
      const yb = /(19|20)\d{2}/.exec(s)?.[0];
      if (!ya || !yb) return 'non_verifiable';
      return ya === yb ? 'correct' : 'faux';
    }
    case 'livraison': {
      // Seuil de gratuité et pays desservis : les deux erreurs qui coûtent des ventes.
      const ep = parsePrices(e);
      const sp = parsePrices(s);
      if (ep.length && sp.length && !sp.every((x) => ep.some((y) => Math.abs(x - y) <= 0.05 * Math.max(y, 1)))) return 'faux';
      const only = /\b(uniquement|seulement|que)\b/.test(norm(s));
      const countries = (x: string) => new Set((norm(x).match(/\b(france|belgique|suisse|luxembourg|allemagne|espagne|italie|europe|monde|international)\b/g) ?? []));
      const ec = countries(e);
      const sc = countries(s);
      if (only && sc.size && [...ec].some((c) => !sc.has(c))) return 'faux';
      if (/(ne livre pas|pas de livraison)/.test(norm(s)) && [...sc].some((c) => ec.has(c))) return 'faux';
      if (sp.length && ep.length) return 'correct';
      const et = new Set(tokens(e));
      const st = tokens(s);
      if (!st.length) return 'non_verifiable';
      return st.filter((t) => et.has(t)).length / st.length >= 0.5 ? 'correct' : 'incomplet';
    }
    case 'retours': {
      const days = (x: string) => /(\d{1,3})\s*(?:j|jours)\b/.exec(norm(x))?.[1];
      const a = days(e);
      const b = days(s);
      if (a && b) return a === b ? 'correct' : 'faux';
      return 'non_verifiable';
    }
    case 'dirigeant': {
      const sim = similarity(norm(e), norm(s));
      return sim >= 0.85 || norm(e).includes(norm(s)) ? 'correct' : 'faux';
    }
    default: {
      const et = new Set(tokens(e));
      const st = tokens(s);
      if (!st.length || !et.size) return 'non_verifiable';
      const hit = st.filter((t) => et.has(t)).length / st.length;
      if (hit >= 0.5) return 'correct';
      return hit > 0 ? 'incomplet' : 'non_verifiable';
    }
  }
}

function severityOf(field: BrandFactField, verdict: Verdict): FactCheckItem['severity'] {
  if (verdict === 'correct' || verdict === 'non_verifiable') return 'basse';
  if (verdict === 'incomplet') return MEDIUM.includes(field) || HIGH.includes(field) ? 'moyenne' : 'basse';
  if (HIGH.includes(field)) return 'haute';
  if (MEDIUM.includes(field)) return 'moyenne';
  return 'basse';
}

function factsOf(facts: BrandFacts | Facts | null | undefined): Facts {
  if (!facts) return {};
  if ('facts' in facts && typeof (facts as BrandFacts).facts === 'object') return (facts as BrandFacts).facts ?? {};
  return facts as Facts;
}

/** Compare des affirmations à la fiche de vérité. `checkedAt` : date de la mesure (défaut : maintenant). */
export function checkClaims(claims: BrandClaim[], facts: BrandFacts | Facts, checkedAt?: string): FactCheckReport {
  const f = factsOf(facts);
  const items: FactCheckItem[] = [];
  const seen = new Set<string>();
  for (const c of claims) {
    if (c.field === 'autre') continue;
    const expected = (f[c.field] ?? '').trim();
    const verdict = compareFact(c.field, expected, c.value);
    // Une information juste compte une fois par IA (deux formulations justes du même prix = 1 « juste ») ;
    // chaque valeur fausse distincte reste une erreur. Même unité que la grille Vérité (information × IA).
    const k = verdict === 'correct' ? `${c.provider}|${c.field}|correct` : `${c.provider}|${c.field}|${norm(c.value)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ field: c.field, expected, stated: c.value, provider: c.provider, quote: c.quote, verdict, severity: severityOf(c.field, verdict) });
  }
  const rank = { faux: 0, incomplet: 1, correct: 2, non_verifiable: 3 } as const;
  const sev = { haute: 0, moyenne: 1, basse: 2 } as const;
  items.sort((a, b) => rank[a.verdict] - rank[b.verdict] || sev[a.severity] - sev[b.severity] || a.field.localeCompare(b.field));
  return { checkedAt: checkedAt ?? new Date().toISOString(), items, errors: items.filter((i) => i.verdict === 'faux').length };
}

/** Contrat V2 : vérifie les affirmations d'un audit (perception.claims, sinon extraction heuristique). */
export function factCheck(result: Pick<AuditResult, 'answers' | 'queries' | 'input' | 'perception'>, facts: BrandFacts | Facts): FactCheckReport {
  const claims = result.perception?.claims ?? buildPerceptionHeuristic(result.answers, result.queries, result.input).claims;
  return checkClaims(claims, facts);
}
