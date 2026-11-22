/**
 * V8 (AGENT-CONTENU) — création de pages et d'articles chez le client.
 *
 * Différent des ChangeSets (qui modifient une valeur existante, avant/après exacts) : ici on CRÉE une ressource. Le
 * cycle est donc : créer en brouillon chez la plateforme (quand elle le permet) → mettre en ligne → (retirer de la
 * ligne → mettre à la corbeille). Rien n'est appelé sans validation humaine : c'est src/lib/content/service.ts qui
 * vérifie la validation, le quota et l'absence de « [à compléter] » avant d'appeler un connecteur.
 */
import type { ConnectorContext, Platform } from '../types';

export type PageFormat = 'page' | 'article';

/** Bloc de contenu structuré (rendu HTML pour la plupart des plateformes, Ricos pour Wix). */
export type PageBlock =
  | { type: 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export interface PageDraftInput {
  format: PageFormat;
  title: string;
  /** adresse courte (sans barre oblique) */
  slug: string;
  metaTitle: string;
  metaDescription: string;
  /** corps HTML (sans H1 : le titre est porté par la plateforme) */
  html: string;
  /** même contenu en blocs (Wix) */
  blocks: PageBlock[];
  /** blocs JSON-LD sérialisés (insérés seulement là où la plateforme les conserve) */
  jsonLd: string[];
  excerpt?: string;
  /** nom affiché de l'auteur (articles) : l'entreprise, jamais une personne inventée */
  author?: string;
}

export type RemoteStatus = 'draft' | 'published' | 'trashed';

export interface RemotePage {
  platform: Platform;
  format: PageFormat;
  id: string;
  status: RemoteStatus;
  /** adresse publique (connue ou prévue) */
  url?: string;
  /** lien d'édition dans l'outil du client, si connu */
  editUrl?: string;
  /** informations de routage (collection Webflow, blog Shopify…) */
  extra?: Record<string, string>;
  /** contenu relu chez la plateforme (pour la vérification), tronqué */
  html?: string;
  title?: string;
}

/** Réglages non secrets propres au contenu (saisis dans /app/contenu). */
export interface PageOptions {
  /** Webflow : collection CMS des articles */
  webflowCollectionId?: string;
  /** Wix : membre auteur des articles (sinon le premier membre du site ; jamais créé automatiquement) */
  wixMemberId?: string;
  /** Shopify : blog cible (sinon le premier blog de la boutique) */
  shopifyBlogId?: string;
  /** PrestaShop : catégorie CMS (défaut 1) */
  prestashopCategoryId?: string;
  /** WordPress : l'utilisateur peut publier du HTML non filtré (bloc JSON-LD conservé) */
  allowScript?: boolean;
}

export interface PageSupport {
  page: boolean;
  article: boolean;
  /** la plateforme garde un brouillon invisible du public avant la mise en ligne */
  draft: boolean;
  /** retrait de la ligne possible (retour au brouillon) */
  unpublish: boolean;
  /** limites connues, en clair */
  notes: string[];
}

export interface PageConnector {
  platform: Platform;
  support: PageSupport;
  /** collision d'adresse : une ressource porte déjà ce slug ? */
  findBySlug(ctx: ConnectorContext, format: PageFormat, slug: string, opts: PageOptions): Promise<RemotePage | null>;
  /** crée la ressource en brouillon (ou hors ligne) chez la plateforme */
  createDraft(ctx: ConnectorContext, input: PageDraftInput, opts: PageOptions): Promise<RemotePage>;
  /** relit la ressource (null = n'existe plus) */
  read(ctx: ConnectorContext, ref: RemotePage, opts: PageOptions): Promise<RemotePage | null>;
  publish(ctx: ConnectorContext, ref: RemotePage, opts: PageOptions): Promise<RemotePage>;
  /** retour au brouillon / hors ligne */
  unpublish(ctx: ConnectorContext, ref: RemotePage, opts: PageOptions): Promise<RemotePage>;
  /** corbeille (ou suppression quand la plateforme n'a pas de corbeille) */
  remove(ctx: ConnectorContext, ref: RemotePage, opts: PageOptions): Promise<void>;
}
