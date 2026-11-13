/**
 * Types du module ECOMMERCE (docs/v3/12-CONTRATS-V3.md, ligne ECOMMERCE ; teardown docs/v3/06 F2 à F6).
 * Persistance : src/lib/store.ts, collections préfixées `ecom.*`.
 */
import type { AiEngine, FactCheckItem } from '@/lib/engine/types-v2';

/* ------------------------------------------------------------------ */
/* Catalogue suivi                                                     */
/* ------------------------------------------------------------------ */

export type CatalogSource = 'manual' | 'url' | 'sitemap' | 'products_json' | 'shopify' | 'demo';
export type Availability = 'InStock' | 'OutOfStock' | 'PreOrder';

export interface ProductVariant {
  name: string;
  price?: number;
  sku?: string;
  gtin?: string;
}

export interface CatalogProduct {
  /** identifiant stable dans le catalogue (slug ou id Shopify abrégé) */
  id: string;
  name: string;
  url?: string;
  category?: string;
  price?: number;
  currency?: string;
  gtin?: string;
  sku?: string;
  image?: string;
  description?: string;
  /** marque si différente de la marque suivie (revendeur multimarque) */
  brand?: string;
  /** autres noms sous lesquels les IA citent le produit (« Onde », « shampoing Onde ») */
  aliases?: string[];
  variants?: ProductVariant[];
  /** note RÉELLE de la fiche (jamais inventée) ; absente si inconnue */
  rating?: { value: number; count: number; source?: string };
  availability?: Availability;
  source: CatalogSource;
  updatedAt: string;
}

export interface Catalog {
  businessId: string;
  brand: string;
  website?: string;
  products: CatalogProduct[];
  updatedAt: string;
  demo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Suivi par produit                                                   */
/* ------------------------------------------------------------------ */

/** Un élément recommandé dans une réponse (ligne de liste ou phrase). */
export interface RecommendedItem {
  rank: number;
  /** marque principale de l'élément (la première nommée), ou null */
  brand: string | null;
  /** libellé produit lu dans la réponse (« Shampoing solide Avoine »), ou null si seule la marque est citée */
  product: string | null;
  isClient: boolean;
  /** produit du catalogue reconnu (client uniquement) */
  catalogId?: string;
  /** score de correspondance floue 0..1 */
  matchScore?: number;
  /** variante reconnue (« 75 g ») */
  variant?: string;
  /** extrait de la réponse (≤ 240 car.) */
  text: string;
  start: number;
}

export interface AnswerProducts {
  queryId: string;
  query: string;
  provider: string;
  run: number;
  category: string | null;
  items: RecommendedItem[];
  clientBrandRank: number | null;
  clientProducts: { productId: string; rank: number }[];
  clientProductPresent: boolean;
}

export interface ProductStat {
  productId: string;
  name: string;
  category: string | null;
  /** réponses où le produit pouvait apparaître (réponses de sa catégorie ; toutes si sans catégorie) */
  answers: number;
  appearances: number;
  visibility: number; // appearances / answers
  firstPlace: number;
  firstPlaceRate: number; // firstPlace / answers
  avgRank: number | null;
  queries: string[];
  byProvider: Record<string, { answers: number; appearances: number }>;
  /** produits ou marques recommandés à sa place quand il est absent (réponses de sa catégorie) */
  recommendedInstead: { label: string; brand: string | null; count: number }[];
}

export interface CategoryStat {
  category: string;
  answers: number;
  clientBrandAnswers: number;
  clientProductAnswers: number;
  /** part des éléments recommandés qui sont des produits du client */
  shareOfItems: number;
  topBrands: { brand: string; count: number; share: number; isClient: boolean }[];
  topProducts: { label: string; brand: string | null; count: number; avgRank: number }[];
}

export interface QueryRow {
  queryId: string;
  query: string;
  category: string | null;
  answers: number;
  clientProductAnswers: number;
  clientBrandAnswers: number;
  bestClientRank: number | null;
  recommended: { label: string; brand: string | null; isClient: boolean; count: number; avgRank: number }[];
}

export interface ProductTrackingReport {
  businessId: string;
  auditId: string | null;
  measuredAt: string | null;
  answersAnalyzed: number;
  products: ProductStat[];
  categories: CategoryStat[];
  queries: QueryRow[];
  answers: AnswerProducts[];
  demo: boolean;
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Revendeurs / marketplaces cités à la place de la marque             */
/* ------------------------------------------------------------------ */

export type EcomSourceKind =
  | 'brand'
  | 'marketplace'
  | 'retailer'
  | 'comparison'
  | 'media'
  | 'reviews'
  | 'forum'
  | 'social'
  | 'competitor'
  | 'other';

export interface RetailerStat {
  domain: string;
  label: string;
  kind: EcomSourceKind;
  citations: number;
  answers: number;
  queries: string[];
  /** la marque est nommée dans la source (titre, extrait, URL) */
  brandPresent: boolean;
  competitorsPresent: string[];
}

export interface RetailerRecommendation {
  kind: EcomSourceKind;
  domain?: string;
  title: string;
  why: string;
  steps: string[];
  impact: 1 | 2 | 3;
}

export interface RetailerReport {
  businessId: string;
  citations: number;
  answersWithSources: number;
  /** part des citations par type */
  byKind: Partial<Record<EcomSourceKind, { citations: number; share: number }>>;
  /** où l'IA envoie l'acheteur : première destination d'achat de chaque réponse */
  destinations: Partial<Record<'brand' | 'marketplace' | 'retailer' | 'competitor', { answers: number; share: number }>>;
  /** part des citations « achat » (marque + marketplace + revendeur + concurrent) qui ne vont PAS chez la marque */
  thirdPartyShare: number;
  domains: RetailerStat[];
  byQuery: { queryId: string; query: string; destinations: { domain: string; kind: EcomSourceKind }[]; brandLinked: boolean }[];
  recommendations: RetailerRecommendation[];
  notes: string[];
  demo: boolean;
}

/* ------------------------------------------------------------------ */
/* Prix et avis cités                                                  */
/* ------------------------------------------------------------------ */

export interface PriceClaim {
  value: number;
  currency: 'EUR';
  raw: string;
  index: number;
}
export interface RatingClaim {
  value: number;
  scale: number;
  count: number | null;
  raw: string;
  index: number;
}

export interface PriceCheck {
  productId: string;
  productName: string;
  provider: string;
  queryId: string;
  kind: 'prix' | 'note';
  stated: number;
  expected: number | null;
  /** écart relatif (stated - expected) / expected */
  delta: number | null;
  verdict: 'correct' | 'faux' | 'non_verifiable';
  quote: string;
  /** nombre d'avis cité (note) */
  statedCount?: number | null;
  expectedCount?: number | null;
}

export interface CompetitorPricePoint {
  brand: string | null;
  label: string;
  provider: string;
  queryId: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
}

export interface PriceReport {
  businessId: string;
  checks: PriceCheck[];
  errors: number;
  /** éléments au format de la vérification des faits (erreur de prix) */
  factItems: FactCheckItem[];
  /** par produit : prix et note cités, face à la fiche et aux concurrents cités dans les mêmes réponses */
  products: {
    productId: string;
    name: string;
    price: number | null;
    rating: number | null;
    reviews: number | null;
    citedPrices: number[];
    citedRatings: number[];
    competitors: CompetitorPricePoint[];
    alerts: string[];
  }[];
  llm: boolean;
  demo: boolean;
}

/* ------------------------------------------------------------------ */
/* Chiffre d'affaires attribué aux IA                                  */
/* ------------------------------------------------------------------ */

export type RevenueSource = 'shopify' | 'beacon' | 'demo' | 'none';

export interface RevenueLine {
  orders: number;
  revenueEur: number;
  /** panier moyen */
  aov: number | null;
  visits: number;
  /** commandes / visites (null sans visites mesurées) */
  conversionRate: number | null;
}

export interface RevenueReport {
  businessId: string;
  source: RevenueSource;
  from: string;
  to: string;
  currency: 'EUR';
  ai: RevenueLine;
  other: RevenueLine;
  byEngine: Partial<Record<AiEngine, RevenueLine>>;
  products: { path: string; name: string; visits: number; orders: number; revenueEur: number }[];
  /** part du CA attribuée aux IA */
  aiRevenueShare: number | null;
  connected: { shopify: boolean; beacon: boolean };
  caveats: string[];
  demo: boolean;
}

/** Commande Shopify réduite au strict nécessaire (aucune donnée client). */
export interface MinimalOrder {
  id: string;
  createdAt: string;
  totalEur: number;
  currency: string;
  referrerUrl: string | null;
  landingPage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  sourceName: string | null;
}
