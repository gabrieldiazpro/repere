# Checklist de mise en production

> **Guide pas à pas (fondateur, sans développement) : `docs/MISE-EN-LIGNE.md`.** Scripts associés :
> `secrets.mjs` (fichier `.env.production.local`), `migrate.mjs` (base, `--tout-en-un`, `--cron`), `stripe-setup.mjs`
> (produits, prix, webhook, portail), `check-env.mjs --prod` (contrôle avant envoi), `verifier-prod.mjs` (site en ligne).
> La liste ci-dessous reste la référence technique.

À dérouler dans l'ordre avant d'encaisser le premier paiement. Cochez chaque ligne.

## 1. Comptes et plans
- [ ] Vercel **Pro** (le plan Hobby interdit l'usage commercial et limite les crons à une exécution par jour).
- [ ] Supabase : projet en région UE (Francfort ou Paris), Pro conseillé (sauvegardes, voir `backup.md`).
- [ ] Stripe en mode live, Resend avec domaine vérifié (SPF, DKIM, DMARC), Sentry (offre gratuite) facultatif.

## 2. Base de données
- [ ] `supabase/schema.sql` exécuté, puis les migrations dans l'ordre : `supabase/migrations/0003_comptes.sql`,
      `0004_jobs.sql` (table `jobs`, `jobs_claim`, `jobs_stats`, `jobs_purge`), `0005_lead_sources.sql`.
      En une commande : `node scripts/ops/migrate.mjs` (ou `supabase/TOUT-EN-UN.sql` dans l'éditeur SQL).
- [ ] Déclenchement du worker chaque minute par pg_cron + pg_net (indépendant du plan Vercel) :
  ```sql
  create extension if not exists pg_cron; create extension if not exists pg_net;
  select cron.schedule('repere-worker', '* * * * *', $$ select net.http_post(
    url := 'https://<domaine>/api/cron/worker',
    headers := jsonb_build_object('authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 5000) $$);
  select cron.schedule('repere-jobs-purge', '23 3 * * *', 'select jobs_purge()');
  select cron.schedule('repere-purge', '41 3 * * *', 'select purge_old_data()');
  ```
  Sinon : Vercel Pro, cron `/api/cron/worker` passé à `* * * * *` dans `vercel.json`.

## 3. Variables d'environnement (Vercel › Settings › Environment Variables, environnement Production)
- [ ] `node scripts/ops/check-env.mjs` : toutes les variables lues par le code sont documentées dans `.env.example`.
- [ ] Obligatoires (sinon **l'application refuse de démarrer**, `src/lib/env.ts`) : `SUPABASE_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` (https), `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `AUDIT_SIGNING_SECRET`,
      `RATE_LIMIT_SALT` (secrets : `openssl rand -hex 32`, tous différents).
- [ ] Recommandées : `NEXT_PUBLIC_SUPABASE_URL` (lue au build pour la CSP), `AUTH_SECRET`, `SHARE_SECRET`,
      `INTEGRATIONS_SECRET`, `DIGEST_SIGNING_SECRET`, `SENTRY_DSN`, clés IA, `STRIPE_PRICE_*`, `LEGAL_*`, `NEXT_PUBLIC_LEGAL_*`.
- [ ] `DEMO_MODE` vide, `CSP_REPORT_ONLY` et `CSP_DISABLE` vides, `AUTH_LOCAL_ACCOUNTS` vide.

## 4. Démarrage et santé
- [ ] `src/instrumentation.ts` appelle `assertEnv()` au démarrage (voir plus bas si absent).
- [ ] `GET https://<domaine>/api/health` → `status: ok` ; avec `Authorization: Bearer <CRON_SECRET>` : détail
      (`db`, `env.errors` vide, `jobs`).
- [ ] Moniteur gratuit (UptimeRobot, Better Stack) sur `/api/health`, alerte si code ≠ 200 (une tâche morte ou une
      tâche prête depuis plus de 30 minutes passe le statut à `warn`, une base injoignable à `fail` / 503).
- [ ] Webhook Stripe → `https://<domaine>/api/stripe/webhook` ; achat test réel remboursé : compte créé, e-mail reçu,
      premier audit visible (`GET /api/jobs/<id>` passe à `done`).

## 5. Sécurité
- [ ] CSP appliquée (en-tête `Content-Security-Policy`, pas `-Report-Only`) : `curl -sI https://<domaine>/ | grep -i content-security`.
- [ ] Une semaine après l'ouverture : lire les `csp.violation` dans les journaux et ajuster `next.config.ts`.
- [ ] HSTS sans `preload` ; ne l'ajouter qu'après inscription volontaire du domaine sur hstspreload.org.
- [ ] Sauvegardes : `backup.md`, premier test de restauration fait et noté.

## 6. Légal
- [ ] Plus aucun « [À COMPLÉTER] » dans `src/app/{cgv,mentions-legales,confidentialite}` (raison sociale, SIREN,
      adresse, contact RGPD, hébergeurs, médiateur de la consommation).
- [ ] Export et suppression des données testés depuis les Réglages (`GET`/`DELETE /api/account/data`).

---

## Annexe A — démarrage validé (`src/instrumentation.ts`)
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertEnv } = await import('@/lib/env');
    assertEnv(); // lève en production si un secret obligatoire manque (sauf DEMO_MODE=1)
  }
}
```

## Annexe B — CSP à nonce (supprime `'unsafe-inline'` des scripts)
La CSP de `next.config.ts` est statique : Next 15 injecte des scripts inline dont le contenu varie, d'où
`'unsafe-inline'`. Pour passer au nonce, le middleware doit couvrir **toutes les pages** et poser la CSP par requête ;
Next lit alors le nonce dans l'en-tête de la requête et l'applique à ses propres scripts (les pages deviennent
dynamiques : coût de rendu à mesurer). Dans `src/middleware.ts` :
```ts
const nonce = btoa(crypto.randomUUID());
const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; ` +
  `img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com ${SUPABASE} ; ` +
  `frame-src 'self' https://js.stripe.com https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'self'; ` +
  `object-src 'none'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com; report-uri /api/health/csp-report`;
const headers = new Headers(req.headers);
headers.set('x-nonce', nonce);
headers.set('content-security-policy', csp);
const res = NextResponse.next({ request: { headers } });
res.headers.set('content-security-policy', csp);
```
Puis `CSP_DISABLE=1` n'est plus nécessaire : les deux politiques se cumulent (la plus stricte s'applique). Matcher à
élargir à `'/((?!_next/static|_next/image|favicon.ico|t.js).*)'`.
