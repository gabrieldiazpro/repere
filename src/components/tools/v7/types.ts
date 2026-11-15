/**
 * Outils gratuits V7 (OUTILS-2) : formes de résultat partagées entre serveur (analyse) et navigateur (affichage).
 * Aucun import serveur ici.
 */
import type { CheckStatus, V6Check, Verdict } from '../v6/types';

export type { CheckStatus, V6Check, Verdict };

/** Site illisible ou lu partiellement : état et marche à suivre (src/lib/analysis/access.ts). */
export interface AccessInfo {
  state: string;
  /** rien n'a pu être lu : l'outil n'affiche aucun résultat calculé */
  blocked: boolean;
  title: string;
  message: string;
  howTo: string[];
  notes: string[];
  platform?: string;
}

export interface PageBase7 {
  url: string;
  finalUrl: string;
  status: number;
  verdict: Verdict;
  checks: V6Check[];
  checkedAt: string;
  access?: AccessInfo;
}

/* ---------- Structure des titres H1–H6 ---------- */

export interface HeadingRow {
  level: number;
  text: string;
  /** saut de niveau (H2 → H4) */
  skipped: boolean;
  empty: boolean;
  question: boolean;
}

export interface HeadingsReport extends PageBase7 {
  title: string | null;
  headings: HeadingRow[];
  counts: number[];
  words: number;
}

/* ---------- Images et textes alternatifs ---------- */

export type AltKind = 'ok' | 'missing' | 'empty' | 'filename' | 'long' | 'generic' | 'duplicate';

export interface ImageRow {
  src: string;
  alt: string | null;
  kind: AltKind;
  linked: boolean;
  /** statut HTTP vérifié (0 : injoignable), absent si non vérifié */
  status?: number;
  bytes?: number;
  contentType?: string;
  error?: string;
}

export interface ImagesReport extends PageBase7 {
  total: number;
  missing: number;
  empty: number;
  weak: number;
  checked: number;
  broken: number;
  images: ImageRow[];
}

/* ---------- Poids de la page ---------- */

export type ResourceKind = 'html' | 'image' | 'script' | 'style' | 'font' | 'media' | 'autre';

export interface ResourceRow {
  url: string;
  kind: ResourceKind;
  bytes: number | null;
  status?: number;
  contentType?: string;
  external: boolean;
  error?: string;
}

export interface WeightReport extends PageBase7 {
  htmlBytes: number;
  compressed: string | null;
  totalKnown: number;
  unknown: number;
  requests: number;
  checked: number;
  byKind: { kind: ResourceKind; count: number; bytes: number }[];
  heaviest: ResourceRow[];
  resources: ResourceRow[];
}

/* ---------- Compatibilité mobile ---------- */

export interface MobileReport extends PageBase7 {
  viewport: string | null;
  signals: { label: string; value: string }[];
}

/* ---------- HTTPS et contenu mixte ---------- */

export interface MixedItem {
  url: string;
  tag: string;
  active: boolean;
}

export interface HttpsReport extends PageBase7 {
  https: boolean;
  httpRedirect: { start: string; final: string; status: number; toHttps: boolean; error?: string } | null;
  hsts: string | null;
  mixed: MixedItem[];
  httpLinks: number;
}

/* ---------- Contenu dupliqué entre deux pages ---------- */

export interface DupSide {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  description: string | null;
  h1: string | null;
  canonical: string | null;
  words: number;
  hash: string;
  error?: string;
}

export interface DuplicateReport {
  url: string;
  verdict: Verdict;
  checks: V6Check[];
  a: DupSide;
  b: DupSide;
  /** part du texte commune (Jaccard sur des suites de 5 mots), 0–100 */
  similarity: number;
  identical: boolean;
  shared: string[];
  checkedAt: string;
  access?: AccessInfo;
}

/* ---------- Fraîcheur ---------- */

export interface DateSignal {
  source: string;
  value: string;
  iso: string | null;
}

export interface FreshnessReport extends PageBase7 {
  dates: DateSignal[];
  latest: string | null;
  ageDays: number | null;
}

/* ---------- Résultats enrichis Google ---------- */

export type RichStatus = 'eligible' | 'incomplete' | 'invalid' | 'deprecated' | 'none';

export interface RichItem {
  type: string;
  feature: string;
  doc: string | null;
  status: RichStatus;
  required: string[];
  recommended: string[];
  invalid: string[];
  notes: string[];
}

export interface RichReport extends PageBase7 {
  blocks: number;
  parseErrors: string[];
  types: string[];
  items: RichItem[];
  microdata: string[];
}

/* ---------- Cohérence NAP (navigateur) ---------- */

export interface NapEntry {
  source: string;
  name: string;
  address: string;
  phone: string;
}

export type NapMatch = 'same' | 'variant' | 'different' | 'empty';

export interface NapRow {
  source: string;
  name: NapMatch;
  address: NapMatch;
  phone: NapMatch;
  notes: string[];
}

export interface NapReport {
  reference: NapEntry;
  rows: NapRow[];
  verdict: Verdict;
  checks: V6Check[];
}

/* ---------- UTM (navigateur) ---------- */

export interface UtmInput {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface UtmResult {
  link: string | null;
  channel: string;
  errors: string[];
  warnings: string[];
  verdict: Verdict;
}

/* ---------- Fiche « faits clés » (navigateur) ---------- */

export interface FactsInput {
  name: string;
  activity: string;
  area: string;
  address: string;
  phone: string;
  hours: string;
  since: string;
  prices: string;
  facts: string;
  updated: string;
  site: string;
}

export interface FactsResult {
  html: string;
  markdown: string;
  verdict: Verdict;
  checks: V6Check[];
  count: number;
}
