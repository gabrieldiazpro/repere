# Mission CONTENU (journal : docs/v3/progress/CONTENU.md)

## À lire
- Les 6 teardowns docs/v3/01 à 06-teardown-*.md (prix et fonctionnalités des concurrents, avec leurs sources),
  docs/v3/03-teardown-france.md (§ contenus à produire pour dépasser les concurrents français).
- Code de ton périmètre. Un agent précédent a commencé /comparatif (page + [slug]) : inspecte et termine.

## Périmètre exclusif
src/app/{comparatif,guides,methode,cgv,confidentialite,mentions-legales,geo,glossaire,questions,etudes,a-propos,visibilite-ia}/**,
src/lib/seo/**, src/app/sitemap.ts, src/app/robots.ts, public/llms.txt.

## À livrer
1. **/comparatif** refait avec les teardowns : tableau fonctionnalité par fonctionnalité (suivi, sources, vérification
   des faits, exécution, trafic IA, audit de page, outils gratuits, prix d'entrée, langue, cible), honnête y compris là
   où un concurrent est meilleur ; prix sourcés et DATÉS (« relevé le … »), « non vérifié » quand le teardown le dit ;
   section « Quand choisir un autre outil » ; sous-pages /comparatif/[concurrent] pour les 6 principaux (Peec, Otterly,
   Profound, Meteoria, Qwairy, agence GEO). Publicité comparative : objective, vérifiable, aucun dénigrement.
2. **/methode V3** : questions personnalisées, marge d'erreur, Mistral, indice de demande (méthode de l'estimation),
   carte par quartier (simulation), audit de page (règles publiées), mesure avant/après, limites (pas d'AI Overviews),
   changelog. Page /methode/robot : notre robot RepereBot (user agent, ce qu'il lit, comment le bloquer).
3. **CGV et confidentialité** : offre Découverte gratuite, liens de partage publics, exports, Slack et webhook,
   connecteur Shopify, RepereBot, parrainage, classement opt-in.
4. **4 nouveaux guides** de 1 000 à 1 400 mots, sourcés : « Robots d'IA : lesquels autoriser dans votre robots.txt »,
   « Écrire une page que les IA citent : la méthode en 9 règles », « Fiche produit et IA : ce que ChatGPT lit
   vraiment », « Suivre ses questions dans ChatGPT : par où commencer ».
5. **/glossaire et /questions** enrichis (marge d'erreur, citabilité, part de voix par thème…).
6. **Sitemap et llms.txt** avec toutes les nouvelles routes : /outils/*, /fonctionnalites/*, /demo, /nouveautes,
   /securite, /integrations, /contact, /aide, /cas-usage/*, /inscription, /badge, /classement, /parrainage. Dans
   sitemap.ts, vérifie l'existence des dossiers (fs) pour ne jamais lister une page absente.
