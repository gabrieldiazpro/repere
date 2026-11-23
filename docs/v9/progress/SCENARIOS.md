# SCENARIOS — journal (V9)

**Fait**
- Moteur src/lib/scenarios : apply.ts (corrections rejouées sur une COPIE de l'exploration ; page relue par
  extractPage du robot ; robots.txt / sitemap / redirections / liens), engine.ts (simulate, rankCandidates,
  buildScenarios : l'auditeur passé est auditBoth de /app/seo, aucune formule parallèle), follow.ts (prévu vs mesuré),
  launch.ts (brouillons agent via createChangeSets + tâches « vous » via createCustomTask, sans doublon), store.ts
  (instantané de la dernière exploration `scenarios.snapshot`, lancements `scenarios.launch`).
- Non simulés (exclus, raison affichée) : constats sans autoFix, llms.txt (informatif), fusion JSON-LD, FAQ sans
  réponse connue, robots.txt si des pages étaient bloquées, redirection vers une page non lue, pages rendues en JS.
- /app/scenarios : 3 scénarios (3 plus rentables, Repéré seul, 30 minutes) + personnalisé (cases, recalcul serveur),
  comparaison 1–3 côte à côte + tableau par section, barres animées (Counter + observe), bandeau d'honnêteté,
  lancement à confirmer (démo : rien créé), suivi prévu vs mesuré (démo : calculé sur les explorations démo 3→4).
- Intégrations minimales : app/seo/actions.ts (saveSnapshot après l'exploration), bouton « Simuler » dans /app/seo,
  entrée « Scénarios » dans components/app/nav.ts (groupe Agir). Tâches visibles dans le Centre d'actions.
- Tests : src/lib/scenarios/__tests__ (0 correction = score réel ×3 démos, correctif connu → bonne section, exclusions,
  exploration d'origine intacte, lancement, prévu/mesuré). Captures qa/v9/SCENARIOS (3 démos × 1440/390 × clair/sombre).

**Reste** : rien.

**À faire par d'autres**
- Comptes réels : la simulation exige une exploration faite APRÈS ce déploiement (instantané) ; avant, la page le dit.
- Serveur qa-app 4102 partagé avec FICHE-OFFICIELLE : redémarrages mémoire fréquents (test cliqué du lancement non
  rejoué en navigateur ; couvert par les tests vitest).
