/**
 * Outils communs du module GEO : pages analysables, constats, scores, texte.
 * Réutilise l'analyse HTML de src/lib/siteaudit (ce que voit un robot sans JavaScript).
 */
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';
import { parseHtml, sameSite, type ParsedPage } from '@/lib/siteaudit/html';
import { allNodes, typesOf } from '@/lib/siteaudit/jsonld';
import { norm } from '@/lib/engine/detect';
import { hash32 } from '@/lib/engine/util';
import type { EvidenceLevel, GeoFinding, GeoSection, GeoSectionId } from './types';

export type JsonNode = Record<string, unknown>;

/** Page explorée + analyse HTML (si le HTML a été gardé). */
export interface GeoPage {
  page: CrawledPage;
  url: string;
  path: string;
  parsed: ParsedPage | null;
  nodes: JsonNode[];
  types: Set<string>;
}

export const MAX_AFFECTED = 200;

/** Pages utiles à l'analyse : réponse 200 HTML, non bloquées par robots.txt. */
export function geoPages(crawl: SiteCrawl): GeoPage[] {
  const out: GeoPage[] = [];
  const seen = new Set<string>();
  for (const page of crawl.pages) {
    if (page.status !== 200 || page.blockedByRobots) continue;
    if (page.contentType && !/html/i.test(page.contentType)) continue;
    const url = page.finalUrl || page.url;
    if (seen.has(url)) continue;
    seen.add(url);
    let parsed: ParsedPage | null = null;
    if (page.html) {
      try {
        parsed = parseHtml(page.html);
      } catch {
        parsed = null;
      }
    }
    const nodes = page.jsonLd.flatMap((d) => allNodes(d));
    const types = new Set(nodes.flatMap((n) => typesOf(n)));
    let path = '/';
    try {
      path = new URL(url).pathname || '/';
    } catch {
      /* URL invalide : chemin racine */
    }
    out.push({ page, url, path, parsed, nodes, types });
  }
  return out.sort((a, b) => effDepth(a.page.depth) - effDepth(b.page.depth) || a.url.localeCompare(b.url));
}

/** Profondeur utile : les pages orphelines du sitemap (-1) passent après les autres. */
export function effDepth(d: number): number {
  return d < 0 ? 99 : d;
}

export function homePage(pages: GeoPage[]): GeoPage | undefined {
  return pages.find((p) => p.path === '/' || p.path === '') ?? pages[0];
}

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function stableId(...parts: string[]): string {
  return hash32(parts.join('\u0001')).toString(36);
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  'le la les un une des de du d l et a au aux en pour par sur dans avec sans ou que qui quoi est sont votre vos nos notre mon ma mes ce cet cette ces se sa son ses plus tres comment pourquoi quel quelle quels quelles combien il elle ils elles on nous vous leur leurs y ne pas peut faut-il est-ce quand ou etre avoir fait faire bien tout tous toute toutes'.split(
    ' ',
  ),
);

/** Racines grossières (6 caractères, sans accents ni pluriel) des mots porteurs de sens. */
export function stems(text: string): string[] {
  return norm(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.replace(/(x|s)$/, '').slice(0, 6));
}

/** Part des racines de `q` présentes dans `text` (0–1). */
export function overlap(q: string, text: string): number {
  const a = [...new Set(stems(q))];
  if (!a.length) return 0;
  const b = new Set(stems(text));
  return a.filter((w) => b.has(w)).length / a.length;
}

export const PHONE_RE = /(?:\+33\s?(?:\(0\)\s?)?|0)[1-9](?:[\s.-]?\d{2}){4}/g;
export const POSTCODE_RE = /\b(?:0[1-9]|[1-8]\d|9[0-8])\d{3}\b/g;
export const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi;

/** Téléphone normalisé (chiffres, format national « 0XXXXXXXXX »). */
export function normPhone(s: string): string {
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0033')) d = d.slice(4);
  else if (d.startsWith('33') && d.length === 11) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 9) return `0${d}`;
  return d;
}

/** « 0476001122 » → « +33 4 76 00 11 22 » (format international lisible). */
export function formatPhone(n: string): string {
  return /^0\d{9}$/.test(n) ? `+33 ${n[1]} ${n.slice(2).match(/\d{2}/g)!.join(' ')}` : n;
}

export function phonesIn(text: string): string[] {
  return [...new Set((text.match(PHONE_RE) ?? []).map(normPhone).filter((p) => p.length === 10))];
}

export function isExternal(href: string, base: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  return !sameSite(href, base);
}

/* ------------------------------------------------------------------ */
/* JSON-LD                                                             */
/* ------------------------------------------------------------------ */

export function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === 'object' && typeof (v as JsonNode)['@value'] === 'string') return str((v as JsonNode)['@value']);
  return null;
}

export function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(strList);
  const s = str(v);
  return s ? [s] : [];
}

export function nodesOfType(pages: GeoPage[], test: (types: string[]) => boolean): { page: GeoPage; node: JsonNode }[] {
  return pages.flatMap((p) => p.nodes.filter((n) => test(typesOf(n))).map((node) => ({ page: p, node })));
}

/* ------------------------------------------------------------------ */
/* Constats et scores                                                  */
/* ------------------------------------------------------------------ */

export interface FindingInput {
  id: string;
  category: string;
  severity: GeoFinding['severity'];
  title: string;
  why: string;
  fix: string;
  affected?: { url: string; detail?: string }[];
  affectedCount?: number;
  impact: 1 | 2 | 3;
  effort: 1 | 2 | 3;
  evidenceLevel: EvidenceLevel;
  autoFix?: { kind: string; payload: unknown };
  evidence?: string;
}

export function finding(f: FindingInput): GeoFinding {
  const affected = f.affected ?? [];
  return {
    id: f.id,
    category: f.category,
    severity: f.severity,
    title: f.title,
    why: f.why,
    fix: f.fix,
    affected: affected.slice(0, MAX_AFFECTED),
    affectedCount: f.affectedCount ?? affected.length,
    impact: f.impact,
    effort: f.effort,
    evidenceLevel: f.evidenceLevel,
    ...(f.autoFix ? { autoFix: f.autoFix } : {}),
    ...(f.evidence ? { evidence: f.evidence } : {}),
  };
}

export const SEVERITY_PENALTY: Record<GeoFinding['severity'], number> = { critical: 45, high: 22, medium: 10, low: 4, info: 0 };
export const SEVERITY_RANK: Record<GeoFinding['severity'], number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export function sectionScore(findings: GeoFinding[]): number {
  const pen = findings.reduce((s, f) => s + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, Math.round(100 - pen)));
}

export function section(id: GeoSectionId, label: string, weight: number, findings: GeoFinding[], note: string, measured = true): GeoSection {
  return { id, label, score: measured ? sectionScore(findings) : 0, findings, measured, weight, note };
}

/** Ordre de priorité : sévérité, puis impact / effort, puis nombre de pages touchées. */
export function byPriority(a: GeoFinding, b: GeoFinding): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    b.impact / b.effort - a.impact / a.effort ||
    b.affectedCount - a.affectedCount ||
    a.id.localeCompare(b.id)
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
