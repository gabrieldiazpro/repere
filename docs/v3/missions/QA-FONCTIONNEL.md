# Mission QA-FONCTIONNEL (journal : docs/v3/progress/QA-FONCTIONNEL.md)
Lis _COMMUN.md puis _QA-COMMUN.md. Journaux à lire : tous ceux de docs/v3/progress/ (sections « À faire par d'autres »
et « Non livré »).

## À faire
1. **Parcours complet d'un vrai client, hors démo** (compte local de développement, lien magique affiché dans le
   journal du serveur /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/dev-4103.log) : /inscription (Découverte) → lien magique → /bienvenue → site → questions
   suggérées → premier audit par la file (/api/jobs/[id]) → /app avec SES données (jamais la démo) → ajouter une
   question (quota) → cocher une action → mesure avant/après planifiée → fiche de vérité → export CSV → lien de
   partage /r/{jeton} (mot de passe, expiration, révocation) → rapport planifié → inviter un membre (rôles) → export
   puis suppression RGPD. Deux comptes distincts ne voient jamais les données l'un de l'autre (teste les ID croisés
   sur toutes les routes /api/** : écris un script qui parcourt les routes avec la session du compte B et les
   identifiants du compte A).
2. **Paiement simulé** : appelle le webhook Stripe avec des événements signés de test (checkout.session.completed
   pour Essentiel local, Accompagné PME, audit approfondi e-commerce ; invoice.paid ; customer.subscription.deleted) :
   compte + commerce créés avec le bon segment et les bons droits, deuxième achat, e-mail non confirmé, parrainage.
3. **Droits par offre** : pour Découverte, Essentiel, Accompagné : quotas de questions, IA, exports, partage, marque
   blanche, copilote réellement appliqués côté serveur (pas seulement masqués dans l'interface).
4. **File de tâches et crons** : worker, reprises, ré-audits planifiés, digest, rappels locaux, rapports planifiés,
   webhooks sortants signés (reçois-les sur un petit serveur HTTP local).
5. **Outils gratuits** : les 9 routes /api/tools/* avec de vraies pages servies par un serveur HTTP local (bonne page,
   SPA vide, robots bloquants, fiche produit) ; anti-SSRF (localhost, 169.254.169.254, redirections) ; limites.
6. **Cohérence** : score, marge, rang, nombre de questions, part de voix identiques entre rapport public, PDF, app,
   digest, carte de score, export CSV, copilote, pour les 3 comptes démo.
7. **Sécurité** : un rapport arrivera dans /home/claude/auditia/qa/v3/securite-v3.md (agent en parallèle ; regarde
   périodiquement). Applique les correctifs critiques, élevés et les moyens rapides, avec tests.
8. Corrige tous les bugs trouvés (périmètre de _QA-COMMUN.md), ajoute des tests d'intégration. À la fin :
   `flock /tmp/repere-heavy.lock npx vitest run` entièrement vert et tsc propre.
9. Rapport : bugs trouvés / corrigés / restants, tableau des correctifs de sécurité (appliqué / reporté).
