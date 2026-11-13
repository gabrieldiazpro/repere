# Mission MESURE (journal : docs/v3/progress/MESURE.md)

Lis _COMMUN.md puis _APP-COMMUN.md. Journaux utiles : MOTEUR, QUESTIONS, DONNEES, COPILOTE.

## À livrer (écrans « Mesurer » et « Comprendre »)
1. **/app/questions — Questions suivies** : liste (texte, thème, tags, indice de demande étiqueté « estimation »,
   dernier résultat par IA, tendance), ajout / modification / archivage, tags et thèmes, import (CSV ou collé),
   suggestions (20, acceptables en un clic), quota de l'offre visible, filtre et recherche. Détail d'une question :
   historique par IA (courbe citée / rang), réponses brutes.
2. **/app/reponses — Réponses des IA** : lecteur de réponses brutes avec surlignage (vous, concurrents, sources),
   filtres IA / question / date / « je ne suis pas cité », comparaison de deux dates côte à côte.
3. **/app/citations — Explorateur de citations** URL par URL (sources.urls du moteur) : URL, titre, domaine,
   catégorie, IA, questions, vous présent ?, concurrents présents ; tri et filtres ; action « créer la tâche » ou
   « brief de contenu » (buildContentBrief). /app/sources garde la vue par domaine et les 10 opportunités, avec un lien
   croisé.
4. **/app/concurrents** : grille part de voix thème × IA (matrice du moteur), 10 premiers concurrents, « pourquoi il
   passe devant », évolution, bouton « Demander au copilote ».
5. **/app/ia** (ce que disent les IA) : verbatims, sentiment cohérent avec les verbatims, thèmes, par IA (Mistral inclus).
6. **Transversal** : sélecteur de période et comparaison de périodes, filtres par IA et par tag conservés dans l'URL,
   marge d'erreur affichée sur chaque indicateur (« ±x »), annotations sur les courbes (/api/annotations) et bouton
   « Expliquer ce changement », export CSV sur chaque tableau (/api/export), états vides utiles.
7. /app/requetes et /app/historique : redirections propres vers les nouveaux écrans.
Pose les attributs `data-visite` demandés par COQUILLE (voir son journal s'il existe ; sinon : `data-visite="questions"`,
`"reponses"`, `"citations"`, `"concurrents"` sur le bloc principal de chaque écran).
