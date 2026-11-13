# Données SEO de Repéré V5 — quelles données, quel fournisseur, quel coût

Agent SEO-DATA, 13 nov. 2026. Règle : aucune donnée fabriquée. Un fournisseur non configuré est affiché « non configuré » ;
les comptes démo affichent des données de démonstration étiquetées. Prix relevés sur les pages officielles le 13 nov. 2026
(en dollars US, monnaie de facturation des fournisseurs ; conversion € par `SEODATA_EUR_PER_USD`, défaut 0,92, estimation).

## 1. Ce qui est gratuit (et suffit pour l'essentiel)

| Donnée | Fournisseur | Accès | Limites (doc officielle) |
|---|---|---|---|
| Clics, impressions, CTR, position moyenne par requête / page / pays / appareil / jour, 16 mois | Google Search Console API (`searchanalytics.query`) | OAuth du client, scope `webmasters.readonly` | 1 200 requêtes/min par site et par utilisateur ; 30 M/jour et 40 000/min par projet ; 25 000 lignes par requête (pagination `startRow`) ; `dataState` final/all |
| Sitemaps soumis (envoyées / indexées, erreurs) | Search Console API (`sitemaps.list`) | même OAuth | 20 req/s et 200/min par utilisateur |
| État d'indexation d'une URL (verdict, couverture, canonique Google, dernier passage) | URL Inspection API (`urlInspection.index.inspect`) | même OAuth | 2 000/jour et 600/min **par site** |
| Performance labo (Lighthouse) + terrain (CrUX intégré), mobile et bureau | PageSpeed Insights API v5 | clé API Google Cloud | 25 000 req/jour par projet, ~240/min (à vérifier dans la console du projet) |
| Terrain Chrome (p75 LCP, INP, CLS, FCP, TTFB) par URL ou origine, 28 jours glissants | CrUX API (`records:queryRecord`) | même clé | 150 req/min par projet, gratuit, non augmentable ; CLS p75 renvoyé en chaîne |
| Requêtes, clics, impressions et positions **Bing** (semaines), liens entrants | Bing Webmaster Tools API (JSON, réponse sous `d`) | clé API **du client** (générée dans son compte Bing WMT) | quotas non publiés |

Coût Google : 0 €. Le plafond utile est le quota URL Inspection (2 000/jour/site) : on inspecte au plus 100 URL par jour
et par compte (pages importantes d'abord).

## 2. Ce qui est payant : DataForSEO (retenu, paiement à l'appel)

| Besoin | Point d'accès | Prix officiel | Notes |
|---|---|---|---|
| Volumes FR, CPC, concurrence, tendance 12 mois | Keywords Data › Google Ads › `search_volume` | 0,06 $ par tâche (file standard, 1–3 h) ou 0,09 $ (live, 12 req/min) — **jusqu'à 1 000 mots-clés par tâche** | facturé par tâche, pas par mot-clé |
| Positions Google France (top 10 / 20), fonctionnalités de SERP, aperçu IA | SERP › Google › Organic (`task_post` + `task_get/advanced`, ou `live/advanced`) | 0,0006 $ par page de 10 résultats (standard), 0,0012 $ (prioritaire), 0,002 $ (live) | profondeur 20 = 2 pages ; `load_async_ai_overview` = +1 prix de base ; type d'élément `ai_overview` dans `item_types`/`items` |
| Mots-clés sur lesquels le site se positionne, concurrents organiques, difficulté | DataForSEO Labs (`ranked_keywords`, `competitors_domain`, `bulk_keyword_difficulty`) | 0,012 $ par requête + 0,00012 $ par ligne | 1 000 lignes = 0,132 $ |
| Domaines référents, ancres, nouveaux / perdus | Backlinks (`summary`, `referring_domains`, `anchors`, `timeseries_new_lost_summary`) | 0,02 $ par requête + 0,00003 $ par ligne | **engagement minimal 100 $/mois** (crédit utilisable sur toutes les API DataForSEO) |
| Ouverture du compte | — | dépôt minimal 50 $ (sans expiration) | |

Location Google France : `location_code` 2250, `language_code` fr. Pour un commerce local, la position est relevée sur la
ville (`location_name` « Paris,Ile-de-France,France ») en mobile.

## 3. Alternatives étudiées (non retenues)

| Fournisseur | Prix | Pourquoi pas |
|---|---|---|
| Serper.dev | 50 $ pour 50 000 requêtes (1 $/1 000), crédits valables 6 mois, 2 500 gratuites | positions seulement, ~1,7× DataForSEO standard, pas de volumes ni de liens |
| SerpApi | 25 $/mois (1 000), 75 $ (5 000), 150 $ (15 000) | 15 à 25 $ pour 1 000 SERP : 25 à 40× plus cher |
| Semrush API | accès API complet avec l'offre Advanced (549 $/mois, désormais sur devis) + unités API | coût fixe disproportionné pour notre volume |
| Ahrefs API | 129 $ (Lite, 200 000 unités) à 1 499 $/mois (Enterprise, annuel) ; ≥ 50 unités par requête | idem ; conditions de réutilisation des données restrictives |
| SE Ranking API | portefeuille 50 $ (250 000 crédits) ou 179 $/mois | alternative crédible si DataForSEO devient indisponible |

## 4. Coût par client et par mois (limites proposées par offre)

Hypothèses : 4,35 relevés hebdomadaires par mois ; file standard DataForSEO ; profondeur 20 (2 pages) + aperçu IA
(+1 prix de base) = 3 × 0,0006 $ = 0,0018 $ par mot-clé et par appareil et par relevé ; volumes rafraîchis une fois par
mois (1 tâche) ; Labs 1 fois par mois ; liens 1 fois par mois.

| Offre | Mots-clés suivis | Appareils | Positions | Volumes | Labs | Liens | Total estimé | Plafond proposé |
|---|---|---|---|---|---|---|---|---|
| Découverte | 0 (Search Console + PageSpeed gratuits seulement) | — | 0 | 0 | 0 | 0 | **0 €** | 0 € |
| Essentiel Local | 20 | mobile | 0,16 $ | 0,06 $ | 0,05 $ | — | **≈ 0,25 €** | 1 € |
| Essentiel PME / E-com | 100 | bureau | 0,78 $ | 0,06 $ | 0,15 $ | — | **≈ 0,90 €** | 3 € |
| Accompagné (tous parcours) | 300 | mobile + bureau | 4,70 $ | 0,06 $ | 0,15 $ | 0,10 $ | **≈ 4,60 €** | 10 € |
| Agence (par marque, 20 marques) | 100 / marque | bureau | 15,7 $ | 1,2 $ | 3 $ | 2 $ | **≈ 20 €** (≈ 1 €/marque) | 40 € |
| Démo | — | — | 0 (données de démonstration) | | | | 0 € | 0 € |

Coût fixe de la plateforme : 0 € tant que les liens entrants sont coupés (dépôt 50 $ unique) ; **100 $/mois** dès qu'on
active Backlinks (crédit consommé par toutes les API).

**Décision ROI-DONNEES (13 nov. 2026)** : liens entrants réservés à **Accompagné et Agence** (rentables par construction :
1 abonné Accompagné à 99 €/mois couvre l'engagement ≈ 92 €), interrupteur plateforme `SEODATA_BACKLINKS_ENABLED=1`
(coupé par défaut), ROI mesuré dans `/admin/roi`.
Le plafond par compte (`SEODATA_LIMITS` dans src/lib/seodata/limits.ts, à reporter dans entitlements) bloque tout appel
payant au-delà et l'écrit dans le journal des coûts (`seodata.costs`, un document par compte et par mois).

## 5. Sources
- Search Console, quotas : https://developers.google.com/webmaster-tools/limits
- Search Console, searchanalytics.query : https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- CrUX API : https://developer.chrome.com/docs/crux/api
- PageSpeed Insights, quotas (synthèse) : https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api/rate-limits
- Bing Webmaster API : https://learn.microsoft.com/en-us/bingwebmaster/getting-started ; format JSON de GetQueryStats :
  https://bing-webmaster-api.analyticsedge.com/getquerystats/
- DataForSEO SERP : https://dataforseo.com/pricing/serp/google-organic-serp-api ; doc :
  https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
- DataForSEO Google Ads (volumes) : https://dataforseo.com/pricing/keywords-data/google-ads ; doc :
  https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/
- DataForSEO Labs : https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api ; doc :
  https://docs.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live.md/
- DataForSEO Backlinks : https://dataforseo.com/help-center/backlinks-api-pricing-explained ; doc :
  https://docs.dataforseo.com/v3/backlinks/timeseries_new_lost_summary/live
- Alternatives (Serper, SerpApi, Semrush, Ahrefs, SE Ranking, dépôt minimal DataForSEO) :
  https://ryandoser.com/dataforseo-alternatives/
