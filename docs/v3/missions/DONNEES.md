# Mission DONNEES (journal : docs/v3/progress/DONNEES.md)

## À lire
- docs/v3/09-audit-app.md (points 6 et 7, annotations, mesure avant/après), docs/v3/02-teardown-midmarket.md
  (rapports par lien public, marque blanche, exports, suivi avant/après), docs/v3/01-teardown-enterprise.md (centre
  d'actions avec relance et gain, annotations).
- Code : src/lib/store.ts, src/lib/db.ts, src/lib/alerts.ts, src/lib/email.ts, src/lib/execution/index.ts,
  src/lib/engine/index.ts, src/components/app/Settings.tsx (préférences stockées dans le navigateur : à passer côté
  serveur), src/app/rapport/[id]/page.tsx (rendu).

## Périmètre exclusif
src/lib/{share,exports,notify,integrations,annotations,measure}/**,
src/app/api/{export,share,notifications,integrations,annotations,measure,alerts}/**, src/app/r/**.

## À livrer
1. **Exports CSV** (UTF-8 avec BOM, point-virgule, compatible Excel français) : questions, réponses, sources (domaines
   et URL), concurrents, tâches, trafic IA, historique des scores. GET /api/export?businessId&kind=…, droit `exports`.
2. **Liens de partage** : jeton aléatoire haché en base, portée (rapport d'un audit, tableau de bord en lecture),
   expiration, révocation, mot de passe facultatif. Marque blanche : nom, logo (URL), couleur, masquage de « Repéré »
   si droit whiteLabel. Page publique /r/[token] en SSR, noindex, soignée, sans donnée sensible (jamais d'e-mail).
3. **Rapports planifiés** (hebdo ou mensuels) par e-mail à des destinataires enregistrés CÔTÉ SERVEUR, via
   enqueue('report.scheduled'). Exporte `sendScheduledReport(payload)`.
4. **Préférences d'alerte côté serveur** (GET/POST /api/alerts/prefs : types, seuils, canaux) et **centre de
   notifications** (liste, lu/non lu, GET/POST /api/notifications), alimenté par `notify(businessId, {type, title, body, href})`.
5. **Intégrations** : webhook Slack entrant (message formaté) et webhook sortant générique signé HMAC (audit.completed,
   alert.created, task.done), reprise via la file, bouton de test. Routes /api/integrations.
6. **Annotations** : événements datés sur les courbes (manuels, ou automatiques quand une tâche est faite). /api/annotations.
7. **Mesure avant/après d'une action** : à la complétion d'une tâche, état « avant » (questions liées, mention, rang)
   + relance ciblée planifiée à J+14 et J+30 (enqueue('measure.action')). `getActionImpact(taskId)` → avant, après,
   marge, verdict honnête (« dans la marge d'erreur » le cas échéant). Seed de démonstration réaliste.
8. Tests : CSV, jetons, expiration, signature HMAC, impact.
