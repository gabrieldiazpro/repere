# V9 — idées reprises de Fairly Made (lancé 23 nov. 2026)

Le fondateur a validé (« fait tout ») : 1. veille Google + IA (comme leur Legal Hub), 2. fiche officielle vérifiée de
l'entreprise + encart à poser sur son site (comme leur passeport produit/« Communicate »), 3. contenu premium à télécharger
contre e-mail, 4. newsletter mensuelle, 5. double appel « Tester gratuitement » + « Réserver une démo » (Accompagné, Agence),
6. programme partenaires (agences, plateformes, fédérations, experts-comptables), 7. simulateur de scénarios dans l'app
(« si je corrige ces points » : effet sur les contrôles mesurés, jamais un gain promis). Hors périmètre : traductions.

Règles : /home/claude/auditia/docs/v5/00-BRIEF-V5.md (aucune donnée inventée présentée comme réelle, démo étiquetée,
aucune promesse de résultat), /home/claude/auditia/docs/v3/missions/_COMMUN.md (flock /tmp/repere-heavy.lock pour tsc/vitest ;
jamais next build/dev/start dans le dossier principal ; pas de réseau dans les tests), /home/claude/auditia/docs/v4/DESIGN-COMMUN.md.
E-mails : consentement explicite (CNIL), double opt-in pour la newsletter, désinscription en un clic (réutiliser
src/lib/email.ts et la liste de désinscription existante). Pas de faux témoignages, logos ou partenaires inventés : un
partenaire n'apparaît que s'il existe (liste vide = état « devenez le premier »).
Mémoire 8 Go : un seul Chromium à la fois, deviceScaleFactor 1 ; serveurs de dev qa-site 4101 / qa-app 4102 / qa-fn 4103
(scratchpad/sync.sh, scratchpad/dev.sh) seulement si `free -m` > 2,5 Go libres ; ne touche pas au serveur 4200.
Scratchpad : /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad
Journal : /home/claude/auditia/docs/v9/progress/<NOM>.md ; demandes : /home/claude/auditia/docs/v9/demandes-<NOM>.md.
Menus, pied de page, accueil, sitemap, llms.txt : demandes à SITE (demandes-SITE.md), intégrées par l'agent final.
Fin de chaque agent : tsc, vitest complet, eslint (0 erreur) ; rien poussé sur GitHub.

## Périmètres exclusifs
| Agent | Possède |
|---|---|
| VEILLE | src/app/veille/**, src/lib/veille/** (nouveau), src/app/ressources/** (contenu premium), src/lib/newsletter/**, src/app/api/newsletter/**, src/app/admin/newsletter/** |
| FICHE-OFFICIELLE | src/app/p/**, la partie fiche publique de src/lib/execution/**, src/app/app/fiche/** (nouveau), src/app/api/fiche/** et la route de l'encart (src/app/encart/** ou équivalent) |
| PARTENAIRES | src/app/partenaires/**, src/lib/partners/** (nouveau), src/app/admin/partenaires/**, src/app/rendez-vous/** (réserver une démo), src/lib/meetings/** |
| SCENARIOS | src/lib/scenarios/** (nouveau), src/app/app/scenarios/** et l'intégration minimale dans /app/seo et le Centre d'actions |
