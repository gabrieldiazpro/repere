# V6 — « au niveau du marché » (lancé 15 nov. 2026)

Demande du fondateur : un site au niveau des leaders (Semrush, Ahrefs, Peec, Otterly…). Ce qui dépend de lui (mise en
ligne, clés d'IA, clients pilotes, juridique) est hors de cette vague. Ici : notre propre site exemplaire, contenu de fond,
Wix dans l'agent, fonctions agences.

Règles : celles de /home/claude/auditia/docs/v5/00-BRIEF-V5.md (aucune donnée inventée présentée comme réelle, aucune
promesse de résultat, démo étiquetée, rien publié chez un client sans validation), /home/claude/auditia/docs/v3/missions/_COMMUN.md
(verrou `flock /tmp/repere-heavy.lock` pour tsc/vitest ; jamais next build/dev/start dans le dossier principal ; pas de réseau
sortant dans les tests) et /home/claude/auditia/docs/v4/DESIGN-COMMUN.md (design, mouvement, mobile 390, sombre).
Mémoire : 8 Go. Un seul Chromium à la fois, deviceScaleFactor 1, fermé entre les lots. Serveurs :
- SITE-SEO-90 : build de production dans sa propre copie (port 4201), voir scratchpad/start-4200.sh et prod-env.sh comme modèle.
- AGENCES : dev qa-app port 4102 (scratchpad/sync.sh qa-app ; dev.sh qa-app 4102).
- WIX : dev qa-fn port 4103 (sync.sh qa-fn ; dev.sh qa-fn 4103), seulement le temps des captures.
- GUIDES : pas de serveur (tests + rendu vérifié par SITE-SEO-90 à la fin).
Scratchpad : /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad

## Périmètres exclusifs
| Agent | Possède |
|---|---|
| GUIDES | src/lib/seo/guides-v6.ts (nouveau) + la seule ligne d'enregistrement dans src/lib/seo/guides.ts ; images/illustrations SVG des guides sous public/guides/v6/** |
| SITE-SEO-90 | tout le site public hors contenu des guides : src/app (hors src/app/app/**, src/app/admin/**, src/app/api/**), src/components/site/**, src/components/pages/**, src/lib/seo/** (hors guides*.ts), next.config.ts, public/** (hors public/guides/v6), sitemap, robots, llms.txt |
| WIX | src/lib/publish/** (ajout Wix + Bing Places si faisable), src/app/api/v5/publish/**, les écrans de connexion de src/app/app/agent/** et src/components/app/agent/** |
| AGENCES | fonctions agences : src/app/app/** hors agent, src/components/app/** hors agent, src/lib/agency/** (nouveau), src/lib/reports/** , src/lib/entitlements/** |
Demandes à un autre agent : /home/claude/auditia/docs/v6/demandes-<NOM>.md. Journal : /home/claude/auditia/docs/v6/progress/<NOM>.md.

## Plan de nuit (fondateur endormi, 15 nov. 00 h 45 : « fais tout ce que tu penses juste pour être leader au lancement »)
Vague 1 (en cours) : SITE-SEO-90, GUIDES, WIX, AGENCES.
Vague 2 (dès que la mémoire le permet) :
- ROBUSTESSE : crawler et analyse face aux sites difficiles (lents, JS seul, robots bloquants, redirections en boucle,
  sitemaps géants, encodages, Cloudflare/anti-bots, sites Wix/Shopify/Squarespace typés) + rendu JS optionnel désactivé par défaut.
- LANCEMENT : programme « clients pilotes » (page publique honnête + suivi admin), kit presse, plan de lancement 30 jours
  (doc), séquences e-mail d'acquisition conformes CNIL.
- OPS : supervision des erreurs et de la disponibilité, page statut, sauvegardes, alertes (sans service payant imposé).
Vague 3 : REGARD-CLIENT (œil neuf : parcours complets d'un artisan, d'une PME, d'un e-commerçant, d'une agence, comparés
aux leaders ; corrige le plus gênant), puis vérification finale (tsc, vitest, eslint, build, sitemap), vidéos si l'UI a
changé, push GitHub, mise à jour du dossier Docs, point au fondateur.
Rien d'irréversible ni de payant sans le fondateur : pas de mise en ligne, pas d'inscription à des services.
Mise à jour 00 h 45 : le fondateur autorise à CHOISIR des services gratuits (offres gratuites durables, sans carte bancaire
de préférence, hébergés UE si possible). On choisit, on intègre, on documente en 1 étape pour lui ; la création des comptes
(mot de passe, vérification) reste à faire par lui à son réveil.

## Vague 2 lancée tôt (00 h 50) — périmètres retirés à SITE-SEO-90
| ROBUSTESSE | src/lib/crawl/**, src/lib/siteaudit/**, src/lib/analysis/**, correctifs démontrés dans seoaudit/geo |
| OPS | src/lib/ops/**, src/app/api/ops/**, src/app/api/health/**, src/app/admin/ops/**, src/app/statut/**, scripts/ops (ajouts) |
| OUTILS | src/components/tools/**, src/app/outils/** (SITE-SEO-90 n'y touche plus ; demandes-OUTILS.md) |
| LANCEMENT | src/app/pilotes/**, src/app/presse/**, src/lib/pilots/**, src/app/admin/pilotes/**, docs/lancement/** |
Ajouts au menu, pied de page, sitemap, llms.txt → demande à SITE-SEO-90 (demandes-SITE-SEO-90.md), qui les intègre.
Serveur partagé pour OUTILS et LANCEMENT : dev qa-site 4101 (sync.sh qa-site ; dev.sh qa-site 4101), seulement si la
mémoire libre dépasse 2,5 Go (free -m) ; un seul Chromium à la fois.
| GEO-MARQUE (00 h 50) | faire recommander REPÉRÉ lui-même par les IA et les moteurs : src/app/etudes/**, src/lib/studies.ts, src/app/glossaire/**, src/app/questions/** (retirés à SITE-SEO-90), docs/visibilite-repere/** ; le reste du site via demandes-SITE-SEO-90.md |
