/**
 * Création de pages et d'articles chez le client (V8, AGENT-CONTENU). Plateformes sans connecteur ici (Magento,
 * fiche Google, export) : export HTML / Markdown (`buildPageExport`). Magento appartient à l'agent ECOM.
 */
import type { Platform } from '../types';
import { prestashopPages } from './prestashop';
import { shopifyPages } from './shopify';
import type { PageConnector, PageFormat } from './types';
import { webflowPages } from './webflow';
import { wixPages } from './wix';
import { wordpressPages } from './wordpress';

export * from './types';
export { blocksToHtml, blocksToRicos, escapeHtml, htmlToText, jsonLdHtml, plainInline } from './render';
export { buildPageExport, blocksToMarkdown, standaloneHtml } from './export';

export const PAGE_CONNECTORS: Partial<Record<Platform, PageConnector>> = {
  wordpress: wordpressPages,
  shopify: shopifyPages,
  webflow: webflowPages,
  wix: wixPages,
  prestashop: prestashopPages,
};

export function pageConnectorFor(platform: Platform | string): PageConnector | null {
  return (PAGE_CONNECTORS as Record<string, PageConnector | undefined>)[platform] ?? null;
}

/** La plateforme sait-elle créer ce format ? (sinon : export) */
export function canCreate(platform: Platform | string, format: PageFormat): boolean {
  const c = pageConnectorFor(platform);
  return !!c && (format === 'page' ? c.support.page : c.support.article);
}

export { prestashopPages, shopifyPages, webflowPages, wixPages, wordpressPages };
