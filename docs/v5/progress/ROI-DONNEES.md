# ROI-DONNEES — journal (13 nov. 2026)

## Fait
- (1) Liens entrants réservés à Accompagné et Agence : `SEODATA_LIMITS.essentiel.backlinks=false` (limits.ts, `BACKLINKS_TIERS`),
  interrupteur plateforme `SEODATA_BACKLINKS_ENABLED` (coupé par défaut, providers.ts). /app/seo/liens : état « Inclus dans les
  offres Accompagné et Agence » + lien /tarifs, aucun chiffre ; usage de l'onglet compté côté serveur (roi.usage, démo ignorée).
  Seuil : engagement 100 $ ≈ 92 € < 99 € → **1 abonné Accompagné** suffit (Agence 149 € aussi).
- (2) Baromètres : `LAUNCH_ORDER` + `launchCatalog` + `BAROMETRE_MAX` (défaut 10) dans catalog.ts ; runMonthly, run.ts --plan,
  /api/v5/barometre/plan suivent. 10 ≈ 19,30 €/mois → rentable dès **1 Essentiel local** attribué ; 50 ≈ 96,50 € → 4 Essentiel
  local ou 1 Accompagné. BAROMETRE_ENABLED reste requis (cron inchangé).
- (3) /admin/roi (cookie admin) : src/lib/roi/{core,attribution,landing,visits,usage,links,compute,report}.ts. Attribution
  première page (mémoire de l'onglet, LandingCapture dans SiteTracking) / UTM (CTA baromètre `/audit?utm_…`) → envoyée par
  AuditForm, analyse (stream.ts), SignupForm → stockée serveur (roi.attribution : audit, analysis, business via claim `src`).
  Visites /barometre/** : VisitBeacon → POST /api/v5/roi/hit (même origine, totaux mensuels, DNT). Liens des pages baromètre :
  DataForSEO par page, mensuel, plafond ROI_LINKS_CAP_EUR. Relevé mensuel roi.snapshots (cron quotidien + ouverture page) ;
  règle d'arrêt 3 mois (compute.ts `stopDecision`). Confidentialité art. 11 complétée.
- (4) MISE-EN-LIGNE §14 d) h) g), donnees-seo.md, barometres.md, .env.example, env.ts. Tests : src/lib/roi/__tests__/roi.test.ts.

## Choix des 10 baromètres (hypothèse raisonnée, à confirmer par /admin/roi)
Paris (plus grand bassin, presse nationale/locale), puis Lyon et Marseille. Métiers : dépannage urgent (plombier, serrurier,
électricien) = questions les plus posées aux IA et sujet de presse récurrent (tarifs abusifs) → liens ; agences immobilières et
coiffeurs = très nombreuses entreprises indépendantes, cible directe d'Essentiel 29 € → inscriptions. Aucun volume de recherche
mesuré ici (DataForSEO non configuré) : à revoir après 3 mois avec les visites et inscriptions attribuées.

## À décider (fondateur)
- Ratio des liens = MRR des offres qui les incluent / coût incrémental (couverture, pas causalité) ; la règle d'arrêt s'y applique.
