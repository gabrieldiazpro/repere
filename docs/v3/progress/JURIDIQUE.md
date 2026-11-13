# Journal JURIDIQUE — mission terminée
## Fait (tsc : 0 erreur sur mes chemins ; vitest src/app src/components : 301/301)
- Décisions fondateur appliquées : éditeur = société Mycelo (variables, rien d'inventé) ; B2B seul (case pro obligatoire inscription + test gratuit, CGV art. 4) ; audit seul = 1 mois Essentiel offert puis Découverte (CGV 2 bis/11, FAQ /tarifs).
- CGV : identité société, TVA [À VÉRIFIER éligibilité], paiement B2B (BCE+10 pts, 40 €), rétractation légale retirée, AI Act art. 50, cession L131-3, responsabilité, compétence, annexe → /dpa.
- Mentions légales (société, téléphone hébergeur, directeur), confidentialité (base 6.1.b test gratuit, art. 13 complété, transferts DPF/CCT, mesure d'audience réelle du site, prospection).
- Nouvelle page /dpa (content.ts + test 28.3). docs/v3/juridique-pre-relecture.md (sources, décisions, 10 questions).
## Variables d'environnement : à créer (forme, capital, ville RCS, téléphone, TVA intracom, directeur publication)
## À faire par d'autres
- src/lib/stripe.ts + api/checkout/commitment.ts : « J'agis pour les besoins de mon activité professionnelle et j'accepte les [CGV] » ; pied de facture (délai, BCE+10, 40 €, TVA).
- /api/audit, /api/account/signup : enregistrer `professional: true` + date (preuve).
- Footer : lien /dpa ; site.ts PAGE_UPDATED + sitemap NOINDEX '/dpa' ; variables légales (MISE-EN-LIGNE).
- scripts/write-emails.ts, KIT-LANCEMENT : identité Mycelo au lieu de personne + SIREN.
