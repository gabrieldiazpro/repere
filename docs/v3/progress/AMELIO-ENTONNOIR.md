# AMELIO-ENTONNOIR — journal
Source : qa/v3/regard-client-v3.md (B1, B2, B3, B4, B10, B22, B23 ; améliorations 1, 2, 3, 7).
## Fait
- B1/amél. 1 : lib/auth/profile.ts (resolveSignupProfile, sans repli « commerce/entreprise/boutique ») ; claims.createOwnedBusiness relit l'audit d'origine (métier/catégorie, ville, quartier, catégories, concurrents) ; onboarding.ts sème les questions (audit d'origine, sinon moteur) dans la limite de l'offre avant le 1er audit ; /inscription + SignupForm (« Repris de votre audit — Modifier », métier/ville envoyés).
- B3/amél. 2 : /bienvenue texte gratuit ≠ payé (setupIntro), WelcomeForm pré-rempli, ne demande que les champs vides (métier compris) ; completeBusinessSetup exige le métier.
- B2/B10/amél. 3 : digest/stats.ts comparableAudits/comparableHistory/previousComparable (mêmes questions ≥ 80 %, ≥ 6 j) utilisés par rankMove, newEntrants, digest, workspace.previous ; « Première mesure : … Prochaine mesure vers le … » au lieu de « Semaine calme ».
- B4/B22/amél. 7 : AuditForm method="post", bouton désactivé avant hydratation, e-mail/consentement retirés de l'URL, nom jamais écrit pendant la saisie (shouldProposeName).
- B23 : invite d'installation compacte, étapes iOS sur « Comment faire ? » (3e visite déjà en place).
- Tests : lib/auth/__tests__/entonnoir.test.ts, lib/digest/__tests__/comparable.test.ts, app/audit/__tests__/entonnoir.test.ts.
- Vérifié : tsc sans erreur sur les chemins touchés ; vitest lib/auth, lib/digest, lib/jobs, lib/prompts, app/audit, valeur-client, qa-fonctionnel : verts.
## En cours
- rien
## À faire par d'autres
- TACHES-FOND (src/lib/jobs/handlers.ts:171) : la notification « Nouvelle mesure » met `delta` dès qu'il existe un audit précédent ; utiliser `previousComparable` de @/lib/digest/stats.
- QA-VISUEL-APP-2 : retouches minimales faites dans src/app/app/page.tsx (2 textes « Semaine calme »), src/components/app/workspace.ts (previous), InstallPrompt.tsx.
- QA-FONCTIONNEL : src/lib/__tests__/qa-fonctionnel.test.ts envoie désormais `trade` à completeBusinessSetup (métier exigé).
- Réglages (amél. 1, dernier point) : champ « Métier / catégorie » modifiable dans /app/reglages non fait (hors périmètre).
