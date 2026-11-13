# SITE-ACCUEIL — journal V4

**Fait**
- Captures avant/après (1440 et 390, clair ; accueil aussi en sombre) : qa/v4/SITE-ACCUEIL/avant|apres/. Le site public n'a pas de thème sombre : captures sombres = claires (demande à SYSTEME).
- Accueil : HomeHero (onglets à indicateur glissant, un seul appel « Tester gratuitement ») + StoryScene « Absent, puis cité » (vraies réponses des comptes démo, 1re puis 6e mesure, score qui monte) ; schéma AnswerPath (question → IA → sources → réponse → vous) ; Méthode en 4 onglets avec vidéos (VideoShowcase : affiche, aperçu au survol, clic, plein écran) ; parcours en onglets ; marge d'erreur illustrée (ProofWall) ; bloc des 4 constats remplacé par le schéma.
- En-tête : trait de l'onglet actif, CTA visible sur mobile, menu mobile animé (burger → croix, cascade). Pied : colonnes rangées, guides à part, barre légale avec /dpa.
- /tarifs : sélecteurs glissants (parcours, mensuel/annuel), prix en fondu, « Recommandé pour … », comparatif mobile palier par palier, FAQ animée, circuit Accompagné en 3 étapes.
- /local /pme /e-commerce : carte de quartier, matrice concurrents × IA, produits cités + StoryScene. /demo : vidéos mises en valeur.
- Mouvement réduit : StoryScene, HeroScene, ChatScene, ScoreGauge jouent (fondus, écriture, compteurs) ; vérifié Playwright (reduce : score 18 → 61).
- CSS du site : site-css.ts injecté par Header en <style> React (pas d'import .css : cassait vitest via PostCSS).
- Données : demoHeroStory, demoCompetitorMatrix, demoLocalMap. Tests : __tests__/v4-site.test.tsx. tsc + vitest (site, motion, app) : 173/173.
- LCP/CLS : qa/v4/SITE-ACCUEIL/vitals.txt (pas de régression nette ; LCP = H1 serveur ; CLS 0 sur mobile, 0.0003 bureau venant de ScenePlayer).

**À faire par d'autres** : SYSTEME — largeur fixe du bouton de ScenePlayer (CLS 0.0003) ; thème sombre du site public si voulu (qa/v4/demandes-SYSTEME.md).
