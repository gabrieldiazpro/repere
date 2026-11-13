# Tracking du trafic IA

- Snippet : `<script async src="https://…/t.js" data-site="BUSINESS_ID"></script>` (`snippetFor`). Aucun cookie, aucun stockage local.
- `POST /api/t` (beacon, CORS ouvert, corps ≤ 2 Ko, 204) : agrégats `track.daily` / `track.pages`. Ni IP, ni user agent, ni identifiant.
  Le total de visites (toutes sources) est compté ; seuls moteur, chemin d'arrivée et conversion des visites IA sont conservés.
- `POST /api/t/bot` : plugin WordPress, en-tête `x-repere-key` = HMAC-SHA256 hex de `businessId` (`botKeyFor`), corps `{businessId, ua, path}`.
- `GET /api/t/summary?businessId=…&days=…` : `AiTrafficSummary` (comptes `demo`, `demo-pme`, `demo-ecom` en accès libre, données démo si vide).
- GA4 : `GET /api/connect/ga4/start?businessId=…` (Bearer) renvoie `{url}` ; `/callback` stocke le refresh token chiffré.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `AUDIT_SIGNING_SECRET` | HMAC des robots, état OAuth, clé AES-GCM des jetons GA4 (obligatoire en production) |
| `NEXT_PUBLIC_SITE_URL` | Origine publique : `src` du snippet, redirect URI GA4 (`/api/connect/ga4/callback`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Client OAuth Google ; absents = connecteur GA4 désactivé (503) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persistance (sinon fichiers `.data/`) |

Limites : le trafic IA est un plancher mesuré ; Google AI Mode / Overviews sont indiscernables ; le direct n'est jamais attribué à une IA.
