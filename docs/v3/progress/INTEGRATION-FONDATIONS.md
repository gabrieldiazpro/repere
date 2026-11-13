# INTEGRATION-FONDATIONS — journal (terminé)
tsc : 4/5 lancés, 0 erreur sur tout le projet. vitest src/lib + src/app/api : 41 fichiers, 696/696 verts.
## Fait
- mistral (tokens, demo-data, alerts, email, ia/page `?? null`) ; notify/platform + prompts/adapters → réexports @/lib/auth|entitlements|jobs, getSiteFetcher → fetchPageSnapshot ; aides de test src/lib/jobs/testing.ts
- onTaskDone (exec/tasks/[id], digest/done) ; notify() dans alerts.recordAlerts et fin d'audit ; execution/auth → auth/compat ; /api/actions, ga4/start, tracking summary → requireBusiness (démo en lecture seule)
- components/app : session serveur (getSession, cache, /bienvenue, plus de repli démo), SessionSync/LoginForm supprimés, plus de lecture de rp_session ; Settings → /api/alerts/prefs, logout et portail par API
- /inscription : parcours, offre, audit (pré-remplissage, rattachement si même e-mail), suite=carte, ref (parrainage) ; webhook invoice.paid → onReferredFirstPayment ; /api/audit {businessId} → jobId (file) ; premier audit déjà enfilé par COMPTES (vérifié)
- instrumentation.ts ; CSP à nonce (src/lib/csp.ts, routes dynamiques) ; env.ts/.env.example (MISTRAL_*, PROMPTS_SITE_FETCH, GROWTH_REFERRAL_REWARD, CSP_NONCE, LOCAL_MAP_BUDGET_EUR, SHOPIFY_*, COPILOT_MAX_TOOL_TURNS)
- ECOMMERCE : montant des conversions (t.js, handleBeacon, recordHit) ; erreurs de prix dans la vérité (facts.withPriceFacts) ; LOCAL : cron /api/local/reminders ; RGPD ecom.*/local.* testés ; leads tool/contact (+ migration 0005)
## Non fait
- copilote → explainChange du moteur : 4 tests du copilote cassent (titre et chiffres différents) ; adaptateur local gardé. buildContentBrief : signature incompatible (le copilote s'appuie sur la fiche du commerce).
## À faire par d'autres
- Orchestrateur : appliquer la migration 0005 ; Stripe : activer l'événement invoice.paid ; mesurer au build le coût de /connexion, /inscription, /r avec la CSP à nonce.
- COPILOTE/MOTEUR : aligner le texte de explainChange (« Score en hausse », « 42 → 52/100 ») pour supprimer copilot/explain.ts.
- Écrans 2b : /app?suite=carte, sondage /api/jobs/[id] après POST /api/audit {businessId} ; PAGES-SITE : /contact → source 'contact'.
- CONTENU : ajouter /badge, /classement, /parrainage au sitemap.
