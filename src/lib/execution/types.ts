/**
 * Types locaux du module EXÉCUTION (les types partagés restent dans engine/types-v2.ts).
 */
import type { AuditInput, AuditResult } from '@/lib/engine/types';
import type {
  AuditInputV2,
  AuditResultV2Ext,
  BrandFactField,
  BrandFacts,
  ExecTask,
  Segment,
} from '@/lib/engine/types-v2';
import type { Business } from '@/lib/db';

/** Résultat d'audit V2 tel que le module l'attend (extension facultative). */
export type AuditV2 = Omit<AuditResult, 'input'> & AuditResultV2Ext & { input: AuditInput & AuditInputV2 };

/** Faits de la fiche de vérité, à plat. */
export type FactsMap = Partial<Record<BrandFactField, string>>;

/** Réglages d'exécution propres à un commerce (collection `exec.settings`). */
export interface ExecSettings {
  businessId: string;
  /** slug de la page hébergée /p/[slug] */
  slug: string;
  segment?: Segment;
  /** Google Place ID (lien d'avis direct) */
  placeId?: string;
  /** lien d'avis déjà connu (g.page/r/…/review) */
  reviewUrl?: string;
  /** couleur de marque (#RRGGBB) pour la page hébergée */
  brandColor?: string;
  logoUrl?: string;
  /** sous-type schema.org forcé (Plumber, Restaurant…) */
  schemaType?: string;
  /** profils officiels (sameAs) */
  sameAs?: string[];
  /** page hébergée publiée (défaut : true) */
  published?: boolean;
  /** produits phares (e-commerce) pour Product/Offer */
  products?: ExecProduct[];
  updatedAt?: string;
}

export interface ExecProduct {
  name: string;
  description?: string;
  url?: string;
  image?: string;
  sku?: string;
  gtin?: string;
  brand?: string;
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  category?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Commerce enrichi pour l'exécution. */
export interface ExecBusiness extends Business {
  segment: Segment;
  category?: string;
  offering?: string;
  productCategories?: string[];
  market?: string;
}

export interface GenerateOptions {
  businessId?: string;
  segment?: Segment;
  settings?: Partial<ExecSettings>;
  /** date de création (tests) */
  now?: Date;
  /** nombre maximal de tâches (défaut 16) */
  max?: number;
  /** e-commerce : produits du catalogue suivi (une fiche par produit, pas par catégorie) */
  catalog?: import('./content').SheetProduct[];
}

/** Tâche telle que stockée (champs de rotation en plus). */
export interface StoredTask extends ExecTask {
  /** nombre de reports d'une semaine sur l'autre (au plus 1) */
  carried?: number;
  /** semaine à partir de laquelle la tâche peut revenir après remplacement */
  snoozedUntil?: string;
  /** clé de déduplication (type + cible) */
  key?: string;
  /** tâche liée à un événement de la semaine (erreur, concurrent, nouvelle source) */
  event?: boolean;
  /** livrable rédigé par LLM (sinon gabarit) */
  llm?: boolean;
}

export interface ReviewInput {
  rating: number; // 1–5
  text: string;
  author?: string;
}

export interface ReviewKit {
  reviewUrl: string | null;
  instructions: string[];
  qrSvg: string | null;
  qrServiceUrl: string | null;
  email: { subject: string; body: string };
  sms: string;
  poster: string;
  rules: string[];
}

export type { BrandFacts };
