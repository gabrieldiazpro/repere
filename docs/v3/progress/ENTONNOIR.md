# ENTONNOIR — journal (mission terminée)
**Fait**
- Clé `mistral` : report/derive.ts, report/adapters.ts, pdf/derive.ts.
- report/v3.ts (pur, partagé web + PDF) : marginOf (computeMargins du moteur), citedUrls (sources.urls), voiceOf (buildVoiceMatrix), summaryOf (auditStats), signupHref, ancres.
- Rapport V3 : synthèse 5 s (score ± marge, rang, phrase choc, 1 action), AnchorNav collante, sections repliables mobile (Fold), 5 URL citées, matrice thème × IA, carte de score (/carte si activée, sinon via compte), « Créer mon compte gratuit », Découverte d'abord puis Essentiel/Accompagné/audit ; sans Stripe → /tarifs, échec paiement → lien de repli.
- gapsOf : comptage unique auditStats, seulement les concurrents devant. Surlignage : « (vous) ».
- Formulaire : site d'abord + pré-remplissage (audit/prefill.ts, action serveur audit/actions.ts via siteaudit, limitée par IP), résumé d'erreurs, erreurs serveur par champ, progression, attente avec les vraies questions + suivi /api/jobs/[id] si jobId.
- PDF : marge, action prioritaire, 5 URL citées, Découverte ; ≤ 5 pages. Tests : 21 verts (report, pdf, audit).
**Reste** : tsc non relancé après les retouches PDF/tests (quota 2/2) : à vérifier au build d'intégration.
**À faire par d'autres** : COMPTES : /inscription doit lire `audit`, `offre` (xx_decouverte) et `suite=carte`. API /api/audit : renvoyer `jobId` quand l'audit passe par la file. PAGES-SITE : /tarifs?segment= et ancres #<planId>.
