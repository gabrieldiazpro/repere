/**
 * Analyseur de robots.txt conforme à la RFC 9309 (pur, sans réseau).
 * - Groupes : une ou plusieurs lignes `user-agent` suivies de règles ; les groupes qui visent le même robot
 *   sont fusionnés ; à défaut de groupe propre, le groupe `*` s'applique ; sans groupe applicable, tout est permis.
 * - Règle la plus spécifique (motif le plus long) ; à longueur égale, `Allow` l'emporte.
 * - Jokers : `*` (n'importe quelle suite de caractères) et `$` (fin d'URL).
 * - `/robots.txt` est toujours permis. Lignes inconnues ignorées (crawl-delay, host…). `Sitemap` est global.
 */

export interface RobotsRule {
  allow: boolean;
  path: string;
  line: number;
  raw: string;
}

export interface RobotsGroup {
  agents: string[];
  /** Numéro (1-based) de la première ligne user-agent du groupe. */
  line: number;
  rules: RobotsRule[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Lignes non comprises (hors commentaires et directives connues ignorées). */
  invalid: number[];
}

const MAX_ROBOTS_BYTES = 500 * 1024; // RFC 9309 : au moins 500 Kio doivent être lus

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const invalid: number[] = [];
  let cur: RobotsGroup | null = null;
  let inAgents = false;
  const lines = text.slice(0, MAX_ROBOTS_BYTES).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      invalid.push(lineNo);
      return;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !inAgents) {
        cur = { agents: [], line: lineNo, rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      inAgents = true;
    } else if (key === 'allow' || key === 'disallow') {
      inAgents = false;
      if (!cur) {
        invalid.push(lineNo);
        return;
      }
      cur.rules.push({ allow: key === 'allow', path: value, line: lineNo, raw: line });
    } else if (key === 'sitemap') {
      if (value) sitemaps.push(value);
    } else {
      // crawl-delay, host, clean-param… : ignorés, ne ferment pas le groupe.
      if (!['crawl-delay', 'host', 'clean-param', 'request-rate', 'visit-time', 'noindex', 'content-signal'].includes(key)) invalid.push(lineNo);
    }
  });
  return { groups, sitemaps, invalid };
}

/** Jeton produit d'un user-agent (« GPTBot/1.1 » → « gptbot »). */
export function productToken(agent: string): string {
  return agent.trim().toLowerCase().split(/[\s/]/)[0];
}

/** Groupes applicables à un robot : groupes propres fusionnés, sinon `*`. */
export function groupsFor(parsed: ParsedRobots, botToken: string): { groups: RobotsGroup[]; kind: 'specific' | 'wildcard' | 'none' } {
  const token = productToken(botToken);
  const specific = parsed.groups.filter((g) => g.agents.some((a) => productToken(a) === token));
  if (specific.length) return { groups: specific, kind: 'specific' };
  const star = parsed.groups.filter((g) => g.agents.includes('*'));
  if (star.length) return { groups: star, kind: 'wildcard' };
  return { groups: [], kind: 'none' };
}

/** Uniformise les échappements « %xx » (majuscules) et encode les caractères non ASCII. */
function normPath(p: string): string {
  let out = p.replace(/%[0-9a-f]{2}/gi, (x) => x.toUpperCase());
  try {
    out = out.replace(/[^\x21-\x7e]/g, (c) => encodeURIComponent(c));
  } catch {
    /* caractère isolé invalide : laissé tel quel */
  }
  return out;
}

const reCache = new Map<string, RegExp>();
/** Le motif (avec `*` et `$`) correspond-il au début du chemin ? */
export function patternMatches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  let re = reCache.get(pattern);
  if (!re) {
    const p = normPath(pattern);
    const anchored = p.endsWith('$');
    const body = (anchored ? p.slice(0, -1) : p)
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    re = new RegExp(`^${body}${anchored ? '$' : ''}`);
    if (reCache.size > 2000) reCache.clear();
    reCache.set(pattern, re);
  }
  return re.test(normPath(path));
}

/** Longueur de spécificité d'un motif (RFC 9309 : nombre d'octets du motif). */
function specificity(pattern: string): number {
  return normPath(pattern).length;
}

export interface Decision {
  allowed: boolean;
  rule: RobotsRule | null;
  kind: 'specific' | 'wildcard' | 'none';
}

/** Décision pour un robot et un chemin (chemin + requête, ex. « /produits?id=3 »). */
export function decide(parsed: ParsedRobots, botToken: string, path: string): Decision {
  const p = path.startsWith('/') ? path : `/${path}`;
  const { groups, kind } = groupsFor(parsed, botToken);
  if (p === '/robots.txt') return { allowed: true, rule: null, kind };
  let best: RobotsRule | null = null;
  for (const g of groups)
    for (const r of g.rules) {
      if (!r.path) continue; // « Disallow: » vide = aucune restriction
      if (!patternMatches(r.path, p)) continue;
      if (!best) best = r;
      else {
        const a = specificity(r.path);
        const b = specificity(best.path);
        if (a > b || (a === b && r.allow && !best.allow)) best = r;
      }
    }
  return { allowed: best ? best.allow : true, rule: best, kind };
}

export function isAllowed(parsed: ParsedRobots, botToken: string, path: string): boolean {
  return decide(parsed, botToken, path).allowed;
}

/** Chemins interdits pour un robot (règles Disallow non vides de ses groupes applicables). */
export function disallowedPaths(parsed: ParsedRobots, botToken: string): string[] {
  const { groups } = groupsFor(parsed, botToken);
  return [...new Set(groups.flatMap((g) => g.rules.filter((r) => !r.allow && r.path).map((r) => r.path)))];
}
