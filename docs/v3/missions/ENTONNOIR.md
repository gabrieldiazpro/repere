# Mission ENTONNOIR (journal : docs/v3/progress/ENTONNOIR.md)

Charge le skill frontend-design (outil Skill). L'audit d'ergonomie du site n'a pas pu aboutir : fais ta propre revue
critique (CRO) de l'entonnoir audit → rapport → paiement à partir du code et des documents ci-dessous.

## À lire
- qa/v2/regard-client.md, qa/v2/visuel/bugs-logique.md, docs/v3/07-design-benchmark.md (micro-interactions),
  docs/v3/04-teardown-suites.md (graders : score visible, détail contre e-mail), docs/v3/09-audit-app.md (§ cohérence
  des chiffres).
- Captures : qa/v2/rapport/, qa/v2/visuel/ (regarde-en quelques-unes).
- Code : src/app/audit/**, src/app/rapport/**, src/components/report/**, src/lib/pdf/**, src/app/api/audit/route.ts
  (lecture), src/lib/engine (types ; MOTEUR ajoute marge d'erreur, urls, explainChange, matrice thème × IA : vérifie
  ce qui existe réellement dans types*.ts), src/lib/jobs (enqueue, /api/jobs/[id] si présent), src/components/motion/**
  s'il existe.

## Périmètre exclusif
src/app/audit/**, src/app/rapport/**, src/components/report/**, src/lib/pdf/**.

## À livrer
1. **Formulaire d'audit** : le moins de champs possible par parcours (site web d'abord : pré-remplissage de la
   catégorie et du nom à partir de l'URL quand '@/lib/siteaudit' est disponible), progression claire, erreurs par
   champ, accessible au clavier et au lecteur d'écran, mobile. Écran d'attente qui montre le travail réel (IA
   interrogées, questions posées), branché sur l'état de la tâche si /api/jobs/[id] existe, sinon comportement actuel.
2. **Rapport V3** : synthèse en 5 secondes (score, marge d'erreur, rang, phrase choc, une action), puis : erreurs des
   IA, sources (domaines + 5 URL citées), pourquoi les concurrents passent devant, matrice thème × IA si disponible,
   ce qu'on fait pour vous (3 livrables réels), offre. Navigation par ancres collante, sections repliables sur mobile,
   animations sobres (jauge, compteurs, barres). Bouton « Partager ma carte de score » (/carte/[auditId] si la carte
   est activée : voir src/lib/growth) et « Créer mon compte gratuit » (/inscription?audit=…).
3. **Conversion** : CTA par parcours vers l'offre Découverte gratuite d'abord, puis Essentiel / Accompagné / audit
   approfondi ; plus aucun CTA mort ; mentions « démo » sobres mais honnêtes.
4. **PDF** : aligné sur le rapport V3 (marge d'erreur, URL citées), 5 pages max, tests à jour.
5. Cohérence des chiffres entre rapport, PDF et app (une seule fonction de calcul par chiffre : réutilise celles du moteur).
