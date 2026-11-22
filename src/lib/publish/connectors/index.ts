import type { Platform, PublishConnector } from '../types';
import { exportConnector } from './export';
import { gbpConnector } from './gbp';
import { magentoConnector } from './magento';
import { prestashopConnector } from './prestashop';
import { shopifyConnector } from './shopify';
import { webflowConnector } from './webflow';
import { wixConnector } from './wix';
import { wordpressConnector } from './wordpress';

export const CONNECTORS: Record<Platform, PublishConnector> = {
  wordpress: wordpressConnector,
  shopify: shopifyConnector,
  webflow: webflowConnector,
  prestashop: prestashopConnector,
  wix: wixConnector,
  magento: magentoConnector,
  export: exportConnector,
  gbp: gbpConnector,
};

export function connectorFor(platform: Platform): PublishConnector {
  return CONNECTORS[platform];
}

export { buildExportBundle } from './export';
export { exportConnector, gbpConnector, magentoConnector, prestashopConnector, shopifyConnector, webflowConnector, wixConnector, wordpressConnector };
