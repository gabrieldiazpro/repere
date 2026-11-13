# Journal COPILOTE (V3) — mission terminée

**Fait** : entities.ts, types.ts (repris) ; explain.ts (adaptateur explainChange) ; tools.ts (15 outils + TOOL_DEFS) ;
deliverables.ts (FAQ HTML+JSON-LD, avis, brief, idées, e-mail média, description fiche Google, CSV, plan 3 mois) ;
router.ts (fautes, entités floues, composées, hors périmètre = 1 phrase + 3 questions) ; agent.ts + llm.ts (boucle
d'outils Anthropic/OpenAI, budget par tour, résultats encadrés non fiables, garde-fou chiffres, repli démo) ;
prompt.ts (prompt à outils, contextSuggestions) ; index.ts ; route GET `?context=`. tsc propre, 139 tests verts.
Réponses spécifiques : 13/30 (V2) → 30/30. Tests : 30 questions + 23 variantes + outils + LLM simulé + injections.
Changement de test V2 : « Bonjour » → intention `greeting` (au lieu de `other`).
**Nouvelle variable d'environnement** : `COPILOT_MAX_TOOL_TURNS` (défaut 4).
**Reste** : rien dans le périmètre.
**À faire par d'autres** :
- MOTEUR : quand @/lib/engine exportera `explainChange`/`buildContentBrief`, remplacer copilot/explain.ts et buildBrief.
- Écrans 2b (Copilot.tsx) : afficher `answer.sources`, `answer.actions` (track_question → POST /api/prompts après
  confirmation), télécharger les livrables `csv`, passer `?context=<écran>` au GET /api/copilot.
