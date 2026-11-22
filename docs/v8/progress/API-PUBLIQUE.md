# Journal — agent API-PUBLIQUE (V8, 22 nov. 2026)

## Fait
- **API REST v1** `src/app/api/public/v1/[[...path]]/route.ts` → `src/lib/publicapi/router.ts` ; table unique `routes.ts`
  (19 routes : me, espaces, scores + historique, mesures (+ POST nouvelle mesure bornée par l'offre), questions
  (GET/POST/DELETE) + réponses des IA, concurrents/part de voix, sources, constats, priorités, propositions (lecture
  seule, `reviewUrl` vers l'app), rapports). Marges : score/taux/part de voix à 90 % (computeMargins), Wilson par
  question × IA. Pagination par curseur lié à la liste, erreurs au format unique, `X-Request-Id`, `X-RateLimit-*`.
- **OpenAPI 3.1** générée depuis la table (`openapi.ts`, section `webhooks` comprise), servie sans clé sur
  `/api/public/v1/openapi.json`.
- **Clés** (`keys.ts`, `access.ts`) : `rp_live_<id>_<secret 256 bits>`, HMAC-SHA256 stocké, comparaison en temps
  constant, affichées une fois, 10 actives max ; portée espace ou agence (réévaluée à chaque requête ; rôle perdu → 401) ;
  lecture / écriture ; offres Accompagné, Agence, démo (402 sinon). Espace hors portée → 404 (pas d'oracle).
- **Limites et journal** (`usage.ts`) : 120 lectures / 20 écritures par min, 10 000/jour par clé ; démo 30/min et
  1 000/jour par IP ; compteurs quotidiens + 50 derniers appels (sans jeton, corps ni IP).
- **Réglages › API** `src/app/app/reglages/api/` (page, KeyManager, actions serveur) : création, jeton une fois,
  révocation, journal 30 j ; démo : clé de démonstration affichée, rien créé.
- **MCP** `src/app/api/mcp/route.ts` → `mcp.ts` : Streamable HTTP, révision 2026-07-28 (sans session, en-têtes
  MCP-Protocol-Version / Mcp-Method / Mcp-Name, -32020, -32022, 404/-32601, 202, GET/DELETE 405, Origin → 403,
  server/discover) + compatibilité `initialize` 2025-03-26 → 2025-11-25. Outils lecture : lister_espaces, scores,
  questions_reponses, priorites, concurrents. Aucun SDK installé (interdit) : implémentation minimale testée.
  Sources : modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http, /basic/versioning,
  /server/discover.
- **Webhooks** : système d'intégrations existant réutilisé ; `audit.completed` (nouvelle mesure, existant),
  `score.dropped` (intervalles à 90 % disjoints vs mesure comparable), `proposal.pending` (`webhooks.ts`).
- **/developpeurs** : présentation, authentification, curl + JS, pagination/erreurs, limites, référence générée,
  webhooks + vérification de signature, MCP (commande Claude Code vérifiée sur code.claude.com), clé démo.
- **Démo** : `DEMO_API_KEY` publique, lecture seule, comptes demo / demo-pme / demo-ecom, `demo: true` partout.
- Tests : `src/lib/publicapi/__tests__/publicapi.test.ts` (33 : isolation, hachage, révocation, rôle perdu, offres,
  lecture seule, démo, pagination, 429, OpenAPI, MCP moderne/ancien, webhooks).

## Modifications minimales hors périmètre (relues)
- src/lib/integrations/index.ts : EVENTS + libellés `score.dropped`, `proposal.pending`.
- src/lib/notify/index.ts : bloc qui diffuse ces deux événements (webhook seulement) pour audit_done / agent_proposals.

## Vérifications
- tsc : 0 erreur dans mon périmètre (erreurs restantes : src/components/tools/v8/registry.ts (ECOM, en cours) puis
  src/lib/content/__tests__ (AGENT-CONTENU)). eslint : 0 erreur chez moi (1 erreur dans
  src/components/app/contenu/Facts.tsx, AGENT-CONTENU). vitest complet : 2169 OK, 7 échecs hors périmètre
  (notify.test « rapports planifiés » échoue aussi sans ma modification ; inscription-libre ; copilot demo-ecom ;
  délai rank.test sous charge).

## Reste / À faire par d'autres
- Orchestrateur : lien « API et MCP » → /app/reglages/api dans src/app/app/reglages/page.tsx (SECTIONS ou panneau
  Intégrations) ; champ `api: boolean` dans Entitlements (règle aujourd'hui dans publicapi/access.ts `apiAllowed`).
- SITE : menu / pied de page / sitemap / llms.txt / tarifs → demandes-SITE.md.
- AGENT-CONTENU : `proposal.pending` quand l'agent notifie en mode « app » → demandes-AGENT-CONTENU.md.
- Env facultatives : PUBLIC_API_KEY_PEPPER (le changer invalide les clés), PUBLIC_MCP_ALLOWED_ORIGINS.
- MCP par OAuth (clients qui n'acceptent pas d'en-tête) : non fait.
