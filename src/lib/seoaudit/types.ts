/**
 * Types de l'audit SEO V5 (SEO-AUDIT). `Finding` / `ScoredSection` viennent du contrat central (src/lib/crawl/types.ts).
 * `PerfData` : forme MINIMALE attendue de SEO-DATA (PageSpeed Insights / CrUX). Voir docs/v5/demandes-SEO-DATA.md.
 */
import type { CrawledPage, Finding, ScoredSection, Severity, SiteCrawl } from '@/lib/crawl/types';

export type { CrawledPage, Finding, ScoredSection, Severity, SiteCrawl };

export type SiteType = 'local' | 'pme' | 'ecommerce';

/** Mesures au 75e centile (terrain, CrUX) ou de laboratoire (Lighthouse). Toutes optionnelles. */
export interface PerfMetrics {
  lcpMs?: number;
  inpMs?: number; // terrain uniquement (INP n'existe pas en laboratoire)
  cls?: number;
  ttfbMs?: number;
  fcpMs?: number;
  tbtMs?: number; // laboratoire uniquement (approximation de la réactivité)
}

/** Données de performance fournies par SEO-DATA. Absentes → la section mobile/performance se limite au crawl. */
export interface PerfData {
  source: 'crux' | 'pagespeed' | 'mixed';
  fetchedAt: string;
  /** Données de démonstration (comptes démo) : signalé dans chaque constat. */
  demo?: boolean;
  /** Données terrain CrUX à l'échelle de l'origine (p75). `undefined` = pas assez de trafic pour CrUX. */
  origin?: { mobile?: PerfMetrics; desktop?: PerfMetrics };
  /** Mesures par page (PageSpeed Insights). */
  pages?: {
    url: string;
    strategy: 'mobile' | 'desktop';
    field?: PerfMetrics;
    lab?: PerfMetrics & { performanceScore?: number /* 0–100 */ };
  }[];
}

export interface SeoAuditOptions {
  siteType?: SiteType;
  /** Forme minimale ci-dessus, ou directement la (les) mesure(s) `PerfData` de SEO-DATA (src/lib/seodata/types.ts). */
  perf?: PerfData | import('@/lib/seodata/types').PerfData | import('@/lib/seodata/types').PerfData[];
}

export type SectionId =
  | 'indexation'
  | 'technique'
  | 'contenu'
  | 'doublons'
  | 'maillage'
  | 'liens'
  | 'international'
  | 'images'
  | 'donnees'
  | 'performance'
  | 'ecommerce'
  | 'local';

export interface SeoStats {
  pagesCrawled: number;
  htmlPages: number;
  indexablePages: number;
  sitemapUrls: number;
  internalLinks: number;
  checksRun: number;
  checksApplicable: number;
  findings: Record<Severity, number>;
  truncated: boolean;
  siteType: SiteType;
  siteTypeDetected: boolean;
  perfData: boolean;
  /** Pages dont le HTML était disponible (les contrôles qui relisent le HTML sont ignorés sinon, ex. crawl « public »). */
  pagesWithHtml: number;
}

export interface SeoReport {
  score: number; // 0–100, arrondi à 5 (pas de fausse précision)
  grade: 'bon' | 'moyen' | 'faible';
  sections: (ScoredSection & { weight: number; applicable: boolean })[];
  topFixes: Finding[];
  stats: SeoStats;
  /** Méthode de calcul en une phrase (affichable). */
  method: string;
}

/** Contexte précalculé partagé par tous les contrôles. */
export interface AuditCtx {
  crawl: SiteCrawl;
  siteType: SiteType;
  perf?: PerfData;
  origin: string; // origine finale (https://www.exemple.fr)
  host: string;
  https: boolean;
  pages: CrawledPage[]; // toutes les pages récupérées
  html: CrawledPage[]; // statut 200, HTML, non bloquées
  indexable: CrawledPage[];
  home?: CrawledPage;
  byUrl: Map<string, CrawledPage>; // clés : url et finalUrl normalisées
  inlinks: Map<string, { from: string; anchor: string; rel: string[] }[]>; // liens internes reçus (cible normalisée)
  internalLinks: SiteCrawl['links'];
  sitemapSet: Set<string>;
  siteName: string;
  text(p: CrawledPage): string; // texte visible (mis en cache)
  nodes(p: CrawledPage): Record<string, unknown>[]; // nœuds JSON-LD typés (imbriqués compris)
  isProduct(p: CrawledPage): boolean;
  /** État HTTP des liens externes et images vérifiés par CRAWL (option checkLinks), par URL normalisée. */
  linkChecks: Map<string, NonNullable<SiteCrawl['linkChecks']>[number]>;
  /** Poids d'une image : attribut du crawl, sinon vérification HEAD. */
  imageBytes(src: string, own?: number): number | undefined;
}

/** Résultat brut d'un contrôle, transformé en `Finding` par le moteur. */
export interface Hit {
  items: { url: string; detail?: string }[];
  evidence?: string;
  autoFix?: { kind: string; payload: unknown };
  /** Remplace le titre par défaut (rare). */
  title?: string;
  severity?: Severity;
  /** Base de calcul du score (nombre de pages concernées possibles). Défaut : selon `scope`. */
  base?: number;
}

export interface CheckDef {
  id: string;
  section: SectionId;
  category: string;
  severity: Severity;
  impact: 1 | 2 | 3;
  effort: 1 | 2 | 3;
  /** 'site' : constat global (une seule occurrence) ; 'page' : proportion de pages concernées. */
  scope: 'site' | 'page';
  /** Types de sites concernés (défaut : tous). */
  types?: SiteType[];
  /** Libellé court pour la documentation. */
  label: string;
  title: (n: number) => string;
  why: string;
  fix: string;
  source: string;
  run: (ctx: AuditCtx) => Hit | null;
}
