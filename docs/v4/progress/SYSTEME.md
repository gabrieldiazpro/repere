# SYSTEME — journal V4
- Fait : captures AVANT/APRÈS (qa/v4/SYSTEME/avant, apres). Règle « mouvement réduit » V4 à la racine : globals.css
  (keyframes de déplacement → fondus), ui.css, app.css (règle globale supprimée), Counter/ChartDraw/GaugeMorph/Typewriter/
  ScenePlayer jouent toujours ; motionAllowed() ; test motion/__tests__/reduced.test.ts ; vérifié au navigateur.
- Fait : jetons (ui.css : espacement 4/8, rayons, ombres, typo chiffre/titre/texte/légende, tons up/down/warn/neutral/brand
  clair+sombre) ; composants ui (Surface, KeyFigure, Delta, StatusBadge, Sparkline, Tabs, EmptyState, Skeleton, ActionButton,
  Disclosure, ProgressBar/Gauge, PageIntro, toast) ; motion (Cascade, useInView). SYSTEME-API.md publié et à jour.
- Fait : coquille (app-shell.css, Shell.tsx : boucle numérotée, indicateur actif qui glisse, compteurs, bandeau démo,
  onglets mobiles avec pression) ; template.tsx (transition de page) ; PageHeader (result/subtitle/primary) ; v4.css importé.
- Fait : accueil /app refait (phrase, chiffre clé animé + variation + courbe, UN bouton, puis cartes en cascade).
- Tests : tsc vert ; vitest src/components src/app : 325/326 — l'échec (routes.test désinscription, PostCSS) vient de
  `import "./site.css"` dans site/Header.tsx (SITE-ACCUEIL, signalé).
- À faire par d'autres : demandes-APP-ECRANS.md (ActionButton dans TaskBoard, Delta neutre, règle réduite v4.css),
  demandes-SITE-PAGES.md (règles réduites), demandes-SITE-ACCUEIL.md (site.css casse un test).
