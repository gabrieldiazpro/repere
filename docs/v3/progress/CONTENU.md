# CONTENU — journal
**Reprise** : /comparatif (page + [slug]) et seo/competitors.ts de l'agent précédent relus : complets, conservés.
**Fait** : 1 /comparatif ; 2 /methode V3 (V3Sections.tsx, rules.ts, METHOD_VERSION v3.0) + /methode/robot ; 3 CGV + confidentialité ;
4 guides (seo/guides-v3.ts, 4 guides 1 000-1 400 mots) ; 5 glossaire 36 termes, questions 30 ; 6 sitemap (seo/routes.ts, fs + noindex) + llms.txt (route existante src/app/llms.txt/route.ts, pas de public/llms.txt : conflit de route) ; tests seo/__tests__/content.test.ts (19 verts)
**Reste** : tsc final ; relire /cas-usage quand PAGES-SITE aura fini.
**À faire par d'autres** :
- UA de RepereBot : siteaudit/fetch.ts pointe vers https://repere-ia.fr/robot et engine/sources/presence.ts vers https://repere.fr/bot → next.config.ts (TACHES-FOND) redirects /robot → /methode/robot ; aligner les 2 UA.
- Compteurs devenus faux : nav.ts l.16-17 (« 25 réponses », « 30 termes »), app/page.tsx l.55 et 478, e-commerce/page.tsx l.37, local/page.tsx l.36, tarifs/page.tsx l.251 : 25 → 30 questions, 30 → 36 termes (MOTION, PAGES-SITE).
- PAGES-SITE : /cas-usage/* est lu par dossiers littéraux ; si un registre [slug] est créé, l'importer dans lib/seo/routes.ts.
- Sources des 4 guides non rouvertes (réseau sortant bloqué) : à revérifier avant publication (surtout schema.org, Google Product, RFC 9309).
- CGV/confidentialité : placeholders [À COMPLÉTER]/[À VÉRIFIER] conservés, pages restent noindex.
