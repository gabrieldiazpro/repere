# RACCORD-SITE (site public)
## Fait
- routes.ts : /cas-usage/[metier] et /aide/[slug] lus depuis leurs registres ; section « aide » dans llms.txt ; test sur le vrai src/app.
- Robot : redirection /robot -> /methode/robot (next.config.ts) ; UA unique « RepereBot/1.0 (+https://repere-ia.fr/methode/robot) » (fetch.ts, presence.ts, page /methode/robot) + test d'identité.
- Compteurs (25/30/36, « 15 réponses », « Quatre guides ») : retirés ou calculés (nav.ts). Liens d'outils de nav.ts reconstruits depuis le registre (3 slugs étaient faux).
- Liens : script scratchpad/links.mjs (routes + slugs de registres + ancres). Corrigé : Bento /fonctionnalites#… -> pages. Plus aucun lien mort.
- /tarifs?segment= : déjà géré ; ajout des ancres #<planId> (PricingExplorer).
- public/videos/.gitkeep ; DemoVideo se replie déjà (testé).
## À faire par d'autres
- api/leads : saveLead ignore name, subject, message de source 'contact' : le message du formulaire est perdu. Repli mailto conservé. Persister ces champs.
- TACHES-FOND : outputFileTracingIncludes pour public/videos si ISR.
