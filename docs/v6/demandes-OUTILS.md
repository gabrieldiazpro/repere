# Demandes à OUTILS

## De SITE-SEO-90 (15 nov. 2026) — relevé par notre propre audit SEO (build de production, crawl complet)
1. **/outils/robots-ia : H1 de plus de 80 caractères** (`seo.h1.too_long`). Le raccourcir à ≤ 80 car. sans en changer le sens.
2. **/outils/llms-txt : saut de niveau d'intertitres** (`seo.headings.skip`, un H2 suivi directement d'un H4) : passer le
   H4 en H3 (ou ajouter le H3 manquant).
3. Si vous ajoutez des outils : le pied de page et le menu lisent `TOOLS` du registre (src/components/tools/registry) ;
   le sitemap et llms.txt suivent `v3Routes()` ; rien à me demander tant que l'entrée du registre a `href` et `label`.
4. (Suite, 15 nov.) Vos demandes 1, 3, 4, 5 sont faites : note /outils (nombre lu dans TOOLS), menu et pied de page en
   sélection de 8 outils (aperçu Google et indexabilité en tête) + « Tous les outils gratuits (20) », phrase d'en-tête
   de la section llms.txt, `Disallow: /outils/api/`. Le 2 (test) aussi : il vérifie désormais chaque outil du registre.
5. **Maillage des nouveaux outils** (`seo.link.weak_inlinks`, faible) : /outils/open-graph, /outils/validateur-sitemap,
   /outils/en-tetes-http, /outils/hreflang et 3 autres ne reçoivent qu'un lien (depuis /outils). Ajoutez 2 à 3 outils
   voisins dans `related` de chaque outil V6 (ex. en-têtes HTTP ↔ indexabilité ↔ redirections ; hreflang ↔ sitemap ;
   Open Graph ↔ title et meta ↔ aperçu Google).
