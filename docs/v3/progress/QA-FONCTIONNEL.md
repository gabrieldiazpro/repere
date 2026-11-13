# QA-FONCTIONNEL — journal
Serveur : http://localhost:4103 (copie qa-fn), relancé par scratchpad/qa-fn-loop.sh (OOM fréquents du cgroup partagé).
Scripts : /home/claude/auditia/qa/v3/qa-fonctionnel/ (lib.js = client HTTP + lien magique ; p1*.js parcours).
## Fait
- P1 Découverte : inscription → lien magique → /bienvenue → setup → 1er audit (file, /api/jobs) → questions (quota 5 → 402),
  tâche faite → mesure avant/après, fiche de vérité, /app = ses données ; exports/partage/équipe refusés (402) OK.
- P2 Stripe signé (p2*.js) : Essentiel local / Accompagné PME / audit approfondi e-com → bon segment et offre ; doublon
  d'événement ignoré ; 2e achat ; non confirmé (claim lié à l'e-mail) ; parrainage (invoice.paid) ; résiliation → Découverte.
- P1 payé (p3*.js) : exports CSV, partage /r (mdp, révocation, marque blanche ignorée hors Agence), rapport planifié,
  invitations + rôles viewer/member/admin, RGPD export + suppression (p4.js, plus aucune trace dans .data).
- ID croisés (croise.js, ~95 requêtes × 2 identités) : aucune fuite (seul /api/report/[id]/pdf public par UUID, by design V2).
- Sécurité appliquée : E1, M1, M2, M3, M4, M5, M6, M7 (route DELETE /api/account + export/suppression parrainage),
  M8, F1, F2, F3 (SHARE_SECRET/INTEGRATIONS_SECRET requis en prod), F4, F5, F6 (LLM e-com, DELETE origin, sièges).
- Tests : src/lib/__tests__/qa-fonctionnel.test.ts (9) + growth/share mis à jour ; plans.ts + docs/v2/07-plans-v2.json (AI Overviews retiré).
- P3 droits (p5.js) : Découverte → mesure 402, exec/generate 402, review-reply 402, posts LLM 402, export/intégrations 402,
  copilote 4e question 429 ; IA : Découverte 3, Accompagné PME 5.
- P4 crons (secret Bearer, 401 sans) : monthly, weekly?force=1, worker, local/reminders OK ; double opt-in GET/POST (p6.js).
- P5 outils : src/lib/siteaudit/__tests__/http-local.test.ts (vrai serveur HTTP local, 9 routes, SSRF, limites) vert.
- P6 cohérence (p7.js) : score, marge, rang, questions, part de voix identiques app / CSV / copilote / rapport / PDF /
  digest après correctif (démo : marges du vivier recopiées → rapport « 12–33 » pour un score de 61).
- Fin : tsc propre ; vitest complet 55 fichiers / 879 tests verts (timeout relevé sur un test lourd de routes.test.ts).
## Restant (non corrigé)
- /api/report/[id]/pdf et /rapport/[id] publics par UUID même pour les audits d'un espace (conception V2, risque faible).
- Webhooks sortants : impossibles à recevoir sur un serveur local (https + IP publique exigés, voulu) ; signature
  couverte par integrations.test.ts. Erreurs « Unexpected end of JSON input » du serveur de dev = artefact HMR.
- Audit approfondi (one-shot) : l'espace reste en droits Découverte (prestation humaine), à confirmer par le fondateur.
## En cours
- rien.
## Bugs trouvés / corrigés
- [corrigé] auth/businesses.ts : needsSetup perdu (forme publique) → /bienvenue jamais proposé.
- [corrigé] auth/claims.ts : espace à compléter → next=/bienvenue.
- [corrigé] auth/businesses.ts completeBusinessSetup : needsSetup lu après updateBusiness → 1er audit jamais lancé.
- [corrigé] prompts/repo.ts ensureInitialPrompts : marqueur posé sans audit → questions jamais semées.
- [corrigé] db.ts upsertSubscription : abonnement sans ligne liée → résiliation sans effet (repli client+plan).
- [corrigé] growth/referral.ts : mois de parrainage comptés « accordés » sans coupon appliqué.
- [corrigé] share/index.ts : rapport partagé sans auditId → 400 ; prend le dernier audit.
- [corrigé] api/audit : mesure manuelle quotidienne pour toutes les offres → 1 par période de l'offre (E1), exception 1re mesure après onboarding.
- [corrigé] claims.afterSignup : audit d'origine jamais rattaché (e-mail cherché dans l'audit, il est dans leads) → db.auditRequestedBy.
- [corrigé] copilote : quota quotidien de l'offre (copilotDaily) non appliqué (60/jour pour tous).
- [corrigé] exec/generate, exec/review-reply, local posts/reviews (LLM) : ouverts à Découverte (« pas d'exécution »).
- [corrigé] jobs/handlers + db.listBusinessesDueForAudit : ré-audits planifiés lancés sur des espaces « Mon entreprise »
  à compléter ; Découverte exclue des mesures mensuelles.
- [corrigé] demo-v2.ts : marges des audits démo calculées pour un autre score (rapport/PDF ≠ app/CSV/copilote).
- [corrigé] copilote : « Quelle est ma part de voix ? » → « pas de donnée » ; routé vers la réponse rang + part de voix.
## À faire par d'autres
- QA-VISUEL-SITE : 2 lignes dans qa/v3/a-corriger-QA-VISUEL-SITE.md (prefillFromSite /64, login CSRF du callback).
- Orchestrateur : SHARE_SECRET et INTEGRATIONS_SECRET désormais obligatoires en production (env.ts) ; .env.example l.127
  dit encore « défaut : SHARE_SECRET » → retirer. Route nouvelle DELETE /api/account (suppression du compte) à brancher
  dans Réglages › Mes données (écran 2b).
