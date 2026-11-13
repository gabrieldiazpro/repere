/**
 * Module LOCAL (docs/v3/12-CONTRATS-V3.md, ligne LOCAL ; docs/v3/05-teardown-local.md).
 * Types partagés : audit de fiche Google, carte de visibilité par zone, audit NAP, calendrier de posts, thèmes des avis.
 */
import type { ProviderId } from '@/lib/engine/types';
import type { TaskKind } from '@/lib/engine/types-v2';

// ---------------------------------------------------------------------------
// Critères (forme commune aux audits du module, alignée sur /api/tools/readiness)
// ---------------------------------------------------------------------------
/** `unknown` : donnée non lisible par la source choisie (ex. posts via l'API Places) — exclue du calcul. */
export type CriterionStatus = 'ok' | 'warn' | 'fail' | 'unknown';

/** Lien vers la tâche d'exécution correspondante (src/lib/execution : id = t_ + hash(businessId:key)). */
export interface TaskLink {
  key: string;
  kind: TaskKind;
  /** identifiant de tâche si businessId connu (même calcul que execution/tasks.ts) */
  id?: string;
  /** écran de l'app (vague 2b) */
  href?: string;
}

export interface Criterion {
  id: string;
  label: string;
  status: CriterionStatus;
  detail: string;
  fix: string;
  /** famille de pondération */
  group: GbpGroup;
  /** points obtenus / points possibles */
  points: number;
  max: number;
  task?: TaskLink;
}

// ---------------------------------------------------------------------------
// Audit de fiche Google
// ---------------------------------------------------------------------------
export type GbpGroup = 'categories' | 'completude' | 'avis' | 'photos' | 'activite' | 'coherence';
export type GbpSource = 'places' | 'manual' | 'demo';

/**
 * Profil normalisé d'une fiche (quelle que soit la source). Champ `undefined` = inconnu (non évalué).
 * Pour la source `places`, cet objet n'est JAMAIS stocké (règles Places, voir places.ts).
 */
export interface GbpProfile {
  source: GbpSource;
  placeId?: string;
  name?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  /** longueur de la description du propriétaire (0 = vide) */
  descriptionLength?: number;
  hasHours?: boolean;
  hoursText?: string;
  hasSpecialHours?: boolean;
  servicesCount?: number;
  attributesCount?: number;
  photosCount?: number;
  /** date ISO de la photo la plus récente (null = aucune) */
  lastPhotoAt?: string | null;
  /** date ISO du post le plus récent (null = jamais) */
  lastPostAt?: string | null;
  website?: string;
  phone?: string;
  address?: string;
  reviewCount?: number;
  rating?: number;
  /** date ISO de l'avis le plus récent (null = aucun) */
  lastReviewAt?: string | null;
  /** part des avis ayant une réponse du propriétaire (0 à 1) */
  replyRate?: number;
}

/** Saisie guidée par le client (formulaire structuré). Tous les champs sont facultatifs. */
export interface ManualGbpInput {
  name?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  description?: string;
  descriptionLength?: number;
  hasHours?: boolean;
  hoursText?: string;
  hasSpecialHours?: boolean;
  services?: string[];
  servicesCount?: number;
  attributesCount?: number;
  photosCount?: number;
  /** « il y a combien de jours » la dernière photo (plus simple à saisir qu'une date) */
  /** null = jamais */
  lastPhotoDaysAgo?: number | null;
  /** null = jamais publié */
  lastPostDaysAgo?: number | null;
  website?: string;
  phone?: string;
  address?: string;
  reviewCount?: number;
  rating?: number;
  /** null = aucun avis */
  lastReviewDaysAgo?: number | null;
  /** nombre d'avis récents ayant reçu une réponse sur les N derniers */
  repliedOfLast?: { replied: number; total: number };
  replyRate?: number;
}

export interface GbpAudit {
  id: string;
  businessId: string;
  source: GbpSource;
  placeId?: string;
  /** score sur 100, calculé sur les seuls critères évalués */
  score: number;
  /** points évalués / 100 (part de la grille que la source permet de lire) */
  coverage: number;
  groups: Record<GbpGroup, { points: number; max: number; evaluated: number }>;
  criteria: Criterion[];
  createdAt: string;
  demo?: boolean;
  /** mentions à afficher (méthode, règles Places) */
  notes: string[];
  /** Places : le contenu brut n'est pas stocké ; relire la fiche en direct pour l'afficher */
  contentStored: boolean;
}

// ---------------------------------------------------------------------------
// Carte de visibilité par zone
// ---------------------------------------------------------------------------
export interface Zone {
  id: string;
  /** « Paris 11e », « Lyon 1er », « Toulouse, Capitole », « Nantes, secteur nord » */
  label: string;
  /** quartier emblématique ajouté dans la question (« Oberkampf ») */
  hint?: string;
  /** complément de lieu injecté dans la question (« dans le 11e arrondissement de Paris ») */
  phrase: string;
  /** coordonnées schématiques 0–100 (pas de fond de carte) */
  x: number;
  y: number;
  /** la zone du commerce */
  home?: boolean;
}

export interface ZoneGrid {
  city: string;
  kind: 'arrondissements' | 'quartiers' | 'cardinal';
  zones: Zone[];
}

export interface ZoneQuestion {
  id: string;
  /** gabarit avec `{zone}` */
  template: string;
}

export interface ZoneResult {
  zoneId: string;
  label: string;
  x: number;
  y: number;
  home?: boolean;
  /** taux de mention 0–1 (réponses valides) ; null si aucune réponse exploitable */
  mentionRate: number | null;
  /** rang moyen quand cité */
  avgRank: number | null;
  answers: number;
  dominantCompetitor: { name: string; mentions: number } | null;
  /** palier de couleur pour la carte */
  band: 'fort' | 'moyen' | 'faible' | 'absent' | 'na';
}

export interface MapBudget {
  zones: number;
  questions: number;
  providers: number;
  runs: number;
  calls: number;
  maxCalls: number;
  tier: string;
}

export interface VisibilityMap {
  id: string;
  businessId: string;
  city: string;
  trade: string;
  kind: ZoneGrid['kind'];
  label: string;
  disclaimer: string;
  providers: ProviderId[];
  questions: ZoneQuestion[];
  budget: MapBudget;
  zones: ZoneResult[];
  /** prêt pour un SVG schématique */
  svg: MapSvgModel;
  createdAt: string;
  demo: boolean;
}

export interface MapSvgModel {
  viewBox: string;
  radius: number;
  points: { id: string; cx: number; cy: number; r: number; fill: string; stroke: string; label: string; value: string; home?: boolean }[];
  legend: { band: ZoneResult['band']; label: string; fill: string }[];
}

// ---------------------------------------------------------------------------
// Audit NAP sur annuaires
// ---------------------------------------------------------------------------
export interface Directory {
  id: string;
  name: string;
  domain: string;
  /** 1 = indispensable, 2 = recommandé, 3 = utile */
  priority: 1 | 2 | 3;
  note: string;
  task: TaskLink;
}

export type NapStatus = 'verified' | 'declared' | 'absent' | 'unknown';

export interface NapEntryInput {
  directoryId: string;
  /** déclaration du client */
  present?: boolean | null;
  url?: string;
  /** coordonnées affichées sur l'annuaire, recopiées par le client (facultatif) */
  listed?: { name?: string; address?: string; phone?: string };
}

export interface NapIssue {
  directoryId: string;
  field: 'name' | 'address' | 'phone' | 'url';
  expected: string;
  found: string;
  severity: 'haute' | 'moyenne' | 'basse';
  message: string;
}

export interface NapRow {
  directory: Directory;
  status: NapStatus;
  url?: string;
  checkedAt?: string;
  /** résultat de la vérification légère */
  check?: { fetched: boolean; name: boolean | null; address: boolean | null; phone: boolean | null; note: string };
  issues: NapIssue[];
}

export interface NapAudit {
  id: string;
  businessId: string;
  reference: { name: string; address?: string; phone?: string; website?: string };
  rows: NapRow[];
  issues: NapIssue[];
  score: number;
  counts: Record<NapStatus, number>;
  createdAt: string;
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Calendrier de posts
// ---------------------------------------------------------------------------
export type PostType = 'actualite' | 'offre' | 'conseil' | 'evenement' | 'coulisses';
export type PostStatus = 'planned' | 'published' | 'skipped';

export interface LocalPost {
  id: string;
  businessId: string;
  /** date ISO (jour) de publication prévue */
  date: string;
  type: PostType;
  title: string;
  /** texte prêt à coller (1 500 caractères maximum) */
  text: string;
  /** bouton d'action suggéré dans Google */
  cta: 'Appeler' | 'En savoir plus' | 'Réserver' | 'Commander' | 'Aucun';
  /** idée de visuel (photo à prendre) */
  photoIdea: string;
  status: PostStatus;
  /** rappel : date ISO */
  remindAt: string;
  reminded?: boolean;
  llm?: boolean;
  publishedAt?: string;
}

export interface Reminder {
  id: string;
  businessId: string;
  postId: string;
  dueAt: string;
  channel: 'email' | 'in_app';
  status: 'pending' | 'sent' | 'logged';
  sentAt?: string;
}

// ---------------------------------------------------------------------------
// Thèmes des avis
// ---------------------------------------------------------------------------
export interface ReviewText {
  rating?: number;
  text: string;
  author?: string;
  /** date ISO (facultative) */
  date?: string;
}

export interface ReviewTheme {
  id: string;
  label: string;
  positive: number;
  negative: number;
  /** extraits courts (jamais d'auteur) */
  examples: { polarity: 'positive' | 'negative'; quote: string }[];
}

export interface ReviewThemesReport {
  businessId: string;
  source: 'pasted' | 'places' | 'demo';
  analyzed: number;
  averageRating: number | null;
  tones: { positif: number; mitige: number; negatif: number };
  themes: ReviewTheme[];
  strengths: string[];
  weaknesses: string[];
  replies?: { index: number; tone: string; draft: string }[];
  llm: boolean;
  createdAt: string;
  notes: string[];
}
