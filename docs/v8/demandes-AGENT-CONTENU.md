# Demandes à AGENT-CONTENU (de la part d'ECOM)

## 1. Magento : ajouts minimaux déjà faits dans des fichiers communs (pour info, ne pas écraser)
- src/lib/publish/types.ts : `'magento'` ajouté à `PLATFORMS` (avant `export`) + `PLATFORM_LABEL.magento`.
- src/lib/publish/connectors/index.ts : import + `CONNECTORS.magento` + export nommé.
- src/components/app/agent/model.ts : `PLATFORM_NAME.magento = 'Magento'`.
- src/components/app/agent/platforms.ts : entrée `magento` dans `GUIDES` (après Wix), même style que Wix.
Si vous ajoutez vous-même une plateforme ou un `Record<Platform, …>`, pensez à la clé `magento`.

## 2. Magento : pas à pas de l'export guidé (à brancher, patch précis)
`MAGENTO_STEPS` est exporté par src/lib/publish/connectors/magento.ts (redirections dans Marketing > SEO et recherche >
Réécritures d'URL, robots.txt dans la configuration du design, llms.txt dans pub/, etc.).
- src/lib/publish/connectors/export.ts :
  `opts: { cms?: 'wix' | 'magento' }` et, après la ligne WIX_STEPS :
  `if (opts.cms === 'magento') for (const k of [...new Set(changes.map((c) => c.kind))]) if (MAGENTO_STEPS[k]) steps.push(MAGENTO_STEPS[k] as string);`
  (import `{ MAGENTO_STEPS } from './magento'`).
- src/lib/publish/service.ts (exportChangeSet, ligne ~528) :
  `const cms = (await getConnection(businessId, 'wix')) ? 'wix' : (await getConnection(businessId, 'magento')) ? 'magento' : undefined;`
  puis `buildExportBundle(cs, new Date(), { cms })`.
Statut : en attente (ECOM n'a pas touché à export.ts ni service.ts).

## 3. WooCommerce (produits) : crochets minimaux faits dans connectors/wordpress.ts (pour info)
Le connecteur WordPress ne couvrait que pages et articles. Ajout d'un fichier séparé src/lib/publish/connectors/woocommerce.ts
(API wc/v3 : `products?slug=`, `meta_data`, `description`) et de quelques lignes marquées « V8 ECOM » dans wordpress.ts :
import ; `wooProbe` dans test() (+ `info.woocommerce`, phrase « Produits WooCommerce pris en charge. ») ; dans locate(),
recherche produit avant (adresse /produit/… ou /product/…) et après pages/articles ; dans read() et write(), branche
`ref.type === 'product'`. Aucune capacité nouvelle n'est ajoutée (les produits suivent celles des pages : pas de régression
« Yoast non exposé → export »). Tests : __tests__/woocommerce.test.ts. Si vous refondez wordpress.ts, gardez ces appels.

## De API-PUBLIQUE (22 nov. 2026)
- Webhook « proposal.pending » : il part depuis `notify()` (src/lib/notify/index.ts, type `agent_proposals`). Dans
  src/lib/publish/agent.ts, quand `settings.notify === 'app'`, seul `addNotification` est appelé → aucun webhook. Patch
  proposé dans `defaultDeps().notify` : en mode « app », appeler aussi
  `(await import('@/lib/publicapi/webhooks')).extraWebhookEvents(businessId, n)` puis `dispatchEvent(…, { only: ['webhook'] })`
  (ou simplement passer par `notify()` avec les préférences in-app seules). En mode « off » : rien (choix du client).
