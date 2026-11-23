/**
 * Veille Google + IA : accès aux fiches, filtres, frise, flux RSS. Fonctions pures (testées dans __tests__).
 */
import { CONSULTED, VEILLE_ENTRIES } from './entries';
import {
  AUDIENCE_LABEL,
  STATUS_LABEL,
  THEME_LABEL,
  type VeilleAudience,
  type VeilleEntry,
  type VeilleStatus,
  type VeilleTheme,
} from './types';

export * from './types';
export { CONSULTED, VEILLE_ENTRIES };

/** Date de mise à jour visible du hub : la plus récente des fiches. */
export const VEILLE_UPDATED = VEILLE_ENTRIES.reduce((m, e) => (e.updated > m ? e.updated : m), '2026-11-23');
/** Première mise en ligne du hub. */
export const VEILLE_PUBLISHED = '2026-11-23';

export const VEILLE_PATH = '/veille';
export const veillePath = (e: VeilleEntry | string) => `${VEILLE_PATH}/${typeof e === 'string' ? e : e.slug}`;

/** Fiches triées de l'évènement le plus récent au plus ancien (à date égale : ordre alphabétique du slug). */
export function sortedEntries(list: readonly VeilleEntry[] = VEILLE_ENTRIES): VeilleEntry[] {
  return [...list].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.slug.localeCompare(b.slug));
}

export const getEntry = (slug: string): VeilleEntry | undefined => VEILLE_ENTRIES.find((e) => e.slug === slug);

export const THEMES = Object.keys(THEME_LABEL) as VeilleTheme[];
export const AUDIENCES = Object.keys(AUDIENCE_LABEL) as VeilleAudience[];
export const STATUSES = Object.keys(STATUS_LABEL) as VeilleStatus[];

export const isTheme = (v: unknown): v is VeilleTheme => typeof v === 'string' && (THEMES as string[]).includes(v);
export const isAudience = (v: unknown): v is VeilleAudience => typeof v === 'string' && (AUDIENCES as string[]).includes(v);

export interface VeilleFilter {
  theme?: VeilleTheme | null;
  audience?: VeilleAudience | null;
}

export function filterEntries(list: readonly VeilleEntry[], f: VeilleFilter): VeilleEntry[] {
  return list.filter((e) => (!f.theme || e.themes.includes(f.theme)) && (!f.audience || e.audiences.includes(f.audience)));
}

/** Nombre de fiches par thème et par cible (pour les compteurs des filtres). */
export function facetCounts(list: readonly VeilleEntry[] = VEILLE_ENTRIES) {
  const themes = Object.fromEntries(THEMES.map((t) => [t, list.filter((e) => e.themes.includes(t)).length])) as Record<VeilleTheme, number>;
  const audiences = Object.fromEntries(AUDIENCES.map((a) => [a, list.filter((e) => e.audiences.includes(a)).length])) as Record<VeilleAudience, number>;
  return { themes, audiences };
}

export interface TimelineItem {
  date: string;
  label: string;
  slug: string;
  title: string;
  /** passé / futur par rapport à `today` */
  future: boolean;
}

/**
 * Frise : toutes les échéances de toutes les fiches, dédoublonnées (même date + même fiche), triées par date.
 * `today` (ISO) sépare le passé de l'avenir.
 */
export function timeline(list: readonly VeilleEntry[] = VEILLE_ENTRIES, today: string = CONSULTED): TimelineItem[] {
  const seen = new Set<string>();
  const out: TimelineItem[] = [];
  for (const e of list) {
    for (const d of e.deadlines) {
      const k = `${d.date}|${e.slug}|${d.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ date: d.date, label: d.label, slug: e.slug, title: e.title, future: d.date > today });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

/** Regroupe la frise par année (ordre chronologique). */
export function timelineByYear(items: TimelineItem[]): { year: string; items: TimelineItem[] }[] {
  const map = new Map<string, TimelineItem[]>();
  for (const it of items) {
    const y = it.date.slice(0, 4);
    map.set(y, [...(map.get(y) ?? []), it]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, its]) => ({ year, items: its }));
}

/** Prochaines échéances (strictement après `today`). */
export function upcoming(list: readonly VeilleEntry[] = VEILLE_ENTRIES, today: string = CONSULTED): TimelineItem[] {
  return timeline(list, today).filter((t) => t.future);
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 22 juillet 2026 » ; accepte aussi « 2026-08 » (« août 2026 »). */
export function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  if (!m[3]) return `${month} ${m[1]}`;
  const day = Number(m[3]);
  return `${day === 1 ? '1er' : day} ${month} ${m[1]}`;
}

export function entryWordCount(e: VeilleEntry): number {
  return [e.title, e.summary, ...e.changes, ...e.actions, ...(e.uncertain ?? [])].join(' ').split(/\s+/).filter(Boolean).length;
}

/* ------------------------------------------------------------------ */
/* Flux RSS                                                            */
/* ------------------------------------------------------------------ */

export function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function rfc822(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T08:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toUTCString() : new Date(0).toUTCString();
}

/** Flux RSS 2.0 des fiches (date = date de l'évènement ; guid stable = URL de la fiche). */
export function veilleRss(site: string, list: readonly VeilleEntry[] = VEILLE_ENTRIES): string {
  const base = site.replace(/\/$/, '');
  const items = sortedEntries(list)
    .map((e) => {
      const url = `${base}${veillePath(e)}`;
      const desc = `${STATUS_LABEL[e.status]} · ${e.summary}`;
      const cats = [...e.themes.map((t) => THEME_LABEL[t]), ...e.audiences.map((a) => AUDIENCE_LABEL[a])]
        .map((c) => `      <category>${xmlEsc(c)}</category>`)
        .join('\n');
      return `    <item>
      <title>${xmlEsc(e.title)}</title>
      <link>${xmlEsc(url)}</link>
      <guid isPermaLink="true">${xmlEsc(url)}</guid>
      <pubDate>${rfc822(e.eventDate)}</pubDate>
      <description>${xmlEsc(desc)}</description>
${cats}
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Repéré · Veille Google et IA</title>
    <link>${xmlEsc(`${base}${VEILLE_PATH}`)}</link>
    <atom:link href="${xmlEsc(`${base}${VEILLE_PATH}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Ce qui change pour votre visibilité sur Google et dans les IA : fiches datées et sourcées.</description>
    <language>fr-FR</language>
    <lastBuildDate>${rfc822(VEILLE_UPDATED)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ------------------------------------------------------------------ */
/* Contrôle de cohérence (tests + garde-fou éditorial)                 */
/* ------------------------------------------------------------------ */

const ISO = /^\d{4}-\d{2}(-\d{2})?$/;

/** Liste des problèmes d'une fiche (vide si tout va bien). `guideSlugs` : slugs de guides existants. */
export function entryProblems(e: VeilleEntry, guideSlugs: ReadonlySet<string>): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) p.push('slug invalide');
  if (!ISO.test(e.eventDate) || e.eventDate.length !== 10) p.push('eventDate invalide');
  if (!ISO.test(e.updated)) p.push('updated invalide');
  if (!e.changes.length) p.push('aucun changement');
  if (!e.actions.length) p.push('aucune action');
  if (!e.sources.length) p.push('aucune source');
  if (!e.sources.some((s) => s.primary)) p.push('aucune source primaire');
  if (!e.deadlines.length) p.push('aucune échéance');
  for (const d of e.deadlines) if (!ISO.test(d.date) || d.date.length !== 10) p.push(`échéance invalide ${d.date}`);
  for (const s of e.sources) {
    if (!/^https:\/\//.test(s.url)) p.push(`source non https ${s.url}`);
    if (!ISO.test(s.consulted)) p.push(`date de consultation manquante ${s.url}`);
    if (s.published && !ISO.test(s.published)) p.push(`date de publication invalide ${s.url}`);
  }
  for (const g of e.guides) if (!guideSlugs.has(g)) p.push(`guide inconnu ${g}`);
  for (const t of e.tools) if (!t.href.startsWith('/') || t.href.startsWith('//')) p.push(`lien outil non interne ${t.href}`);
  if (!e.themes.length || !e.audiences.length) p.push('thème ou cible manquant');
  if (e.status === 'a-venir' && !e.deadlines.some((d) => d.date > e.updated)) p.push('« à venir » sans échéance future');
  return p;
}
