# DECISIONS-V10 — journal (23 nov. 2026)

Application de docs/v10/DECISIONS.md (mandat du fondateur). Rien de payant ni d'irréversible : aucun produit Stripe créé,
aucun compte ouvert, rien poussé sur GitHub.

## Nouvelle décision (remplace la décision 3 du contrat V3, « aucune offre n'annonce AI Overviews, AI Mode ni Copilot »)
**Décision V10-3** : les aperçus IA de Google (AI Overviews) et Google AI Mode font partie de TOUTES les offres payantes
(Essentiel, Accompagné, Agence) et sont comptés dans leur « N IA » ; Découverte reste à 3 IA (ChatGPT, Gemini,
Perplexity). Copilot (Bing) et DeepSeek sont des options payantes (Accompagné +9 €/mois, Agence +2 €/mois par client),
jamais comptées dans « N IA » ; Grok sur demande. Test : src/lib/__tests__/plans-engines.test.ts (IA annoncées = IA des
droits ; Google dans toutes les offres payantes et pas dans Découverte ; Copilot/DeepSeek seulement « en option »
Accompagné/Agence ; Grok jamais annoncé). Prérequis de mise en ligne : DataForSEO + `AUDIT_SERP_ENGINES=google_aio,google_ai_mode`
avant la première vente (docs/MISE-EN-LIGNE.md § 6 bis).

## Grille finale (prix nets, TVA non applicable)
| Parcours | Découverte | Essentiel | Accompagné (3 mois min.) | À la carte |
|---|---|---|---|---|
| Local | 0 € | 29 €/mois ou 290 €/an — 20 q., 5 IA, chaque mois | 99 €/mois — 30 q., 6 IA, chaque semaine | audit + plan 149 € ; Réseau 79 €/mois (5 établ.) |
| PME | 0 € | 99 €/mois ou 990 €/an — 50 q., 6 IA, chaque mois | 490 €/mois — 100 q., 7 IA, chaque semaine | audit 390 € |
| E-commerce | 0 € | 79 €/mois ou 790 €/an — 50 q., 6 IA, chaque mois | 390 €/mois — 100 q., 7 IA, chaque semaine | audit 390 € |
| Agence | — | 149 €/mois ou 1 490 €/an : 10 clients (30 q., 6 IA, chaque mois) ; +9 €/client au-delà ; hebdo +39 €/client ; Copilot/DeepSeek +2 €/client | | exécution 59 / 230 / 290 €/client |
Découverte : analyse 60 s + test de marque sans inscription, puis 5 questions, 3 IA, chaque mois (3 passages).
Passages : 3 par mesure mensuelle, 2 par mesure hebdomadaire (Accompagné, client Agence hebdomadaire).

## Calcul des marges (src/lib/economics.ts, testé dans src/lib/__tests__/decisions-v10.test.ts)
Coût par réponse (docs/v8/economie-offres.md) : ChatGPT 0,0132 · Perplexity 0,0067 · Gemini 0,0150 · Claude 0,0187 ·
Mistral 0,0306 · AIO 0,0040 · AI Mode 0,0040 · Copilot 0,0021 · DeepSeek 0,0095 €. Coût mensuel = questions × IA ×
passages × mesures/mois (4,33 à la semaine). Autres : plafond données SEO de l'offre + Stripe 1,5 % + 0,25 €.
| Offre | Prix | Réponses/mois | IA | Autres | Marge brute |
|---|---|---|---|---|---|
| Essentiel local | 29 € | 20×5×3 = 300 | 2,57 € | 1,69 € | 85 % (annuel 83 %) |
| Essentiel PME | 99 € | 50×6×3 = 900 | 9,24 € | 4,73 € | 86 % (annuel 83 %) |
| Essentiel e-com | 79 € | 900 | 9,24 € | 4,44 € | 83 % (annuel 80 %) |
| Accompagné local | 99 € | 30×6×2×4,33 = 1 559 | 16,00 € | 11,73 € | 72 % (avec option 9 € : 71 %) |
| Accompagné PME | 490 € | 100×7×2×4,33 = 6 062 | 79,85 € | 17,60 € | 80 % (avec option : 79 %) |
| Accompagné e-com | 390 € | 6 062 | 79,85 € | 16,10 € | 75 % (avec option : 74 %) |
| Réseau (5 établ.) | 79 € | 1 500 | 12,87 € | 6,44 € | 76 % |
| Agence (10 clients) | 149 € | 10×30×6×3 = 5 400 | 55,44 € | 32,49 € (SEO 10×3 €) | 41 % (décision : ≈ 34 % avec 40 € de SEO) |
Client Agence en plus : 9 € pour 5,54 € de mesure + 3 € de SEO au plus. Option hebdo : +10,46 € de mesure pour 39 € (72 %).
Pourquoi l'option Copilot/DeepSeek est payante (9 €) : gratuite, elle ferait tomber Accompagné local à 69 %.
Budget par mesure (défaut `offre`, plafond 25 €) : mesure la plus chère = Accompagné PME/e-com + options ≈ 20,76 € (budget 22,84 €).
Non comptés : travail humain d'Accompagné, hébergement, e-mails, analyses gratuites (plafond 5 €/jour).

## Fait
- Offres : plans.ts (Découverte seule offre gratuite, `*_audit_free` en legacy ; IA de Google dans les lignes « N IA » ;
  Essentiel « chaque mois » ; Accompagné « chaque semaine » ; Agence 10 clients ; Réseau Accompagné « sur devis » au lieu
  de +69 €, sous 70 %) ; `PLAN_ADDONS` (4 options), `AGENCY_INCLUDED_CLIENTS`/`AGENCY_MAX_CLIENTS` (50).
- Droits : entitlements.ts (`runs`, `optionalEngines`, `contentsPerMonth`, options d'espace `entitlements.options` :
  `withOfferOptions`, `setOfferOptions`, `getEntitlementsWithOptions`) ; moteur : `runAudit({ runs })`, file des mesures
  (jobs/platform.ts, handlers.ts) avec options ; `AUDIT_BUDGET_PAID_MODE=offre` par défaut (`fixe` = ancien garde-fou).
- Quotas : contenus 0/2/6/6 (quota.ts lit `CONTENTS_PER_MONTH`, déjà appliqué) ; corrections 20/100/200 n'étaient PAS
  appliquées : `assertWithinPublishQuota` + `countAppliedThisMonth` dans l'API de publication (402, export toujours possible).
- Agence : seoData par espace client 100 mots-clés / 3 € (avant 2 000 / 40 € PAR client) ; /app/agence « 10 inclus ».
- Stripe : scripts/ops/stripe-setup.mjs (option_more_ai par défaut ; Agence et options par client avec `--agence`),
  webhook `charge.refunded` ; docs/MISE-EN-LIGNE.md (§ 5, § 6 bis, budgets, quotas).
- Site : /tarifs refait (3 onglets × 3 paliers, mensuel/annuel, audit et Réseau à la carte, comparatif groupé lu dans
  les droits, Agence à part #agence, FAQ prix 13 questions) ; anciennes ancres (#*_audit_free, #test-gratuit, #comparer,
  #seo-agent) gardées ; redirections 308 /test-gratuit, /audit-gratuit, /audit?plan=*_audit_free → /analyse.
  Landings (3 paliers + à la carte), /agences, /comparatif, /questions, /methode (+ journal V10), llms.txt, JSON-LD
  (Découverte, annuels, options Agence), CGV (prix et quotas lus dans le code, partenaires [À RELIRE]), confidentialité
  (attribution partenaire, candidatures [À RELIRE]), « Test gratuit » → test de marque / Découverte partout.
- Test des prix : src/lib/__tests__/prix-affiches.test.ts (PriceTable, JSON-LD, comparatif, llms.txt, CGV et sources du site).
- Partenaires : src/lib/partners/terms.ts (30/20/20 %, CCI/chambres = atelier, trimestriel, minimum 50 €) ; déduction
  des remboursements (recordPartnerRefund, netBase, clawbackCents, byQuarter) ; contrat docs/v10/contrat-partenaire.md.
- Pilotes : 3 mois d'Accompagné, 10 places 4/3/3 (`PILOT_SLOTS_BY_SEGMENT`, /pilotes par parcours, accord écrit).
- Lancement : docs/lancement (README décisions, plan J-6 Brevo + domaine secondaire, J18 Product Hunt, Meta après seuil
  organique — seuil proposé dans kpi.md : 200 analyses organiques et 10 % d'inscription sur 4 semaines, à ajuster).
- Démos : « entreprise fictive » (badges des maquettes et scènes, barre démo de l'app, rapports démo, PDF, titre de
  /p/<démo>, libellés et sous-titres des vidéos) ; domaines démo en .example (plomberie-martin.fr, paysia.fr et
  maisonsora.fr sont enregistrés par des tiers, vérifié par RDAP AFNIC) ; exemples de saisie génériques.

## Reste / à faire par d'autres
- Vidéos (public/videos/*.mp4) et visuels pub (docs/pub, pub/) : non réenregistrés ; un sous-titre « entreprises
  fictives » est ajouté aux .vtt (0–2,5 s) mais l'image peut encore montrer les anciens domaines .fr et l'ancienne grille
  (Test gratuit, Agence 20 clients) : à refaire (capture.js, render-reels.js, render-statics.js) sur le build V10.
- Fondateur : créer Brevo + domaine d'envoi, Cal.com ; faire relire contrat, CGV et confidentialité par un avocat ;
  `node scripts/ops/stripe-setup.mjs --live` (15 prix) ; DataForSEO + AUDIT_SERP_ENGINES avant la 1re vente.
- Admin : pas d'écran pour activer une option sur un espace (fonction `setOfferOptions` seulement).
- Exécution marque blanche (59 €/mois local) sous 70 % de marge si l'on compte la mesure Accompagné : hors décision.

## Vérification finale (méthode FINALE-V9)
- tsc 0 erreur ; vitest 165 fichiers / 2 378 tests verts ; eslint 0 erreur (43 avertissements préexistants).
- Build de production scratchpad/rc-build (resynchronisé, 2 builds), 4200 relancé par scratchpad/start-4200.sh (ancien :
  start-4200.sh.bak-v9). Sitemap 231 URL toutes en 200 ; title, description, canonical, og:title dans <head> avec GPTBot.
  Redirections 308 vérifiées (/test-gratuit, /audit-gratuit, /audit?plan=local_audit_free). Ancre #pme_audit_free → onglet PME.
- Score du site (268 pages) : SEO 95 / GEO 98 (scratchpad/seo90/audit/v10-final.json) ; restes connus inchangés
  (sameAs/adresse, /a-propos noindex, /p/repere). Titre de /p/<démo> raccourci (≤ 60 car.).
- Captures /tarifs 1440 et 390 (haut, page entière, local annuel, Agence) : qa/v10/ ; aucun défilement horizontal,
  aucune erreur console.
