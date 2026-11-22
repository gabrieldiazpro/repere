# V8 — faire mieux que Semji, BabyLoveGrowth et RAKOR (lancé 22 nov. 2026)

Demande du fondateur : « Oui lance et va plus loin » après l'étude concurrentielle :
- Semji : audit GEO gratuit sans carte sur 7 IA (ChatGPT, Gemini, Perplexity, AI Overviews, AI Mode, Claude, DeepSeek),
  accroche marque « Votre marque est-elle citée par l'IA ? », benchmark concurrents, consultant dédié ; cible ETI, prix cachés.
- BabyLoveGrowth (99–299 $/mois) : « entrez votre URL et ne touchez plus à rien » — 30 articles/mois publiés seuls,
  échange de liens (4 000 sites), agent Reddit ; critiques : qualité, liens rares, note Trustpilot suspendue, risques spam Google.
- RAKOR (relances e-commerce) : avant/après chiffré très lisible, « Simulation pour ma boutique », PrestaShop/WooCommerce/Magento.
Notre angle : on fait le travail comme BabyLoveGrowth, mesuré sur plus d'IA que Semji, pour les petites entreprises, sans
rien de ce que Google pénalise, avec validation du client et marges d'erreur.

Règles : /home/claude/auditia/docs/v5/00-BRIEF-V5.md (aucune donnée inventée présentée comme réelle, démo étiquetée,
aucune promesse de résultat, rien publié chez un client sans validation, réversible), /home/claude/auditia/docs/v3/missions/_COMMUN.md
(flock /tmp/repere-heavy.lock pour tsc/vitest ; jamais next build/dev/start dans le dossier principal ; pas de réseau dans les
tests), /home/claude/auditia/docs/v4/DESIGN-COMMUN.md (design, mouvement, 390, sombre ; JAMAIS de logos officiels d'IA :
noms en texte ou pictos génériques). Pas de spam : pas d'échange de liens, pas de production de masse, pas de faux comptes,
pas de commentaires non déclarés sur Reddit/forums.
Mémoire 8 Go : un seul Chromium à la fois, deviceScaleFactor 1. Serveurs de dev : qa-site 4101, qa-app 4102, qa-fn 4103
(scratchpad/sync.sh <copie> ; scratchpad/dev.sh <copie> <port>), seulement si `free -m` montre > 2,5 Go libres ; ne touche
pas au serveur 4200. Scratchpad : /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad
Journal : /home/claude/auditia/docs/v8/progress/<NOM>.md. Demandes à un autre : /home/claude/auditia/docs/v8/demandes-<NOM>.md.
Fin de chaque agent : tsc, vitest complet, eslint (0 erreur) verts ; rien poussé sur GitHub.

## Périmètres exclusifs
| Agent | Possède |
|---|---|
| MOTEURS-IA | src/lib/engine/** (fournisseurs, sources), parties « IA » de src/lib/seodata (SERP AI Overviews / AI Mode), src/lib/measure/**, variables + docs MISE-EN-LIGNE pour les nouveaux fournisseurs |
| TEST-MARQUE | src/lib/analysis/**, src/app/analyse/**, src/components/analysis/**, src/app/api/v5/analysis/**, inscription libre : src/app/inscription/**, src/app/connexion/**, src/lib/auth/** |
| AGENT-CONTENU | src/lib/content/** (nouveau), src/app/app/contenu/**, src/components/app/contenu/**, src/lib/publish/** (cœur : création de pages/articles) sauf connectors/magento.ts, src/app/app/agent/** pour le raccord |
| ECOM | src/lib/publish/connectors/magento.ts (+ enregistrement minimal du connecteur), src/app/outils/** et src/components/tools/** pour le simulateur, pages e-commerce publiques via demandes à SITE (pas de propriétaire : modifications minimales notées) |
| API-PUBLIQUE | src/app/api/public/**, src/lib/publicapi/** (nouveau), src/app/app/reglages/api/** (clés), src/app/developpeurs/** (doc publique), serveur MCP en lecture (src/app/api/mcp/**) |
| PUBLICITE | /home/claude/auditia/docs/pub/** et /home/claude/auditia/pub/** (créations), aucun code de l'app |
Tout le reste (accueil, tarifs, menu, sitemap, llms.txt) : demandes dans demandes-SITE.md ; l'orchestrateur ou l'agent
REGARD final les intègre.
