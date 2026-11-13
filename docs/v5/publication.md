# V5 — Publication : ce que l'agent peut modifier, plateforme par plateforme

Recherche du 13 nov. 2026 (agent PUBLICATION). Sources officielles citées ; quand une page n'a pas pu être lue
(filtrage réseau) ou ne précise pas un point, c'est écrit « à confirmer » et le code le traite prudemment
(lecture avant écriture, relecture après, sinon repli sur l'export manuel).

Règles transverses (brief V5) : rien n'est appliqué sans validation explicite (rôle ≥ admin) ; chaque changement garde
sa valeur « avant » exacte ; tout est journalisé (journal chaîné, immuable) ; retour arrière par changement ; secrets
chiffrés (AES-256-GCM, `INTEGRATIONS_SECRET`) ; appels sortants vers des hôtes saisis par le client (WordPress,
PrestaShop) épinglés sur une IP publique validée (anti-SSRF), https uniquement, sans suivre les redirections.

## Synthèse

| Plateforme | Connexion | Méta titre / description | Alt d'images | JSON-LD / FAQ | Redirections | robots.txt / llms.txt | Réécriture de passage | Permissions minimales |
|---|---|---|---|---|---|---|---|---|
| WordPress | URL + identifiant + mot de passe d'application (Basic, https) | Oui via Rank Math (`rankmath/v1/updateMeta`) ou méta exposée (`_yoast_wpseo_title`/`_yoast_wpseo_metadesc` si exposées par l'extension d'aide) ; sinon export | Oui (`/wp/v2/media/<id>` champ `alt_text`) | Ajout d'un bloc en fin de contenu (`content.raw`) | Non natif (extension Redirection : à confirmer) → export | Non (fichiers serveur) → export | Oui (`content.raw`, remplacement exact du passage) | Utilisateur « Éditeur » (edit_posts, edit_pages, upload_files) |
| Shopify | OAuth (app Repéré), jeton hors ligne expirant | Oui : `productUpdate(product:{seo})` ; pages/articles : métachamps `global.title_tag` / `global.description_tag` via `metafieldsSet` | Oui (`fileUpdate`, alt du média ; à confirmer) | Métachamp + snippet de thème → export (thème) | Oui : `urlRedirectCreate` / `urlRedirectDelete` | `templates/robots.txt.liquid`, `templates/llms.txt.liquid` via `themeFilesUpsert` (exemption Shopify requise) → sinon export | Oui (`descriptionHtml` produit, `body` page) | `write_products`, `write_content`, `write_online_store_navigation` (+ `write_themes` avec exemption) |
| Webflow | Jeton de site (Bearer) | Oui : `PUT /v2/pages/{id}` `seo{title,description}` puis publication | Non par la Data API (à confirmer) → export | Code personnalisé (Custom Code API, à confirmer) → export | Non (réglages du site) → export | Non → export | Éléments CMS : `PATCH /v2/collections/{c}/items/{i}/live` | `pages:read`, `pages:write`, `sites:write` (publication), `CMS:write` |
| PrestaShop | URL + clé webservice (Basic, clé en identifiant, mot de passe vide) | Oui : `products`/`categories`/`content_management_system` champs multilingues `meta_title`, `meta_description` (PATCH ≥ 8, sinon PUT XML complet) | Non (images sans alt par le webservice ; legend d'image : à confirmer) → export | Non → export | Non (Paramètres > SEO & URL) → export | Non → export | `description` produit (multilingue) | Clé limitée aux ressources `products`, `categories`, `content_management_system` en GET + PUT/PATCH |
| Wix | App Wix (OAuth) | Oui : Item SEO Tags API (pages statiques, produits, articles) | Non → export | Balises personnalisées via SEO Tags (à confirmer) | Non → export | Non → export | Non | Permission « Manage SEO » (à confirmer) — **non implémenté en V5** (app Wix à créer), export à la place |
| Google Business Profile | OAuth Google `business.manage` | — | — | — | — | — | Description de fiche, horaires (`locations.patch`) ; publications (`localPosts`) | **Accès API sur dossier (14 jours)** : connecteur derrière `PUBLISH_GBP_ENABLED=1` |
| Bing Places | — | — | — | — | — | — | Pas d'API publique (programme partenaires > 10 000 fiches) ; import/synchro depuis la fiche Google → instructions | — |
| Export (tout site) | aucune | Fichier + instructions | idem | Bloc `<script type="application/ld+json">` prêt à coller | Fichier `.htaccess` / `_redirects` / CSV | `robots.txt`, `llms.txt` prêts à déposer | Avant/après en texte | — |

## WordPress
- Authentification : mots de passe d'application (WordPress ≥ 5.6), Basic Auth RFC 7617, uniquement en https.
  « As of 5.6, WordPress has shipped with Application Passwords » — https://developer.wordpress.org/rest-api/authentication/
  ; guide d'intégration : https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/
- Test de connexion : `GET /wp-json/` (namespaces : `yoast/v1`, `rankmath/v1` détectent l'extension SEO) puis
  `GET /wp-json/wp/v2/users/me?context=edit` (capacités de l'utilisateur).
- Pages et articles : `GET|POST /wp-json/wp/v2/{posts|pages}/<id>?context=edit` (`title.raw`, `content.raw`, `meta`) —
  https://developer.wordpress.org/rest-api/reference/pages/ . Médias : `POST /wp-json/wp/v2/media/<id>` `alt_text`.
- Yoast : l'API REST est **en lecture seule** (`yoast_head`, `yoast_head_json`, `GET /wp-json/yoast/v1/get_head?url=`) —
  https://developer.yoast.com/customization/apis/rest-api/ . L'écriture passe par les métas `_yoast_wpseo_title` et
  `_yoast_wpseo_metadesc`, protégées (préfixe `_`) et non exposées par défaut : il faut une petite extension (ex.
  https://wordpress.org/plugins/seo-fields-api-support/ , qui « Exposes `_yoast_wpseo_title` and `_yoast_wpseo_metadesc`
  fields in the REST API ») ou le snippet fourni par Repéré (`register_post_meta(..., ['show_in_rest' => true,
  'auth_callback' => fn() => current_user_can('edit_posts')])`). Le connecteur vérifie leur présence dans `meta` avant
  d'écrire ; sinon : export avec instructions.
- Rank Math : point d'entrée `POST /wp-json/rankmath/v1/updateMeta` `{ objectType: 'post', objectID, meta: {
  rank_math_title, rank_math_description } }` (mentionné par le support Rank Math :
  https://support.rankmath.com/ticket/can-i-use-wp-json-rankmath-v1-updatemeta-to-change-focus-keyword-in-rankmath/ ;
  forme exacte à confirmer — le connecteur relit toujours après écriture et signale l'échec).
- Relecture : `yoast_head_json` (titre, description rendus) + lecture réelle de la page publique.

## Shopify (Admin GraphQL, version `SHOPIFY_API_VERSION`, défaut 2026-10)
- Réutilise l'OAuth de src/lib/ecommerce/shopify.ts (jeton chiffré, rafraîchi). La connexion existante a
  `read_products,read_orders` : pour publier, le client doit **ré-autoriser** avec les portées d'écriture (voir « À faire »).
- Produits : `productUpdate(product: ProductUpdateInput)` (`input` est déprécié), champ `seo { title description }`,
  portée `write_products` — https://shopify.dev/docs/api/admin-graphql/latest/mutations/productUpdate
- Pages, articles, collections : méta titre/description stockés dans les métachamps `global.title_tag` /
  `global.description_tag` (`single_line_text_field`) — https://shopify.dev/docs/apps/marketing/seo ; écriture par
  `metafieldsSet` (25 max par appel, atomique, `compareDigest` pour l'écriture conditionnelle depuis 2024-07 ; même
  portée que la ressource propriétaire) — https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet
- Masquer une page : métachamp `seo.hidden = 1` (`number_integer`) → noindex (même source).
- Redirections : `urlRedirectCreate(urlRedirect: { path, target })`, portée `write_online_store_navigation` —
  https://shopify.dev/docs/api/admin-graphql/latest/mutations/urlRedirectCreate ; retour arrière : `urlRedirectDelete(id)`.
- Thème : `themeFilesUpsert(themeId, files)` — « needs write_themes and an exemption from Shopify to modify theme files »
  — https://shopify.dev/docs/api/admin-graphql/latest/mutations/themeFilesUpsert . `templates/robots.txt.liquid` remplace
  le robots.txt généré ; Shopify recommande d'étendre l'objet `robots` plutôt que de tout remplacer —
  https://shopify.dev/docs/storefronts/themes/seo/robots-txt . `templates/llms.txt.liquid` (contexte Liquid restreint :
  `request`, `agents`), sinon `/llms.txt` reflète `/agents.md` géré par Shopify —
  https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid . **Tant que l'exemption n'est pas
  obtenue, robots/llms passent par l'export** (le connecteur n'appelle pas `themeFilesUpsert` sans
  `SHOPIFY_THEME_WRITE=1`).

## Webflow (Data API v2, `https://api.webflow.com/v2`, Bearer)
- Pages : `PUT /v2/pages/{page_id}` corps `{ title, slug, seo: { title, description }, openGraph }`, portée
  `pages:write` — https://developers.webflow.com/data/reference/pages-and-components/pages/update-page-settings
- Publication : `POST /v2/sites/{site_id}/publish` `{ customDomains?, publishToWebflowSubdomain?, pageId? }`, portée
  `sites:write`, « one successful publish queue per minute » — https://developers.webflow.com/data/reference/sites/publish
  → le connecteur publie une seule fois par ChangeSet, après tous les changements.
- CMS : `PATCH /v2/collections/{collection_id}/items/{item_id}/live` `{ fieldData }`, portée `CMS:write` —
  https://developers.webflow.com/data/reference/cms/collection-items/live-items/update-item-live

## PrestaShop (webservice, `/api/`)
- Clé webservice en identifiant Basic, mot de passe vide ; JSON en sortie (`output_format=JSON`) mais **entrées en XML** ;
  mise à jour : PUT du XML complet, ou PATCH avec l'`id` et les seuls champs modifiés —
  https://devdocs.prestashop-project.org/9/webservice/getting-started/
- Champs multilingues : `<meta_title><language id="1">…</language></meta_title>` —
  https://devdocs.prestashop-project.org/9/webservice/tutorials/advanced-use/multilang-fields/
- Ressources : `products` (https://devdocs.prestashop-project.org/9/webservice/resources/products/), `categories`,
  `content_management_system`. Le connecteur fait PATCH (≥ 8) et, sur 405, PUT du XML complet relu juste avant.

## Wix
- Item SEO Tags API : « Set an item's title, description, and other meta tags » ; pages statiques en brouillon sauf
  `publish: true` ; écriture dans la langue principale uniquement —
  https://dev.wix.com/docs/api-reference/business-management/seo/item-seo-tags-v1/introduction . Nécessite une app Wix
  publiée : **hors V5**, export à la place.

## Google Business Profile
- Accès aux API sur demande (examen sous 14 jours, motif professionnel légitime) —
  https://developers.google.com/my-business/content/faq ; quota standard une fois accepté.
- Fiche : `PATCH https://mybusinessbusinessinformation.googleapis.com/v1/locations/{id}?updateMask=…`, `validateOnly`
  possible, portée `https://www.googleapis.com/auth/business.manage` —
  https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations/patch
  (masques utilisés : `profile.description`, `regularHours`).
- Publications : `accounts.locations.localPosts` (API v4 « get, create, or update local posts »).
- Connecteur écrit et testé sur faux serveur, **désactivé tant que `PUBLISH_GBP_ENABLED` ≠ 1**.

## Bing Places
- Pas d'API publique : réservée aux partenaires gérant plus de 10 000 fiches ; import et synchronisation automatique
  depuis la fiche Google — https://whitespark.ca/guides/the-ultimate-guide-to-your-bing-places-listing/ → instructions.

## Vocabulaire `autoFix.kind` accepté (pour SEO-AUDIT et GEO-OPT)
`meta.title`, `meta.description`, `image.alt`, `jsonld`, `faq`, `redirect`, `canonical`, `robots.txt`, `llms.txt`,
`rewrite`, `gbp.description`, `gbp.hours`, `sitemap.xml`, `meta.robots` (+ alias `img.alt`, `robots`, `sitemap`, `link.update`).
Formats réels de SEO-AUDIT (`{ items: [...] }`) et GEO-OPT : src/lib/publish/autofix.ts et docs/v5/demandes-PUBLICATION.md.
Sans `value`, le planificateur rédige ; sans `url`, il prend `affected[]`. « [à compléter] » bloque la validation.
