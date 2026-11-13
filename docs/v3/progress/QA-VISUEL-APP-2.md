# Journal QA-VISUEL-APP-2 (passe 2) — terminé
Outils : qa/v3/qa-visuel-app/p2.js (crawl léger), p2i.js (copilote|actions|bienvenue|visite [lent]), coherence.js (badge cité/rang vs texte), sheet*.py. Captures passe2/. Serveur 4102 tué par l'OOM toutes les 3-6 pages : scripts avec relance/réessai.
## Fait (tsc 2/3 : 0 erreur ; vitest src/components src/lib : 921 verts)
- 1. demo-ecom mobile, tous écrans : prix-avis replié en mobile + doublons ; « Ctrl K » sur mobile ; invite iOS dès la 1re visite → 3e ; questions de marque « entrera dans le score » faux.
- 2. Sombre : demo bureau (24 écrans), demo-ecom mobile (23), demo-pme mobile (11) : lisible, aucun défaut de contraste nouveau.
- 3. Bienvenue : titre caché sous l'en-tête, onglets tronqués, exemple « plombier » pour tous les parcours.
- 4. Copilote 5 q × 3 : liens /app/taches → /app/actions, produits cités, sources prioritaires, date ISO, erreurs en double.
- 5. Actions : livrable, copie, « C'est fait » OK ; toast ajouté, compteur d'en-tête figé en démo corrigé.
- 6. Visite : bulle masquée pendant la navigation (indicateur + Quitter, relances 10/22 s, « Reprendre » à 35 s) ; étape Local → /app/local/fiche-google ; Technique : site d'exemple en démo.
- 7. Réponses : 60 réponses, 0 incohérence badge/texte, dates 5 nov. ; rang/citations cohérents Lundi/Concurrents.
## Reste
- Étapes 6-8 de la visite e-commerce (Produits, Trafic, Copilote) non revues après correctif (serveur tombé) ; demo-pme sombre partiel.
## À faire par d'autres
- qa/v3/a-corriger-QA-VISUEL-APP-2.md et a-corriger-QA-FONCTIONNEL.md.
