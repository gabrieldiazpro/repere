# Journal MESURE — mission terminée
## Fait (tsc 2/2 : 0 erreur sur mes chemins ; vitest src/components/app/mesure : 27/27)
- Socle src/components/app/mesure/ : params (état URL : periode, vs, ia, tag, q), derive + chart (période bornée par historyMonths, marges ±, réponses surlignées, URL, résultats par question, repères), server (loadMesure, annotations, liens question), ui (MesureBar, Kpi, DeltaPts « dans la marge », ExportLink + VerrouBouton, ExplainChange, HighlightedAnswer), AnnotatedChart (+ repère, démo sur l'appareil), TaskButton/CopyText, AnswerCard, demoStore, Skeleton, MesureError, mesure.css (variables seules)
- /app/questions (+[id]), /app/reponses (filtres, comparaison 2 dates), /app/citations (+brief), /app/sources (lien croisé, export), /app/concurrents (matrice thème × IA, top 10, courbe annotée), /app/ia (ton = verbatims, Mistral/Claude verrouillés) ; loading + error par écran ; requetes → questions, historique → reponses?comparer=1
- data-visite : questions, reponses (1re réponse), citations, concurrents (matrice)
## Variables d'environnement : aucune
## À faire par d'autres
- COQUILLE (nav.ts) : ajouter « Questions suivies » /app/questions, « Réponses des IA » /app/reponses, « Pages citées » /app/citations (groupe Visibilité).
- ACTION (Copilot) : préremplir la saisie avec `?q=` sur /app/copilote (liens « Demander au copilote » : ?context=concurrents|ia|questions|sources&q=…).
- MOTEUR : plafonds de vraisemblance du mock (D5/D7) toujours ouverts.
