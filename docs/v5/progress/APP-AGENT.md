# APP-AGENT — journal (13 nov. 2026)

Périmètre : src/app/app/agent/**, src/components/app/agent/** ; ajouts minimaux : entrée « Agent » (nav.ts, pilier Agir),
bouton « Faire par l'agent » (ActionCenter.tsx).

## Plan de design
- Couleurs : jetons V4 existants. Différences : retrait = fond tone-down-bg + barré ; ajout = fond tone-up-bg + souligné
  (jamais la couleur seule) ; « [à compléter] » = fond ambre + contour pointillé.
- Typo : celle de l'app (display pour les titres-résultats, Inter) ; chasse fixe seulement pour les fichiers (llms.txt, robots, JSON-LD).
- Mise en page : en-tête-résultat + onglets-liens (Propositions · Journal · Connexions · Réglages). Propositions en lignes
  (liseré de risque, origine, gain), pas en cartes identiques. Détail : AVANT | APRÈS côte à côte (empilés à 390),
  barre d'action collante avec UN bouton principal qui change avec l'état (Valider → Appliquer → Vérifié).
- Élément marquant : le « relais » d'application (lecture de l'état actuel → écriture → relecture chez la plateforme →
  page publique relue) qui se remplit étape par étape, puis la coche « Appliqué et vérifié ».
- Démo : bandeau « Simulation » rayé sur tous les écrans de l'agent ; tout se passe dans le navigateur (sessionStorage).

## Fait
- Routes : /app/agent (propositions + parcours en 5 étapes ; `?cs=` → fiche, cible des repères `an_pub_*` ; `?tache=` →
  proposition surlignée), /app/agent/[id] (fiche), /app/agent/journal, /app/agent/connexions, /app/agent/reglages ;
  layout.tsx (données chargées une fois + AgentProvider), loading.tsx, actions.ts (action serveur des réglages, admin).
- Composants (src/components/app/agent) : model.ts (pur : libellés, tons, diff mot à mot LCS avec replis, « [à compléter] »,
  droits, simulation démo, réglages), demo.ts (parcours démo des 3 comptes, cohérent avec t3 schema / t4 FAQ / fact_fix),
  effect.ts + EffectView (remesure J+7, marge d'erreur via compareSnapshots, repère ChartDraw), server.ts (loadAgent),
  state.tsx (contexte ; démo = sessionStorage, jamais envoyé), DiffView, ProposalList, ProposalDetail (avant/après,
  édition, exclusion, validation explicite « qui valide », relais animé, vérification, annulation avec confirmation),
  JournalList/JournalView, Connections + platforms.ts (assistant 3 étapes : où trouver l'accès → saisie → test),
  SettingsForm, Chrome (bandeau « Démo simulée », onglets), agent.css (mouvement réduit : rotation coupée, fondus gardés).
- Ajouts minimaux : nav.ts (entrée « Agent », pilier Agir, sans raccourci clavier pour ne pas heurter APP-SEO) ;
  ActionCenter.tsx (bouton « Faire par l'agent » si agentKindForTask(task.kind) : schema, faq_page, fact_fix).
- Tests : 16 verts (src/components/app/agent/__tests__/agent.test.ts) ; tsc propre sur le périmètre.

## Décisions
- Compte réel : l'application est un seul appel API ; la progression avance pendant l'attente puis se cale sur le résultat
  réel (échec d'écriture → étape « écriture » en rouge ; non vérifié → dernière étape à refaire).
- Effet réel : score de la page relue (job siteaudit.run J+7) avant/après, sans marge (déterministe) + repère sur la courbe
  du score de visibilité. Le taux de citation IA avant/après n'est montré qu'en démo (pas de lien ChangeSet → questions
  dans @/lib/publish) : demande ci-dessous.

## Attendu des autres
- PUBLICATION / ANALYSE-60S : créer les ChangeSets réels à partir des constats (POST /api/v5/publish/changesets) après
  chaque analyse, en lisant `publish.agent_settings` (kinds, frequency) ; notifier selon `notify` (email | app | off).
  Aujourd'hui les réglages sont enregistrés mais pas encore lus par le planificateur.
- PUBLICATION : mesure IA liée à un ChangeSet (questions liées + snapshots, comme measure.actions) pour l'effet réel avec marge.
- Centre d'actions : lien tâche → ChangeSet réel (aujourd'hui seulement en démo, `taskLinks`).

## QA (13 nov.)
- Captures 1440/390, clair/sombre : /home/claude/auditia/qa/v5/APP-AGENT/ (propositions, detail-avant-apres, a-completer,
  relais-en-cours, applique-verifie, effet-mesure, journal, connexions, assistant-connexion, reglages,
  centre-actions-bouton-agent, agent-depuis-action). Aucun défilement horizontal.
- Parcours démo vérifié au navigateur : valider → appliquer (relais) → « Appliqué et vérifié » ; « [à compléter] » bloque ;
  Centre d'actions → « Faire par l'agent » → proposition surlignée.
- Démo : les tâches du Centre d'actions peuvent venir du moteur (identifiants hachés) : le lien tâche → proposition se fait
  par type (schema / fact_fix → JSON-LD, faq_page → FAQ), pas par identifiant fixe.
- Serveur 4103 instable (redémarre au seuil mémoire de 1,4 Go, partagé avec APP-SEO) : relancé 2 fois avec dev.sh.
- Non fait : passe sur les comptes démo PME et e-commerce en capture (couverts par les tests : Shopify → JSON-LD en export).
