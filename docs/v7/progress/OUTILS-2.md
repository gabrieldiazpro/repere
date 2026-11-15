# Journal OUTILS-2 (V7)

## 15 nov. 2026
- Lu : brief V6, journal OUTILS (V6), registry.ts, v6/* (types, analyze, run, ui, examples), route /outils/api/[outil],
  siteaudit/api.ts (toolHandler), crawl/fetcher.ts, crawl/extract.ts, crawl/diagnose.ts, analysis/access.ts,
  seoaudit/schema.ts (règles Google par type), geo/freshness.ts, execution/qr.ts.
- Écartés (doublons des 20 existants) : « ce qu'un robot d'IA voit » (= rendu-sans-javascript), testeur ChatGPT Search
  / robots de recherche IA d'une URL (= robots-ia, qui teste déjà un chemin ; envoyer les agents des autres robots serait
  une usurpation), générateur Open Graph (= open-graph), comparateur deux pages (= comparateur), FAQ à partir d'un texte
  (le générateur JSON-LD fait déjà FAQPage).
- Menu, pied de page, sitemap, llms.txt et routes lisent le registre : aucun ajout manuel nécessaire.

## Fait (15 nov. 2026) — registre 20 → 31
| Étape du hub | Outil (slug) | Ce qu'il vérifie | Réseau |
|---|---|---|---|
| S'afficher | compatibilite-mobile | viewport, zoom bloqué, largeurs fixes, polices < 12 px, liens collés, tel:, champs mal typés | POST /outils/api/mobile |
| S'afficher | generateur-utm | lien UTM propre (minuscules, espaces, utm_ existants), canal GA4 estimé, QR SVG, modèles fiche Google/QR | navigateur |
| Être indexée | https-contenu-mixte | HTTPS, redirection http→https, HSTS, contenu mixte actif/passif, liens internes et canonical en http | /https |
| Être indexée | contenu-duplique | 2 URL : % de texte commun (Jaccard 5 mots), phrases identiques, title/desc/H1 en double, canonical | /doublons |
| Laisser entrer les IA | poids-page | HTML + 30 ressources (HEAD), images > 300 Ko / 1 Mo, formats, compression, scripts | /poids |
| Être comprise | resultats-enrichis | JSON-LD contre les exigences Google (seoaudit/schema.ts), types retirés, + mode « coller du code » dans le navigateur | /resultats-enrichis |
| Être comprise | textes-alternatifs | alt absent/vide/nom de fichier/générique/répété, liens-images muets, images cassées (20 HEAD) | /images |
| Être comprise | coherence-nap | nom/adresse/téléphone de 8 fiches saisies contre une référence (abréviations, formes juridiques, +33) | navigateur |
| Être lue et citée | structure-titres | plan H1–H6, H1 absent/multiple, sauts de niveau, vides, répétés, intertitres en question | /titres |
| Être lue et citée | fraicheur-page | dates visibles, JSON-LD, balises, Last-Modified, contradictions, © figé, « tarifs 2024 » | /fraicheur |
| Être lue et citée | fiche-faits-cles | bloc HTML « L'essentiel » + Markdown (llms.txt), faits sans chiffre, superlatifs, date | navigateur |

- Code : src/components/tools/v7/ (types, pure, access, analyze, run, registry, examples, PageTools.tsx, LocalTools.tsx).
  Endpoints ajoutés à src/app/outils/api/[outil]/route.ts (toolHandler : zod + limite IP/heure 10 à 30 ; CrawlFetcher anti-SSRF,
  robots.txt RepereBot). Page illisible : `accessFor` construit un mini-crawl d'une page et appelle diagnoseCrawl + accessReport ;
  la réponse est 200 avec `access` (titre, message, marche à suivre, plateforme) et AUCUN résultat calculé ; seules les
  adresses refusées (forme, réseau privé) restent en 400. v6/ui.tsx : UrlTool affiche `AccessNote` (profite aussi aux V6
  si un jour ils renvoient `access`).
- Hub : 5 étapes rééquilibrées (5/7/5/6/8), textes d'étape mis à jour, description du hub calculée sur TOOLS.length.
- Tests : __tests__/v7.test.ts (36 tests, réseau simulé : robots.txt bloquant, pare-feu Cloudflare, SSRF 400, limite 429,
  HEAD des images, redirection http→https, doublons), compteurs 20 → 31 dans tools.test.ts et v6-analyze.test.ts.
  content.test.ts n'a pas de compteur d'outils (lit le registre) : non modifié.
- Vérifs : tsc 0 ; eslint 0 erreur (43 avertissements préexistants hors périmètre) ; vitest complet 140 fichiers / 2017 tests verts.
- Captures (dev qa-site 4101, arrêté ensuite) : qa/v7/OUTILS-2/ hub, resultats-enrichis, structure-titres, coherence-nap
  en 1440 et 390. Les 11 outils ouverts avec leur exemple en 1440 et 390 : 0 débordement horizontal, 0 erreur console.
  Corrigé après capture : tableau NAP coupé à 390 → lignes empilées ; accord « Adresse différente ».

## Reste / pour d'autres
- Menu, pied de page, sitemap, llms.txt, routes : lisent le registre, rien à ajouter. Deux textes figés hors périmètre
  (SITE-SEO-90) : la note de /outils dans src/lib/seo/routes.ts (liste d'outils V6) et la liste statique de
  src/components/site/Bento.tsx — à compléter s'ils le souhaitent.
- Pas de DNS sortant dans le bac à sable : outils réseau vérifiés par tests simulés et exemples, pas sur un vrai site.
- Mobile : approximations sur le HTML (pas de rendu navigateur) — dit dans les limites de la page.
- GUIDES-2 : les liens « Guide : » ne pointent que vers des guides existants ; à enrichir avec leurs nouveaux guides
  (ex. un guide UTM/GA4 ou HTTPS) une fois publiés.
