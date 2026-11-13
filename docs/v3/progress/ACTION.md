# Journal ACTION — mission terminée
## Fait (11 tests verts dans src/components/app/action, tsc propre sur le périmètre)
- 1. /app/actions : score impact × facilité, 4 groupes, preuve (question perdue, source, erreur citée), livrable (Verrou execution), « C'est fait », avant/après J+14/J+30 + marge (ImpactView), calendrier ; /app/taches et /app/plan redirigent
- 2. /app/pages : citabilité 20 règles, extraits, réécriture IA, pages suivies + historique, « créer la tâche » ; démo = page d'exemple
- 3. /app/technique : score, plafond, contrôles, robots × passages 90 j, rendu, balisage servi, plugin WP, historique
- 4. /app/rapports : R1/R2/R5, liens de partage (expiration, mot de passe, révocation, aperçu, marque blanche), envoi planifié, carte de score
- 5. /app/trafic : CSV verrouillé, repères, « Probablement depuis », état Shopify, conversions définies
- 6. /app/verite : grille champ × IA, frise des erreurs, erreurs corrigées, date démo = mesure
- 7. /app/copilote : ?context= et ?q=, sources [n], actions confirmées, téléchargements CSV/HTML, conversations, limite du jour
- data-visite : actions, pages, technique, rapports, trafic, copilote
## Non fait
- TrafficClient : deux styles de repères (TR2) ; comparaison de deux audits (R4)
## Variables d'environnement nouvelles : aucune
## À faire par d'autres
- COQUILLE : nav « Tâches » → « Actions » (/app/actions) ; entrées /app/pages, /app/technique ; ancre /app/reglages#integrations
- MESURE : liens profonds /app/questions?q=<queryId>, /app/sources?d=<domaine>
- COPILOTE : sources href '/app/taches' → '/app/actions' (lib/copilot/tools.ts:380, redirection en place)
