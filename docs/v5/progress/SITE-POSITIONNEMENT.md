# SITE-POSITIONNEMENT — journal (V5, vague B, 13 nov. 2026)
## Fait
- docs/v5/positionnement.md : promesse, preuves (code), différences datées et sourcées vs Semrush, Ahrefs, Screaming Frog, Peec, Otterly, Meteoria.
- Accueil réécrit (SEO + GEO) : héros « Google et les IA décident qui vos clients trouvent. » + QuickAuditForm (ANALYSE-UI) « Analyser mon site » → /analyse ; aperçu d'analyse étiqueté fictif ; Deux lecteurs ; carte des contrôles (chiffres lus dans CHECKS/SECTIONS) ; agent ; comparaison par familles ; FAQ SEO. Blocs : src/components/site/v5-blocks.tsx.
- /fonctionnalites : socle de 7 pages (analyse-60-secondes, audit-seo, positions-et-search-console, performance, geo-avance, agent-de-publication, barometres) + visuels v5-visuals.tsx.
- /local /pme /e-commerce : section SEO + IA (prop `seoGeo` de SegmentLanding), titres/descriptions, CTA → analyse.
- /tarifs : mêmes prix ; tableau SEO + agent lu dans entitlements (SeoOfferTable, v5OfferFacts) — relu en fin de mission.
- /comparatif + 3 fiches (semrush, ahrefs, screaming-frog), lignes SEO et positions, dates de relevé distinctes.
- /methode : exploration, audit SEO, audit GEO (preuves), données Google, agent (V5Sections.tsx).
- Guides : pilier seo-geo-sites-pros-2026 + seo-local-et-ia, donnees-structurees-utiles, search-console-debutants, core-web-vitals-sans-jargon (guides-v5.ts) ; robots-ia-robots-txt et fiche-produit-et-ia enrichis (même URL) ; 8 schémas SVG (guide-figures.tsx), FAQ + FAQPage.
- llms.txt (fonctions, limites), JSON-LD : knowsAbout SEO, entité Repéré typée Service + catalogue de fonctions (pas d'avis inventés).
- Site : CTA d'en-tête « Analyse gratuite », menus, liens vers /app en nofollow, titres > 60 car. sans suffixe (meta.ts), titres d'outils raccourcis, dates visibles sur l'aide.
- Tests : components/site/__tests__/v5-site.test.tsx (+ compteurs mis à jour) ; tsc propre ; vitest 512/512 (site, pages, app, lib/seo, tools).
- Corrections issues de l'auto-analyse : titres > 60 car. sans suffixe, descriptions ramenées à 160 car. (fitDescription), outils et entité en `Service` (pas d'avis inventés), questions-titres avec réponse directe, H1 trop longs, cannibalisations, liens /app en nofollow, /analyse dans routes/sitemap.
- Auto-analyse (scratchpad/sp-pos : miroir du site 4101 → crawlSite + auditSeo + auditGeo) : voir « Scores ».
## Scores (notre propre analyse, serveur de dev, 113+ pages)
- Avant : SEO 55 / GEO 98 (113 pages). Après : SEO 60 / GEO 98 (119 pages).
- Avec la demande n° 2 (métadonnées dans <head> pour les robots) simulée : avant 60 → après 65 ; restent hors périmètre : /analyse (ANALYSE-UI), HSTS et compression (absents en dev seulement), pages légales en noindex liées partout.
- Méthode : miroir HTML (mirror.py, le serveur redémarre souvent), charge RSC de dev retirée, liens externes « non vérifiables » (réseau filtré). Résultats : scratchpad/sp-pos/avant.json, apres-plain.json, apres-sim.json.
- Captures : qa/v5/SITE-POSITIONNEMENT/avant (rendues depuis le miroir d'avant : le serveur partagé avait été resynchronisé) et apres/.
## À faire par d'autres
- docs/v5/demandes-SITE-POSITIONNEMENT.md (ONE_LINER + PAGE_UPDATED, htmlLimitedBots, sitemap /analyse, pages légales).
