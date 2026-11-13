# Règles communes à tous les agents de construction V3 (à lire en premier)

1. Lis /home/claude/auditia/docs/v3/12-CONTRATS-V3.md en entier (règles de la machine, décisions, périmètres,
   signatures partagées, endpoints) et /home/claude/auditia/docs/v3/00-BRIEF-V3.md. Ils s'imposent.
2. **Reprise après interruption.** Le conteneur peut redémarrer à tout moment et t'interrompre ; un agent précédent a
   peut-être déjà commencé ta mission. Avant tout :
   - lis ton journal `/home/claude/auditia/docs/v3/progress/<TON-NOM>.md` s'il existe ;
   - inspecte les fichiers déjà présents dans ton périmètre (ils peuvent être incomplets ou ne pas compiler) :
     reprends-les et termine-les, ne repars pas de zéro sans raison.
3. **Journal de progression.** Après chaque livrable terminé (pas à la fin), mets à jour ton journal
   `/home/claude/auditia/docs/v3/progress/<TON-NOM>.md` : « Fait », « En cours », « Reste », « À faire par d'autres »
   (changements nécessaires hors de ton périmètre, avec fichier et patch précis). 15 lignes max, tenu à jour.
4. **Machine partagée** (2 CPU, 7 Go) : jamais de `next build`, `next dev`, `next start`. Commandes lourdes uniquement
   par le verrou : `flock /tmp/repere-heavy.lock npx tsc --noEmit -p . 2>&1 | grep -E "<tes chemins>"` (2 fois max) et
   `flock /tmp/repere-heavy.lock npx vitest run <ton dossier>`. Aucune installation npm.
5. Tu ne modifies QUE ton périmètre. Un export d'un autre module absent au moment de vérifier → adaptateur local dans
   TON dossier + ligne dans « À faire par d'autres ».
6. Français, vouvoiement dans tout texte visible. Aucun faux chiffre, faux client, faux logo, aucune promesse de
   résultat. Mode démo sans clé pour tout (comptes `demo`, `demo-pme`, `demo-ecom`, lecture seule côté serveur).
7. Écris des tests vitest pour ta logique. Ne casse pas les tests existants de ton dossier.
8. Rapport final : 150 mots max — livré, non livré (et pourquoi), variables d'environnement nouvelles, « À faire par
   d'autres ». Le journal de progression doit dire la même chose.
