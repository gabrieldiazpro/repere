/**
 * Plan d'action (docs/05-plan-action.md) : évalue les déclencheurs de data/actions.json sur le résultat d'audit.
 * Grammaire : or / and / not, comparaisons (< <= > >= == !=), `in [..]`, parenthèses, `always`.
 * Une variable absente vaut null ; une comparaison d'ordre avec null vaut false.
 */
import actionsData from './data/actions.json';
import { resolveTrade, type TradeFamily } from './queries';
import type { ActionItem, AuditResult } from './types';

export interface ActionDef {
  id: string;
  title: string;
  why: string;
  how: string[];
  effort: 'S' | 'M' | 'L';
  impact: 1 | 2 | 3;
  trades: string[];
  trigger: string;
}

export const ACTIONS: ActionDef[] = actionsData as ActionDef[];

type Val = number | string | boolean | null;
type Ctx = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Analyseur d'expressions                                             */
/* ------------------------------------------------------------------ */

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'kw'; v: 'and' | 'or' | 'not' | 'in' | 'true' | 'false' | 'null' | 'always' }
  | { t: 'p'; v: '(' | ')' | '[' | ']' | ',' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if ('()[],'.includes(c)) {
      out.push({ t: 'p', v: c as '(' });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!='].includes(two)) {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if (c === '<' || c === '>') {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error(`chaîne non fermée : ${src}`);
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) {
      const w = id[0];
      if (['and', 'or', 'not', 'in', 'true', 'false', 'null', 'always'].includes(w)) out.push({ t: 'kw', v: w as 'and' });
      else out.push({ t: 'id', v: w });
      i += w.length;
      continue;
    }
    throw new Error(`caractère inattendu « ${c} » dans : ${src}`);
  }
  return out;
}

function lookup(ctx: Ctx, path: string): Val {
  let cur: unknown = ctx;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur === undefined) return null;
  if (typeof cur === 'number' || typeof cur === 'string' || typeof cur === 'boolean' || cur === null) return cur;
  return null;
}

function truthy(v: Val): boolean {
  return v !== null && v !== false && v !== 0 && v !== '';
}

function compare(a: Val, op: string, b: Val): boolean {
  if (op === '==') return a === b;
  if (op === '!=') return a !== b;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  switch (op) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      return false;
  }
}

/** Évalue une expression de déclencheur. Lève une erreur si la syntaxe est invalide. */
export function evaluateTrigger(expr: string, ctx: Ctx): boolean {
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p];
  const isKw = (v: string) => peek()?.t === 'kw' && peek()?.v === v;
  const isP = (v: string) => peek()?.t === 'p' && peek()?.v === v;
  const expect = (v: string) => {
    if (!isP(v)) throw new Error(`« ${v} » attendu dans : ${expr}`);
    p++;
  };

  const value = (): Val => {
    const tk = toks[p++];
    if (!tk) throw new Error(`expression incomplète : ${expr}`);
    if (tk.t === 'num' || tk.t === 'str') return tk.v;
    if (tk.t === 'id') return lookup(ctx, tk.v);
    if (tk.t === 'kw') {
      if (tk.v === 'true') return true;
      if (tk.v === 'false') return false;
      if (tk.v === 'null') return null;
      if (tk.v === 'always') return true;
    }
    throw new Error(`valeur attendue dans : ${expr}`);
  };

  const cmp = (): boolean => {
    if (isP('(')) {
      p++;
      const r = or();
      expect(')');
      return r;
    }
    const a = value();
    const tk = peek();
    if (tk?.t === 'op') {
      p++;
      return compare(a, tk.v, value());
    }
    if (isKw('in')) {
      p++;
      expect('[');
      const list: Val[] = [];
      if (!isP(']')) {
        list.push(value());
        while (isP(',')) {
          p++;
          list.push(value());
        }
      }
      expect(']');
      return list.some((x) => x === a);
    }
    return truthy(a);
  };
  const not = (): boolean => {
    if (isKw('not')) {
      p++;
      return !not();
    }
    return cmp();
  };
  const and = (): boolean => {
    let r = not();
    while (isKw('and')) {
      p++;
      const rhs = not();
      r = r && rhs;
    }
    return r;
  };
  const or = (): boolean => {
    let r = and();
    while (isKw('or')) {
      p++;
      const rhs = and();
      r = r || rhs;
    }
    return r;
  };

  const result = or();
  if (p !== toks.length) throw new Error(`jeton en trop dans : ${expr}`);
  return result;
}

/* ------------------------------------------------------------------ */
/* Contexte                                                            */
/* ------------------------------------------------------------------ */

export interface SiteSignals {
  has_website: boolean | null;
  has_schema: boolean | null;
  has_localbusiness_schema: boolean | null;
  has_faq: boolean | null;
  has_service_pages: boolean | null;
  has_district_pages: boolean | null;
  has_about: boolean | null;
  blocks_ai_bots: boolean | null;
  has_llms_txt: boolean | null;
  last_update_days: number | null;
}

export interface DeclaredSignals {
  gbp_claimed: boolean | null;
  bing_claimed: boolean | null;
  pagesjaunes: boolean | null;
  facebook_page: boolean | null;
  nap_consistent: boolean | null;
  third_party_reviews: boolean | null;
  google_reviews: number | null;
  reply_rate: number | null;
}

export interface PlanContext {
  site?: Partial<SiteSignals>;
  declared?: Partial<DeclaredSignals>;
}

export function buildTriggerContext(result: AuditResult, extra: PlanContext = {}): Ctx {
  const family: TradeFamily = resolveTrade(result.input.trade).family;
  return {
    score: result.score,
    sub: { ...result.subScores },
    mention_rate: result.mentionRate,
    share_of_voice: result.shareOfVoice,
    avg_rank: result.avgRank,
    competitors_top_mentions: result.competitors.reduce((m, c) => Math.max(m, c.mentions), 0),
    competitors_count: result.competitors.length,
    confidence: result.confidence,
    trade_family: family,
    // Sans scan du site : on sait seulement s'il existe (déclaré dans le formulaire).
    site: { has_website: !!result.input.website, ...(extra.site ?? {}) },
    declared: { ...(extra.declared ?? {}) },
  };
}

/* ------------------------------------------------------------------ */
/* Sélection                                                           */
/* ------------------------------------------------------------------ */

const EFFORT_ORDER = { S: 0, M: 1, L: 2 } as const;

function toItem(a: ActionDef, wave?: 1 | 2 | 3): ActionItem {
  return { id: a.id, title: a.title, why: a.why, how: [...a.how], effort: a.effort, impact: a.impact, ...(wave ? { wave } : {}) };
}

function applicable(a: ActionDef, family: TradeFamily): boolean {
  return a.trades.includes('tous') || a.trades.includes(family);
}

function safeEval(a: ActionDef, ctx: Ctx): boolean {
  try {
    return evaluateTrigger(a.trigger, ctx);
  } catch {
    return false;
  }
}

const sortRule = (a: ActionDef, b: ActionDef) =>
  b.impact - a.impact || EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || a.id.localeCompare(b.id);

/**
 * Plan complet (10 à 14 actions) : déclencheurs vrais, filtrés par famille de métier, triés par impact décroissant
 * puis effort croissant, répartis en 3 vagues (semaine 1, semaines 2-3, mois 2).
 */
export function buildActionPlan(result: AuditResult, extra: PlanContext = {}): ActionItem[] {
  const ctx = buildTriggerContext(result, extra);
  const family = ctx.trade_family as TradeFamily;
  const pool = ACTIONS.filter((a) => applicable(a, family));
  const triggered = pool.filter((a) => safeEval(a, ctx)).sort(sortRule);
  let chosen = triggered.slice(0, 14);
  if (chosen.length < 10) {
    // Complément : actions applicables non déclenchées, hors actions liées au site si le commerce n'en a pas.
    const rest = pool
      .filter((a) => !chosen.includes(a))
      .filter((a) => !((ctx.site as SiteSignals).has_website === false && /site\.has_website == true/.test(a.trigger)))
      .sort(sortRule);
    chosen = [...chosen, ...rest.slice(0, 10 - chosen.length)];
  }
  return chosen.map((a, i) => {
    let wave: 1 | 2 | 3 = i < 4 ? 1 : i < 9 ? 2 : 3;
    if (a.effort === 'L' && wave === 1) wave = 2;
    return toItem(a, wave);
  }).sort((x, y) => (x.wave ?? 3) - (y.wave ?? 3));
}

/** 3 actions gratuites pour le rapport : les premières du plan, en évitant les efforts longs. */
export function topActions(result: AuditResult, extra: PlanContext = {}): ActionItem[] {
  const plan = buildActionPlan(result, extra);
  const quick = plan.filter((a) => a.effort !== 'L');
  const out = quick.slice(0, 3);
  for (const a of plan) if (out.length < 3 && !out.includes(a)) out.push(a);
  return out;
}
