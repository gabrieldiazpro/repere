# PILOTE-AUTO — journal (23 nov. 2026)

Demande du fondateur : « une option de travail 100 % déjà fait en contactless ». Décisions déléguées (« le plus efficace
et adapté au marché »). Rien de payant ni d'irréversible : aucun produit Stripe créé, rien poussé sur GitHub.

## Décision : une offre « Pilote automatique » par parcours (et pas une option d'Accompagné)
- **Local 59 €/mois, PME 179 €/mois, E-commerce 159 €/mois**, mensuel, sans engagement. = droits de l'Essentiel du
  parcours (mesure mensuelle, 20 séries de corrections et 2 contenus par mois) + application automatique sous mandat,
  récapitulatif hebdomadaire, rapport mensuel, support écrit. Positionnement : « Tout fait pour vous, sans rendez-vous ».
- Pourquoi pas une option sur Accompagné : Accompagné local est déjà à 72 % de marge ; le coût du pilote au plafond
  (100 séries + 6 contenus + e-mails) le ferait passer sous 70 % (≈ 65–68 %). Et Accompagné vend autre chose (équipe,
  fiches Google, avis, visio). Pourquoi une offre plutôt qu'un supplément Stripe sur Essentiel : un seul prix par
  abonnement = paiement en libre-service et webhook inchangés (plan = essentiel, planId = l'offre), pas de mélange
  mensuel/annuel dans un abonnement Stripe.
- Marché (relevé le 23 nov. 2026) : agences françaises « clé en main » de visibilité locale à partir de 90 €/mois (Otalone),
  99 €/mois (IBIKKO, fiche Google), 120–160 €/mois (Viselo) ; SEO généraliste pour petites structures 190–690 €/mois
  (Xdesigns, Anetmo 200 €, Mathieu Mari 290 €) — https://www.lafabriquedunet.fr/seo/articles/cout-referencement-naturel-tarifs-seo/
  (tarifs affichés par les agences, relevés par La Fabrique du Net). BabyLoveGrowth (tout automatique, articles) :
  le brief cite 99–299 $ ; page tierce consultée : Grow 49 $, Scale 199 $/mois — https://ecommerceparadise.com/babylovegrowth-pricing/
  (non vérifié sur le site de l'éditeur). Local à 59 € : sous l'entrée de gamme des agences locales ; PME 179 € et
  e-commerce 159 € : dans la fourchette des outils automatiques, sous les agences, loin sous Accompagné (490/390 €).

## Marges (src/lib/economics.ts `autopilotMargin`, testé ≥ 70 % dans src/lib/autopilot/__tests__)
Coûts au plafond de l'offre : mesure (Essentiel), données SEO, Stripe 1,5 % + 0,25 €, série 0,025 € (rédaction ≈ 10
textes + relecture ciblée), contenu 0,15 €, 12 e-mails à 0,001 €, **support écrit provisionné 3 € (local) / 5 € (PME,
e-commerce) par mois** (seul temps humain compté). Local : 59 − 2,57 − 1 − 1,14 − 3,81 ≈ 50,5 € (**86 %**) ; PME :
179 − 9,24 − 3 − 2,94 − 5,81 ≈ 158 € (**88 %**) ; e-commerce : 159 − 9,24 − 3 − 2,64 − 5,81 ≈ 138 € (**87 %**).

## Garde-fous (src/lib/autopilot)
- Mandat écrit (mandate.ts) : 8 catégories (titres, descriptions, alt, données structurées issues de la fiche, llms.txt,
  robots.txt IA, redirections 301 des pages cassées, contenus) ; défauts prudents (robots.txt et redirections décochés) ;
  métier réglementé (regulated.ts) : aucune catégorie rédactionnelle. Preuve : texte exact, version
  `mandat-pilote-v1-2026-11-23`, SHA-256, horodatage serveur, signataire, empreinte IP (store.ts). Pause, re-signature,
  révocation en un clic. Texte et CGV 5 bis marqués « à relire par un avocat ».
- Jamais (policy.ts, testé) : suppression, prix (montant nouveau dans « après », clés JSON-LD offers/price/review),
  pages juridiques ou d'avis, canonique/noindex/sitemap/fiche Google, réécriture de passage, FAQ, « [à compléter] »,
  export, données structurées dont une valeur n'est pas dans la fiche officielle confirmée, redirection d'une page non
  cassée, robots.txt autre qu'un ajout d'autorisations. Une série n'est jamais appliquée en partie.
- Contenus : création seulement (pas de page tarifs), faits tous vérifiés dans la fiche officielle confirmée, contrôles
  tous passés, pas de cannibalisation forte, pas de prix ; brouillon chez le client, e-mail « Bloquer », mise en ligne à
  +72 h par le balayage quotidien si mandat toujours actif et contrôles toujours bons.
- Validation sous mandat dans les services (double garde, mandat relu dans le stockage) : publish/service.ts
  `validateChangeSetUnderMandate`, content/service.ts `validateDraftUnderMandate` + `assertHumanOrMandate` ;
  `validateChangeSet` / `validateDraft` refusent toujours l'acteur « mandate ».
- Plafonds de l'offre (countAppliedThisMonth, quota de contenus) ; au plus 5 séries par passage.
- Arrêt automatique : score SEO ou GEO en baisse de plus de 5 points à l'analyse suivante une série → mandat en pause
  (raison « guard »), alerte critique + e-mail avec « Annuler cette série » ; reprise seulement par le client.
- Journal chaîné `autopilot.journal` (+ journal immuable de publication pour l'avant/après) ; liens signés d'e-mail
  (tokens.ts, 30 j) ouvrant une page de confirmation /pilote/action (POST, jamais d'action sur un GET).

## Parcours 100 % sans contact
/tarifs (bandeau par parcours, ancre #pilote-automatique) ou /tout-fait-pour-vous → activité → plateforme → **ce que le
pilote fera seul, dit avant le paiement** (components/site/pilote-data.ts, d'après les connecteurs réels ; « Autre » :
pas de vente, Essentiel proposé) → case professionnelle → Stripe (/api/checkout, inchangé) → /merci « Démarrer le pilote »
→ /app/agent/pilote : connexion (assistant existant), fiche officielle pré-remplie à confirmer (/app/fiche), mandat
(signature → première analyse en file) → c'est parti. Récapitulatif du lundi + rapport du mois (recap.ts, effets avec
marge ±5), cron quotidien /api/pilote/cron (vercel.json 12 7 * * *), support écrit (/contact, /aide).

## Fait (fichiers)
- Offre : plans.ts (3 offres, `isPilotePlanId`, `pilotePlanFor`), docs/v2/07-plans-v2.json, entitlements.ts
  (`autopilot`), economics.ts, notify (type `autopilot`), email.ts (`sendAutopilotEmail`), stripe-setup.mjs (en-tête ;
  prix créés par soldPlans), docs/MISE-EN-LIGNE.md (18 prix).
- Moteur : src/lib/autopilot/** (mandate, policy, store, runner, recap, tokens, sources, actions, demo), branché dans
  analysis/job.ts (avant l'agent de publication). API : /api/v5/autopilot, /api/pilote/action, /api/pilote/cron.
- App : /app/agent/pilote (onglet de l'agent + entrée de menu) : état et pause d'un clic, arrêt automatique, mise en
  route, « ce que le pilote a fait cette semaine » avec Annuler, contenus en relecture avec Bloquer, mandat (catégories,
  jamais, signature, preuve, texte signé), journal. Démo étiquetée, simulée dans le navigateur.
- Site : /tout-fait-pour-vous (fait seul / jamais / mandat / annulation / déroulé / exemple démo étiqueté / plateformes /
  commencer / FAQ, JSON-LD Service + Offer + FAQ), /tarifs (bandeau, FAQ, garanties, tableau, comparatif), JSON-LD Offer
  (`displayedPlans`), menu Produit + pied de page, accueil et /local /pme /e-commerce (une ligne), llms.txt, sitemap
  (PAGE_UPDATED), CGV 5 bis (ancre #pilote-automatique, texte à relire), /merci.
- Tests : src/lib/autopilot/__tests__/autopilot.test.ts (32), prix-affiches (Pilote automatique), plans-checkout.

## Reste au fondateur
- Faire relire par un avocat le mandat (src/lib/autopilot/mandate.ts `mandateText`) et la section 5 bis des CGV.
- `node scripts/ops/stripe-setup.mjs --live` (18 prix dont les 3 du pilote) ; `AUTOPILOT_SIGNING_SECRET` (sinon
  DIGEST/AUDIT_SIGNING_SECRET) ; `AUTOPILOT_ENABLED=0` coupe tout.
- Recaler les coûts du pilote et la provision de support écrit sur les premières factures et le temps réel passé.
- À confirmer sur de vrais sites : création de contenus sous mandat (mêmes points que AGENT-CONTENU), reconnexion
  Shopify avec write_content.

## Vérification finale (méthode FINALE-V9)
- tsc 0 erreur ; vitest 166 fichiers / 2 416 tests verts ; eslint 0 erreur (43 avertissements préexistants).
- Build de production scratchpad/rc-build (resynchronisé par scratchpad/pilote/build.sh), 4200 relancé par
  scratchpad/start-4200.sh. Sitemap 232 URL toutes en 200, title/description/canonical/og:title/RSS dans <head> avec
  GPTBot ; llms.txt cite /tout-fait-pour-vous et les prix du pilote.
- Score du site (272 pages) : SEO 95 / GEO 98, brut 96,76 comme en V10 (scratchpad/seo90/audit/pilote-final.json).
  Corrigé en route : JSON-LD Offer du pilote sur /local /pme /e-commerce sans prix visible → prix affiché dans la ligne.
- Navigateur 1440/390 : 10 pages + bandeau /tarifs + parcours (plateforme « Autre » : paiement désactivé ; WordPress →
  /merci?demo=1&plan=local_pilote_month) + app démo (Annuler, Bloquer simulés) : aucun défilement horizontal, aucune
  erreur console (une erreur d'hydratation corrigée : <details> dans un <p>). Captures : qa/v10/PILOTE-AUTO/ (30).
