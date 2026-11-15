# Journal OUTILS (V6)

## 15 nov. 2026
- Lu : brief V6, DESIGN-COMMUN V4, positionnement V5, registry.ts, 9 outils, ToolPage, ui.tsx, api.ts, siteaudit/api.ts
  (toolHandler : zod + limite par IP), siteaudit/fetch.ts (safeFetch), crawl/fetcher.ts (CrawlFetcher : saut par saut,
  boucles, robots.txt, anti-SSRF), crawl/extract.ts, crawl/sitemap.ts.
- Veille (15 nov. 2026) :
  - Ahrefs https://ahrefs.com/free-seo-tools : AI Visibility Checker, AI Mode / AI Overviews Tracker, Keyword Generator,
    KD Checker, Backlink / Broken Link Checker, Website Authority, Traffic, SERP Checker, Rank Checker, XML Sitemap Generator.
  - Semrush https://semrush.com/free-tools : SEO Checker, Authority, AI Search Visibility, AI Overviews, AI Traffic,
    Keyword Tool, Volume, Rank, Backlink, Traffic, SERP Checker, Plagiarism, Google SERP Simulator, Sitemap Generator,
    Competitor Finder ; local : description de fiche, lien d'avis Google, QR code d'avis.
  - SEO Review Tools https://www.seoreviewtools.com/seo-tools/ (84 outils) : Redirect Checker, Bulk HTTP Header Checker,
    Bulk Meta Robots Checker, Canonical Checker, Internal Link Analyzer, Broken Link Checker, Readability Checker,
    HTML Headings Checker, Google SERP Preview, Title / Meta Description Generator, FAQ Schema Generator.
  - Screaming Frog : version gratuite du SEO Spider limitée à 500 URL (docs/v5/positionnement.md).
  - Conclusion : nos manques sans fournisseur payant = aperçu SERP, title/meta, redirections, en-têtes HTTP, indexabilité,
    sitemap, hreflang, Open Graph, liens d'une page, lisibilité, générateur robots.txt. Mots-clés, volumes, liens entrants,
    trafic : exigent un fournisseur payant → exclus. JSON-LD (LocalBusiness/Organization/Product/FAQ) : déjà fait.
- Choix technique : endpoints sous src/app/outils/api/[outil]/route.ts (mon périmètre ; src/app/api/** n'est à personne
  en V6), même enveloppe toolHandler (zod, limite par IP), récupération par CrawlFetcher (anti-SSRF de siteaudit/fetch.ts).
- Site public sans mode sombre (globals.css : color-scheme light) : outils vérifiés en émulation sombre, rendu clair cohérent.

## Fait (15 nov. 2026)
- 11 outils ajoutés (registre 9 → 20) : apercu-google, balises-title-meta, indexabilite, redirections, en-tetes-http,
  validateur-sitemap, hreflang, open-graph, analyse-liens, lisibilite, generateur-robots-txt.
- Code : src/components/tools/v6/ (types, pure = pixels/lisibilité Kandel-Moles/générateur robots/hreflang/lastmod,
  analyze = analyses sans réseau sur extractPage + lecteur RFC 9309, run = réseau via CrawlFetcher, examples fictifs
  .example, registry éditorial, ui = verdict vert/ambre/rouge + icône, UrlTool). Endpoints POST /outils/api/<outil>
  (toolHandler : zod + limite IP/heure 10 à 30). Aperçu Google, lisibilité, robots.txt : calcul dans le navigateur.
- Hub /outils : 5 étapes (s’afficher, être indexée, laisser entrer les IA, être comprise, être lue et citée), titre et
  H1 élargis à Google + IA, CTA vers /analyse. AuditBridge : option `to="analyse"` (outils SEO → /analyse?site=).
- Demandes SITE-SEO-90 traitées : H1 /outils/robots-ia ≤ 80 car. ; saut d’intertitres /outils/llms-txt (HonestBox h2/h3).
  Leurs points 4 à 9 et 11 concernent leur propre périmètre (non traités ici).
- Tests : __tests__/v6-pure.test.ts, v6-analyze.test.ts (réseau simulé par setFetchDeps, anti-SSRF, robots RepereBot,
  limite 429, 404 outil inconnu), tools.test.ts mis à jour (20 outils). tsc et eslint verts.
- Captures 1440 et 390 (+ 3 en émulation sombre, + état d’erreur) : qa/v6/OUTILS/. Aucun débordement horizontal à 390.
  Le site public est clair seulement (color-scheme light) : rendu identique en émulation sombre, cohérent.

## Reste / À faire par d’autres
- SITE-SEO-90 : demandes-SITE-SEO-90.md « De OUTILS » (note /outils dans routes.ts, content.test.ts attend 9 outils,
  menu, phrase llms.txt, Disallow /outils/api/ facultatif).
- Le bac à sable n’a pas de DNS sortant : outils réseau vérifiés par tests simulés et état d’erreur, pas sur un vrai site.
- vitest complet : 1963/1966. Échecs hors périmètre OUTILS : content.test.ts (attend 9 outils → demande SITE-SEO-90),
  v4-site.test.tsx (accueil : 2 boutons submit dans le hero, SITE-SEO-90), robustesse.test.ts (ROBUSTESSE, vert en relance).
