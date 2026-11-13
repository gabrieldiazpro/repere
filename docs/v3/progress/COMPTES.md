# Journal COMPTES — terminé
## Fait
- @/lib/auth (session cookies httpOnly, lien magique PKCE/token_hash, compte local console, requireBusiness, rôles, compat, équipe, provision achat), @/lib/entitlements, src/middleware.ts (nodejs), /api/account/{login,signup,logout,session,businesses,portal}, /api/team(+accept), /connexion(+callback), /inscription, /bienvenue, /app/connexion→/connexion, webhook+checkout (segment, 2ᵉ achat, business_id serveur, client Stripe réutilisé), portail → /app/reglages, SQL 0003 + schema.sql, 26 tests verts ; tsc propre sur le périmètre
- Env : AUTH_SECRET (prod), SUPABASE_JWT_SECRET (option), NEXT_PUBLIC_SUPABASE_ANON_KEY, AUTH_LOCAL_ACCOUNTS (option)
## À faire par d'autres
- execution/auth.ts : `export { bearer, canEditBusiness, BUSINESS_ID_RE } from '@/lib/auth/compat';`
- components/app/data.ts : sessionUser = getSession() de @/lib/auth ; connecté sans espace → redirect('/bienvenue'), jamais la démo ; workspace.ts : segment = b.segment, planLabel = TIER_NAMES[getEntitlements(b).tier] ; loadWorkspace en cache()
- Shell : retirer SessionSync ; LoginForm.tsx obsolète ; Settings : déconnexion = POST /api/account/logout, abonnement = POST /api/account/portal {businessId} (supprimer NEXT_PUBLIC_STRIPE_PORTAL_URL) ; actionQueue.ts/localDemo.ts : rp_session est httpOnly, ne plus le lire
- api/actions, tracking/handlers.ts, connect/ga4/start : remplacer getUserIdFromAccessToken(bearer) par requireBusiness
- PAGES-SITE : /merci « lien d'accès envoyé à l'adresse du reçu » + /connexion ; Header « Se connecter » → /connexion ; Découverte → /inscription?parcours=… ; liens démo → /app?compte=demo|demo-pme|demo-ecom (tous agents)
- TACHES-FOND : cron mensuel exclut plan 'free' → Découverte (1 mesure/mois) via getEntitlements().frequency ; .env.example ; console Supabase : inscriptions publiques OFF, Redirect URL <APP_URL>/connexion/callback
