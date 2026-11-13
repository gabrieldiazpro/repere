/**
 * PUBLICATION (V5) — « l'agent qui fait le travail » : contrats.
 *
 * Un `ChangeSet` regroupe les modifications concrètes issues d'UN constat (`Finding.id`) pour UNE plateforme.
 * Cycle : brouillon → proposé → validé (qui, quand) → appliqué → vérifié → (annulé). Rien n'est écrit chez le client
 * sans validation explicite (rôle ≥ admin) ; chaque `Change` garde sa valeur « avant » exacte (retour arrière) ; tout
 * passe par le journal immuable (src/lib/publish/journal.ts). Documentation : docs/v5/publication.md.
 */
import type { Finding } from '@/lib/crawl/types';

export type { Finding };

export const PLATFORMS = ['wordpress', 'shopify', 'webflow', 'prestashop', 'export', 'gbp'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const isPlatform = (v: unknown): v is Platform => typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v);

export const PLATFORM_LABEL: Record<Platform, string> = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  prestashop: 'PrestaShop',
  export: 'Export (fichiers à déposer)',
  gbp: 'Fiche Google (Business Profile)',
};

/** Vocabulaire `autoFix.kind` accepté (SEO-AUDIT, GEO-OPT). */
export const CHANGE_KINDS = [
  'meta.title',
  'meta.description',
  'image.alt',
  'jsonld',
  'faq',
  'redirect',
  'canonical',
  'robots.txt',
  'llms.txt',
  'rewrite',
  'gbp.description',
  'gbp.hours',
  'sitemap.xml',
  'meta.robots',
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const isChangeKind = (v: unknown): v is ChangeKind => typeof v === 'string' && (CHANGE_KINDS as readonly string[]).includes(v);

export type Risk = 'low' | 'medium' | 'high';
export const RISK_RANK: Record<Risk, number> = { low: 1, medium: 2, high: 3 };

export const KIND_RISK: Record<ChangeKind, Risk> = {
  'meta.title': 'low',
  'meta.description': 'low',
  'image.alt': 'low',
  'llms.txt': 'low',
  jsonld: 'medium',
  faq: 'medium',
  rewrite: 'medium',
  'gbp.description': 'medium',
  'gbp.hours': 'medium',
  canonical: 'high',
  redirect: 'high',
  'robots.txt': 'high',
  'sitemap.xml': 'medium',
  'meta.robots': 'high',
};

export const KIND_LABEL: Record<ChangeKind, string> = {
  'meta.title': 'Titre de page (balise title)',
  'meta.description': 'Méta-description',
  'image.alt': 'Texte alternatif d’image',
  jsonld: 'Données structurées (JSON-LD)',
  faq: 'FAQ balisée',
  redirect: 'Redirection',
  canonical: 'URL canonique',
  'robots.txt': 'Fichier robots.txt',
  'llms.txt': 'Fichier llms.txt',
  rewrite: 'Réécriture d’un passage',
  'gbp.description': 'Description de la fiche Google',
  'gbp.hours': 'Horaires de la fiche Google',
  'sitemap.xml': 'Plan du site (sitemap.xml)',
  'meta.robots': 'Consigne d’indexation (meta robots)',
};

/**
 * Charge utile `Finding.autoFix.payload` (toutes facultatives). Sans `value`, le planificateur rédige (IA puis repli
 * déterministe) ; sans `url`, il prend `Finding.affected[]`.
 */
export interface AutoFixPayload {
  url?: string;
  urls?: string[];
  /** valeur proposée telle quelle (titre, description, alt, JSON-LD, contenu de fichier…) */
  value?: string;
  /** image visée (image.alt) */
  imageSrc?: string;
  /** redirection : chemin source → cible */
  from?: string;
  to?: string;
  /** réécriture : passage exact à remplacer (et sa nouvelle version, ou une consigne pour l'IA) */
  find?: string;
  replace?: string;
  instruction?: string;
  /** FAQ : questions/réponses TIRÉES DU CONTENU EXISTANT (jamais inventées) */
  faq?: { question: string; answer: string; trusted?: boolean }[];
  /** robots.txt : robots à autoriser explicitement (GPTBot, ClaudeBot, PerplexityBot…) */
  allowBots?: string[];
  /** horaires (gbp.hours) au format Google `regularHours` */
  hours?: unknown;
  /** réécriture : texte rédigé par l'IA (contrôle anti-invention) ou déterministe */
  mode?: 'ia' | 'deterministe';
  /** remplacer toutes les occurrences (mise à jour de liens) */
  all?: boolean;
  /** JSON-LD : fusion de champs dans le bloc d'entité existant de la page (export seulement) */
  merge?: Record<string, unknown>;
}

/** Ressource visée chez la plateforme (résolue depuis l'URL par le connecteur). */
export interface ResourceRef {
  type: 'post' | 'page' | 'product' | 'collection' | 'article' | 'media' | 'cms' | 'category' | 'file' | 'location' | 'redirect' | 'site';
  id?: string;
  /** information complémentaire (ex. collection Webflow, langue PrestaShop, handle Shopify) */
  extra?: Record<string, string>;
}

export interface ChangeTarget {
  /** page publique visée (pour la relecture réelle) ; pour un fichier : son URL publique */
  url?: string;
  resource?: ResourceRef;
  /** image (alt) */
  imageSrc?: string;
  /** redirection : chemin source */
  path?: string;
}

/** Comment calculer « après » à partir de l'état réel lu chez la plateforme. */
export interface ChangePatch {
  op: 'set' | 'append' | 'replace';
  value: string;
  /** `replace` : passage exact (doit apparaître une seule fois, sauf `all`) */
  find?: string;
  /** `replace` : toutes les occurrences (mise à jour d'adresses de liens) */
  all?: boolean;
}

export type ChangeStatus = 'pending' | 'applied' | 'verified' | 'failed' | 'reverted' | 'skipped';

export interface Verification {
  ok: boolean;
  /** `api` : relu chez la plateforme ; `page` : page publique relue ; `manual` : export, à déposer par le client */
  method: 'api' | 'page' | 'manual';
  detail: string;
  at: string;
}

export interface Change {
  id: string;
  kind: ChangeKind;
  target: ChangeTarget;
  patch: ChangePatch;
  /** valeur exacte avant (null = absent) ; `beforeSource` dit d'où elle vient */
  before: string | null;
  beforeSource: 'platform' | 'crawl' | 'none';
  /** valeur exacte après (null = suppression) */
  after: string | null;
  rationale: string;
  risk: Risk;
  generatedBy: 'finding' | 'ai' | 'rules' | 'user';
  status: ChangeStatus;
  error?: string;
  /** identifiant créé chez la plateforme (ex. redirection Shopify), pour le retour arrière */
  remoteRef?: string;
  appliedAt?: string;
  verification?: Verification[];
  revertedAt?: string;
}

export const CHANGESET_STATUSES = ['draft', 'proposed', 'validated', 'applying', 'applied', 'partially_applied', 'verified', 'reverted', 'rejected', 'failed'] as const;
export type ChangeSetStatus = (typeof CHANGESET_STATUSES)[number];

export interface Actor {
  /** identifiant d'utilisateur (session) ou 'system' / 'agent' */
  id: string;
  email?: string;
  role?: string;
}

export interface ChangeSet {
  id: string;
  businessId: string;
  platform: Platform;
  /** origine du site (https://exemple.fr) */
  site: string;
  title: string;
  /** constat d'origine (Finding.id) */
  origin: { findingId: string; findingTitle?: string; severity?: string };
  changes: Change[];
  risk: Risk;
  status: ChangeSetStatus;
  createdAt: string;
  createdBy: Actor;
  proposedAt?: string;
  validation?: { by: Actor; at: string; note?: string };
  rejection?: { by: Actor; at: string; reason?: string };
  appliedAt?: string;
  verifiedAt?: string;
  revertedAt?: string;
  /** remesure ciblée programmée (id de tâche de la file) */
  remeasureJobId?: string;
  /** export : nom du fichier zip à télécharger */
  exportBundle?: boolean;
  demo?: boolean;
  /** incrémenté à chaque écriture (contrôle de concurrence optimiste) */
  version: number;
  updatedAt: string;
}

/** Changements non planifiables (et pourquoi), renvoyés au client pour transparence. */
export interface SkippedFix {
  findingId: string;
  kind?: string;
  url?: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// HTTP (injectable : client sûr en production, faux serveur local en test)
// ---------------------------------------------------------------------------
export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}
export type HttpClient = (req: HttpRequest) => Promise<HttpResponse>;

// ---------------------------------------------------------------------------
// Connecteurs
// ---------------------------------------------------------------------------
export interface ConnectorContext {
  businessId: string;
  http: HttpClient;
  /** secrets déchiffrés (jamais renvoyés au client) */
  credentials: Record<string, string>;
  /** réglages non secrets (URL du site, identifiant de site, boutique…) */
  config: Record<string, string>;
  now: () => Date;
}

export interface ConnectInput {
  config: Record<string, string>;
  credentials: Record<string, string>;
}

export interface TestResult {
  ok: boolean;
  detail: string;
  /** types de changement réellement applicables avec ces droits */
  capabilities: ChangeKind[];
  /** informations utiles (extension SEO détectée, nom du site…) */
  info?: Record<string, string>;
}

export interface PublishConnector {
  platform: Platform;
  /** types de changement que la plateforme sait appliquer (avant test des droits) */
  kinds: readonly ChangeKind[];
  /** valide et normalise la saisie (sans réseau) ; lève PublishError(400) si incomplète */
  connect(input: ConnectInput): ConnectInput;
  test(ctx: ConnectorContext): Promise<TestResult>;
  /** trouve la ressource visée par un changement (depuis son URL) */
  locate(ctx: ConnectorContext, change: Change): Promise<ResourceRef>;
  /** lit la valeur actuelle exacte (null = absente) */
  read(ctx: ConnectorContext, change: Change): Promise<string | null>;
  /** écrit `change.after` ; renvoie un éventuel identifiant créé */
  apply(ctx: ConnectorContext, change: Change): Promise<{ remoteRef?: string }>;
  /** rétablit `change.before` (ou supprime ce qui a été créé) */
  revert(ctx: ConnectorContext, change: Change): Promise<void>;
  /** après une série d'écritures (ex. publication Webflow, une fois par minute au plus) */
  finalize?(ctx: ConnectorContext, changes: Change[]): Promise<void>;
}

export class PublishError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}
