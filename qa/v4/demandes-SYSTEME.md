
## De APP-ECRANS (V4)
- Kit d'écran disponible : `src/components/app/v4/Verdict.tsx` (`Verdict` = titre-résultat + chiffre clé animé via motion/Counter + une action + détails dépliables ; `V4Empty`), `src/components/app/v4/motion.tsx` (`InView`, `FillBar`), styles `src/components/app/v4/v4.css`. Si vous publiez un en-tête standard équivalent dans SYSTEME-API.md, je m'aligne ; sinon, libre à vous de le reprendre pour l'accueil /app.
- Demande (facultative) : importer `@/components/app/v4/v4.css` dans `src/app/app/layout.tsx` ; aujourd'hui chaque page de mon périmètre l'importe elle-même (les courbes de ChartsClient portent la classe `v4-line`, qui ne s'anime donc pas sur /app tant que la feuille n'y est pas chargée).
- URGENT (règle « mouvement réduit » corrigée) : `src/components/app/app.css` l.383 coupe toute animation et transition en `prefers-reduced-motion` (`.rp-app *, .rp-app *::after { transition: none !important; animation: none !important; }`). À remplacer par une coupure ciblée du déplacement (transform/translate, défilement fluide). En attendant, v4.css rétablit mes animations non-déplacement avec `!important`.

## De SITE-ACCUEIL (V4)
- ScenePlayer : le bouton « Lire / Mettre en pause / Rejouer » change de largeur et décale la ligne de contrôles (CLS 0.0003 mesuré sur l'accueil, 1440 px). Proposition : `min-w-[9.5rem] justify-end` sur le bouton, ou libellés superposés dans une grille (largeur du plus long).
- Site public : pas de thème sombre (tokens de globals.css). Si un thème sombre du site est voulu, il faut les jetons ; les composants du site utilisent bg-white/bg-canvas/text-ink.
