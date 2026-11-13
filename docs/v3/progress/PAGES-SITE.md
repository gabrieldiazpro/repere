# PAGES-SITE — journal (TERMINÉ, 10 nov.)
## Fait
- src/components/pages/** : données (features, aide 15, cas d'usage 6, démo, changelog, comparatif), mocks, visuels (DemoVideo + scènes MOTION), ui, RoiCalculator, ContactForm, DecouverteBand, CompareTable, merci ; 21 tests verts, tsc et eslint propres.
- /fonctionnalites (+ ancres mesurer|sources|verite|taches|trafic|copilote) et 10 pages /fonctionnalites/[slug] ; /demo ; /nouveautes + rss.xml ; /securite ; /integrations (GA4 « disponible » seulement si GOOGLE_CLIENT_ID/SECRET) ; /contact (?sujet=) ; /aide + 15 articles ; /cas-usage + 6 métiers.
- /tarifs : Découverte en tête, tableau #comparer, calculateur #rentabilite (seuil, aucune promesse), FAQ, CTA /inscription?parcours=.
- Navigation : Produit, Solutions, Outils gratuits, Tarifs, Ressources ; « Voir la démo », Connexion (/connexion), « Essai gratuit » (/inscription) ; menu mobile repliable ; footer complet.
- /merci : états (Découverte, abonnement, Accompagné, audits) ; « Ouvrir mon espace » → /app si session, sinon /connexion?next=/app.
## Non livré
- Captures visuelles (next dev interdit) : contrôle visuel à faire au build d'intégration.
## À faire par d'autres
- Orchestrateur (src/app/api/leads) : accepter source 'contact' + name, subject, message sans trade/city (sinon repli mailto).
- CONTENU : sitemap.ts et llms.txt avec les nouvelles pages ; PAGE_UPDATED.
- AUDIT-SITE : USER_AGENT pointe vers /robot ; la page est /methode/robot.
- OUTILS : /outils et les 8 slugs liés dans nav.ts (TOOLS).
- App 2b : lire /app?compte=demo|demo-pme|demo-ecom&visite=1&segment=….
