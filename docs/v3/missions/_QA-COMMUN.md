# Règles communes aux agents de contrôle qualité V3 — à lire après _COMMUN.md

## Serveurs de test (déjà lancés par l'orchestrateur, mode démo, secrets factices)
| Agent | Copie de test | Serveur de dev |
|---|---|---|
| QA-VISUEL-SITE | /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/qa-site | http://localhost:4101 |
| QA-VISUEL-APP | /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/qa-app | http://localhost:4102 |
| QA-FONCTIONNEL | /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/qa-fn | http://localhost:4103 |
- Tu modifies le code dans le dossier PRINCIPAL /home/claude/auditia/app (jamais dans la copie), puis tu lances
  `/tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/sync.sh <ta-copie>` : le serveur de dev de ta copie recharge à chaud.
- Si ton serveur ne répond plus : `fuser -k <port>/tcp; /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/dev.sh <ta-copie> <port>` puis attends 20 s. Journal :
  /tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/dev-<port>.log. N'utilise jamais le port d'un autre agent pour tester TES modifications.
- Toujours interdit : `next build`, `next dev` ou `next start` dans le dossier principal. tsc et vitest uniquement
  par le verrou (`flock /tmp/repere-heavy.lock …`), tsc 3 fois max.
- Playwright est préinstallé (`require('playwright')`, lance tes scripts depuis /home/claude/auditia/app). Un seul
  navigateur à la fois, ferme-le après chaque passe. Captures dans /home/claude/auditia/qa/v3/<ton-nom>/, à
  regarder avec Read (réduis-les avec PIL si elles sont très hautes).
- En local, les erreurs console « ERR_SSL_PROTOCOL_ERROR » sur les préchargements viennent de la CSP
  (upgrade-insecure-requests) en http : à ignorer, sauf si tu constates que la CSP est mal configurée pour le dev.
- Comptes démo : /app?compte=demo (local), /app?compte=demo-pme, /app?compte=demo-ecom.
- Périmètres de correction (pour ne pas se marcher dessus) :
  - QA-VISUEL-SITE : pages publiques (tout src/app sauf app/ et api/), src/components/{site,motion,pages,tools,report,ui}/**, globals.css.
  - QA-VISUEL-APP : src/app/app/**, src/components/app/**.
  - QA-FONCTIONNEL : src/lib/**, src/app/api/**, src/middleware.ts, src/instrumentation*.ts, next.config.ts, supabase/**.
  Un défaut hors de ton périmètre → écris-le dans /home/claude/auditia/qa/v3/a-corriger-<propriétaire>.md (une ligne
  précise : page, défaut, fichier, correction), le propriétaire le lira.
- Journal de progression docs/v3/progress/<TON-NOM>.md tenu à jour (le conteneur peut redémarrer).
