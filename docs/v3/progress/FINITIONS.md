# FINITIONS — journal
## Fait
- 1a Erreurs e-commerce : lib/ecommerce/prices.ts uniqueErrors/errorKey (IA × produit × type × valeur) ; FactCheckItem.source='catalogue' ; workspace.withCatalogErrors fusionne dans latest.factCheck (Lundi, Vérité, copilote, layout comptent pareil) ; /app ne filtre plus les erreurs catalogue par la fiche.
- 1b Copilote « ma fiche Google » : context.gbp (gbpOf), intention gbp_audit, composeGbpAudit (score, critères manquants, lien /app/local/fiche-google).
- 1c Copilote prix : verbatims regroupés (IA fusionnées), erreurs catalogue ajoutées.
- 1d Démo doneAt : localDemo.doneAt + cookie rp_demo_tasks (demoTaskState.ts) relu par adaptTasks ; « Effet de vos actions » montre les actions cochées en démo.
- 2 Réglages : ProfileForm (métier/ville/quartier) + POST /api/account/businesses {profile}|{regenerate} ; lib/auth updateBusinessProfile, onboarding.planRegeneration/regenerateQuestions (aperçu puis accord) ; IA : cases cochées = offre, autres verrouillées « Avec Essentiel/Accompagné » → /tarifs (shell/verrou.engineAccess).
- 3 Formats : lib/text fmtMargin/fmtPts/frNum ; measure (marge ±13,7 → « ± 14 pts »), ImpactView, notify/reports, siteaudit/product frPrice (« 12,90 € » au lieu de « 12.9 EUR »), PDF rang moyen, CSV copilote virgule décimale, contexte copilote en €.
- 4 Digest : digest/stats.digestRhythm (« ce mois-ci », « Pas de nouvelle mesure cette semaine… », « Mois calme ») dans buildWeeklyDigest et l'accueil.
- 5 handlers.ts : comparableBase (previousComparable) pour le delta de « Nouvelle mesure ».
- 6 Comparatif : execution/content TO_FILL + competitorCells/extraRows ; copilote competitorPublicRows (sources où il est cité, descriptions des IA).
- 7 /admin : section Messages (admin/messages.ts, POST /admin/messages marquer répondu / rouvrir).
- Tests : src/lib/__tests__/finitions.test.ts (21). Vérifié : tsc 0 erreur, vitest 70 fichiers / 1047 tests verts, eslint --quiet propre.
## En cours
- rien
## Non fait / à suivre
- QA ligne « 500 intermittents du serveur de dev » : non reproduit, lié à l'OOM du conteneur, pas de correctif de code.
- afterScheduledAudit (e-mail mensuel « +N points ce mois-ci ») compare encore au dernier audit, pas au dernier comparable : à aligner sur comparableBase.
