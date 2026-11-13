# Mission AUDIT-SITE (journal : docs/v3/progress/AUDIT-SITE.md)

Le contrat des endpoints (§ Endpoints AUDIT-SITE de 12-CONTRATS-V3.md) est FIGÉ : d'autres agents s'y branchent.

## À lire
- docs/v3/04-teardown-suites.md (audit « AI readiness », optimiseur de citabilité), docs/v3/02-teardown-midmarket.md
  (citabilité par règles), docs/v3/06-teardown-ecommerce.md (audit de fiche produit), docs/v3/11-outils-gratuits.md,
  docs/v2/05-ai-sources.json (user agents des robots IA), qa/v2/seo-geo-audit.md (ce qui fait citer une page).
- Code : src/lib/ratelimit.ts, src/lib/execution/ (buildJsonLd, reviewKit), src/lib/engine/sources* (vérification HTTP
  derrière verifyPresence : factorise la récupération sûre dans TON dossier).

## Périmètre exclusif
src/lib/siteaudit/**, src/app/api/siteaudit/**, src/app/api/tools/**.

## À livrer
1. **safeFetch** : anti-SSRF (résolution DNS, refus des IP privées, link-local, metadata ; redirections revalidées ;
   ports 80/443), délai 8 s, 2 Mo max, user agent « RepereBot/1.0 (+https://repere-ia.fr/robot) », respect de
   robots.txt pour notre robot, cache 10 min.
2. **robots** : analyseur complet de robots.txt (groupes, Allow/Disallow, jokers). Verdict par robot IA (GPTBot,
   OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, ClaudeBot, Claude-SearchBot, Claude-User,
   Google-Extended, Applebot-Extended, MistralAI-User, Bytespider, Meta-ExternalAgent, CCBot…), rôle de chacun
   (entraînement, recherche, navigation), recommandation nuancée.
3. **readiness** /100 : robots, HTTPS, statut, rendu sans JavaScript (ratio de texte dans le HTML brut, SPA vide),
   title, meta, h1, JSON-LD présent et valide, sitemap, canonical, lang, poids HTML, temps de réponse, llms.txt
   (0 point, information honnête), Open Graph. Contrôles {id, label, status, detail, fix}.
4. **citability** /100 par règles, sans IA : réponse directe en tête, titres en questions, paragraphes courts, listes
   et tableaux, chiffres sourcés (liens sortants), date visible, auteur, définitions, FAQ, longueur, liens internes,
   entités. Extraits citables détectés + suggestions de réécriture. Mode facultatif « avec IA » (clé présente).
5. **product** : extraction Product / Offer / AggregateRating (JSON-LD, microdonnées, Open Graph), attributs
   manquants, score /100, correctifs.
6. **compare** : readiness + citability de deux URL, côte à côte.
7. **Générateurs** : JSON-LD (réutilise buildJsonLd), validateur (champs requis par type), llms.txt.
8. **Les 9 routes /api/tools/** du contrat** (zod, limite par IP, {ok, data|error}) + /api/siteaudit (session,
   historique par commerce dans `siteaudit.runs`).
9. **Tests** avec fetch injecté et pages HTML d'exemple (bonne, mauvaise, SPA vide, fiche produit complète ou non,
   robots.txt variés) + anti-SSRF (IP privées, redirection vers 169.254.169.254, IPv6, DNS rebinding simulé).
