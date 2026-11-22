# FINALE-V8 — journal (22 nov. 2026)
## Fait
- Site : accueil « Votre marque est-elle citée par les IA ? » + « Tester ma marque » + « Gratuit, sans carte bancaire » (héros,
  menu, tarifs, pied) ; liste des 10 IA mesurables avec méthode (src/components/site/ai-coverage.ts, lue dans PROVIDER_LABELS,
  providerMethod et getEntitlements ; IA hors offres = « en option », Grok « sur demande », jamais comptées dans « N IA »)
  sur accueil (AiStrip), /methode (#chaque-ia), /comparatif (#ia-couvertes), /tarifs (#ia-mesurables), /agences.
  Test plans-engines inchangé et vert. Textes faux corrigés (aperçus IA « non mesurés », Le Chat → Mistral Vibe, comparatifs
  par concurrent, CGV, llms.txt, FAQ accueil, Réglages…). Semji non nommé : sa page anglaise (semji.com/geo) annonce
  ChatGPT, Perplexity, AI Overviews, AI Mode, pas 7 IA ni « sans carte » → comparaison générique sans nom.
- Nouvelles pages : /agences (gabarit des landings, liste d'attente réelle, prix lus dans la grille), /fonctionnalites/agent-de-contenu.
  Menus, pied, sitemap (PAGE_UPDATED), llms.txt : test de marque, agent de contenu, simulateur, Magento/WooCommerce/Wix,
  /developpeurs, /agences ; /e-commerce (plateformes en texte, bloc simulateur, FAQ Magento) ; /integrations (publication, API et MCP).
- Technique : `api` dans Entitlements (publicapi/access.ts le lit) ; Réglages → /app/reglages/api + liste dynamique des IA
  (verrou.engineAccess sur ALL_PROVIDERS, « en option » / « mesurée en plus ») ; .env.example + env.ts : ANALYSIS_* (4),
  CONTENT_WRITER, PUBLIC_API_KEY_PEPPER, PUBLIC_MCP_ALLOWED_ORIGINS, NEXT_PUBLIC_PRESS_EMAIL, PILOTS_NOTIFY_EMAIL,
  AUDIT_BUDGET_PAID_MODE / _MAX_EUR (check-env vert) ; /admin/roi : dépense DataForSEO des relevés d'IA (roi.serpai) ajoutée
  aux autres appels ; santé : aiOptional (deepseek, grok, aio, ai mode, copilot) ; export CSV : une note par IA (10) ;
  mesures J+30/J+90 des contenus dans le cron quotidien (src/lib/content/scheduled.ts) ; notify.test daté → horloge figée ;
  rank / demo-figures : premier calcul des comptes démo (≈ 3,5 s) déplacé dans beforeAll (cause des délais dépassés).
- Économie : docs/v8/economie-offres.md (coût par IA, 3 scénarios, recommandation S2 + Agence restructurée) ;
  AUDIT_BUDGET_PAID_MODE=offre (désactivé par défaut) dans engine/audit.ts, testé (src/lib/__tests__/finale-v8.test.ts).
- Corrigé en route : build de production cassé par AGENT-CONTENU (Journal.tsx, composant client, importait
  lib/content/journal.ts → node:crypto/fs) : libellés déplacés dans lib/content/journal-labels.ts. /analyse : titre
  absolu (64 → 55 car.), description ≤ 160, H1 distinct de l'accueil ; /inscription description ≤ 160 ; « tarifs 2024 »
  (outil fraîcheur) reformulé ; espaces insécables (H1 accueil, /developpeurs, guillemets du comparatif, /methode).
## Vérifications (22 nov., fin)
- tsc 0 erreur ; vitest complet 153 fichiers / 2 242 tests verts ; eslint 0 erreur ; check-env vert.
- Build de production scratchpad/rc-build (resynchronisé), serveur 4200 relancé par scratchpad/start-4200.sh (mis à jour,
  ancien : start-4200.sh.bak-rc15). Sitemap : 203 URL toutes en 200, title/description/canonical/og:title dans <head> avec
  GPTBot sur toutes. Score du site (méthode SITE-SEO-90, 233 pages) : SEO 95 (brut 96,75) / GEO 99
  (scratchpad/seo90/audit/v8-final.json). Restes : sameAs/adresse (entité), /a-propos noindex (fondateur).
- Navigateur (un Chromium, dsf 1, 1440 et 390) : accueil, /analyse rejouée (rich.ndjson), inscription libre démo → arrivée
  dans l'app, /app/contenu, /app/agent (Magento, Wix), /app/ia (démo PME : 8 IA + Mistral), Réglages, simulateur,
  /developpeurs, /agences, /tarifs, /methode, /comparatif, /e-commerce, menu mobile : aucun débordement, aucune erreur
  console. Captures : qa/v8/FINALE/.
## Reste au fondateur
- Décider : IA de Google dans les offres (plans.ts + entitlements + test), Essentiel mensuel, passages par offre, Agence 10 clients.
- Repointer les annonces agences vers /agences ; pixel Meta après bandeau de consentement.
- Publicité : capture.js, render-reels.js all, render-statics.js, contact.js relancés sur 4200 à jour (6 reels, 12 visuels,
  planche pub/planche.png relue). « DÉBORDE: IMG » sur s4, p3, p4 = captures rognées par leur cadre (voulu, rendu correct).
  annonces.md et JOURNAL pub : agences → /agences.
- Rien poussé sur GitHub.
