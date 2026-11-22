# V8 — Connecteur Magento / Adobe Commerce et produits WooCommerce (agent ECOM, 22 nov. 2026)

Code : src/lib/publish/connectors/magento.ts (tests : __tests__/magento.test.ts + magentofake.ts),
src/lib/publish/connectors/woocommerce.ts (tests : __tests__/woocommerce.test.ts).

## Magento Open Source / Adobe Commerce (PaaS, sur site)
- **Connexion** : intégration créée par le marchand, Système > Extensions > Intégrations, accès aux ressources
  « Personnalisé », puis Activer > Autoriser : quatre jetons affichés —
  https://experienceleague.adobe.com/docs/commerce-admin/systems/integrations/integrations.html
- **Signature OAuth 1.0a** (mode par défaut) : HMAC-SHA256, en-tête `Authorization: OAuth oauth_consumer_key, oauth_nonce,
  oauth_signature_method, oauth_signature, oauth_timestamp, oauth_token`, clé = secret client & secret du jeton —
  https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-oauth/
  (chaîne de base RFC 5849 : paramètres de requête inclus et triés).
- **Jeton seul (Bearer)** en option : « Integration tokens can no longer be used for API Bearer token authentication »
  depuis 2.4.4 (notes de version https://experienceleague.adobe.com/en/docs/commerce-operations/release/notes/adobe-commerce/2-4-4) ;
  réactivable par « Allow OAuth Access Tokens to be used as standalone Bearer tokens » ou
  `bin/magento config:set oauth/consumer/enable_integration_as_bearer 1` (déconseillé par Adobe) —
  https://developer.adobe.com/commerce/webapi/get-started/authentication/gs-authentication-token
- **SaaS (Adobe Commerce as a Cloud Service)** : IMS / OAuth 2, « traditional admin and integration token generation
  methods is not supported » — https://developer.adobe.com/commerce/webapi/rest/authentication → non couvert (export).
- **Routes** (relues dans app/code/Magento/{Catalog,Cms}/etc/webapi.xml, branche 2.4-develop du 19 nov. 2026) :
  `GET|PUT /V1/products/:sku` (Magento_Catalog::products), `GET /V1/categories/list`, `GET|PUT /V1/categories/:id`
  (Magento_Catalog::categories), `GET /V1/cmsPage/search`, `GET|PUT /V1/cmsPage/:id` (Magento_Cms::page / ::save),
  `GET|PUT /V1/products/:sku/media/:entryId` (lecture Magento_Catalog::attributes_attributes, écriture Magento_Catalog::catalog).
- **Champs** : `meta_title`, `meta_description`, `description` (custom_attributes) ; CMS : `meta_title`,
  `meta_description`, `content` (page relue et renvoyée entière) ; images : `label` = « gallery entry alternative text »
  (ProductAttributeMediaGalleryEntryInterface), entrée complète renvoyée, `null` = « Reverts to the global alt text » —
  https://developer.adobe.com/commerce/webapi/rest/tutorials/image/product-image-store-scope
- **Portée** : `/rest/<code de vue>/V1/…` (défaut `default`). Écrire crée une valeur propre à la vue ; le retour arrière
  remet la valeur exacte lue avant.
- **Mots-clés méta** : ni proposés ni modifiés (Google ne les utilise pas pour le classement) ; jamais écrasés.
- **Guidé** (`MAGENTO_STEPS`) : redirections 301 — le module UrlRewrite du cœur n'a pas de etc/webapi.xml, donc aucune
  route REST (vérifié dans le code source) ; robots.txt (Contenu > Design > Configuration) ; llms.txt (fichier dans pub/) ;
  JSON-LD, FAQ, canonique, meta robots, plan du site.
- Branchement de l'export guidé : demande à AGENT-CONTENU (docs/v8/demandes-AGENT-CONTENU.md §2).

## WooCommerce (produits) via le connecteur WordPress
- API v3 : `GET /wp-json/wc/v3/products?slug=`, `GET|PUT /wp-json/wc/v3/products/<id>`, `meta_data` (`key`, `value`,
  `id` en lecture seule), `description` — https://developer.woocommerce.com/docs/apis/rest-api/v3/products/
- Même mot de passe d'application que WordPress ; l'acceptation par l'API WooCommerce est vérifiée au test de connexion
  (la documentation WooCommerce ne décrit que ses propres clés API : https://developer.woocommerce.com/docs/apis/rest-api/authentication/).
- Méta Yoast / Rank Math des produits écrites dans `meta_data` (mêmes clés que les pages) ; alt des images par la
  médiathèque WordPress (déjà couvert).
