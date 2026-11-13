# Contrôles SEO de Repéré (V5) — catalogue, sources, pondération

Agent SEO-AUDIT, 13 nov. 2026. Code : `src/lib/seoaudit/**` (`auditSeo(crawl, { siteType?, perf? })`), route `POST /api/v5/seoaudit`.
Le tableau de la fin est **généré depuis le code** (`CHECKS` dans `src/lib/seoaudit/index.ts`) : identifiant, sévérité, impact/effort,
types de sites, correctif automatisable, source. 185 contrôles en 12 sections.

## 1. Méthode de recherche

Sources officielles d'abord (Google Search Central, web.dev, schema.org, MDN), puis la documentation publique des outils de référence.
Certaines pages de Google Search Central n'étaient lisibles qu'en partie depuis notre environnement (accès filtré) : les règles
citées viennent de la documentation Google telle que connue en juin 2026, recoupée pour les changements récents par les annonces
de Google et la presse spécialisée (liens ci-dessous).

**Outils comparés** (listes de contrôles publiques) :
- Screaming Frog SEO Spider, liste des « issues » : https://www.screamingfrog.co.uk/seo-spider/issues/ (consultée : codes de réponse,
  sécurité, URL, titres, descriptions, H1/H2, contenu, images, canonical, pagination, directives, hreflang, JavaScript, liens,
  données structurées, sitemaps, PageSpeed, mobile, validation HTML).
- Semrush Site Audit : https://www.semrush.com/kb/542-site-audit-issues-list et calcul du « Site Health » : https://www.semrush.com/kb/114-total-score
  (erreurs > avertissements > notices ; le score dépend de la proportion de pages touchées, pas du volume crawlé).
- Sitebulb (« Hints » priorisés) : https://sitebulb.com/hints/ ; Ahrefs Site Audit : https://help.ahrefs.com/en/collections/1539899-issues ;
  SE Ranking Website Audit : https://help.seranking.com/en/project-tools/website-audit/how-to-use-website-audit.

Ce que Repéré fait **en plus** de ces outils : sévérités adaptées au type de site (local / PME / e-commerce), contrôles
propres à la France (mentions légales, CGV, RGPD, adresses et téléphones français), validation des données structurées contre les
**fonctionnalités Google encore actives en 2026**, texte en français simple (constat, pourquoi, quoi faire), correctifs
automatisables prêts pour PUBLICATION, et aucun constat sur ce qui n'a pas pu être vérifié (HTML absent, données de
performance non fournies, exploration partielle → constat « orphelines » prudent).

## 2. Recommandations Google à jour (2025–2026) prises en compte

| Sujet | Ce qui compte en 2026 | Source |
|---|---|---|
| Core Web Vitals | LCP ≤ 2,5 s, **INP ≤ 200 ms** (remplace FID depuis mars 2024), CLS ≤ 0,1, au 75e centile des visites ; mauvais : > 4 s, > 500 ms, > 0,25. TTFB indicatif : ≤ 0,8 s bon, > 1,8 s mauvais. | https://developers.google.com/search/docs/appearance/core-web-vitals ; https://web.dev/articles/vitals ; https://web.dev/articles/inp ; https://web.dev/articles/ttfb |
| Mobile-first | Google explore et indexe avec Googlebot smartphone (tous les sites depuis juillet 2024) : viewport, contenu identique mobile/ordinateur. | https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing |
| Contenus utiles | Contenu fait pour les personnes, expertise visible (qui, comment, pourquoi) ; contenus pauvres ou dupliqués à grande échelle visés par les règles anti-spam. | https://developers.google.com/search/docs/fundamentals/creating-helpful-content ; https://developers.google.com/search/docs/essentials/spam-policies |
| Données structurées | Seuls les types de la galerie Google produisent des résultats enrichis ; le balisage doit refléter le contenu visible ; avis auto-attribués (LocalBusiness/Organization) non éligibles aux étoiles. | https://developers.google.com/search/docs/appearance/structured-data/search-gallery ; https://developers.google.com/search/docs/appearance/structured-data/sd-policies ; https://developers.google.com/search/docs/appearance/structured-data/review-snippet |
| Types retirés | HowTo (2023) ; juin 2025 : Book Actions, Course Info, ClaimReview, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing (retirés des rapports le 9 sept. 2025 ; Book Actions finalement conservé) ; nov. 2025 : Practice problems, Dataset (Dataset Search seulement) ; **FAQ : plus affichée dans Google depuis le 7 mai 2026**. Champ de recherche des sitelinks supprimé (nov. 2024). | https://developers.google.com/search/blog/2025/06/simplifying-search-results ; https://www.seroundtable.com/google-search-console-deprecated-structured-data-40083.html ; https://www.seroundtable.com/google-drops-support-structured-data-types-40386.html ; https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/ ; https://developers.google.com/search/blog/2023/08/howto-faq-changes |
| Canonical | Une seule canonical, absolue, vers une page 200 indexable ; signal (pas une directive) ; pas de chaîne. | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls |
| hreflang | Codes ISO 639-1 (+ ISO 3166-1), réciprocité, auto-référence, x-default recommandé, URL absolues. | https://developers.google.com/search/docs/specialty/international/localized-versions |
| Pagination | rel=prev/next ignoré ; chaque page paginée est sa propre canonical, liée par des `<a href>`. | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading |
| Facettes e-commerce | Bloquer l'exploration des filtres sans valeur (robots.txt), ordre de paramètres constant, 404 pour les combinaisons vides, canonical/noindex sinon (doc officielle publiée en déc. 2024). | https://developers.google.com/crawling/docs/faceted-navigation |
| Variantes produit | ProductGroup + hasVariant, ou canonical vers la fiche principale. | https://developers.google.com/search/docs/specialty/ecommerce/product-variants |
| JavaScript | Google rend le JS en différé ; liens = `<a href>` ; ne pas bloquer CSS/JS ; la plupart des robots d'IA n'exécutent pas le JS. | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ; https://developers.google.com/search/docs/crawling-indexing/links-crawlable |
| Images | Texte alternatif descriptif, nom de fichier parlant, dimensions déclarées (CLS), pas de lazy-load sur l'image principale (LCP), formats modernes. | https://developers.google.com/search/docs/appearance/google-images ; https://web.dev/articles/browser-level-image-lazy-loading |
| Sitemaps | ≤ 50 000 URL / 50 Mo par fichier, URL canoniques uniquement ; `lastmod` utilisé s'il est fiable, `priority`/`changefreq` ignorés. | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| robots.txt | 5xx sur robots.txt = exploration suspendue ; robots.txt n'empêche pas l'indexation (noindex nécessite l'exploration). | https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt ; https://developers.google.com/search/docs/crawling-indexing/block-indexing |
| Redirections / erreurs | 301/308 pour le définitif, pas de chaînes ; soft 404 ; 5xx répétés = ralentissement de l'exploration. | https://developers.google.com/search/docs/crawling-indexing/301-redirects ; https://developers.google.com/search/docs/crawling-indexing/http-network-errors |
| HTTPS / sécurité | HTTPS attendu (expérience de page), contenu mixte bloqué par les navigateurs, HSTS recommandé. | https://developers.google.com/search/docs/appearance/page-experience ; https://web.dev/articles/what-is-mixed-content |
| Titres / extraits | Titre unique et descriptif (Google réécrit les titres vides, génériques ou trop longs) ; meta description = extrait proposé ; `nosnippet`/`max-snippet` limitent aussi l'usage dans les aperçus IA. | https://developers.google.com/search/docs/appearance/title-link ; https://developers.google.com/search/docs/appearance/snippet ; https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag |
| Local | Pertinence, distance, notoriété ; cohérence NAP entre site et fiche ; LocalBusiness (name + address obligatoires). | https://support.google.com/business/answer/7091 ; https://developers.google.com/search/docs/appearance/structured-data/local-business |
| Obligations FR | Mentions légales (LCEN), CGV pour la vente en ligne, information RGPD. | https://entreprendre.service-public.fr/vosdroits/F31228 ; https://entreprendre.service-public.fr/vosdroits/F33138 ; https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on |

## 3. Validation des données structurées (src/lib/seoaudit/schema.ts)

Règles par type, alignées sur les pages Google : **LocalBusiness** et ses ~80 sous-types (obligatoires : name, address ;
recommandées : telephone, url, openingHoursSpecification, geo, image, priceRange ; adresse : streetAddress, addressLocality,
postalCode), **Organization** (aucune obligatoire ; recommandées : name, url, logo, sameAs, address, telephone/contactPoint),
**Product** (name, image, et offers ou review ou aggregateRating ; recommandées : description, brand, sku, GTIN/MPN),
**Offer** (price, priceCurrency ; recommandées : availability, shippingDetails, hasMerchantReturnPolicy), **AggregateOffer**,
**AggregateRating** (ratingValue dans l'échelle, ratingCount/reviewCount), **Review** (author, reviewRating), **BreadcrumbList**
(position, name, item sauf dernier), **Article/BlogPosting/NewsArticle**, **Event** (name, startDate, location), **Recipe**
(name, image), **VideoObject** (name, thumbnailUrl, uploadDate), **JobPosting**, **SoftwareApplication**, **FAQPage**.
Valeurs vérifiées : dates ISO 8601, devise ISO 4217, prix numériques sans symbole, disponibilité schema.org, note dans
l'échelle, `@context` schema.org, cohérence avec le contenu visible (prix, téléphone).

## 4. Pondération et score (sans fausse précision)

- **Section** : chaque constat retire un pourcentage : note = 100 × Π (1 − part), part = poids de sévérité × étendue.
  Poids : critique 0,60 · élevée 0,35 · moyenne 0,15 · faible 0,04 · info 0. Étendue : 1 pour un constat global, sinon
  0,35 + 0,65 × min(1, pages touchées / (50 % des pages)) — comme Semrush, c'est la proportion qui compte, pas le volume.
- **Global** : 100 × Π (1 − part × ½ × poids de la section / poids moyen des sections applicables). Poids : indexation 20,
  technique 14, balises et contenu 16, doublons 8, maillage 7, liens cassés 8, international 4 (si hreflang ou plusieurs
  langues), images 5, données structurées 7, mobile et performance 11, e-commerce 12 (boutiques), local 14 (commerces locaux).
  Plafond 40 si un constat critique est global ou touche ≥ 50 % des pages (robots.txt qui bloque tout, accueil en noindex…).
- **Arrondi à 5 points** partout ; appréciation : bon ≥ 80, moyen ≥ 55, faible en dessous. La note mesure l'état du site,
  pas une position dans Google (aucune promesse de résultat).
- **topFixes** : (rang de sévérité 4/3/2/1 × impact 1–3) / effort 1–3, puis nombre de pages touchées ; 10 premiers hors « info ».
- Repères sur les sites témoins des tests : site propre 100 ; artisan sans balisage ni descriptions 45–65 ; PME avec doublons et
  lien cassé 55–75 ; boutique avec facettes indexables 55–75 ; robots.txt bloquant ≤ 40.

## 5. Correctifs automatisables (`autoFix`, appliqués par PUBLICATION après validation)

`meta.title`, `meta.description` (proposés depuis H1 / premier paragraphe, marqués « à relire »), `img.alt` (depuis le nom de
fichier et le H1 — nous ne voyons pas l'image : toujours à relire), `jsonld` (Organization / LocalBusiness reconstruits depuis le
site : nom, adresse, téléphone, logo, réseaux ; BreadcrumbList depuis les pages parentes), `redirect` (301 vers la destination
finale ou le parent existant le plus proche), `canonical`, `link.update` (http → https, liens vers redirections), `sitemap`
(XML des pages indexables), `robots` (robots.txt corrigé : blocage total retiré, ligne Sitemap, filtres bloqués), `meta.robots`.

## 6. Limites connues (dites, pas cachées)

- Liens externes et images cassés : seulement si CRAWL a vérifié les liens (`checkLinks`).
- Performance : sans `PerfData` (SEO-DATA), seuls les signaux du crawl (viewport, poids, temps de réponse de notre robot,
  scripts bloquants, compression) ; aucune note Core Web Vitals inventée.
- Crawl « public » sans HTML : les contrôles qui relisent le HTML ne s'exécutent pas (`stats.pagesWithHtml`).
- Cannibalisation : estimée sur la proximité des titres ; la confirmation exige les requêtes Search Console (SEO-DATA).

## 7. Catalogue complet (généré depuis le code)

### Indexation et exploration (27 contrôles, poids 20)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.robots.blocks_all` | robots.txt bloque tout le site pour Google | critique | 3/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/robots/robots_txt](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) |
| `seo.robots.server_error` | robots.txt en erreur serveur (5xx) | critique | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots/robots_txt](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) |
| `seo.robots.missing` | robots.txt absent | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/robots/intro](https://developers.google.com/search/docs/crawling-indexing/robots/intro) |
| `seo.robots.no_sitemap` | robots.txt sans ligne Sitemap | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.robots.blocks_resources` | robots.txt bloque CSS/JS | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/javascript/javascr](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) |
| `seo.sitemap.missing` | Aucun sitemap XML | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.error` | Sitemap inaccessible ou invalide | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.too_big` | Sitemap de plus de 50 000 URL | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.non_indexable` | Sitemap : pages non indexables | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.broken` | Sitemap : pages en erreur | élevée | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.redirects` | Sitemap : adresses redirigées | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sit](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) |
| `seo.sitemap.other_host` | Sitemap : URL d’un autre domaine ou protocole | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/sitemaps/overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) |
| `seo.sitemap.missing_pages` | Pages indexables absentes du sitemap | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/sitemaps/overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) |
| `seo.index.home_noindex` | Page d’accueil exclue de Google | critique | 3/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing) |
| `seo.index.noindex` | Pages en noindex (à vérifier) | faible | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing) |
| `seo.index.xrobots_noindex` | noindex envoyé par l’en-tête HTTP | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots-meta-tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) |
| `seo.index.nofollow` | Pages en nofollow | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots-meta-tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) |
| `seo.index.nosnippet` | Extraits interdits (nosnippet) | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots-meta-tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) |
| `seo.index.unavailable_after` | Directive unavailable_after | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots-meta-tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) |
| `seo.index.blocked_in_sitemap` | Pages du sitemap bloquées par robots.txt | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/robots/intro](https://developers.google.com/search/docs/crawling-indexing/robots/intro) |
| `seo.index.blocked_linked` | Pages liées mais bloquées par robots.txt | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing) |
| `seo.index.client_rendered` | Contenu généré uniquement en JavaScript | élevée | 3/3 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/javascript/javascr](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) |
| `seo.index.low_indexable_ratio` | Moins de la moitié des pages indexables | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.index.deep_pages` | Pages à plus de 3 clics de l’accueil | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.index.crawl_errors` | Adresses sans réponse | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |
| `seo.index.truncated` | Exploration partielle | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/sitemaps/overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) |
| `seo.index.home_unreachable` | Page d’accueil inaccessible | critique | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |

### Technique et redirections (22 contrôles, poids 14)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.https.not_https` | Site sans HTTPS | critique | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/page-experience#https](https://developers.google.com/search/docs/appearance/page-experience#https) |
| `seo.https.http_pages` | Pages encore servies en http | élevée | 2/2 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/page-experience#https](https://developers.google.com/search/docs/appearance/page-experience#https) |
| `seo.https.mixed_content` | Contenu mixte (ressources en http) | moyenne | 2/1 | local, PME, e-commerce |  | [web.dev/articles/what-is-mixed-content](https://web.dev/articles/what-is-mixed-content) |
| `seo.https.hsts` | En-tête HSTS absent | faible | 1/1 | local, PME, e-commerce |  | [developer.mozilla.org/fr/docs/Web/HTTP/Headers/Strict-Transport-Securi](https://developer.mozilla.org/fr/docs/Web/HTTP/Headers/Strict-Transport-Security) |
| `seo.https.http_links` | Liens internes en http | moyenne | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.host.duplicate` | Deux versions du site (www et sans www) | élevée | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.status.5xx` | Erreurs serveur (5xx) | critique | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |
| `seo.status.soft404` | Fausses pages 404 (soft 404) | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |
| `seo.redirect.chain` | Chaînes de redirections | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.redirect.loop` | Boucles de redirection | élevée | 3/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.redirect.temporary` | Redirections temporaires (302/307) | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.redirect.internal_links` | Liens internes vers des redirections | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.redirect.meta_refresh` | Redirections par meta refresh | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.url.session_id` | Identifiants de session dans les URL | élevée | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.url.tracking_internal` | Paramètres de suivi (utm) dans les liens internes | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.url.uppercase` | Majuscules dans les URL | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.url.underscore` | Tirets bas dans les URL | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.url.too_long` | URL trop longues | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.url.malformed` | URL avec doubles barres, espaces ou caractères spéciaux | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/url-structure](https://developers.google.com/search/docs/crawling-indexing/url-structure) |
| `seo.html.charset` | Encodage des caractères non déclaré | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.html.doctype` | Doctype absent | faible | 1/1 | local, PME, e-commerce |  | [web.dev/articles/responsive-web-design-basics](https://web.dev/articles/responsive-web-design-basics) |
| `seo.html.base_href` | Balise <base> vers un autre site | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |

### Balises et contenu (26 contrôles, poids 16)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.title.missing` | Titre (balise title) absent | élevée | 3/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.title.too_long` | Titre trop long (> 60 caractères) | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.title.too_short` | Titre trop court (< 20 caractères) | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.title.generic` | Titre générique (« Accueil », « Sans titre »…) | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.title.multiple` | Plusieurs balises title | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.meta.missing` | Meta description absente | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/snippet](https://developers.google.com/search/docs/appearance/snippet) |
| `seo.meta.too_long` | Meta description trop longue (> 160) | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/snippet](https://developers.google.com/search/docs/appearance/snippet) |
| `seo.meta.too_short` | Meta description trop courte (< 50) | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/snippet](https://developers.google.com/search/docs/appearance/snippet) |
| `seo.h1.missing` | Titre principal H1 absent | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.h1.empty` | H1 vide | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.h1.multiple` | Plusieurs H1 | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.h1.too_long` | H1 trop long (> 80) | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.headings.skip` | Hiérarchie des intertitres incohérente | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.headings.no_h2` | Long texte sans intertitre | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.content.thin` | Pages au contenu très court | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.content.home_thin` | Page d’accueil trop pauvre en texte | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.content.lorem` | Texte de remplissage (lorem ipsum) | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.content.text_ratio` | Très peu de texte par rapport au code | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.lang.missing` | Langue de la page non déclarée | faible | 1/1 | local, PME, e-commerce |  | [developer.mozilla.org/fr/docs/Web/HTML/Global_attributes/lang](https://developer.mozilla.org/fr/docs/Web/HTML/Global_attributes/lang) |
| `seo.og.missing` | Balises de partage (Open Graph) absentes | faible | 1/1 | local, PME, e-commerce |  | [ogp.me/](https://ogp.me/) |
| `seo.og.image_missing` | Image de partage (og:image) absente | faible | 1/1 | local, PME, e-commerce |  | [ogp.me/](https://ogp.me/) |
| `seo.meta.keywords` | Balise meta keywords (ignorée) | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.trust.legal_missing` | Mentions légales introuvables | moyenne | 2/1 | local, PME, e-commerce |  | [entreprendre.service-public.fr/vosdroits/F31228](https://entreprendre.service-public.fr/vosdroits/F31228) |
| `seo.trust.privacy_missing` | Politique de confidentialité introuvable | faible | 1/1 | local, PME, e-commerce |  | [cnil.fr/fr/rgpd-de-quoi-parle-t-on](https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on) |
| `seo.trust.contact_missing` | Page contact introuvable | moyenne | 2/1 | PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.trust.about_missing` | Page « Qui sommes-nous » introuvable | faible | 1/2 | PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |

### Doublons et cannibalisation (15 contrôles, poids 8)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.dup.content` | Contenus identiques | élevée | 3/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.dup.title` | Titres en double | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.dup.meta` | Descriptions en double | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/snippet](https://developers.google.com/search/docs/appearance/snippet) |
| `seo.dup.h1` | H1 en double | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/seo-starter-guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) |
| `seo.dup.cannibal` | Cannibalisation probable | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.dup.trailing_slash` | Pages avec et sans slash final | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.missing` | Balise canonical absente | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.to_error` | Canonical vers une page en erreur, redirigée ou noindex | élevée | 3/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.multiple` | Plusieurs canonical contradictoires | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.relative` | Canonical en adresse relative | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.other_domain` | Canonical vers un autre domaine | moyenne | 3/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.http` | Canonical en http sur un site https | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.chain` | Canonical en chaîne | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.fragment` | Canonical avec ancre (#) | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |
| `seo.canonical.canonicalised` | Pages canonicalisées vers une autre (information) | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/consolidate-duplic](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) |

### Maillage interne et pages orphelines (10 contrôles, poids 7)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.link.orphans` | Pages orphelines (dans le sitemap, jamais liées) | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.dead_end` | Pages sans aucun lien interne sortant | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.weak_inlinks` | Pages recevant un seul lien interne | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.nofollow_internal` | Liens internes en nofollow | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.empty_anchor` | Liens internes sans texte | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.generic_anchor` | Ancres non descriptives (« cliquez ici ») | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.too_many` | Trop de liens internes sur une page | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.many_external` | Beaucoup de liens externes | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies) |
| `seo.link.javascript` | Liens en JavaScript (non explorables) | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.link.to_noindex` | Liens internes vers des pages noindex | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing) |

### Liens cassés (6 contrôles, poids 8)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.broken.internal` | Liens internes cassés (404) | élevée | 3/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |
| `seo.broken.redirect_to_error` | Redirections vers une page en erreur | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/301-redirects](https://developers.google.com/search/docs/crawling-indexing/301-redirects) |
| `seo.broken.dev_links` | Liens vers un site de test ou localhost | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.broken.malformed_href` | Liens mal formés | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |
| `seo.broken.internal_5xx_linked` | Liens vers des pages en erreur serveur | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/http-network-error](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) |
| `seo.broken.external` | Liens externes cassés | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/links-crawlable](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) |

### International (8 contrôles, poids 4)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.hreflang.invalid_code` | Codes hreflang invalides | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.no_return` | hreflang sans lien de retour | élevée | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.no_self` | hreflang sans auto-référence | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.no_xdefault` | x-default absent | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.to_error` | hreflang vers des pages en erreur ou non indexables | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.relative` | hreflang en adresses relatives | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.hreflang.lang_mismatch` | hreflang et langue de la page incohérents | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |
| `seo.intl.no_hreflang` | Plusieurs langues sans hreflang | moyenne | 2/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/specialty/international/localized-ve](https://developers.google.com/search/docs/specialty/international/localized-versions) |

### Images (11 contrôles, poids 5)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.img.alt_missing` | Images sans texte alternatif | moyenne | 2/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/google-images](https://developers.google.com/search/docs/appearance/google-images) |
| `seo.img.alt_too_long` | Textes alternatifs trop longs | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/google-images](https://developers.google.com/search/docs/appearance/google-images) |
| `seo.img.alt_filename` | Textes alternatifs = nom de fichier | faible | 1/1 | local, PME, e-commerce | oui | [developers.google.com/search/docs/appearance/google-images](https://developers.google.com/search/docs/appearance/google-images) |
| `seo.img.heavy` | Images lourdes (> 200 Ko) | moyenne | 2/1 | local, PME, e-commerce |  | [web.dev/articles/lcp](https://web.dev/articles/lcp) |
| `seo.img.no_dimensions` | Images sans dimensions | faible | 1/1 | local, PME, e-commerce |  | [web.dev/articles/cls](https://web.dev/articles/cls) |
| `seo.img.lazy_lcp` | Image principale en chargement différé | faible | 2/1 | local, PME, e-commerce |  | [web.dev/articles/browser-level-image-lazy-loading](https://web.dev/articles/browser-level-image-lazy-loading) |
| `seo.img.no_lazy` | Nombreuses images sans chargement différé | faible | 1/1 | local, PME, e-commerce |  | [web.dev/articles/browser-level-image-lazy-loading](https://web.dev/articles/browser-level-image-lazy-loading) |
| `seo.img.legacy_format` | Formats d’image anciens | faible | 1/2 | local, PME, e-commerce |  | [web.dev/articles/serve-images-webp](https://web.dev/articles/serve-images-webp) |
| `seo.img.generic_filename` | Noms de fichiers d’image non descriptifs | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/google-images](https://developers.google.com/search/docs/appearance/google-images) |
| `seo.img.page_weight` | Poids total des images par page > 3 Mo | moyenne | 2/2 | local, PME, e-commerce |  | [web.dev/articles/lcp](https://web.dev/articles/lcp) |
| `seo.img.broken` | Images cassées | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/google-images](https://developers.google.com/search/docs/appearance/google-images) |

### Données structurées (15 contrôles, poids 7)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.sd.parse_errors` | JSON-LD illisible (erreur de syntaxe) | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/intro-str](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) |
| `seo.sd.none` | Aucune donnée structurée | faible | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/intro-str](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) |
| `seo.sd.entity_missing` | Organisation non décrite (Organization) | moyenne | 2/1 | PME, e-commerce | oui | [developers.google.com/search/docs/appearance/structured-data/organizat](https://developers.google.com/search/docs/appearance/structured-data/organization) |
| `seo.sd.localbusiness_missing` | Établissement non décrit (LocalBusiness) | élevée | 3/1 | local | oui | [developers.google.com/search/docs/appearance/structured-data/local-bus](https://developers.google.com/search/docs/appearance/structured-data/local-business) |
| `seo.sd.required_missing` | Propriétés obligatoires Google manquantes | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/search-ga](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) |
| `seo.sd.invalid_values` | Valeurs invalides (dates, prix, devise, disponibilité, note) | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/sd-polici](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) |
| `seo.sd.context` | @context schema.org absent | élevée | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/intro-str](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) |
| `seo.sd.recommended_missing` | Propriétés recommandées manquantes | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/search-ga](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) |
| `seo.sd.self_serving_reviews` | Avis auto-attribués | moyenne | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/review-sn](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) |
| `seo.sd.deprecated` | Types abandonnés par Google | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/blog/2025/06/simplifying-search-results](https://developers.google.com/search/blog/2025/06/simplifying-search-results) |
| `seo.sd.faq_no_rich` | FAQPage : plus de résultat enrichi Google (mai 2026) | info | 1/1 | local, PME, e-commerce |  | [searchenginejournal.com/google-drops-faq-rich-results/574429/](https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/) |
| `seo.sd.sitelinks_searchbox` | Balisage « champ de recherche » (retiré par Google) | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/blog/2024/10/sitelinks-search-box](https://developers.google.com/search/blog/2024/10/sitelinks-search-box) |
| `seo.sd.breadcrumb_missing` | Fil d’Ariane non balisé | faible | 1/1 | PME, e-commerce | oui | [developers.google.com/search/docs/appearance/structured-data/breadcrum](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| `seo.sd.article_missing` | Articles de blog non balisés (Article) | faible | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/article](https://developers.google.com/search/docs/appearance/structured-data/article) |
| `seo.sd.content_mismatch` | Données structurées absentes du contenu visible | moyenne | 2/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/sd-polici](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) |

### Mobile et performance (15 contrôles, poids 11)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.mobile.viewport_missing` | Balise viewport absente (site non adapté au mobile) | élevée | 3/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/mobile/mobile-site](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) |
| `seo.mobile.zoom_disabled` | Zoom bloqué sur mobile | faible | 1/1 | local, PME, e-commerce |  | [web.dev/articles/responsive-web-design-basics](https://web.dev/articles/responsive-web-design-basics) |
| `seo.mobile.plugins` | Contenus Flash / plugins | faible | 1/2 | local, PME, e-commerce |  | [developers.google.com/search/docs/crawling-indexing/mobile/mobile-site](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing) |
| `seo.perf.slow_server` | Serveur lent (temps de réponse médian > 1 s) | moyenne | 2/2 | local, PME, e-commerce |  | [web.dev/articles/ttfb](https://web.dev/articles/ttfb) |
| `seo.perf.slow_pages` | Pages très lentes à répondre (> 3 s) | faible | 1/2 | local, PME, e-commerce |  | [web.dev/articles/ttfb](https://web.dev/articles/ttfb) |
| `seo.perf.html_heavy` | Code HTML très lourd (> 600 Ko) | faible | 1/2 | local, PME, e-commerce |  | [web.dev/articles/vitals](https://web.dev/articles/vitals) |
| `seo.perf.too_many_scripts` | Trop de scripts (> 40) | faible | 1/2 | local, PME, e-commerce |  | [web.dev/articles/inp](https://web.dev/articles/inp) |
| `seo.perf.render_blocking` | Scripts bloquants dans l’en-tête | faible | 1/1 | local, PME, e-commerce |  | [developer.chrome.com/docs/lighthouse/performance/render-blocking-resou](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources) |
| `seo.perf.no_compression` | Compression (gzip/brotli) désactivée | faible | 1/1 | local, PME, e-commerce |  | [developer.chrome.com/docs/lighthouse/performance/uses-text-compression](https://developer.chrome.com/docs/lighthouse/performance/uses-text-compression) |
| `seo.cwv.lcp` | LCP (affichage du contenu principal) lent | moyenne | 3/2 | local, PME, e-commerce |  | [web.dev/articles/lcp](https://web.dev/articles/lcp) |
| `seo.cwv.inp` | INP (réactivité aux clics) lente | moyenne | 3/3 | local, PME, e-commerce |  | [web.dev/articles/inp](https://web.dev/articles/inp) |
| `seo.cwv.cls` | CLS (stabilité visuelle) mauvais | moyenne | 2/1 | local, PME, e-commerce |  | [web.dev/articles/cls](https://web.dev/articles/cls) |
| `seo.cwv.ttfb` | TTFB (réponse du serveur) lent chez les visiteurs | moyenne | 2/2 | local, PME, e-commerce |  | [web.dev/articles/ttfb](https://web.dev/articles/ttfb) |
| `seo.cwv.lab_score` | Score Lighthouse mobile faible (< 50) | moyenne | 2/2 | local, PME, e-commerce |  | [web.dev/articles/vitals](https://web.dev/articles/vitals) |
| `seo.cwv.no_field_data` | Pas de données terrain Chrome (CrUX) | info | 1/1 | local, PME, e-commerce |  | [developers.google.com/search/docs/appearance/core-web-vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) |

### E-commerce (19 contrôles, poids 12)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.ecom.facets_indexable` | Pages de filtres (facettes) indexables | élevée | 3/2 | e-commerce | oui | [developers.google.com/crawling/docs/faceted-navigation](https://developers.google.com/crawling/docs/faceted-navigation) |
| `seo.ecom.facets_crawlable` | Filtres explorables sans limite | moyenne | 2/1 | e-commerce | oui | [developers.google.com/crawling/docs/faceted-navigation](https://developers.google.com/crawling/docs/faceted-navigation) |
| `seo.ecom.pagination_canonical` | Pagination canonicalisée vers la page 1 | moyenne | 2/1 | e-commerce | oui | [developers.google.com/search/docs/specialty/ecommerce/pagination-and-i](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) |
| `seo.ecom.pagination_noindex` | Pagination en noindex | faible | 1/1 | e-commerce |  | [developers.google.com/search/docs/specialty/ecommerce/pagination-and-i](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) |
| `seo.ecom.variants_indexable` | Variantes de produit indexées séparément | moyenne | 2/1 | e-commerce | oui | [developers.google.com/search/docs/specialty/ecommerce/product-variants](https://developers.google.com/search/docs/specialty/ecommerce/product-variants) |
| `seo.ecom.product_schema_missing` | Fiches produit sans balisage Product | élevée | 3/1 | e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/merchant-](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) |
| `seo.ecom.product_thin` | Fiches produit pauvres (< 150 mots) | moyenne | 2/2 | e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.ecom.product_dup_description` | Descriptions produit recopiées | moyenne | 2/2 | e-commerce |  | [developers.google.com/search/docs/fundamentals/creating-helpful-conten](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) |
| `seo.ecom.product_no_image` | Fiches produit sans image | élevée | 2/1 | e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/merchant-](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) |
| `seo.ecom.price_not_visible` | Fiches produit sans prix lisible | moyenne | 2/1 | e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/merchant-](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) |
| `seo.ecom.out_of_stock` | Produits en rupture (information) | info | 1/1 | e-commerce |  | [developers.google.com/search/docs/specialty/ecommerce/designing-a-url-](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) |
| `seo.ecom.out_of_stock_noindex` | Produits en rupture passés en noindex | faible | 1/1 | e-commerce |  | [developers.google.com/search/docs/specialty/ecommerce/designing-a-url-](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) |
| `seo.ecom.no_return_shipping` | Livraison et retours non balisés | faible | 1/1 | e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/return-po](https://developers.google.com/search/docs/appearance/structured-data/return-policy) |
| `seo.ecom.category_thin` | Catégories sans texte d’introduction | faible | 2/2 | e-commerce |  | [developers.google.com/search/docs/specialty/ecommerce/designing-a-url-](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites) |
| `seo.ecom.search_indexable` | Résultats de recherche interne indexables | moyenne | 2/1 | e-commerce | oui | [developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies) |
| `seo.ecom.cart_indexable` | Panier, compte ou commande indexables | moyenne | 1/1 | e-commerce | oui | [developers.google.com/search/docs/crawling-indexing/block-indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing) |
| `seo.ecom.cgv_missing` | CGV introuvables | moyenne | 2/1 | e-commerce |  | [entreprendre.service-public.fr/vosdroits/F33138](https://entreprendre.service-public.fr/vosdroits/F33138) |
| `seo.ecom.product_no_breadcrumb` | Fiches produit sans fil d’Ariane balisé | faible | 1/1 | e-commerce |  | [developers.google.com/search/docs/appearance/structured-data/breadcrum](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| `seo.ecom.sort_links` | Liens de tri en clair | faible | 1/1 | e-commerce |  | [developers.google.com/crawling/docs/faceted-navigation](https://developers.google.com/crawling/docs/faceted-navigation) |

### Référencement local (11 contrôles, poids 14)

| Identifiant | Contrôle | Sévérité | Impact/Effort | Sites | Correctif auto | Source |
|---|---|---|---|---|---|---|
| `seo.local.no_contact_page` | Page contact introuvable | élevée | 2/1 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
| `seo.local.no_phone` | Téléphone introuvable | élevée | 3/1 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
| `seo.local.no_address` | Adresse postale introuvable | élevée | 3/1 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
| `seo.local.nap_inconsistent` | Coordonnées incohérentes (NAP) | moyenne | 2/1 | local |  | [support.google.com/business/answer/3038177](https://support.google.com/business/answer/3038177) |
| `seo.local.no_tel_link` | Téléphone non cliquable | faible | 2/1 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
| `seo.local.no_hours` | Horaires d’ouverture absents | moyenne | 2/1 | local |  | [developers.google.com/search/docs/appearance/structured-data/local-bus](https://developers.google.com/search/docs/appearance/structured-data/local-business) |
| `seo.local.no_gbp_link` | Fiche Google (Maps) non reliée | moyenne | 2/1 | local |  | [support.google.com/business/answer/3038177](https://support.google.com/business/answer/3038177) |
| `seo.local.city_not_in_title` | Ville absente du titre de l’accueil | moyenne | 2/1 | local | oui | [developers.google.com/search/docs/appearance/title-link](https://developers.google.com/search/docs/appearance/title-link) |
| `seo.local.zones` | Zone d’intervention non précisée | faible | 1/2 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
| `seo.local.sameas_missing` | Profils non reliés (sameAs) | faible | 1/1 | local |  | [developers.google.com/search/docs/appearance/structured-data/local-bus](https://developers.google.com/search/docs/appearance/structured-data/local-business) |
| `seo.local.multiple_cities_one_page` | Plusieurs établissements sans page dédiée | faible | 1/2 | local |  | [support.google.com/business/answer/7091](https://support.google.com/business/answer/7091) |
