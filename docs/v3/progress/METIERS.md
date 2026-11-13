# Journal METIERS (src/app/app/{local,produits}/**, src/components/app/metiers/**) — mission terminée
## Fait (21 tests verts, tsc propre sur le périmètre, 2/2 lancés)
- Socle metiers/ : context.ts (loadMetier), logic.ts (pur), ui.tsx, client.tsx (api, useLocalState, Notice), Verrou de la coquille.
- Local : /app/local (→ fiche-google), fiche-google (score, priorités, critères, source, saisie guidée), carte (SVG cliquable, simulation expliquée, budget, relance), annuaires (NAP, URL à vérifier, « s’inscrire »), avis (kit lien/QR/modèles, thèmes, brouillons, calendrier de posts), /app/local/posts?post= → avis#posts.
- E-commerce : /app/produits (catalogue, score de fiche, cités par question, ajout/import), revendeurs, prix-avis, ventes (CA par IA, Shopify réel, livrables FAQ/guide/JSON-LD), /app/produits/shopify (retour OAuth).
- Démo : modifications gardées sur l’appareil avec mention « démo ». data-visite : local, local-fiche, local-carte, produits, ventes.
## Non fait
- Score de fiche des produits réels : seulement après « Analyser » (pas d’audit réseau au rendu).
## Variables d’environnement nouvelles : aucune.
## À faire par d'autres
- Orchestrateur (ECOMMERCE fini) : src/app/api/ecommerce/shopify/callback/route.ts `back()` → `${base()}/app/produits/shopify?shopify=${status}` (ou COQUILLE : rediriger /app/reglages?shopify=* vers cette page).
- COQUILLE : ajouter /app/produits/prix-avis au menu (nav.ts) ; /app/local pointe sur la fiche Google (data-visite="local" y est posé).
- ACTION : /app/copilote doit lire `?context=` (liens « Demander au copilote » des écrans métiers).
