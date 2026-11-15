# REGARD-CLIENT — journal (15 nov. 2026)
Build de production dans scratchpad/rc-build (port 4300, scratchpad/rc/start-4300.sh). Scripts : scratchpad/rc/audit.py,
journey_local.py, hyd.py.

## Étape 1 — restes soldés
- [x] OUTILS 5 : 11 outils V6 reliés à 1–3 outils voisins (`related`).
- [x] GUIDES 5 : 3 alt ≤ 125 car. (guides-v6.ts).
- [x] GEO-MARQUE 1 : title SEO « Pourquoi une IA recommande une marque : les études » ; H1 78 car.
- [x] LANCEMENT 1 et 3 : /presse, captures `unoptimized` (fichiers d'origine, plus d'optimiseur en 400), 1re en eager
  (pas de `priority` : image sous la ligne de flottaison, un préchargement ralentirait le vrai LCP).
- [x] EXECUTION 1–3 : services en `Service` dans OfferCatalog (plus d'Offer vide) ; Product sans image ni prix non émis ;
  hostedPageUrl = SITE_URL (jamais localhost en production).
- [x] AGENCES MesureError : déjà fait par AGENCES.
- [x] house.ts aligné sur le kit (docs/visibilite-repere/01-textes-identite.md) et plans.ts.
- [x] /app/seo démo PME sans CSS : non reproduit en build (voir plus bas).

## Étape 2 — frictions trouvées (gravité) et corrections
1. Erreur d'hydratation React sur l'accueil (formulaire DemoEntry dans un <p>) → <div>. CORRIGÉ.
2. Deux portes « gratuites » incohérentes : les CTA éditoriaux (8 pages : questions, comparatifs, études, glossaire, GEO)
   menaient au vieux test IA /audit (5 champs) alors que tout le site promet l'analyse 60 s /analyse → CTA vers /analyse,
   /audit en lien secondaire « Pas de site ? ». CORRIGÉ.
3. Rapport d'analyse : « cette analyse y est rattachée » faux si aucun e-mail n'a été saisi → phrase vraie (site réanalysé
   chaque mois, gratuit). CORRIGÉ.
4. Priorités en doublon (téléphone absent compté côté Google ET côté IA) → groupes de constats équivalents, une seule place. CORRIGÉ + test.
5. Verdict-titre du rapport en une phrase de 200 car. → deux phrases. CORRIGÉ.
6. Offre Découverte décrite partout comme « 5 questions IA » alors qu'elle inclut l'analyse + audit SEO/GEO mensuels
   (entitlements) → ligne ajoutée (plans.ts, bandeau /tarifs, /inscription). CORRIGÉ.
7. /inscription en environnement sans auth : impasse (« configuration incomplète ») → message clair + compte démo + pilotes. CORRIGÉ.
8. /audit : « Trois informations suffisent » puis « 1 sur 5 informations obligatoires » → libellés cohérents. CORRIGÉ.
9. Comparatifs : « mis à jour le 9 nov. » au-dessus de prix « relevés le 13 nov. » ; phrases internes (« depuis notre
   environnement ») → dates alignées sur le relevé (Byline, OG, JSON-LD), formulations clients. CORRIGÉ.
10. /tarifs : « Les mêmes prix qu'avant » (jargon interne), « Par L'équipe » → corrigés.
11. App démo PME /app/seo : « 154 contrôles Google » alors que le site promet 185 → « 154 contrôles applicables à votre
    type de site (sur 185) ». CORRIGÉ.
12. Pages « Comment / Connexion » sans auth : « configuration incomplète » → message client. Ordinal « (1e) » → « 1er ».
    Espaces insécables dans l'aperçu du hero (« : » et « » » orphelins en début de ligne). CORRIGÉS.
13. Démo agence : « À valider » de Maison Sora (cosmétiques, Lyon) montrait « artisan à Exempleville » sur
    exemple-demo.fr, et 1 proposition contre 3 dans l'écran Agent → mêmes propositions que l'écran Agent (validation et
    tableau multi-clients). CORRIGÉ.
14. Démo Agent / À valider : balisage proposé affiché avec deux balises <script> imbriquées → une seule. CORRIGÉ.
- /app/seo démo PME sans CSS : NON reproduit en build (chargement direct et navigation client ×3, 868 règles CSS) :
  artefact du serveur de dev. Clos.
- Hydratation /statut (#418 vu une fois en prod) : non reproduit (3 essais, dev sans erreur). À surveiller.
- Vérifiés sans défaut : 35 pages × 2 largeurs (statut 200, pas de débordement à 390, H1 unique, images avec alt),
  168 liens internes en 200, parcours clavier (lien d'évitement, focus visible), 19 écrans de l'app sur 4 comptes démo.

## Étape 3 — face à Semrush, Ahrefs, Peec, Otterly (relevé du 15 nov. 2026)
Sources : https://peec.ai/pricing ; https://ahrefs.com/pricing ; https://help.otterly.ai/pricing-of-otterlyai ;
https://www.stylefactoryproductions.com/blog/semrush-pricing (juillet 2026 ; semrush.com et otterly.ai/pricing non
lisibles depuis la machine).
- Ce qu'ils font mieux : 3 ou 4 offres lisibles d'un coup d'œil (Peec : Starter/Pro/Advanced/Enterprise, mêmes
  fonctions, volumes croissants ; Ahrefs : Lite→Advanced + tableau « Compare plans ») ; essai immédiat en libre-service
  (Otterly sans carte ; Semrush 7 jours) ; preuves sociales (Peec : « 4 000+ marques », logos, 6 témoignages, G2 4,7/5),
  sécurité affichée (Peec : SOC 2 Type II, DPA) ; API/MCP (Peec dès Pro).
- Ce qui nous fait paraître moins sérieux : (a) grille /tarifs dense : Découverte 0 € + « Test gratuit » 0 € + audit
  payant + Essentiel + Accompagné × 3 parcours + Réseau + Agence (≈ 15 prix) contre 4 chez Peec ; deux offres gratuites
  au nom différent sur la même page ; (b) aucune identité légale visible (/a-propos en noindex, fondateur non nommé,
  SIREN absent) ; (c) aucun client ni avis (assumé et dit honnêtement : bien, mais il faut des pilotes) ; (d) pas
  d'inscription ouverte sur le serveur de démonstration ; (e) pas d'API ni de MCP (Peec en a).
- Ce qui nous distingue vraiment (déjà bien dit) : 0 € permanent, français, SEO + IA dans le même outil, corrections
  publiées après validation, marge d'erreur affichée.

## Pour le fondateur (non modifié : prix et offres)
1. Fusionner « Test gratuit » (test IA par nom, /audit) et « Découverte » en une seule porte gratuite : l'analyse 60 s
   + compte Découverte ; garder le test par nom seulement pour qui n'a pas de site. Supprimer la colonne « Test » du
   tableau des prix.
2. Envisager 3 paliers visibles par parcours (Découverte, Essentiel, Accompagné) et déplacer audits ponctuels, Réseau et
   Agence sous la grille (« Autres formules »).
3. Publier l'identité légale (NEXT_PUBLIC_LEGAL_*, fondateur) puis retirer le noindex de /a-propos.
4. Ouvrir l'inscription (Supabase/Resend) avant toute campagne : sans elle, le bouton « Corriger avec Repéré » mène
   à un compte démo.
5. Premiers pilotes → premiers témoignages (avec accord écrit), seul vrai manque face à Peec.
6. API publique en lecture (déjà demandée par AGENCES) : argument agences.

## Restes (non faits cette nuit)
- Guides locaux (ex. /guides/seo-local-et-ia) : aucun lien vers les outils gratuits dans le corps (le parcours
  guide → outil passe par le menu). À ajouter par GUIDES (liens [texte](/outils/…)).
- « Belgique . » (espace avant le point) dans une fiche produit démo Maison Sora (faits démo).
- Hydratation /statut vue une fois : à surveiller dans /admin/ops.
- Décisions fondateur : voir la liste ci-dessus (fusion des offres gratuites, grille à 3 paliers, identité légale,
  ouverture des inscriptions, témoignages pilotes, API).

## Étape 5 — vérifications finales (15 nov.)
- tsc : 0 erreur ; eslint --quiet : 0 erreur ; vitest complet : 139 fichiers, 1 981 tests verts (puis sous-ensembles
  agence/agent/analyse relancés après les dernières retouches : verts).
- next build vert (scratchpad/rc-build, 399 pages).
- Sitemap : 168 URL, toutes en 200 ; <title>, meta description et canonical dans le <head> avec un user-agent GPTBot : 168/168.
- Serveur de production démo : port 4200 (scratchpad/start-4200.sh pointe désormais sur scratchpad/rc-build ;
  ancienne version : start-4200.sh.bak-rf).
