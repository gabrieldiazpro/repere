/**
 * Normalisation d'URL et classification des domaines (docs/v2/03-sources.md § 4).
 * Sans dépendance ni réseau : table data/domains.json (436 domaines), règles d'hôte, heuristique de repli.
 */
import TABLE from '../data/domains.json';
import { jaroWinkler, norm, normName, registrableDomain } from '../detect';
import type { Segment, SourceCategory } from '../types-v2';
import { capitalize } from '../util';

/** Catégories de la table (anglais, doc 03) → catégories du contrat V2 (français). */
export const DOC_CATEGORY: Record<string, SourceCategory> = {
  directory: 'annuaire',
  reviews: 'avis',
  media_national: 'media_national',
  media_local: 'media_local',
  comparison: 'comparatif',
  forum: 'forum',
  marketplace: 'marketplace',
  social: 'reseau_social',
  competitor: 'concurrent',
  client: 'client',
  wikipedia: 'wikipedia',
  institutional: 'institutionnel',
  other: 'autre',
};

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  annuaire: 'Annuaire / plateforme de fiches',
  avis: "Plateforme d'avis",
  media_national: 'Média national ou spécialisé',
  media_local: 'Média local',
  comparatif: 'Comparatif, classement, guide',
  forum: 'Forum, Reddit, Q&R',
  marketplace: 'Marketplace',
  reseau_social: 'Réseau social / vidéo',
  concurrent: "Site d'un concurrent",
  client: 'Votre site',
  wikipedia: 'Wikipédia et encyclopédies',
  institutionnel: 'Institutionnel',
  autre: 'Autre',
};

export interface DomainEntry {
  domain: string;
  category: string;
  country?: string;
  label: string;
  howToGetListed?: string;
}

const ENTRIES = TABLE as DomainEntry[];
const BY_DOMAIN = new Map<string, DomainEntry>(ENTRIES.map((d) => [d.domain, d]));

export function domainTable(): DomainEntry[] {
  return ENTRIES;
}

/* ------------------------------------------------------------------ */
/* Normalisation (§ 4.1)                                               */
/* ------------------------------------------------------------------ */

const TRACKING = /^(utm_.*|gclid|fbclid|msclkid|srsltid|ref|ref_src|mc_cid|mc_eid|_ga|igshid|si)$/;

export interface NormUrl {
  urlNorm: string;
  host: string;
  domain: string;
  path: string;
}

export function normalizeUrl(raw: string): NormUrl | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\d?|m|amp|mobile)\./, '');
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  const path = u.pathname.replace(/\/amp\/?$/, '').replace(/\/+$/, '');
  const qs = u.searchParams.toString();
  return { urlNorm: `https://${host}${path}${qs ? `?${qs}` : ''}`, host, domain: registrableDomain(host), path };
}

/** Accepte un domaine nu (« fr.trustpilot.com ») ou une URL. */
export function toNormUrl(domainOrUrl: string): NormUrl | null {
  const s = domainOrUrl.trim();
  if (!s) return null;
  return normalizeUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
}

export function isGeminiRedirect(url: string): boolean {
  return url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect');
}

/* ------------------------------------------------------------------ */
/* Classification (§ 4.2 – 4.5)                                        */
/* ------------------------------------------------------------------ */

export interface ClassifyContext {
  clientDomain?: string;
  clientName?: string;
  /** nom du concurrent → domaine connu (extrait des réponses), facultatif */
  competitorDomains?: Map<string, string>;
  competitors?: string[];
  title?: string;
  snippet?: string;
}

export interface DomainClass {
  domain: string;
  host: string;
  category: SourceCategory;
  label: string;
  howTo?: string;
  source: 'client' | 'competitor' | 'rule' | 'table' | 'heuristic' | 'default';
  confidence: 'high' | 'medium' | 'low';
  /** concurrent associé (category = 'concurrent') */
  competitor?: string;
}

interface HostRule {
  test: (host: string, path: string) => boolean;
  category: SourceCategory;
  label?: string;
}

const SITE_PLATFORM = /\.(blogspot\.com|wordpress\.com|wixsite\.com|myshopify\.com|webflow\.io)$/;

const HOST_RULES: HostRule[] = [
  { test: (h, p) => /^maps\.google\./.test(h) || (/^google\./.test(h) && p.startsWith('/maps')) || h === 'maps.app.goo.gl' || (h === 'goo.gl' && p.startsWith('/maps')) || (h === 'g.co' && p.startsWith('/kgs')), category: 'annuaire', label: 'Google Maps' },
  { test: (h) => h === 'play.google.com' || h === 'apps.apple.com', category: 'marketplace', label: "Magasins d'applications" },
  { test: (h) => h === 'maps.apple.com', category: 'annuaire', label: 'Apple Plans' },
  { test: (h) => /^(forum|forums|communaute|community)\./.test(h), category: 'forum' },
  { test: (h) => h === 'france3-regions.francetvinfo.fr' || /\.actu\.fr$/.test(h), category: 'media_local' },
];

const CITIES = [
  'paris', 'lyon', 'marseille', 'toulouse', 'nice', 'nantes', 'montpellier', 'strasbourg', 'bordeaux', 'lille', 'rennes', 'reims',
  'toulon', 'grenoble', 'dijon', 'angers', 'nimes', 'brest', 'tours', 'amiens', 'limoges', 'annecy', 'perpignan', 'metz', 'besancon',
  'orleans', 'rouen', 'mulhouse', 'caen', 'nancy', 'bretagne', 'normandie', 'alsace', 'provence', 'occitanie', 'auvergne', 'savoie',
  'picardie', 'lorraine', 'vendee', 'gironde', 'aquitaine', 'champagne', 'bourgogne', 'corse', 'idf', 'iledefrance',
];

function prettyDomain(domain: string): string {
  const base = domain.split('.')[0];
  return capitalize(base.replace(/-/g, ' '));
}

function compact(s: string): string {
  return normName(s).replace(/\s+/g, '');
}

/** Le label du domaine (« plomberie-martin ») correspond-il au nom (« Plomberie Martin ») ? */
export function domainMatchesName(domain: string, name: string): boolean {
  const label = domain.split('.')[0].replace(/-/g, '');
  const c = compact(name);
  if (!label || !c || c.length < 4) return false;
  if (label === c) return true;
  if (label.length >= 5 && (label.includes(c) || (c.includes(label) && label.length >= c.length * 0.6))) return true;
  return jaroWinkler(label, c) >= 0.93;
}

function heuristic(n: NormUrl, meta: { title?: string; snippet?: string }): { category: SourceCategory; score: number } | null {
  const label = n.host.split('.').slice(0, -1).join('.');
  const path = n.path.toLowerCase();
  const text = norm(`${meta.title ?? ''} ${meta.snippet ?? ''}`);
  const hay = `${label} ${path}`;
  const pts: Partial<Record<SourceCategory, number>> = {};
  const add = (c: SourceCategory, p: number) => (pts[c] = (pts[c] ?? 0) + p);

  if (/\.(gouv\.fr|gouv|gov|edu|int|mil)$/.test(n.host) || /\.(gov|ac)\.[a-z]{2}$/.test(n.host) || n.domain === 'europa.eu' || /(^|[.-])(mairie|ville|cci|cma|prefecture|tourisme|office-de-tourisme|region|departement)([.-]|$)/.test(label))
    add('institutionnel', 3);
  if (/annuaire|directory|pages|listing|118|trouver|(^|[.-])pro-|artisans-|-pros/.test(label) || /\/(annuaire|pro|fiche|etablissement|biz|place)\//.test(`${path}/`))
    add('annuaire', 2);
  if (/avis|review|note|temoignage|opinion/.test(hay) || /avis clients|\d+ avis/.test(text)) add('avis', 2);
  if (/compar|meilleur|(^|[^a-z])top|classement|versus|-vs-|(^|[^a-z])test|guide|alternative/.test(hay) || /les \d+ meilleur|comparatif|meilleurs/.test(text))
    add('comparatif', 2);
  if (/forum|communaute|community|discussion|topic|thread|\/t\/|\/r\/|question/.test(hay)) add('forum', 3);
  if (/journal|actu|info|presse|news|mag|tribune|matin|republicain|depeche|courrier|gazette|echo|hebdo/.test(label) || /\/20\d\d\/\d\d\//.test(path)) {
    const local = CITIES.some((c) => hay.includes(c) || text.includes(c));
    add(local ? 'media_local' : 'media_national', 2);
  }
  if (/shop|boutique|store|market|achat|vente/.test(label) || /\/(produit|p|dp|product|vendeur)\//.test(`${path}/`)) add('marketplace', 1);
  let best: { category: SourceCategory; score: number } | null = null;
  for (const [c, s] of Object.entries(pts) as [SourceCategory, number][]) if (!best || s > best.score) best = { category: c, score: s };
  return best && best.score >= 2 ? best : null;
}

/**
 * Classe un domaine (ou une URL). Ordre (§ 4.4) : client, concurrent, règles d'hôte, table, heuristique, autre.
 */
export function classifyDomain(domainOrUrl: string, ctx: ClassifyContext = {}): DomainClass {
  const n = toNormUrl(domainOrUrl) ?? { urlNorm: domainOrUrl, host: domainOrUrl.toLowerCase(), domain: registrableDomain(domainOrUrl), path: '' };
  const base = { domain: n.domain, host: n.host };
  const tableHit = BY_DOMAIN.get(n.host) ?? BY_DOMAIN.get(n.domain);
  if (ctx.clientDomain && (n.domain === ctx.clientDomain || n.host === ctx.clientDomain))
    return { ...base, category: 'client', label: 'Votre site', source: 'client', confidence: 'high' };
  if (!tableHit) {
    for (const [name, d] of ctx.competitorDomains ?? []) {
      if (d && registrableDomain(d) === n.domain) return { ...base, category: 'concurrent', label: name, source: 'competitor', confidence: 'high', competitor: name };
    }
    for (const name of ctx.competitors ?? []) {
      if (domainMatchesName(n.domain, name)) return { ...base, category: 'concurrent', label: name, source: 'competitor', confidence: 'medium', competitor: name };
    }
    if (ctx.clientName && domainMatchesName(n.domain, ctx.clientName))
      return { ...base, category: 'client', label: 'Votre site', source: 'client', confidence: 'medium' };
  }
  const rule = HOST_RULES.find((r) => r.test(n.host, n.path));
  if (rule) {
    const t = BY_DOMAIN.get(n.domain);
    return { ...base, category: rule.category, label: rule.label ?? t?.label ?? prettyDomain(n.domain), howTo: t?.howToGetListed, source: 'rule', confidence: 'high' };
  }
  if (tableHit) {
    return {
      ...base,
      category: DOC_CATEGORY[tableHit.category] ?? 'autre',
      label: tableHit.label,
      howTo: tableHit.howToGetListed,
      source: 'table',
      confidence: 'high',
    };
  }
  if (SITE_PLATFORM.test(n.host)) return { ...base, category: 'autre', label: prettyDomain(n.host), source: 'heuristic', confidence: 'low' };
  const h = heuristic(n, { title: ctx.title, snippet: ctx.snippet });
  if (h) return { ...base, category: h.category, label: prettyDomain(n.domain), source: 'heuristic', confidence: 'medium' };
  return { ...base, category: 'autre', label: prettyDomain(n.domain), source: 'default', confidence: 'low' };
}

/** Domaine d'une plateforme nommée (« PagesJaunes » → pagesjaunes.fr), via les libellés de la table. */
export function domainFromPlatformLabel(label: string): string | null {
  const n = compact(label);
  if (!n) return null;
  for (const e of ENTRIES) {
    const l = compact(e.label.split('(')[0]);
    if (l && (l === n || e.domain.split('.')[0] === n)) return e.domain;
  }
  return null;
}

/** Sources de référence par segment, pour compléter le top 10 (§ 7.1, point 4). */
export const SECTOR_FALLBACKS: Record<Segment, string[]> = {
  local: ['google.com', 'pagesjaunes.fr', 'bing.com', 'apple.com', 'tripadvisor.fr', 'facebook.com', 'actu.fr', 'justacote.com'],
  pme: ['g2.com', 'capterra.fr', 'appvizer.fr', 'linkedin.com', 'trustpilot.com', 'getapp.fr', 'societe.com', 'journaldunet.com'],
  ecommerce: ['trustpilot.com', 'avis-verifies.com', 'amazon.fr', 'idealo.fr', 'reddit.com', 'instagram.com', 'youtube.com', 'ledenicheur.fr'],
};

export function tableEntry(domain: string): DomainEntry | undefined {
  return BY_DOMAIN.get(domain);
}
