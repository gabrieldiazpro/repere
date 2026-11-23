# FINALE-V9 — journal (23 nov. 2026)
## Intégré (demandes-SITE V9)
- « Réserver une démo » à côté de l'appel principal, jamais à sa place : accueil (héros, `?offre=accompagne&segment=<onglet>`),
  /tarifs carte Accompagné des 3 parcours (`&segment=`) et carte Agence (`?offre=agence`), carte Partenaire → « Devenir
  partenaire » `/partenaires#candidature` ; /agences (héros, carte Agence ; carte Partenaire → `/partenaires#agences` ;
  FAQ partenariat → /partenaires) ; /pme (SegmentLanding `demoHref`). Aucun prix ni offre modifié.
- Menus (nav.ts) : Produit + Fiche officielle, Scénarios ; Solutions + Programme partenaires ; Ressources + Veille Google
  et IA, Guide 2027. Pied de page : Partenaires, Réserver une démo (colonne marque), Fiche officielle, Scénarios,
  Ressources gratuites, Lettre mensuelle, Flux RSS ; formulaire de lettre compact (variante `dark` de NewsletterForm,
  double opt-in inchangé). Guides : formulaire après la FAQ + lien vers la veille.
- Nouvelles pages (gabarit /fonctionnalites/[slug]) : /fonctionnalites/fiche-officielle (exemple lié /p/plomberie-martin,
  limites : aucune garantie de reprise par une IA, indexation sur accord) et /fonctionnalites/scenarios (« ne prédit ni
  positions ni citations », aucun trafic estimé). Lien « avec Repéré » de la fiche publique → la page fiche officielle.
- Sitemap : PAGE_UPDATED (+ /partenaires, /rendez-vous, /veille (weekly), /veille/lettre, /ressources,
  /ressources/guide-2027 ; accueil, tarifs, agences, pme au 23/11) + 20 fiches de veille ; /lire et /pdf exclus.
  llms.txt : fiche officielle, partenaires, rendez-vous, section « Veille » (fiches, RSS, lettre, guide).
  `<link rel="alternate" type="application/rss+xml">` dans le layout racine. house.ts : /p/repere au sitemap seulement
  si `loadPublicFicheByBusiness(id).indexable`. vercel.json : cron `/api/fiche/rappels` 40 6 * * *. /admin : liens
  Lettre mensuelle, Partenaires, Demandes de démo. robots : /admin déjà couvert.
## Raccords
- Fiche officielle → agent de contenu : `DraftContext.official` (export « À propos »/« Contact » chargé dans
  components/app/contenu/server.ts) sert de squelette aux pages de ce type proposées par l'agent ; brouillon `draft`,
  validation humaine inchangée, note « Texte repris de votre fiche officielle ». 2 tests (content.test.ts).
- Attribution partenaire d'un achat direct : CheckoutButton envoie `ref` (mémoire de l'onglet, sans cookie),
  /api/checkout le valide (`partnerRefOf`) → metadata Stripe `partner_ref` (checkout simple et Accompagné) ; webhook
  `checkout.session.completed` : `recordSignupAttribution` (audit d'origine, sinon lien partenaire) + premier paiement
  compté (même facture qu'`invoice.paid`, idempotent). Tests : metadata (plans-checkout) + e2e webhook signé.
- « Lancer ce scénario » en démo cliqué au navigateur (1440 et 390) : message « Compte de démonstration : rien n'est
  créé… » affiché, rien créé.
## Vérifications
- tsc 0 erreur ; vitest 163 fichiers / 2 358 tests verts ; eslint 0 erreur (43 avertissements préexistants) ; check-env vert.
- Build de production scratchpad/rc-build (resynchronisé, 3 builds), 4200 relancé par scratchpad/start-4200.sh (mis à jour ;
  ancien : start-4200.sh.bak-v8). Sitemap 231 URL toutes en 200, title/description/canonical/og:title/RSS dans <head>
  avec GPTBot. Score du site (268 pages) : SEO 95 / GEO 98 (scratchpad/seo90/audit/v9-final.json).
  Causes corrigées en route (1er passage SEO 90) : 14 H1 de veille > 80 car. et 1 title > 60 (titres raccourcis, sens
  gardé ; title tronqué à 60) ; cannibalisation veille/guides (llms.txt, contenu IA, avis, Aperçus IA : titres de veille
  différenciés) ; /ressources à un seul lien interne (lié du pied de page). Restes connus (déjà en V8) : sameAs/adresse,
  /a-propos noindex, /p/repere sans logo ni fil d'Ariane.
- Navigateur (un Chromium, dsf 1, 1440 et 390) : accueil, tarifs (+agence), agences, pme, /veille + fiche, lettre
  (inscription → e-mail journalisé → lien de confirmation → 200), guide 2027, guide avec lettre, partenaires + candidature
  envoyée, /rendez-vous, 2 pages fonctionnalités, /app/fiche, /p/plomberie-martin, encart, /app/scenarios + lancement :
  aucun défilement horizontal, aucune erreur console. Captures : qa/v9/FINALE/ (44).
  Note : les essais ont laissé 2 candidatures et 2 inscriptions de test dans les données démo de scratchpad/rc-build/.data.
## Reste au fondateur
- Valider les propositions PARTENAIRES (20 % prescripteurs, règles de commission), contrat partenaire, mention `?ref=` /
  metadata Stripe `partner_ref` dans CGV et confidentialité.
- NEXT_PUBLIC_BOOKING_URL (Cal.com) si agenda en ligne ; NEWSLETTER_SECRET (facultatif) ; envoyer le numéro 1 (brouillon).
- Relire les titres de veille raccourcis (docs : src/lib/veille/entries.ts) ; sameAs/adresse de l'entité.
- Rien poussé sur GitHub.
