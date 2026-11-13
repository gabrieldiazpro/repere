/**
 * Visites des pages /barometre/** par source (ROI des baromètres). Totaux par mois seulement, comme la mesure
 * d'audience du site (confidentialite, article 11) : ni cookie, ni identifiant, ni adresse IP conservée.
 * Document `roi.visits` / `<AAAA-MM>` : clés `v|<slug>|<source>` (visites) et `r|<domaine>` (sites d'origine).
 */
import { classifyVisit } from '@/lib/tracking/classify';
import { getDoc, incrDoc } from '@/lib/store';

export const VISITS = 'roi.visits';
/** Au plus N domaines d'origine distincts par mois (au-delà : « autres »), le document ne grossit pas sans fin. */
export const MAX_REFERRER_KEYS = 200;

export type VisitSource = 'ia' | 'recherche' | 'social' | 'campagne' | 'site' | 'interne' | 'direct';

export const SOURCE_LABELS: Record<VisitSource, string> = {
  ia: 'Assistants IA',
  recherche: 'Moteurs de recherche',
  social: 'Réseaux sociaux',
  campagne: 'Campagne (UTM)',
  site: 'Autres sites (liens)',
  interne: 'Navigation interne',
  direct: 'Accès direct',
};

const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|qwant\.com|duckduckgo\.com|ecosia\.org|yahoo\.[a-z.]+|search\.brave\.com|startpage\.com|lilo\.org|yandex\.[a-z.]+)$/;
const SOCIAL = /(^|\.)(linkedin\.com|lnkd\.in|x\.com|twitter\.com|t\.co|facebook\.com|fb\.com|instagram\.com|threads\.net|bsky\.app|reddit\.com|youtube\.com|whatsapp\.com|mastodon\.[a-z.]+|t\.me|pinterest\.[a-z.]+)$/;

const cleanHost = (h: string | null | undefined): string => {
  if (!h) return '';
  let x = h.trim().toLowerCase();
  try {
    if (/^https?:\/\//.test(x)) x = new URL(x).hostname;
  } catch {
    return '';
  }
  return x.replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '').slice(0, 120);
};

/** Source d'une visite (pur). `selfHost` : domaine du site. */
export function classifySource(input: { referrer?: string | null; utmSource?: string | null; selfHost?: string | null }): { source: VisitSource; host: string } {
  const host = cleanHost(input.referrer);
  const self = cleanHost(input.selfHost);
  if (classifyVisit(input.referrer ?? '', input.utmSource ?? '')) return { source: 'ia', host };
  if (host && self && (host === self || host.endsWith(`.${self}`))) return { source: 'interne', host: '' };
  if (host && SEARCH.test(host)) return { source: 'recherche', host };
  if (host && SOCIAL.test(host)) return { source: 'social', host };
  if (input.utmSource) return { source: 'campagne', host };
  if (host) return { source: 'site', host };
  return { source: 'direct', host: '' };
}

/** Slug du baromètre d'un chemin /barometre ou /barometre/<slug> (pur) ; null hors baromètres. */
export function barometreSlugOfPath(p: string): string | null {
  const path = (p || '').split(/[?#]/)[0];
  if (path === '/barometre' || path === '/barometre/') return 'index';
  const m = path.match(/^\/barometre\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return m ? m[1] : null;
}

export const monthOf = (d: Date = new Date()) => d.toISOString().slice(0, 7);

export async function recordBarometreVisit(input: { path: string; referrer?: string | null; utmSource?: string | null; selfHost?: string | null; now?: Date }): Promise<boolean> {
  const slug = barometreSlugOfPath(input.path);
  if (!slug) return false;
  const { source, host } = classifySource(input);
  const id = monthOf(input.now);
  const deltas: Record<string, number> = { [`v|${slug}|${source}`]: 1 };
  if (host && source !== 'interne') {
    const cur = await getDoc<Record<string, number>>(VISITS, id);
    const k = `r|${host}`;
    const n = cur ? Object.keys(cur.data).filter((x) => x.startsWith('r|')).length : 0;
    deltas[!cur || k in cur.data || n < MAX_REFERRER_KEYS ? k : 'r|autres'] = 1;
  }
  await incrDoc(VISITS, id, deltas);
  return true;
}

export interface VisitsMonth {
  month: string;
  total: number;
  /** hors navigation interne : arrivées depuis l'extérieur */
  external: number;
  bySource: Partial<Record<VisitSource, number>>;
  bySlug: Record<string, number>;
  referrers: { host: string; visits: number }[];
}

/** Lecture d'un mois (pur sur le document). */
export function summarizeVisits(month: string, doc: Record<string, number> | null | undefined): VisitsMonth {
  const out: VisitsMonth = { month, total: 0, external: 0, bySource: {}, bySlug: {}, referrers: [] };
  for (const [k, raw] of Object.entries(doc ?? {})) {
    const n = Number(raw) || 0;
    if (k.startsWith('v|')) {
      const [, slug, source] = k.split('|') as [string, string, VisitSource];
      out.total += n;
      if (source !== 'interne') out.external += n;
      out.bySource[source] = (out.bySource[source] ?? 0) + n;
      out.bySlug[slug] = (out.bySlug[slug] ?? 0) + n;
    } else if (k.startsWith('r|')) out.referrers.push({ host: k.slice(2), visits: n });
  }
  out.referrers.sort((a, b) => b.visits - a.visits);
  return out;
}

export async function readVisits(month: string): Promise<VisitsMonth> {
  return summarizeVisits(month, (await getDoc<Record<string, number>>(VISITS, month))?.data);
}
