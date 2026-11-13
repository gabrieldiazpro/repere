# Mission MOTION (journal : docs/v3/progress/MOTION.md)

Le site doit passer au niveau des meilleurs sites de logiciels : animations, démonstration du produit, action au
premier écran. Charge le skill frontend-design (outil Skill).

## À lire
- docs/v3/07-design-benchmark.md EN ENTIER : c'est ta spécification (système d'animation, storyboard du hero,
  4 scènes produit, sections nouvelles, 10 écarts).
- qa/v2/regard-client.md (verdicts des 3 personas), docs/v2/07-positionnement.md (copy), docs/01-marque.md (tokens).
- Captures du site actuel : qa/v3/benchmark/ (regarde-en quelques-unes avec Read).
- Code : src/app/page.tsx, src/app/{local,pme,e-commerce}/**, src/components/site/** (ChatScene.tsx est une animation
  déjà codée et inutilisée), src/components/ui/**, src/app/globals.css.

## Périmètre exclusif
src/components/motion/**, src/app/globals.css, src/app/page.tsx, src/app/{local,pme,e-commerce}/**,
src/components/site/** SAUF Header.tsx, HeaderNav.tsx, MobileMenu.tsx, Footer.tsx, nav.ts (à PAGES-SITE).

## À livrer
1. **Système d'animation** dans src/components/motion/ : tokens de durée et d'easing (CSS), primitives sans
   dépendance (CSS + IntersectionObserver + Web Animations API) : Reveal (au scroll, avec stagger), Counter,
   Typewriter, Tilt, Marquee, ScrollProgress, GaugeMorph, ChartDraw (courbe qui se trace), GhostCursor (curseur qui
   « utilise » le produit), Parallax légère. `prefers-reduced-motion` respecté partout ; aucun décalage de mise en
   page (CLS 0) ; composants client les plus petits possibles.
2. **Nouveau hero** de l'accueil : promesse, mini-formulaire ou bouton d'action visible au premier écran sur mobile,
   démonstration produit animée (réponse d'IA qui s'écrit, concurrents surlignés, score qui se calcule).
3. **Bandeau des IA suivies** (ChatGPT, Perplexity, Gemini, Claude, Mistral) en pastilles typographiques — pas de logos.
4. **Grille bento animée** des fonctionnalités (mesurer, sources, vérité, tâches, trafic, copilote, outils gratuits).
5. **4 scènes produit animées** (Mesurer, Comprendre, Agir, Prouver) en HTML/CSS/SVG, états et timing de la spec.
6. **Composant `DemoVideo`** (src/components/motion/DemoVideo.tsx) : props `{ id: 'hero'|'mesurer'|'comprendre'|'agir'|'prouver'; fallback: ReactNode; caption?: string }` ;
   lit `/videos/<id>.mp4` et `.webm`, poster `/videos/<id>.jpg`, autoplay muet en boucle quand visible, pause hors
   écran, bouton lecture/pause accessible ; si le fichier n'existe pas (vérification côté serveur avec fs) → `fallback`.
7. **Mur de preuves honnêtes** : méthode ouverte, marge d'erreur publiée, garanties, données conservées, chiffres
   sourcés. Aucun faux client, aucune note inventée.
8. **Landings /local, /pme, /e-commerce** refaites avec ces briques (scène adaptée au parcours, exemples de questions).
9. Liens vers /demo, /outils, /fonctionnalites, /inscription (pages créées par d'autres agents).
Tu ne peux pas lancer de serveur : sois rigoureux, un contrôle visuel suivra. Vérifie tsc par le verrou.
