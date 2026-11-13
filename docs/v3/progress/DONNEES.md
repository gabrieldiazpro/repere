# Journal DONNEES
## Fait (mission complète, 45 tests verts, tsc propre sur le périmètre)
- lib : share, exports, notify (prefs, center, index/notify, reports/sendScheduledReport), integrations (Slack, webhook HMAC, AES-GCM), annotations, measure (avant/après J+14/J+30, marge, seed démo)
- routes : /api/export, /api/share (+unlock), /api/notifications, /api/alerts/prefs, /api/alerts/reports (+confirm), /api/integrations (+test), /api/annotations, /api/measure ; page /r/[token] (SSR, noindex)
- Variables nouvelles : SHARE_SECRET, INTEGRATIONS_SECRET (repli sur des valeurs de dev)
## Reste
- notify/platform.ts = adaptateur : le remplacer par des réexports quand @/lib/auth, @/lib/entitlements, @/lib/jobs (index) existeront
## À faire par d'autres
- TACHES-FOND : le worker doit importer @/lib/integrations, @/lib/notify/reports, @/lib/measure (enregistrent webhook.deliver, report.scheduled, measure.action) ; CSP : img-src https: sur /r/* (logos marque blanche)
- EXECUTION/DIGEST : api/exec/tasks/[id]/route.ts et api/digest/done/route.ts → après passage à « done », `await onTaskDone(businessId, task)` (@/lib/measure)
- src/lib/alerts.ts (recordAlerts) et fin d'audit : appeler `notify(businessId, {type: notifTypeOfAlert(a.type) | 'audit_done', title, body, href, delta})`
- Settings.tsx (vague 2b) : remplacer localStorage par GET/POST /api/alerts/prefs
