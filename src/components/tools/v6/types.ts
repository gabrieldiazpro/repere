/**
 * Outils gratuits V6 (SEO Google) : formes de résultat partagées entre serveur (analyse) et navigateur (affichage).
 * Aucun import serveur ici.
 */
import type { CheckStatus } from '@/lib/siteaudit/types';

export type { CheckStatus };

export interface V6Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix: string;
  informational?: boolean;
}

/** Verdict en une phrase-résultat, avec le ton (vert / ambre / rouge). */
export interface Verdict {
  tone: CheckStatus;
  title: string;
  text: string;
}

export interface Hop {
  url: string;
  status: number;
}

interface PageBase {
  url: string;
  finalUrl: string;
  status: number;
  verdict: Verdict;
  checks: V6Check[];
  checkedAt: string;
}

/* ---------- Aperçu Google ---------- */

export interface SerpLine {
  full: string;
  shown: string;
  truncated: boolean;
  /** Largeur estimée en pixels du texte complet. */
  width: number;
  chars: number;
  /** Limite utilisée (pixels). */
  limit: number;
}

export interface SerpPreview {
  title: SerpLine;
  descDesktop: SerpLine;
  descMobile: SerpLine;
  /** Fil d'adresse affiché par Google (« site.fr › services › plomberie »). */
  breadcrumb: string;
  host: string;
  /** La description vient du texte de la page (pas de meta description). */
  descriptionFromPage: boolean;
}

/* ---------- Title et meta description ---------- */

export interface MetaReport extends PageBase {
  title: string | null;
  titleCount: number;
  description: string | null;
  descriptionCount: number;
  h1: string[];
  lang: string | null;
  serp: SerpPreview;
}

/* ---------- Indexabilité ---------- */

export interface IndexReport extends PageBase {
  indexable: 'yes' | 'no' | 'maybe';
  chain: Hop[];
  metaRobots: string | null;
  xRobotsTag: string | null;
  canonical: string | null;
  robots: { url: string; found: boolean; allowedGoogle: boolean; allowedBing: boolean; rule: string | null };
}

/* ---------- Redirections ---------- */

export interface RedirectVariant {
  start: string;
  final: string;
  status: number;
  hops: number;
  error?: string;
}

export interface RedirectReport {
  url: string;
  verdict: Verdict;
  checks: V6Check[];
  chain: Hop[];
  final: Hop;
  loop: boolean;
  error: string | null;
  variants: RedirectVariant[];
  checkedAt: string;
}

/* ---------- En-têtes HTTP ---------- */

export type HeaderGroup = 'indexation' | 'cache' | 'securite' | 'contenu' | 'serveur' | 'autre';

export interface HeaderRow {
  name: string;
  value: string;
  group: HeaderGroup;
}

export interface HeadersReport extends PageBase {
  chain: Hop[];
  headers: HeaderRow[];
  fetchMs: number;
}

/* ---------- hreflang ---------- */

export interface HreflangEntry {
  lang: string;
  href: string;
  valid: boolean;
  issue?: string;
  /** La page alternative renvoie-t-elle vers cette page ? null : non vérifié. */
  returnLink: boolean | null;
  targetStatus?: number;
}

export interface HreflangReport extends PageBase {
  entries: HreflangEntry[];
  canonical: string | null;
  lang: string | null;
  checkedAlternates: number;
}

/* ---------- Open Graph ---------- */

export interface OgImageCheck {
  url: string;
  status: number;
  contentType: string | null;
  error?: string;
}

export interface OgReport extends PageBase {
  og: Record<string, string>;
  twitter: Record<string, string>;
  preview: { title: string; description: string; image: string | null; siteName: string; host: string };
  image: OgImageCheck | null;
}

/* ---------- Liens d'une page ---------- */

export interface LinkRow {
  href: string;
  anchor: string;
  internal: boolean;
  rel: string[];
  /** Statut HTTP vérifié (0 = injoignable), absent si non vérifié. */
  status?: number;
  error?: string;
}

export interface LinksReport extends PageBase {
  total: number;
  internal: number;
  external: number;
  nofollow: number;
  sponsored: number;
  ugc: number;
  checked: number;
  broken: number;
  links: LinkRow[];
}

/* ---------- Sitemap ---------- */

export interface SitemapReport {
  url: string;
  source: 'given' | 'robots' | 'default';
  status: number;
  verdict: Verdict;
  checks: V6Check[];
  kind: 'index' | 'urlset' | 'text' | 'html' | 'unknown' | 'missing';
  urlCount: number;
  bytes: number;
  truncated: boolean;
  declaredInRobots: boolean;
  lastmodCount: number;
  sample: { url: string; status: number; finalUrl?: string; error?: string }[];
  children: { url: string; status?: number; urlCount?: number }[];
  checkedAt: string;
}

/* ---------- Lisibilité (calcul dans le navigateur) ---------- */

export interface ReadabilityReport {
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  syllables: number;
  /** Indice de Kandel et Moles (adaptation française de Flesch), borné 0–100. */
  score: number;
  band: { label: string; tone: CheckStatus; audience: string };
  wordsPerSentence: number;
  syllablesPerWord: number;
  readingMinutes: number;
  longSentences: string[];
  longParagraphs: number;
  topWords: { word: string; count: number; share: number }[];
  verdict: Verdict;
  checks: V6Check[];
}

/* ---------- Générateur de robots.txt ---------- */

export type BotPolicy = 'allow' | 'block';
export type RobotsProfile = 'ouvert' | 'cite' | 'ferme' | 'perso';

export interface RobotsGenInput {
  bots: Record<string, BotPolicy>;
  disallow: string[];
  sitemaps: string[];
}

export interface RobotsGenRow {
  token: string;
  operator: string;
  roleLabel: string;
  allowedHome: boolean;
  /** Premier chemin interdit testé (s'il y en a) : bloqué pour ce robot ? */
  blockedSample: boolean | null;
}

export interface RobotsGenResult {
  text: string;
  rows: RobotsGenRow[];
  verdict: Verdict;
  warnings: string[];
  errors: string[];
}
