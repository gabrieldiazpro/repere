# APP-ECRANS — passe V4 « clarté et dynamisme »

## Fait
- Kit src/components/app/v4/ : `Verdict` (titre-résultat + chiffre clé qui compte + UNE action + détails dépliables), `V4Empty`, `InView`, `FillBar`, v4.css (surligneur, cascade, coche, glisser-déposer, puces, curseur, courbes `v4-line`, barres `v4-hbar`).
- En-tête-résultat : Réponses (nom surligné qui se révèle), Concurrents (ligne « Vous » + barres qui se remplissent, « Pourquoi ils passent devant » remonté), Centre d'actions (glisser vers « fait », coche animée, progression), Trafic (tableaux → listes avec barres), Vérité (grille qui s'allume), Copilote (réponse qui s'écrit, puces), Questions, Pages citées, Ce que disent les IA, Carte (quartiers qui s'allument depuis votre zone), Annuaires, Produits, Revendeurs, Prix et avis, Ventes. Squelettes : actions, trafic, vérité.
- Réglages : `suivi_month` retiré → `PlanChoice` (offres réelles plans.ts selon parcours, actuelle mise en avant, lien /tarifs) + test.
- Correctif : liens copilote des écrans Local/Produits perdaient la question (`copilotHref` → `context=<écran>&q=`).
- Mouvement réduit (règle corrigée) : déplacements seuls coupés ; texte qui s'écrit, barres, courbes, surligneur jouent. Testé Playwright reduce / no-preference (glisser, clavier).
- Adopté SYSTEME : ProgressBar dans WeeklyTasks, Delta « stable » neutre ; v4.css chargé par layout (imports par page retirés).
- tsc et vitest (87) verts.

## Reste
- Captures avant/après faites (qa/v4/APP-ECRANS) ; serveur 4102 tué par OOM à répétition : quelques 500 transitoires reprises. Notifications, bienvenue = dossier shell (SYSTEME), non retouchés.
- Toast de « C'est fait » arrive après la réponse de /api/exec/tasks (lent en dev) ; la coche, elle, est immédiate.
- Admin (src/app/admin) hors de mon périmètre.

## À faire par d'autres
- SYSTEME : `ActionButton` non adopté pour « C'est fait » (il ne permet pas de revenir à « à faire ») ; DoneButton a déjà pression + coche dessinée + toast.
