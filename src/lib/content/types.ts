/**
 * Agent de contenu (V8) — contrats.
 *
 * Propositions (pages manquantes, preuves à l'appui) → brouillon rédigé UNIQUEMENT à partir des faits fournis par le
 * client (fiche « faits clés ») et de sources publiques citées → contrôle (citabilité, structure, cannibalisation) →
 * validation par un administrateur → création en brouillon chez le client → mise en ligne → mesure J+30 / J+90.
 * « Mentions à obtenir » : sites que les IA citent sur les questions du client, avec message de demande rédigé ; rien
 * n'est envoyé automatiquement. Aucune production de masse : plafond mensuel par offre (quota.ts).
 */
import type { Actor, Platform } from '@/lib/publish/types';
import type { PageBlock, PageFormat, RemotePage } from '@/lib/publish/pages/types';
import type { SourceCategory } from '@/lib/engine/types-v2';

export type { Actor, Platform, PageBlock, PageFormat, RemotePage };

// ---------------------------------------------------------------------------
// Faits clés (fournis par le client)
// ---------------------------------------------------------------------------
export const FACT_KEYS = [
  'activite',
  'services',
  'zone',
  'adresse',
  'telephone',
  'email',
  'horaires',
  'prix',
  'delais',
  'garanties',
  'paiement',
  'certifications',
  'creation',
  'dirigeant',
  'equipe',
  'histoire',
  'difference',
  'clients',
  'livraison',
  'retours',
  'avis',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];
export const isFactKey = (v: unknown): v is FactKey => typeof v === 'string' && (FACT_KEYS as readonly string[]).includes(v);

export interface FactValue {
  value: string;
  /** 'client' : saisi dans la fiche faits clés ; 'verite' : repris de la fiche de vérité (lecture seule ici) */
  origin: 'client' | 'verite';
  updatedAt?: string;
}
export type FactSheet = Partial<Record<FactKey, FactValue>>;

export interface StoredFacts {
  businessId: string;
  facts: Partial<Record<FactKey, string>>;
  updatedAt: string;
  updatedBy?: string;
}

// ---------------------------------------------------------------------------
// Propositions (pages manquantes)
// ---------------------------------------------------------------------------
export const PAGE_TYPES = ['tarifs', 'faq', 'zone', 'comparatif', 'a-propos', 'service', 'garanties', 'contact', 'article'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export type OpportunitySource = 'questions_ia' | 'search_console' | 'analyse_geo' | 'page_mince';

export interface Evidence {
  source: OpportunitySource;
  /** phrase courte, factuelle (« Sur “plombier Lyon 3”, ChatGPT cite Durand Plomberie, pas vous ») */
  text: string;
  /** date de la mesure / de l'exploration */
  at?: string;
  /** chiffres bruts (impressions, nombre de réponses, mots…) */
  data?: Record<string, string | number>;
}

export interface ContentOpportunity {
  id: string;
  action: 'create' | 'rewrite';
  pageType: PageType;
  format: PageFormat;
  /** titre de travail */
  title: string;
  /** requête / question visée */
  target: string;
  why: string;
  evidence: Evidence[];
  /** 1 (faible) à 9 (fort) */
  priority: number;
  /** réécriture : page existante visée */
  existingUrl?: string;
  /** faits nécessaires pour une page complète */
  needs: FactKey[];
  /** questions suivies concernées (mesure d'effet) */
  questionIds: string[];
  competitors: string[];
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Brouillons
// ---------------------------------------------------------------------------
export const DRAFT_STATUSES = ['draft', 'validated', 'remote_draft', 'published', 'unpublished', 'removed', 'exported', 'rejected'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface PublicSource {
  n: number;
  url: string;
  title: string;
  domain: string;
  /** pourquoi cette source est citée */
  note: string;
}

export interface InternalLink {
  url: string;
  anchor: string;
  reason: string;
  direction: 'depuis_brouillon' | 'vers_brouillon';
}

export interface CannibalRisk {
  url: string;
  title: string;
  /** 0–1 */
  overlap: number;
  level: 'fort' | 'moyen';
  advice: string;
}

export interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** bloquant pour la validation */
  blocking?: boolean;
}

export interface Citability {
  /** moyenne des passages, 0–100 (heuristique de rédaction GEO, pas une mesure de citation) */
  score: number;
  passages: { heading?: string; score: number; missing: string[] }[];
}

export interface DraftVersion {
  at: string;
  by: string;
  body: string;
  note?: string;
}

export interface EffectSnapshot {
  at: string;
  /** questions suivies : réponses où vous êtes cité / réponses mesurées */
  ai: { questionIds: string[]; cited: number; total: number } | null;
  /** Search Console : requête visée */
  gsc: { query: string; impressions: number; clicks: number; position: number | null } | null;
  /** suivi de positions : position du mot-clé visé */
  rank: { keyword: string; position: number | null } | null;
}

export interface DraftEffect {
  publishedAt: string;
  baseline: EffectSnapshot;
  d30?: EffectSnapshot;
  d90?: EffectSnapshot;
}

export interface ContentDraft {
  id: string;
  businessId: string;
  opportunityId?: string;
  action: 'create' | 'rewrite';
  pageType: PageType;
  format: PageFormat;
  target: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  /** corps en Markdown restreint (## intertitres, paragraphes, listes « - », [texte](lien), [n] = source n) */
  body: string;
  sources: PublicSource[];
  jsonLd: string[];
  links: InternalLink[];
  cannibal: CannibalRisk[];
  checks: CheckItem[];
  citability: Citability;
  /** faits utilisés et manquants */
  factsUsed: FactKey[];
  missing: string[];
  writer: 'ia' | 'modele';
  writerNote?: string;
  /** réécriture : texte actuel de la page (base des différences) */
  existing?: { url: string; title?: string; text: string };
  history: DraftVersion[];
  status: DraftStatus;
  platform?: Platform;
  remote?: RemotePage;
  validation?: { by: Actor; at: string };
  rejection?: { by: Actor; at: string; reason?: string };
  publishedAt?: string;
  /** compté dans le quota du mois (création chez le client ou export) */
  consumedAt?: string;
  /** adresse publique (déclarée après un export, ou fournie par la plateforme) */
  liveUrl?: string;
  effect?: DraftEffect;
  questionIds: string[];
  evidence: Evidence[];
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Mentions à obtenir
// ---------------------------------------------------------------------------
export type MentionStatus = 'a_faire' | 'demande' | 'obtenu' | 'refuse';

export interface MentionTarget {
  id: string;
  domain: string;
  label: string;
  category: SourceCategory;
  categoryLabel: string;
  /** pourquoi ce site : citations par les IA, concurrents présents */
  why: string;
  citations: number;
  providers: string[];
  competitors: string[];
  sampleUrl?: string;
  /** voie de contact publique connue (table des domaines), sinon null */
  contact: string | null;
  steps: string[];
  message: { subject: string; body: string };
  /** rappels de déontologie propres à la catégorie */
  caution?: string;
  demo?: boolean;
}

export interface MentionTracking {
  id: string;
  businessId: string;
  status: MentionStatus;
  requestedAt?: string;
  obtainedAt?: string;
  url?: string;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface ContentSettings {
  webflowCollectionId?: string;
  wixMemberId?: string;
  shopifyBlogId?: string;
  prestashopCategoryId?: string;
  /** plateforme préférée pour la création (sinon : la première connectée qui sait le faire) */
  platform?: Platform;
}

export class ContentError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ContentError';
  }
}
