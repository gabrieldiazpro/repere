/**
 * Classification des visites : referrer / utm_source -> moteur IA (règles : ai-sources.json).
 * Ordre : 1. utm_source, 2. host du referrer. Le « direct » n'est jamais attribué à une IA.
 */
import type { AiEngine } from '@/lib/engine/types-v2';
import sources from './ai-sources.json';

export interface AiClassification {
  engine: AiEngine;
  signal: 'utm' | 'referrer';
}

interface RefRule {
  engine: string;
  hosts: string[];
  utm_source: string[];
}
interface BotRule {
  token: string;
  category: string;
  ua_regex: string | null;
}

const ENGINE_MAP: Record<string, AiEngine | null> = {
  chatgpt: 'chatgpt',
  perplexity: 'perplexity',
  gemini: 'gemini',
  copilot: 'copilot',
  claude: 'claude',
  you: 'other_ai',
  other_ai: 'other_ai',
  google_ai: null, // indiscernable : jamais mesuré
};

// Hôtes à double usage (moteur classique) : ignorés sans paramètre explicite.
const AMBIGUOUS = /^(search\.brave\.com|duckduckgo\.com)/;

const RULES: RefRule[] = (sources.referrers as RefRule[]).filter((r) => ENGINE_MAP[r.engine] != null);

function engineOf(rule: RefRule): AiEngine {
  return ENGINE_MAP[rule.engine] as AiEngine;
}

/** Normalise une valeur de referrer (URL ou host) en `host[/chemin]` minuscule, sans www. */
export function normalizeHost(input: string): string {
  let v = (input || '').trim().toLowerCase().slice(0, 200);
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[?#].*$/, '').replace(/^www\./, '');
  return v.replace(/\/+$/, '');
}

/** Renvoie le moteur IA d'une visite, ou null si la source n'est pas une IA reconnue. */
export function classifyVisit(referrer: string | null | undefined, utmSource?: string | null): AiClassification | null {
  const utm = (utmSource || '').trim().toLowerCase().slice(0, 60);
  if (utm) {
    for (const r of RULES) {
      if (r.utm_source.includes(utm)) return { engine: engineOf(r), signal: 'utm' };
    }
  }
  const host = normalizeHost(referrer || '');
  if (host) {
    for (const r of RULES) {
      for (const raw of r.hosts) {
        const h = normalizeHost(raw);
        if (h.includes('?') || AMBIGUOUS.test(h)) continue;
        if (host === h || host.startsWith(`${h}/`)) return { engine: engineOf(r), signal: 'referrer' };
      }
    }
  }
  return null;
}

const BOTS = (sources.bots as BotRule[])
  .filter((b) => b.ua_regex)
  .map((b) => ({ token: b.token, category: b.category, re: new RegExp(b.ua_regex as string, 'i') }));

/** Identifie un robot IA à partir de son user agent (le UA n'est jamais conservé, seul le jeton l'est). */
export function classifyBot(userAgent: string | null | undefined): { token: string; category: string } | null {
  const ua = (userAgent || '').slice(0, 400);
  if (!ua) return null;
  for (const b of BOTS) if (b.re.test(ua)) return { token: b.token, category: b.category };
  return null;
}

/** Expression régulière (sans ancrage) des sources IA, pour le filtre GA4 sessionSource. */
export function aiSourceRegex(): string {
  const parts = new Set<string>();
  for (const r of RULES) {
    for (const u of r.utm_source) parts.add(u);
    for (const h of r.hosts) {
      const n = normalizeHost(h);
      if (!n.includes('?') && !AMBIGUOUS.test(n)) parts.add(n.split('/')[0]);
    }
  }
  return [...parts].map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}
