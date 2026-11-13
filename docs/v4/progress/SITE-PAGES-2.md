# SITE-PAGES-2 — journal V4 (terminé 2026-11-13 02:3x)
## Fait
- Reprise sans journal : travail V4 déjà présent (src/components/pages/v4/* : DocLayout/TocSpy, LegalDocument, StepPath, HubDiagram, DataFlow, ScoreFormula, Editorial ; toutes les pages du périmètre ; pont « Étape suivante » du validateur JSON-LD, site pré-rempli). Vérifié page par page (1440/390).
- Captures : qa/v4/SITE-PAGES-2/avant (origine : copies qa/v3 p2-* et SITE-PAGES/avant), reprise/ (état trouvé), apres/ (final). Voir LISEZMOI.md.
- Corrigé : /methode tableau de la formule empilé en mobile (même HTML) ; /integrations libellés du schéma lisibles en 390.
- Test ajouté : src/components/pages/__tests__/legal-v4.test.ts (texte légal inchangé, ancres du sommaire).
- vitest (pages, tools, app) vert 173+3 ; tsc vert hors modules V5 (src/lib/publish en cours par V5).
## Remarques
- /fonctionnalites « Agir » : vidéo vide en capture Chromium sans codec (poster et images OK) — pas un bug de page.
