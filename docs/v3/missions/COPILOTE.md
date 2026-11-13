# Mission COPILOTE (journal : docs/v3/progress/COPILOTE.md)

## À lire
- docs/v3/09-audit-app.md (§ Copilote : 14 types de questions mal reconnus), qa/v3/app/_copilote.json (30 questions
  posées et réponses obtenues), qa/v2/regard-client.md (§ copilote), qa/v2/securite-v2.md (§ injection de prompt :
  les protections doivent rester en place).
- Tout src/lib/copilot/** et src/app/api/copilot/** ; les modules interrogés : src/lib/engine/index.ts,
  src/lib/execution/index.ts, src/lib/tracking/index.ts, src/lib/facts.ts, src/lib/digest/stats.ts.

## Périmètre exclusif
src/lib/copilot/**, src/app/api/copilot/**.

## À livrer
1. **Architecture à outils** : 12 à 15 outils typés sur les données du compte (getScore, getRank,
   getCompetitor(name), compareCompetitors, getSources(filter), getOpportunities, getPerception, getFactErrors,
   getTasks(status), getTraffic(range, engine), getSales, getPromptResults(query), explainChange,
   draftDeliverable(kind, context)…). Chacun renvoie des données structurées + une phrase sourcée.
2. **Mode démo sans clé** : routeur d'intention robuste (règles, synonymes, fautes de frappe, entités : concurrent
   par correspondance floue, IA, période, produit) qui choisit un ou plusieurs outils et compose la réponse à partir de
   LEURS données. Aucune réponse générique : hors périmètre → une phrase + 3 questions proches. Objectif : les 30
   questions du fichier reçoivent une réponse spécifique et exacte (bon concurrent, bonne IA, bons chiffres).
3. **Mode LLM réel** (Anthropic ou OpenAI selon la clé) : boucle d'appels d'outils, prompt système en français
   (honnête, chiffres uniquement issus des outils, pas de promesse), données externes encadrées comme non fiables,
   limite de tours, budget, repli démo en cas d'erreur.
4. **Livrables** : FAQ (HTML + JSON-LD), réponse à un avis selon sa tonalité, brief de contenu, e-mail de proposition
   d'article, description de fiche Google (générateurs de src/lib/execution en démo).
5. **Suggestions contextuelles** : 4 questions selon l'écran d'origine (paramètre `context`) et l'état du compte.
6. **Tests** : les 30 questions + 20 variantes (fautes, tutoiement, questions composées), assertions sur l'outil
   choisi et les chiffres ; tests d'injection. Rapport : taux de réponses spécifiques avant / après.
