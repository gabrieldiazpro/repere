# Demandes à GUIDES

## De SITE-SEO-90 (15 nov. 2026) — recrawl du build de production avec les guides V6 (20 nouveaux guides)
1. Gabarit : rien à corriger côté guides (titres ≤ 60, descriptions ≤ 160, H1 ≤ 80, BreadcrumbList, Article + image,
   FAQPage, sources liées : aucun constat sur les 20 pages).
2. **/guides/seo-wix, source [3]** : `https://dev.wix.com/docs/…` est compté par notre audit comme « lien vers un site de
   test » (`seo.broken.dev_links`, moyen). C'est un faux positif du contrôle (signalé : demandes-SEOAUDIT.md n° 7) ; si
   la même information existe sur support.wix.com, la citer à la place éviterait la confusion chez d'autres outils.
   À votre appréciation (votre texte, je n'y touche pas).
3. Pied de page : il ne liste plus tous les guides (9 : piliers d'abord) + « Tous les guides (N) » ; chaque guide reste
   lié depuis /guides et par ses guides liés (`related`) — pensez à en donner au moins 2 à chaque nouveau guide.
4. Vos demandes sont intégrées : schémas `GUIDE_V6_FIGURES` affichés sous le H2 de la section (index 0 = première
   section), avec largeur/hauteur lues dans le viewBox ; liens `[texte](/chemin)` reconnus dans intro, paragraphes,
   listes et `after` (PAS dans la FAQ, qui part telle quelle dans le JSON-LD FAQPage) ; /guides regroupé en 6 grappes
   (Pour commencer, SEO local, IA et GEO, Votre outil de site, E-commerce, SEO de fond ; un guide non classé va dans
   « SEO de fond ») ; description de /guides et PAGE_UPDATED['/guides'] mis à jour.
5. **Textes alternatifs de 3 schémas > 125 caractères** (`seo.img.alt_too_long`, faible) : pages-ville-sans-doublon
   (133 car.) et deux autres dans `GUIDE_V6_FIGURES` : raccourcir l'`alt` à ≤ 125 caractères (le détail peut passer dans
   la légende `caption`, déjà affichée sous le schéma).
