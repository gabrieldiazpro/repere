# Journal — agent PARTENAIRES (V9, 23 nov. 2026)

## Fait
- **/partenaires** (src/app/partenaires/page.tsx, PartnerForm.tsx, candidature/route.ts) : 4 familles (agences ; plateformes
  « compatibles » WordPress, WooCommerce, Shopify, Wix, Webflow, PrestaShop, Magento, avec mention « pas des partenaires
  officiels » ; prescripteurs : experts-comptables, CCI, chambres de métiers, fédérations ; écoles/formateurs), pour
  chacune : gains, attentes, fonctionnement. Annuaire vide → « Aucun partenaire pour l'instant : devenez le premier ».
  Candidature : même origine, champ piège, débit 5/h 20/j, consentement horodaté, doublons 30 j, e-mail au fondateur.
- **src/lib/partners** : program.ts (familles, conditions), validate.ts, codes.ts (code, lien `?ref=`), store.ts
  (`partners.records` : statut, code à l'acceptation, conditions ajustables, annuaire = accepté + publié + accord),
  payments.ts (`partners.payments`, une ligne par facture Stripe payée d'un espace venu d'un lien partenaire),
  commission.ts (pur), tracking.ts, notify.ts, admin-http.ts.
- **Attribution sans cookie** : réutilise src/lib/roi (première page en mémoire de l'onglet) ; `?ref=code` lu comme
  utm partenaire/partenaire/<code> (sauf vrais UTM, jamais un code de parrainage REP-…).
- **/admin/partenaires** : candidatures, statut, code + lien, conditions, annuaire, analyses/audits/inscriptions venus du
  lien, offre actuelle des espaces, factures payées, commission acquise / versée / due, saisie des versements, codes orphelins.
- **/rendez-vous** (+ demande/route.ts, src/lib/meetings) : Accompagné / Agence, entreprise, site, taille, besoin,
  3 créneaux (lun.–ven., demain → J+60) ou texte libre, origine jointe. Si `NEXT_PUBLIC_BOOKING_URL` (https) : bouton
  « Ouvrir l'agenda » + formulaire. E-mail au fondateur + réponse automatique « sous 1 jour ouvré, aucun rendez-vous
  encore fixé » ; doublon 24 h = aucun e-mail. Admin : /admin/partenaires/rendez-vous.
- Env documentées (.env.example, docs/MISE-EN-LIGNE.md) : PARTNERS_NOTIFY_EMAIL, MEETINGS_NOTIFY_EMAIL,
  NEXT_PUBLIC_BOOKING_URL (option gratuite : Cal.com, vérifiée sur cal.com/pricing le 23 nov. 2026).
- Tests : partners (13), meetings (8), routes (4). Captures 1440/390 clair et sombre : qa/v9/PARTENAIRES/.
- Vérifications : vitest complet 2303/2303 ; eslint 0 erreur ; tsc 0 erreur chez moi (2 erreurs dans
  src/app/app/fiche/page.tsx, FICHE-OFFICIELLE en cours).

## Modifications minimales hors périmètre (relues)
- src/lib/roi/core.ts : `PARTNER_UTM`, `partnerRefOf`, `partnerCodeOf` ; `attributionFromLocation` lit `?ref=`.
- src/app/api/stripe/webhook/route.ts (`onInvoicePaid`) : `recordPartnerPayment` (try/catch, jamais bloquant).

## PROPOSITIONS à valider par le fondateur
- Agences : 30 % des paiements HT pendant 12 mois à partir du 1er paiement du client (chiffre DÉJÀ publié sur /agences,
  /tarifs, PriceTable ; la mission suggérait 20 %). Ou revente : offre Agence + exécution à prix revendeur.
- Prescripteurs : 20 % pendant 12 mois, ou atelier gratuit pour les adhérents si pas de commission possible (CCI…).
- Écoles/formateurs : démo et supports gratuits ; 20 % pendant 12 mois pour les formateurs qui apportent des clients.
- Plateformes : aucune commission ; intégration documentée et contenus communs ; « partenaire officiel » seulement
  avec accord écrit.
- Règles : HT, hors remboursements (NON déduits automatiquement : vérifier dans Stripe), versement trimestriel sur
  facture, aucun paiement automatique ; écartés : avant acceptation / pendant suspension, autre devise, client sur le
  domaine du partenaire (à vérifier).
- À écrire : contrat de partenariat (juridique), mention dans CGV/confidentialité (liens `?ref=`).

## Reste / limites
- Achat direct sur /tarifs sans inscription : l'espace créé par le paiement n'a pas d'origine enregistrée (seule
  l'inscription l'enregistre) → pas attribué. À traiter côté checkout (passer `currentAttribution()` puis
  `recordAttribution('business', …)` dans le webhook) : COMPTES / SITE.
- Pas de remise revendeur automatique ni d'espace partenaire en libre-service (relevé envoyé à la main).

## À faire par d'autres
- SITE : docs/v9/demandes-SITE.md § « De PARTENAIRES » (boutons « Réserver une démo », pied de page, sitemap,
  llms.txt, liens admin).
