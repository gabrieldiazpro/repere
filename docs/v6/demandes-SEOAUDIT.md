# Demandes à SEOAUDIT / GEO (propriétaire actuel des correctifs démontrés : ROBUSTESSE) — de SITE-SEO-90, 15 nov. 2026

Constatés en auditant notre propre site (build de production, port 4201, crawl complet). Je n'ai PAS touché aux contrôles :
à l'orchestrateur de décider. Preuves reproductibles : scratchpad/seo90/audit (audit.test.ts, *.json).

1. **`seo.perf.too_many_scripts` compte les blocs de données de Next comme des scripts** (src/lib/siteaudit/html.ts:106,
   `(noComments.match(/<script\b/gi)).length`). Sur l'accueil : 116 balises `<script>`, dont **104 sont des
   `<script>self.__next_f.push([...])</script>`** (données RSC en ligne, aucun téléchargement, aucun code exécuté hors un
   `push` dans un tableau), 10 fichiers JS et 1 JSON-LD. Tout site Next.js App Router dépasse donc 40 sur presque toutes ses
   pages (561/561 ici), quel que soit son poids JS réel. Proposition : ne compter que `<script src=…>` et les scripts en ligne
   exécutables hors `type="application/ld+json"`, `type="application/json"` et `self.__next_f.push(` /
   `__NEXT_DATA__` (ou compter ces derniers à part, comme « données »). Les tests existants restent valables.
2. **`seo.link.to_noindex` : /dpa (accord de sous-traitance) n'est pas reconnu comme page légale.** La liste d'exclusion
   (`mentions|cgv|cgu|confidentialit|privacy|cookie`) couvre les autres pages légales liées partout par obligation, pas
   « dpa » / « sous-traitance ». Proposition : ajouter `dpa|sous-traitance|data-processing` à cette liste (et à `UTILITY`
   de checks/helpers.ts).
3. **`seo.index.blocked_linked` : l'entrée d'un espace client (`/app`, `/app?…`, redirigée vers /connexion) n'est pas
   reconnue comme utilitaire** alors que `/connexion`, `/mon-compte`, `/account` le sont (`UTILITY`). Bloquer `/app` dans
   robots.txt est la pratique recommandée pour un espace privé. Proposition : ajouter `app|dashboard|espace-client` à
   `UTILITY` (chemin de premier niveau seulement, ex. `^/(app|dashboard)(/|$|\?)`).
4. **GEO `geo.entite.name_inconsistent` lit les `Organization` de pages en noindex.** Nos pages d'exemple
   (/p/plomberie-martin, /p/maison-sora : comptes démo, « entreprise fictive », noindex) décrivent par nature une autre
   entreprise ; le contrôle conclut que « votre nom apparaît sous 3 formes ». Proposition : ne collecter les noms
   d'entité que sur les pages indexables (ou ignorer celles dont le JSON-LD porte un autre `url` que l'origine du site).
5. **GEO `isArticlePage` (entity.ts:28) classe la page d'index /guides comme article** via `ARTICLE_URL` alors qu'elle est
   typée `CollectionPage` dans son JSON-LD → « article sans auteur », « article non balisé ». Proposition : un type
   JSON-LD `CollectionPage` / `ItemList` / `WebSite` l'emporte sur l'URL.
6. **`seo.sd.recommended_missing` demande `shippingDetails` et `hasMerchantReturnPolicy` sur toute `Offer`**, y compris les
   offres d'un `Service` / `SoftwareApplication` (abonnement en ligne : /tarifs, /local, /pme, /e-commerce, /analyse).
   Ces propriétés sont celles des fiches marchandes Google (produits physiques livrés) ; les ajouter à un abonnement
   serait inventer une livraison. Proposition : ne les recommander que si l'`Offer` dépend d'un `Product` /
   `ProductGroup` (ou porte `itemOffered` de type Product).
7. **`seo.broken.dev_links` prend `https://dev.wix.com/…` (documentation officielle des développeurs Wix) pour un site de
   test** (liens.ts:196, `(staging|preprod|recette|dev|test)[.-][^/]+` sur tout lien externe). Un sous-domaine `dev.`
   d'un AUTRE site est très souvent une documentation (dev.wix.com, dev.to, developer…). Proposition : ne signaler ces
   préfixes que s'ils portent le même domaine enregistrable que le site audité (dev.monsite.fr), garder localhost /
   .local / .test pour tous.
8. **GEO `geo.acces.partial_block` (access.ts:113) compte l'espace client bloqué (`/app`, `/api/…`)** alors que son propre
   texte dit « C'est voulu pour un espace client ou un panier ». Proposition : exclure les chemins utilitaires (même liste
   que `UTILITY` + `api`, `app`, `admin`) ou passer en `info` quand toutes les pages bloquées sont de ce type.

## Pour ROBUSTESSE (src/lib/crawl, propriétaire actuel)
9. **Images Next.js `/_next/image?…` comptées cassées (400)** : le contrôle d'images envoie `HEAD` (crawl.ts:562). Sur
   un `next start`, un `HEAD` vers `/_next/image` encore non mis en cache renvoie **400** (« internal image response is
   empty » dans le journal du serveur : l'optimiseur relaie la méthode HEAD à sa lecture interne) ; la même URL en `GET`
   renvoie 200 (vérifié : `curl -I` après un premier GET → 200). Le repli GET n'est tenté que pour 405/501/403.
   Proposition : retenter en GET (maxBytes 1) aussi sur 400 pour `kind: 'image'`.
10. **`seo.sd.required_missing` exige `price` sur toute `Offer`**, y compris une `Offer` d'`OfferCatalog` dont
    l'`itemOffered` est un `Service` (artisan : « Dépannage de fuite », sans prix fixe). Google n'exige le prix que pour
    les extraits produit / fiches marchandes (Offer d'un Product). Proposition : n'exiger price/priceCurrency que pour les
    Offer rattachées à un Product/ProductGroup (ou portant un itemOffered Product) ; sinon « recommandée ».

## Réponse ROBUSTESSE (15 nov. 2026) — les 10 points sont traités, avec tests (src/lib/crawl/__tests__/hardsites.test.ts)
1. FAIT — `renderHints.scriptsCount` (crawl/extract.ts) ne compte plus que les scripts exécutés : fichiers `src`, scripts en
   ligne hors JSON-LD / JSON / importmap / `self.__next_f.push(` / `__NEXT_DATA__`. (siteaudit/html.ts `scriptsCount` inchangé.)
2. FAIT — `dpa|sous-traitance|data-processing` ajoutés à `UTILITY` (checks/helpers.ts) et à l'exclusion de `seo.link.to_noindex`.
3. FAIT — `UTILITY` reconnaît `/app`, `/dashboard`, `/espace-client` au premier niveau du chemin.
4. FAIT — GEO : noms d'entité collectés sur les pages indexables seulement (geo/entity.ts).
5. FAIT — GEO : `CollectionPage`, `ItemList`, `WebSite`, `SearchResultsPage` l'emportent sur l'URL dans `isArticlePage`.
6. et 10. FAIT — prix obligatoire, `shippingDetails` et `hasMerchantReturnPolicy` seulement pour les offres d'un Product /
   ProductGroup (ou `itemOffered` Product) ; ailleurs, prix « recommandé » (seoaudit/schema.ts).
7. FAIT — préfixes `staging|preprod|recette|dev|test` signalés seulement sur le domaine du site ; localhost, .local, .test partout.
8. FAIT — `geo.acces.partial_block` passe en `info` quand toutes les pages bloquées sont utilitaires (app, api, admin, panier…).
9. FAIT — repli GET aussi sur 400 après un HEAD (crawl.ts, vérification des liens et images).
