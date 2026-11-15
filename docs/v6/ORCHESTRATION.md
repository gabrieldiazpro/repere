# Orchestration V6 (nuit du 15 nov.)
- WIX : livré (clé API compte Wix ; SEO pages/blog/produits, 301, robots/llms auto ; alt, FAQ, textes, sitemap guidés).
  Bing Places : pas d'API publique → carte guidée. Mode app Wix (WIX_APP_ID/SECRET) codé mais inactif (identifiant
  d'installation non branché). À vérifier sur vrai site Wix.
- OPS : livré (/api/health, /api/health/deep, erreurs groupées, alertes e-mail 6 cas, plafond de coûts 10 €/j, /statut,
  /admin/ops, sauvegarde chiffrée, étape 15 du guide). Lien /admin → /admin/ops ajouté par l'orchestrateur. Restent chez
  SITE-SEO-90 (sitemap/pied de page /statut, rapporteur client, global-error) et AGENCES (MesureError). Limite : tâches
  urgentes immédiates hors garde-fou.
- GEO-MARQUE : livré (5 pages /questions ciblées, étude « pourquoi les IA recommandent une marque », glossaire 53, questions 35 ;
  kit docs/visibilite-repere : textes d'identité, 22 profils, médias, 30 questions suivies). 12 demandes à SITE-SEO-90.
  À reprendre en passe finale : src/lib/house.ts (faits Repéré obsolètes : « Audit gratuit », pas de SEO) ; tests en échec
  attendus des autres agents (outils 9→20, deux boutons d'envoi dans le haut de l'accueil).
- GUIDES : livré (20 guides, catalogue 13→33, 5 SVG, test 64/64). Demandes SITE-SEO-90 : afficher GUIDE_V6_FIGURES,
  liens [texte](/chemin) dans le corps, /guides par grappes.
- LANCEMENT : livré (/pilotes + candidature, /admin/pilotes avec J0/J30/J90 réels, /presse, docs/lancement). Décisions
  fondateur : offre pilote 3 mois Accompagné, répartition 4/3/3, infos fondateur, outil d'envoi, Product Hunt, relecture
  juridique des pieds d'e-mails. Orchestrateur : correctif Origin null reporté sur /admin/messages. À revérifier en build :
  /app/seo démo PME sans CSS (vu 2 fois en dev).
- OUTILS : livré (9→20 outils, hub /outils en 5 étapes, endpoints src/app/outils/api/). Reste chez SITE-SEO-90 : note
  /outils de routes.ts, content.test.ts (9→20), phrase llms.txt, Disallow /outils/api/.
- AGENCES : livré (/app/agence multi-clients, marque d'agence unique, domaine d'envoi Resend, /app/validation accès client,
  entitlements agency 20 clients, démo demo-agence). Restent : API publique, portail domaine agence, PDF serveur ;
  CGV/confidentialité (domaine d'envoi, client valideur) ; vente Agence en liste d'attente = décision fondateur.
- ROBUSTESSE : livré (~70 faux sites difficiles, 10+ bugs corrigés dont blocage serveur 58 s, notes mensongères sur sites
  non lus, 429, encodages, sitemaps tiers, IPv6 ; diagnosis/platform dans SiteCrawl ; access dans FullAnalysis ; rendu JS
  CRAWL_RENDER=off). Restent : afficher access (SITE-SEO-90), garde dans app/seo/actions.ts et /api/v5/seoaudit|geo.
  Orchestrateur : garde d'accès ajoutée dans app/seo/actions.ts (+ 1re étape dans le toast), /api/v5/seoaudit et /api/v5/geo (422 unreadable). Tests 284/284.
- SITE-SEO-90 : livré — SEO 55→95, GEO 96→99 (198 pages, build prod). Restes : demandes-OUTILS/GUIDES/GEO-MARQUE/
  LANCEMENT/EXECUTION (petits points), sameAs vide, /a-propos noindex tant que l'identité légale manque.
## Vague 3 : REGARD-CLIENT (tout le dépôt, après la fin des autres agents)
- Vague 3 terminée ; vidéos réenregistrées ; GitHub fe1dafc ; dossier Docs V6 ; archive repere-v6.zip (15 nov.)
