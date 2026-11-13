# Repéré V3 : audit technique

Date : 9 novembre 2026, soir. Audit en **lecture seule** : aucun fichier de code n'a été modifié.
Périmètre : `/home/claude/auditia/app` (build V2 servi sur http://localhost:3000), `supabase/schema.sql`, `qa/securite.md`, `qa/v2/securite-v2.md`.

## Méthode et mesures réelles

| Mesure | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint .` | 26 problèmes : 7 erreurs (`no-explicit-any`, toutes dans `scripts/batch-audit.ts` et `scripts/build-leads.ts`) et 19 avertissements (variables inutilisées, un `<img>`) |
| `npx vitest run` | 18 fichiers, **302 tests verts** en 42 s. Pas de couverture mesurable : `@vitest/coverage-v8` n'est pas installé (estimation par module au §3) |
| Poids JS (gzip, calculé depuis `.next/app-build-manifest.json`) | `/` 106 kB · `/tarifs` 118 kB · `/audit` 118 kB · **`/app/*` 182 kB** |
| HTML | `/` 274 kB brut (41 kB gzip) · `/tarifs` 234 kB brut |
| Pré-rendu | 197 routes : 109 en ISR (24 h), 88 statiques |
| Accessibilité (Playwright + axe-core 4.x local, 12 pages, bureau et mobile) | 0 violation critique · 2 sérieuses · 5 règles modérées · menu mobile sans piège de focus |
| En-têtes HTTP (`curl -I`) | complets, mais CSP en **Report-Only sans `report-uri`** |
| Dépôt git / CI | **Aucun dépôt git** dans `/home/claude/auditia`, aucun workflow GitHub Actions |

## Notes par axe

| # | Axe | Note /10 | Verdict en une ligne |
|---|---|---|---|
| 1 | Authentification et multi-tenant | **2** | Le parcours payant ne mène pas à un compte : un client qui paie voit la démo « Plomberie Martin » |
| 2 | Tâches longues | **4** | Les crons sont bornés en temps et en partie idempotents, mais il n'y a ni file, ni reprise, ni onboarding asynchrone |
| 3 | Qualité du code | **6** | Typage strict et tests solides sur le moteur, mais couche d'adaptateurs et données démo en double, erreurs avalées et aucune observabilité |
| 4 | Performance | **7** | Bon niveau pour le site ; l'espace client charge supabase-js partout et lit deux fois les mêmes données par requête |
| 5 | Accessibilité | **7.5** | Base saine (lien d'évitement, `lang`, focus visibles, contrastes) ; manque `<main>` dans `/app` et un vrai menu modal |
| 6 | Sécurité résiduelle | **6.5** | 10 correctifs sur 10 vérifiés, mais une nouvelle faille sur le rattachement des comptes, et la CSP n'est jamais appliquée |
| 7 | i18n, RGPD technique, sauvegardes | **3** | Ni export, ni suppression de compte ; 51 « [À COMPLÉTER] » dans le code dont les pages légales ; aucune sauvegarde prévue |
| 8 | Expérience développeur | **3** | README détaillé mais périmé (grille V1), pas de git, pas de CI, pas de migrations versionnées ni de seed |

**Note globale : 4,9/10.** Le moteur et le site sont au niveau. Ce qui manque, c'est le socle SaaS : compte, session, droits, file de tâches et exploitation.

---

## 1. Authentification et multi-tenant (2/10)

### Le parcours tel qu'il fonctionne réellement (hors démo, Supabase et Stripe configurés)

```
Audit gratuit ──► /rapport/[id] ──► CheckoutButton (auditId) ──► Stripe ──► webhook
                                                                             │
     ensureBusiness(): crée businesses{owner_id: NULL, segment: 'local' (!)} │
     upsertSubscription(user_id: NULL)                                       ▼
/merci ──► « Ouvrir mon espace » ──► /app ──► pas de cookie ──► DÉMO Plomberie Martin   ✗
/app/connexion ──► signInWithOtp({ shouldCreateUser: false }) ──► utilisateur inexistant ──► erreur   ✗
```

Le trigger `claim_businesses_for_new_user` (`schema.sql:303`) ne se déclenche **qu'à l'insertion** dans `auth.users`. Or aucun code ne crée l'utilisateur : `LoginForm.tsx:45` interdit la création (`shouldCreateUser: false`), et le webhook n'appelle ni `auth.admin.createUser` ni `inviteUserByEmail` (vérifié par grep, 0 occurrence). **Un client qui paie ne peut donc jamais se connecter.** Il faudrait créer son compte à la main dans la console Supabase.

### Constats détaillés

| # | Constat | Preuve | Gravité |
|---|---|---|---|
| A1 | Aucun compte n'est créé après le paiement, et la connexion refuse les nouveaux e-mails | `LoginForm.tsx:45`, webhook `route.ts:53-87` | **Bloquant** |
| A2 | Le rattachement ne se fait qu'à la création de l'utilisateur. Un 2ᵉ achat avec un compte existant n'est jamais rattaché | `schema.sql:303-314` | **Bloquant** |
| A3 | **Faille** : le trigger rattache dès l'INSERT, **sans vérifier `email_confirmed_at`**. L'inscription publique Supabase est active par défaut (`/auth/v1/signup` avec la clé anon). Un tiers qui crée un compte non confirmé avec l'e-mail du client s'approprie le commerce payé, et le vrai client ne pourra plus le réclamer | `schema.sql:303-310` | **Élevé** |
| A4 | Le segment n'est pas transmis : un client PME ou e-commerce est créé en `local`, puis le cron mensuel l'audite avec les requêtes « local » | `webhook/route.ts:73-81` (pas de `segment`), `db.ts:559` | **Bloquant** pour PME et e-commerce |
| A5 | Un paiement sans `auditId` (bouton de `Settings.tsx:189`, `/tarifs`) ne crée aucun commerce (« à créer manuellement ») | `webhook/route.ts:61,140` | Élevé |
| A6 | Pas de `middleware.ts`. La session est un **access token JWT posé en cookie non HttpOnly par JavaScript** (`LoginForm.tsx:8`, `SessionSync.tsx:16`). Il expire au bout d'une heure et n'est rafraîchi que si un onglet `/app` est ouvert. Le serveur appelle `auth.getUser` à chaque rendu, deux fois par page (layout et page, sans `cache()`) | `data.ts:42-55`, 12 appels à `loadWorkspace()` | Élevé |
| A7 | **Repli silencieux sur la démo** : utilisateur connecté sans commerce, erreur base ou token expiré → la démo s'affiche, sans message | `data.ts:72-86` | Élevé |
| A8 | Aucun gating par plan. `plan` est stocké mais aucune route `/api/exec/*`, `/api/copilot` ou `/api/connect/ga4` ne le vérifie. Les comptes `free` et résiliés gardent toutes les fonctions | grep `plan ===` : 0 dans les routes | Élevé |
| A9 | Portail de facturation : `createPortalUrl` renvoie vers `/app/compte`, **route inexistante**. `/app/reglages` utilise une URL statique `NEXT_PUBLIC_STRIPE_PORTAL_URL`, sans session client | `stripe.ts:138`, `reglages/page.tsx:13` | Moyen |
| A10 | Pas de rôles, pas d'invitation, pas de multi-utilisateur. `businesses.owner_id` est unique alors que l'offre Réseau et Agence promet plusieurs établissements et collaborateurs | `schema.sql:72` | Moyen (bloquant pour l'offre Réseau) |
| A11 | RLS : bien écrite sur les tables V1, mais tout le V2 vit dans `documents` en accès service_role seul. **La RLS ne protège donc aucune donnée V2**, et toute l'isolation repose sur `canEditBusiness` / `canAccessBusiness` côté code | `schema.sql:400-412` | Moyen (acceptable si centralisé) |
| A12 | Si Supabase n'est pas configuré en production, `canEditBusiness` renvoie `ok: true` pour **tout** commerce, et le store `.data/*.json` est utilisé sur un système de fichiers éphémère | `execution/auth.ts:29`, `db.ts:198` | Élevé (erreur de config = faille) |
| A13 | Le libellé du plan ne connaît que les plans V1 : un client `essentiel` voit « essentiel » brut | `workspace.ts:51` | Faible |
| A14 | Rien ne lance le premier audit payant ni la génération des tâches après l'achat. Les tâches ne sont créées que par le bouton `/api/exec/generate`, et l'audit approfondi « livré sous 48 h » reste un processus manuel | grep `regenerateTasks` | Élevé |

---

## 2. Tâches longues (4/10)

### Existant
- `/api/audit` (gratuit) est synchrone : `maxDuration = 60`, `AbortController` et 504 avec un message clair. L'envoi d'e-mail passe par `after()`.
- `/api/cron/monthly` : un appel par jour, 300 s, `BUDGET_MS = 240 s`, audits **séquentiels**, environ 3 à 4 commerces par jour. Le reste est traité le lendemain par re-sélection. L'index unique `audits_monthly_unique (business_id, period)` empêche les doublons.
- `/api/cron/weekly` : deux créneaux, `wasDigestSent` sert de garde d'idempotence.
- `stripe_events` déduplique les webhooks, avec retrait en cas d'échec : c'est correct.

### Limites
1. **Capacité** : environ 4 audits par jour, soit 120 par mois. Au-delà de 100 clients, les audits mensuels prennent du retard sans limite.
2. **N+1** : `listBusinessesDueForAudit` charge 500 commerces puis exécute `getLatestAuditForBusiness` pour chacun, soit jusqu'à 501 requêtes avant le premier audit (`db.ts:623-647`).
3. **Pas de reprise ni de quarantaine** : un commerce dont l'audit échoue toujours est re-tenté chaque jour, consomme le budget IA à chaque fois, et personne n'est prévenu.
4. **Rien n'est déclenché par un événement** : ni l'onboarding après paiement, ni la régénération des tâches après l'audit mensuel, ni l'audit à la demande.
5. Le cron mensuel reconstruit l'entrée d'audit depuis `businesses` et perd les champs spécifiques PME et e-commerce (catégories produits, etc.).
6. Vercel Hobby limite les crons à une exécution par jour et interdit l'usage commercial (le README le dit). Le plan Pro sera nécessaire dès le premier encaissement.

### Architecture recommandée : table `jobs` dans Postgres et worker HTTP

Pourquoi pas Inngest, QStash ou Trigger.dev : tous trois sont viables en offre gratuite, mais chacun ajoute un compte, un SDK, des quotas (à vérifier au moment du choix) et un endroit de plus où regarder en cas de panne. Avec un fondateur solo et Supabase déjà en place, une table `jobs` avec `FOR UPDATE SKIP LOCKED` suffit jusqu'à plusieurs milliers d'audits par mois. Le déclenchement passe par **pg_cron + pg_net** (gratuit, chaque minute, indépendant du plan Vercel), par Vercel Cron en secours, et par `after()` pour l'immédiat. Si le volume dépasse environ 5 000 jobs par jour, la même interface `enqueue()` pourra être rebranchée sur Inngest.

```sql
-- supabase/migrations/20261110_jobs.sql
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in
                    ('onboarding','audit.paid','audit.monthly','tasks.generate','digest.weekly','email.send','account.delete')),
  business_id     uuid references businesses(id) on delete cascade,
  payload         jsonb not null default '{}'::jsonb,
  idempotency_key text unique,                     -- ex. 'audit.monthly:<bid>:2026-11'
  status          text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  priority        smallint not null default 5,     -- 1 = onboarding, 9 = rattrapage
  attempts        int not null default 0,
  max_attempts    int not null default 4,
  run_after       timestamptz not null default now(),
  locked_at       timestamptz,
  locked_by       text,
  last_error      text,
  result          jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists jobs_ready_idx on jobs (priority, run_after) where status = 'queued';
create index if not exists jobs_business_idx on jobs (business_id, created_at desc);
alter table jobs enable row level security;  -- service_role uniquement
revoke all on jobs from anon, authenticated;

-- Réservation atomique (bail de 290 s : un job « running » abandonné redevient prenable)
create or replace function claim_jobs(p_worker text, p_limit int default 1, p_lease_s int default 290)
returns setof jobs language sql security definer set search_path = public as $$
  update jobs j set status = 'running', locked_at = now(), locked_by = p_worker,
                    attempts = j.attempts + 1, updated_at = now()
  where j.id in (
    select id from jobs
    where (status = 'queued' and run_after <= now())
       or (status = 'running' and locked_at < now() - make_interval(secs => p_lease_s))
    order by priority, run_after
    limit p_limit
    for update skip locked)
  returning j.*;
$$;
revoke all on function claim_jobs(text, int, int) from public, anon, authenticated;

-- Planification des audits mensuels en SQL (supprime le N+1)
create or replace function enqueue_due_monthly_audits() returns int
language sql security definer set search_path = public as $$
  with due as (
    select b.id from businesses b
    left join lateral (select created_at from audits a where a.business_id = b.id
                       order by created_at desc limit 1) last on true
    where b.plan <> 'free' and b.is_active
      and (last.created_at is null or last.created_at < now() - interval '28 days'))
  insert into jobs (kind, business_id, idempotency_key, priority)
  select 'audit.monthly', id, 'audit.monthly:' || id || ':' || to_char(now(), 'YYYY-MM'), 5 from due
  on conflict (idempotency_key) do nothing
  returning 1;
$$;
-- pg_cron :
-- select cron.schedule('repere-enqueue-monthly', '7 6 * * *', 'select enqueue_due_monthly_audits()');
-- select cron.schedule('repere-worker', '* * * * *', $$ select net.http_post(
--   url := 'https://<domaine>/api/jobs/run', headers := jsonb_build_object('authorization','Bearer <JOBS_SECRET>')) $$);
```

Fichiers à créer :

```
src/lib/jobs/index.ts          enqueue(kind, {businessId, payload, key, priority, runAfter})  // insert … on conflict do nothing
src/lib/jobs/handlers.ts       Record<JobKind, (job) => Promise<unknown>>
src/lib/jobs/worker.ts         runWorker({ budgetMs })
src/app/api/jobs/run/route.ts  POST, Bearer JOBS_SECRET (timingSafeEqual), maxDuration 300
src/lib/jobs/__tests__/worker.test.ts   (mode mémoire : même interface que store.ts)
```

```ts
// src/lib/jobs/worker.ts
export async function runWorker({ budgetMs = 270_000, workerId = crypto.randomUUID() }) {
  const t0 = Date.now(); const done = [];
  while (Date.now() - t0 < budgetMs - 95_000) {            // 95 s = un audit au pire + marge
    const [job] = await claimJobs(workerId, 1);
    if (!job) break;
    try {
      const result = await withTimeout(HANDLERS[job.kind](job), 90_000);
      await finishJob(job.id, { status: 'done', result });
    } catch (e) {
      const dead = job.attempts >= job.max_attempts;
      await finishJob(job.id, {
        status: dead ? 'dead' : 'queued',
        last_error: String(e).slice(0, 2000),
        run_after: new Date(Date.now() + 2 ** job.attempts * 60_000),  // 2, 4, 8, 16 min
      });
      if (dead) await notifyAdmin(job, e);                  // e-mail + Sentry
      Sentry.captureException(e, { tags: { job: job.kind } });
    }
    done.push(job.id);
  }
  return done;
}

// handlers.ts (extraits)
'onboarding': async (j) => {             // émis par le webhook, clé 'onboarding:<checkout_session_id>'
  await ensureAuthUser(j.payload.email);                         // §chantier P0-1
  await enqueue('audit.paid', { businessId: j.business_id, key: `audit.paid:${j.business_id}:first` , priority: 1 });
},
'audit.paid': async (j) => {
  const b = await getBusinessRecord(j.business_id);
  const input = await auditInputFor(b);                           // relit l'audit d'origine : segment, catégories…
  const a = await runAudit(input, { mode: 'paid', signal: AbortSignal.timeout(85_000) });
  await saveAudit(a, { businessId: b.id, trigger: j.kind === 'audit.monthly' ? 'monthly' : 'manual' });
  await enqueue('tasks.generate', { businessId: b.id, key: `tasks:${a.id}` });
  return { auditId: a.id, score: a.score };
},
'audit.monthly': (j) => HANDLERS['audit.paid'](j).then(r => postMonthly(j.business_id, r)), // alertes + e-mail (code actuel du cron)
'tasks.generate': (j) => regenerateTasks(j.business_id),
```

**Audit gratuit** (phase 2) : `POST /api/audit` crée la ligne `audits{status:'running'}`, renvoie `202 {id}`, lance `after(() => runAudit…)` et le formulaire interroge `GET /api/audit/[id]/status` toutes les 2 s. On supprime ainsi le 504 à 60 s, et un job `audit.free` de repli reprend les audits `running` de plus de 3 minutes.

### Plan de migration (sans interruption)
1. Créer la migration `jobs` et `claim_jobs`, puis `src/lib/jobs/*` avec ses tests en mode mémoire.
2. Webhook : remplacer le travail synchrone après `ensureBusiness` par `enqueue('onboarding', …)`. La réponse Stripe passe sous 1 s.
3. Brancher `/api/jobs/run` et pg_cron, chaque minute. Garder `/api/cron/monthly` pendant 2 semaines en mode « enqueue only » (il appelle `enqueue_due_monthly_audits()` et ne fait plus d'audit).
4. Déplacer le corps du cron mensuel (alertes, e-mail, paliers) dans `postMonthly()`, sans changer son comportement. Les tests existants de `digest/alerts` restent la référence.
5. Digest hebdo : un job par commerce (`digest.weekly:<bid>:<semaine>`) au lieu de la boucle.
6. Page admin `/admin/jobs` : files en attente, mortes et bouton « relancer ».
7. Supprimer l'ancien code de boucle des crons.

---

## 3. Qualité du code (6/10)

### Duplications et couches laissées par les agents
| Élément | Constat | Action |
|---|---|---|
| `components/app/adapters.ts` (177 l.) et `adapters-real.ts` (30 l.) | Couche de « repli si le module V2 n'est pas livré ». Tous les modules sont livrés. Chaque appel est enveloppé dans un `try { } catch { /* repli */ }` **muet** : une erreur base devient une liste de tâches vide, sans aucun log | Supprimer et appeler `@/lib/execution`, `@/lib/tracking` et `@/lib/facts` directement. Garder un seul `try/catch` qui logue et affiche un état d'erreur |
| `components/app/demo-data.ts` (905 l.) vs `lib/demo-v2.ts` (259 l.) et `lib/execution/demo.ts` (111 l.) | Trois générateurs de démo. `demo-data.ts` ne sert plus que de repli aux adaptateurs | Une seule source : `lib/demo/` (`seeds.ts`, `audits.ts`, `tasks.ts`, `traffic.ts`) |
| `components/app/data.ts` : `ranking()`, `overtaker()` | Doublons V1 de `workspace.ts` / `digest/stats.ts` (le commentaire de `workspace.ts:84` dit « calcul UNIQUE ») et inutilisés | Supprimer |
| `store.ts` `DOCUMENTS_SQL` | Copie du DDL de `schema.sql`, qui finira par diverger | Supprimer : la migration fait foi |
| `components/report/adapters.ts` (843 l.) | Fichier d'adaptation le plus gros du projet, avec des paramètres inutilisés (`_a`, `_f`) | Tester puis découper par section |

### Fichiers morts (aucun import trouvé)
`components/ui/Card.tsx`, `ui/Badge.tsx`, `ui/Section.tsx` · `components/app/TabBar.tsx` (doublon de `Shell.tsx:77`) · `components/report/FreeActions.tsx` · `components/site/ChatScene.tsx` (220 l.) · `site/PlanCard.tsx` · `site/AuditMiniForm.tsx` · `public/{file,globe,next,vercel,window}.svg` (restes de create-next-app) · `components/app/generate-icons.mjs` (script, à déplacer dans `scripts/`). Au total, environ 800 lignes.

### Types
- `tsc` passe sans erreur, en mode strict. Mais les types V1 (`engine/types.ts`) et V2 (`types-v2.ts`) coexistent, ce qui oblige à des transtypages `as AuditV2` et `as V2Audit` dans les crons et les adaptateurs. Il faut fusionner `AuditResult & AuditResultV2Ext` en un seul `Audit`.
- Les lignes Supabase sont typées à la main (`BusinessRow`). Il faut générer les types avec `supabase gen types typescript` dans `src/lib/db.types.ts`.

### Erreurs, logs, observabilité
- 59 appels `console.*`, sans identifiant de requête ni niveau structuré, et aucun Sentry ni `instrumentation.ts`.
- Pas d'endpoint `/api/health`.
- **Variables d'environnement** : environ 60 variables distinctes sont lues directement à travers le code (`process.env.X`), sans validation au démarrage. Seuls trois secrets lèvent une erreur en production, et seulement à l'usage. Il manque un garde-fou contre l'erreur la plus dangereuse : la production sans Supabase (A12).

### Couverture estimée (pas d'outil installé)
| Module | LOC | Tests | Couverture estimée |
|---|---|---|---|
| `lib/engine` | 3 600 | 5 fichiers, environ 1 000 l. | 70 à 80 % |
| `lib/execution` | 3 000 | 2 fichiers | 55 à 65 % |
| `lib/digest`, `lib/copilot`, `lib/tracking`, `lib/pdf` | 3 500 | 5 fichiers | 50 à 65 % |
| `lib/db.ts` | 1 060 | indirects, **branche mémoire seulement** | branche Supabase : environ 0 % |
| Routes API | n/d | 4 fichiers (routes, qa-v2, checkout, valeur-client) | 40 % (webhook Stripe : non testé) |
| `lib/seo` | 2 300 | aucun | environ 5 % |
| `components/**` (UI) | environ 9 000 | aucun | 0 % |
| **Global** | | | **environ 35 %** |

---

## 4. Performance (7/10)

| Constat | Mesure | Action |
|---|---|---|
| Premier chargement du site | 106 à 118 kB gzip, bon niveau | — |
| **`/app/*` charge supabase-js (environ 63 kB gzip) sur toutes les pages, y compris en démo**, via `SessionSync` monté dans le layout | chunks `3943-*.js` (49 kB gz) et `44530001-*.js` (14 kB gz) | Avec `@supabase/ssr` et le middleware (P0-2), `SessionSync` disparaît. La connexion n'importe le client que sur `/app/connexion` |
| `loadWorkspace()` est appelé par le layout **et** par chaque page, sans `React.cache` : deux `auth.getUser` (réseau) et deux lectures complètes par navigation | 12 appels | `export const loadWorkspace = cache(async () => …)` |
| HTML de `/` : 274 kB bruts, `/tarifs` 234 kB (charge RSC des données de tarifs et de FAQ inline) | 41 kB gzip | Acceptable. Sortir `PricingExplorer` (460 l. client) vers un îlot plus petit et passer les grilles en props sérialisées minimales |
| Gros composants client | `AuditForm.tsx` 800 l., `PricingExplorer` 460, `TaskBoard` 407 | Découper `AuditForm` par étape avec `dynamic()` pour les étapes 2 et 3 |
| Images | 3 `<img>`, 0 `next/image`, `public/` = 100 kB | Rien d'urgent. Les vidéos de démo V3 devront passer par `<video preload="none" poster>` hébergées hors bundle |
| Cache | 109 routes en ISR 24 h, `/api` en `no-store`, `/app` en `private, no-store` | Correct. Ajouter `revalidateTag` sur `/p/[slug]` et `/api/schema` quand les réglages changent |
| Cron mensuel N+1 | jusqu'à 501 requêtes | Voir `enqueue_due_monthly_audits()` au §2 |

---

## 5. Accessibilité (7,5/10)

Passe Playwright (Chromium) + **axe-core injecté localement** (règles `wcag2a`, `wcag2aa`, `wcag21aa`, `best-practice`) sur 12 pages : `/`, `/tarifs`, `/audit`, `/local`, `/geo`, `/rapport/demo`, `/app`, `/app/taches`, `/app/reglages`, `/app/connexion`, `/app/copilote`, `/app/verite`. Le contraste est calculé par axe (`color-contrast`) : **aucun échec** de contraste de texte.

| Page | Violation | Impact | Correctif |
|---|---|---|---|
| `/audit` | `link-in-text-block` : liens distingués du texte par la seule couleur (contraste lien/texte 1,64:1) | sérieux | `underline` sur les liens dans les paragraphes |
| `/app/verite` | `definition-list` : `<dl>` contient autre chose que `dt`/`dd` | sérieux | Envelopper chaque paire dans `<div>` (autorisé) et retirer les autres enfants |
| `/app/*` (6 pages) | `landmark-one-main` et `region` : le layout rend `<div id="contenu">`, sans `<main>` | modéré | `src/app/app/layout.tsx` : `<main id="contenu" tabIndex={-1}>` |
| `/rapport/demo` | `skip-link` : la cible `#contenu` n'existe pas | modéré | Ajouter `id="contenu"` au `<main>` du rapport |
| `/geo` | `empty-table-header` | mineur | `<th><span className="sr-only">Critère</span></th>` |
| `/app/copilote` | Le focus initial est sur la zone de saisie (autofocus), avant le lien d'évitement | — | Retirer `autoFocus` sur mobile, ou le garder et ajouter `aria-describedby` |
| **Menu mobile du site** (`/`, `/tarifs`) | Le panneau (16 liens) n'a ni `role="dialog"` ni `aria-modal`. **24 tabulations sur 40 sortent du panneau** pendant qu'il recouvre la page. Échap ferme le menu et rend bien le focus au bouton | modéré | Piège de focus : `inert` sur `main` et `footer` quand le menu est ouvert (une ligne : `document.querySelector('main')!.inert = open`), plus `role="dialog" aria-modal="true" aria-label="Menu"` |

Points positifs vérifiés : `lang="fr"`, un seul `h1` par page, lien « Aller au contenu » en premier arrêt de tabulation, focus visible sur tous les arrêts testés (0 « focus invisible »), `aria-current` sur la navigation de l'app, `aria-expanded` et `aria-controls` sur les menus.

---

## 6. Sécurité résiduelle (6,5/10)

### Échantillon de 10 correctifs des revues V1 et V2

| Réf. | Point | Statut | Preuve |
|---|---|---|---|
| V1 C1 | Plafond global d'audits | ✅ | `api/audit/route.ts:19-20` (`AUDIT_GLOBAL_PER_DAY/HOUR`) |
| V1 E1 | `businessId` jamais accepté du client au checkout | ✅ | `checkout/route.ts:15`, `webhook/route.ts:60` |
| V1 E2 | Pas d'e-mail dans `GET /api/audit/:id` | ✅ | `toPublicAudit()` |
| V1 E3 | Liste d'opposition respectée à l'envoi | ✅ | `email.ts:125` |
| V1 E4 | Case d'audit ≠ consentement marketing | ✅ | `api/audit/route.ts:127-131` |
| V1 F3 | Limite de débit sur le PDF | ✅ | `report/[id]/pdf/route.ts:14` |
| V2 E1 | Comptes démo en lecture seule côté serveur | ✅ | `execution/auth.ts:27` |
| V2 E3 | « C'est fait » : GET sans effet de bord, puis POST | ✅ | `digest/done/route.ts:3-5,60` |
| V2 M1 | État OAuth GA4 lié au navigateur (nonce en cookie, usage unique) | ✅ | `ga4/start:23-25`, `callback:12-15` |
| V2 M3 et F5 | SSRF (`redirect: manual`, IP privées, taille bornée) et URLs `https://` seules | ✅ | `presence.ts:25-79`, `exec/settings/route.ts:44-57` |

### En-têtes réels (`curl -I http://localhost:3000/`)
HSTS (2 ans, `preload`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `X-Robots-Tag: noindex` sur `/app` et `/api`, `Cache-Control: no-store` sur `/api` et `/app` : **tous présents.**

### Nouveaux constats
| # | Constat | Gravité |
|---|---|---|
| S1 | Rattachement d'un commerce par un compte non confirmé (A3) | **Élevé** |
| S2 | La **CSP est en `Report-Only` sans `report-uri` / `report-to`** : elle n'est jamais appliquée et personne ne reçoit de rapport. Elle contient aussi `script-src 'unsafe-inline'`. La « première semaine » de Report-Only n'a donc pas de fin observable | Moyen |
| S3 | Le jeton de session est lisible par JavaScript (cookie non HttpOnly). Une XSS suffit à le voler, et la CSP ne la bloque pas (S2) | Moyen |
| S4 | `connect-src` est calculé **au build** depuis `NEXT_PUBLIC_SUPABASE_URL`. Si la variable est ajoutée après le build, la CSP appliquée bloque la connexion | Faible (piège opérationnel) |
| S5 | `claimSlug` lit puis écrit sans opération atomique : deux réservations simultanées du même slug peuvent réussir toutes les deux | Faible |
| S6 | `HSTS preload; includeSubDomains` : engage tous les sous-domaines (dont `hello.` pour Resend) avant inscription sur la liste preload | Faible, à confirmer |
| S7 | Production sans Supabase : écriture ouverte à tous (A12) | Élevé si mal configuré |

---

## 7. Internationalisation, RGPD technique, sauvegardes (3/10)

- **i18n** : les textes sont écrits en dur dans les composants, avec 37 littéraux `'fr-FR'`. **Aucune action avant 2027** : le marché est français. Seule action utile tout de suite : centraliser `fr()`, `formatEuro()` et `formatDate()` dans `src/lib/format.ts`, pour pouvoir ajouter `next-intl` plus tard sans tout refaire.
- **RGPD : export** : absent. La page de confidentialité promet l'accès et la portabilité (« écrivez à [À COMPLÉTER : e-mail] »).
- **RGPD : suppression** : absente. `businesses.owner_id … on delete cascade` supprime le commerce, ses audits et ses alertes, **mais `documents.business_id` est un `text` sans clé étrangère** : la fiche de vérité, les tâches, le copilote et le trafic resteraient orphelins. Les clients Stripe et les contacts Resend ne sont pas traités.
- **Purge** : `purge_old_data()` existe mais dépend d'une activation manuelle de pg_cron (README, étape 2.6).
- **Pages légales** : **51 occurrences de « [À COMPLÉTER] »** dans `src/` (`cgv`, `mentions-legales`, `confidentialite`, `a-propos`, `house.ts`, `seo/site.ts`). On ne peut pas encaisser un paiement avec des CGV et des mentions légales incomplètes.
- **Sauvegardes** : rien n'est prévu. L'offre gratuite de Supabase ne fournit ni PITR ni sauvegarde téléchargeable. Il faut un `pg_dump` nocturne chiffré, ou passer à Supabase Pro.

---

## 8. Expérience développeur (3/10)

| Élément | Constat |
|---|---|
| Contrôle de version | **`/home/claude/auditia` n'est pas un dépôt git.** Aucun historique ni retour arrière possible après les vagues d'agents parallèles |
| CI | Aucun `.github/workflows` |
| Scripts npm | `dev`, `build`, `start`, `lint`. Manquent `typecheck`, `test`, `test:coverage`, `db:migrate`, `db:types`, `seed` |
| README | Complet sur le déploiement mais **périmé** : il décrit la grille V1 (Suivi 29 €, Pro 79 €) alors que `.env.example` décrit la grille V2 (Essentiel, Accompagné, Réseau) |
| Migrations | Un seul `schema.sql` idempotent de 448 lignes, avec des `alter … add column if not exists` empilés. Le DDL est dupliqué dans `store.ts`. Pas de Supabase CLI |
| Seed | Les données démo sont générées par le code (c'est bien pour le mode démo). Il n'existe aucun `supabase/seed.sql` pour un environnement de préproduction réaliste |
| Lint | Les 7 erreurs sont dans `scripts/`. Il faut un `overrides` ESLint pour `scripts/**` ou les typer |

---

## Chantiers priorisés

Légende : **P0** = indispensable avant le premier client payant · **P1** = dans le mois qui suit · **P2** = quand le volume le justifie. Les estimations supposent un développeur seul aidé d'agents.

### P0-1. Compte client créé au paiement, rattachement sûr (2 j)

**Fichiers** : `src/lib/accounts.ts` (nouveau), `src/app/api/stripe/webhook/route.ts`, `src/app/api/checkout/route.ts`, `src/app/merci/page.tsx`, `supabase/migrations/20261110_claim.sql`, `src/lib/email.ts`.

```sql
-- 1) Supprimer le rattachement à l'INSERT (faille S1)
drop trigger if exists on_auth_user_created_claim on auth.users;
-- 2) Rattacher uniquement des comptes à e-mail confirmé, à chaque connexion (idempotent)
create or replace function claim_businesses(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_email text; n int;
begin
  select lower(email) into v_email from auth.users where id = p_user and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update businesses set owner_id = p_user where owner_id is null and lower(contact_email) = v_email;
  get diagnostics n = row_count;
  update subscriptions set user_id = p_user where user_id is null and lower(email) = v_email;
  return n;
end $$;
revoke all on function claim_businesses(uuid) from public, anon, authenticated;
```
Dans la console Supabase : désactiver **Allow new users to sign up** (seul le serveur crée des comptes).

```ts
// src/lib/accounts.ts
export async function ensureAuthUser(email: string): Promise<string> {
  const admin = sbAdmin().auth.admin;
  const existing = await findUserByEmail(email);             // RPC SQL sur auth.users (listUsers ne filtre pas)
  if (existing) return existing.id;
  const { data, error } = await admin.createUser({ email, email_confirm: true }); // l'adresse vient de Stripe (payée)
  if (error) throw error;
  return data.user.id;
}
// webhook onCheckoutCompleted, après ensureBusiness :
const userId = await ensureAuthUser(email);
await sb().rpc('claim_businesses', { p_user: userId });
// + passer segment: audit.segment ?? audit.input.segment à createBusiness (A4)
// + sans auditId : créer un commerce « à compléter » (nom = e-mail) au lieu de null, et l'onboarding demande les infos (A5)
```
- `/api/checkout` : si une session existe (P0-2), poser `client_reference_id = businessId` dérivé **côté serveur** de la session. Cela couvre le bouton de `Settings.tsx`.
- E-mail de confirmation d'achat : envoyer un **lien magique** généré par `auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: APP_URL + '/auth/callback?next=/app' } })`, qui ouvre l'espace en un clic.
- `/merci` : « Nous vous avons envoyé votre lien d'accès à <email> » au lieu de « Ouvrir mon espace », qui mène aujourd'hui à la démo.
- Tests : webhook avec Stripe simulé, sur les cas audit lié, audit absent, client existant, 2ᵉ achat et segment PME.

### P0-2. Session serveur avec `@supabase/ssr` et middleware, sans repli silencieux (1,5 j)

**Fichiers** : `package.json` (+`@supabase/ssr`), `src/middleware.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/app/auth/callback/route.ts`, `src/components/app/LoginForm.tsx`, `src/components/app/data.ts`, `src/components/app/workspace.ts`, suppression de `SessionSync.tsx`, `src/lib/execution/auth.ts`, `src/lib/db.ts` (`canAccessBusiness`).

```ts
// src/middleware.ts
export const config = { matcher: ['/app/:path*', '/api/exec/:path*', '/api/copilot', '/api/facts', '/api/actions',
                                  '/api/t/summary', '/api/connect/:path*', '/api/billing/:path*', '/auth/:path*'] };
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(URL, ANON, { cookies: {
    getAll: () => req.cookies.getAll(),
    setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) } });
  const { data: { user } } = await supabase.auth.getUser();          // rafraîchit et pose des cookies HttpOnly
  const demo = req.cookies.get('rp_demo_segment') || req.nextUrl.searchParams.has('demo');
  if (!user && req.nextUrl.pathname.startsWith('/app') && !demo && !PUBLIC_APP.has(req.nextUrl.pathname))
    return NextResponse.redirect(new URL('/app/connexion', req.url));
  return res;
}
// src/app/auth/callback/route.ts : exchangeCodeForSession(code) ou verifyOtp({ token_hash, type }),
//   puis rpc('claim_businesses', { p_user }) puis redirect(next)
```
- Démo explicite : `/app?demo=local|pme|ecom` pose `rp_demo_segment`. Sans session ni cookie démo, l'utilisateur est redirigé vers `/app/connexion`, qui affiche « Voir la démo ».
- `loadDashboard` : utilisateur connecté sans commerce → page « Nous préparons votre espace » (état de l'onboarding lu dans `jobs`), **jamais la démo**. Erreur base → `throw`, ce qui affiche `error.tsx` et un événement Sentry.
- `workspace.ts` : `export const loadWorkspace = cache(async () => …)`.
- API : `canEditBusiness` lit l'utilisateur via `createServerClient` (cookies). Le Bearer reste accepté pour la PWA. Contre le CSRF : cookies `SameSite=Lax` et vérification de `Origin` sur les POST, dans `src/lib/http/origin.ts`.
- `LoginForm` : `signInWithOtp({ shouldCreateUser: false, emailRedirectTo: '/auth/callback' })` (correct une fois P0-1 en place). On supprime toute écriture de `document.cookie`.

### P0-3. Droits par plan et portail de facturation (1 j)

**Fichiers** : `src/lib/entitlements.ts` (nouveau), `src/app/api/billing/portal/route.ts` (nouveau), `src/app/app/reglages/page.tsx`, `src/lib/stripe.ts`, routes `/api/exec/*`, `/api/copilot`, `/api/connect/ga4/*`, `src/components/app/workspace.ts`.

```ts
// src/lib/entitlements.ts : une seule table de vérité, testée
export type Feature = 'copilot' | 'tasks.generate' | 'ga4' | 'hosted_page' | 'monthly_audit' | 'multi_location';
const MATRIX: Record<PlanTier, Feature[]> = {
  free: [],
  essentiel: ['monthly_audit', 'tasks.generate', 'hosted_page', 'copilot'],
  accompagne: ['monthly_audit', 'tasks.generate', 'hosted_page', 'copilot', 'ga4'],
  reseau: ['monthly_audit', 'tasks.generate', 'hosted_page', 'copilot', 'ga4', 'multi_location'],
  /* suivi/pro/agency (V1) mappés */ };
export function can(b: { plan: PlanTier; isActive: boolean }, f: Feature) { return b.isActive && MATRIX[b.plan]?.includes(f); }
export async function requireFeature(req: Request, businessId: string, f: Feature) {
  const auth = await canEditBusiness(req, businessId, { write: true });  // propriétaire
  if (!auth.ok) return auth;
  const b = await getBusinessRecord(businessId);
  return can(b!, f) ? auth : { ok: false, status: 402, upgrade: true };
}
```
```ts
// src/app/api/billing/portal/route.ts : POST, propriétaire uniquement
const b = await requireOwner(req); if (!b.stripeCustomerId) return 404;
return NextResponse.json({ url: await createPortalUrl(b.stripeCustomerId, '/app/reglages') }); // corrige /app/compte (404)
```
- Réglages : le bouton « Gérer mon abonnement » appelle la route, et `NEXT_PUBLIC_STRIPE_PORTAL_URL` est supprimé.
- UI : `402` → bandeau « Disponible avec l'offre X » et lien vers `/tarifs`. Libellés des plans V2 dans `workspace.ts:51`.
- Tests : une ligne par case de la matrice et par route protégée.

### P0-4. File de tâches : onboarding automatique, audits mensuels avec reprises (2,5 j)
Le plan complet est au §2 (table `jobs`, `claim_jobs`, `enqueue_due_monthly_audits`, `runWorker`, handlers et étapes de migration). Pour le premier client, le minimum est le suivant : jobs `onboarding`, `audit.paid` et `tasks.generate` émis par le webhook, worker appelé chaque minute par pg_cron, et cron mensuel passé en « enqueue only ». Il faut aussi corriger `auditInputFor(b)` pour relire le segment et les champs PME et e-commerce de l'audit d'origine. Pour cela, ajouter `businesses.audit_input jsonb`, rempli à la création.

```sql
alter table businesses add column if not exists audit_input jsonb;  -- entrée complète de l'audit d'origine
```

### P0-5. Configuration validée, observabilité, garde-fou de production (1 j)

**Fichiers** : `src/lib/env.ts` (nouveau), `src/instrumentation.ts` (nouveau), `sentry.*.config.ts`, `src/app/api/health/route.ts`, `src/app/app/error.tsx`, `src/lib/log.ts`, `next.config.ts`.

```ts
// src/lib/env.ts : importé par instrumentation.ts (au démarrage) et par db.ts / stripe.ts
const isProd = process.env.VERCEL_ENV === 'production';
const Server = z.object({
  SUPABASE_URL: isProd ? z.url() : z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: isProd ? z.string().min(40) : z.string().optional(),
  STRIPE_SECRET_KEY: isProd ? z.string().startsWith('sk_live_') : z.string().optional(),
  STRIPE_WEBHOOK_SECRET: isProd ? z.string().startsWith('whsec_') : z.string().optional(),
  AUDIT_SIGNING_SECRET: isProd ? z.string().min(32) : z.string().optional(),
  CRON_SECRET: isProd ? z.string().min(32) : z.string().optional(),
  JOBS_SECRET: isProd ? z.string().min(32) : z.string().optional(),
  RESEND_API_KEY: isProd ? z.string().startsWith('re_') : z.string().optional(),
  SENTRY_DSN: z.url().optional(),
  // … les ~60 variables, avec leurs valeurs par défaut
});
export const env = Server.parse(process.env);   // lève une erreur au démarrage en production : plus d'A12 possible
```
- `src/lib/log.ts` : `log.info/warn/error(event, fields)` en JSON sur une ligne, avec `requestId` (en-tête `x-vercel-id`) et `businessId`. Remplacer progressivement les 59 `console.*`.
- Sentry (offre gratuite) : `@sentry/nextjs`, `tracesSampleRate: 0.05`, `beforeSend` qui masque e-mails et jetons. Les erreurs avalées par les adaptateurs deviennent des `captureException`.
- `/api/health` : `{ db: ping, stripe: !!key, jobs: { queued, dead, oldestQueuedMin } }`, surveillé par un moniteur gratuit (UptimeRobot / Better Stack). Alerte si `dead > 0` ou si le plus vieux job a plus de 30 minutes.

### P0-6. RGPD technique et pages légales complètes (1,5 j + saisie du fondateur)

**Fichiers** : `src/app/api/account/export/route.ts`, `src/app/api/account/delete/route.ts`, `src/lib/gdpr.ts`, `supabase/migrations/20261110_documents_fk.sql`, `src/components/app/Settings.tsx`, pages `cgv`, `mentions-legales`, `confidentialite`, `src/lib/house.ts`, `src/lib/seo/site.ts`.

```sql
-- Rattacher documents à businesses pour que la suppression les emporte
alter table documents add column if not exists business_uuid uuid references businesses(id) on delete cascade;
update documents set business_uuid = business_id::uuid
 where business_id ~ '^[0-9a-f-]{36}$' and exists (select 1 from businesses b where b.id::text = documents.business_id);
create index if not exists documents_business_uuid_idx on documents(business_uuid);
```
```ts
// src/lib/gdpr.ts
export async function exportAccount(userId) {   // JSON téléchargeable (Content-Disposition)
  const bs = await listBusinessesForUser(userId);
  return { exportedAt, user: { id, email }, businesses: await Promise.all(bs.map(async b => ({
    business: b, audits: await listAuditsForBusiness(b.id), alerts: await listAlerts(b.id, 1000),
    documents: await listDocsByBusiness(b.id) /* facts, tâches, copilote, trafic, digest */,
    subscriptions: await listSubscriptionsByCustomer(b.stripeCustomerId) }))) };
}
export async function deleteAccount(userId) {   // job 'account.delete' (idempotent), confirmation par e-mail signé
  for (const b of bs) { if (b.stripeCustomerId) await stripe.subscriptions.cancel(...);  // pas de suppression du client Stripe : obligations comptables
                        await releaseSlugs(b.id); }
  await addSuppression(email, 'account_deleted');
  await sbAdmin().auth.admin.deleteUser(userId);  // cascade : businesses → audits, alerts, documents (FK ci-dessus)
}
```
- Réglages : section « Mes données » avec « Télécharger mes données (JSON) » et « Supprimer mon compte » (double confirmation, rappel de l'engagement Accompagné).
- **Remplacer les 51 « [À COMPLÉTER] »** (raison sociale, SIREN, adresse, e-mail DPO/contact, hébergeur, médiateur de la consommation). Ajouter un test qui fait échouer la CI si la chaîne subsiste dans `src/app/{cgv,mentions-legales,confidentialite}`.
- Activer pg_cron pour `purge_old_data()`, avec une vérification dans `/api/health`.

### P0-7. Git, CI, migrations versionnées, sauvegardes (1 j)

1. `git init` à la racine `/home/claude/auditia`, `.gitignore` existant, premier commit, dépôt GitHub privé.
2. `supabase init`, puis `supabase/migrations/20261109000000_baseline.sql` = `schema.sql` actuel. Ensuite, une migration par chantier. Supprimer `DOCUMENTS_SQL` de `store.ts`.
3. `package.json` :
   ```json
   "typecheck": "tsc --noEmit", "test": "vitest run", "test:coverage": "vitest run --coverage",
   "db:types": "supabase gen types typescript --linked > src/lib/db.types.ts", "check": "npm run typecheck && npm run lint && npm run test"
   ```
   et `devDependencies` : `@vitest/coverage-v8`.
4. `.github/workflows/ci.yml` :
   ```yaml
   on: [push, pull_request]
   jobs:
     ci:
       runs-on: ubuntu-latest
       defaults: { run: { working-directory: app } }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: npm, cache-dependency-path: app/package-lock.json }
         - run: npm ci
         - run: npm run typecheck
         - run: npx eslint . --max-warnings=0
         - run: npm run test:coverage
         - run: npx next build        # sans clé : mode démo
   ```
5. `.github/workflows/backup.yml` : planifié chaque nuit, `pg_dump "$SUPABASE_DB_URL" | gzip | age -r $AGE_PUBKEY > dump.sql.gz.age`, envoyé vers un stockage objet (Backblaze B2 ou Cloudflare R2, offres gratuites), avec 30 jours de rétention. Faire un test de restauration par trimestre, documenté dans le README.
6. Corriger les 7 erreurs ESLint de `scripts/` et les 19 avertissements.

### P0-8. Sécurité résiduelle (0,5 j)

- S1 : couvert par P0-1, avec en plus l'inscription publique désactivée.
- S2 : ajouter `report-uri /api/csp-report` (route qui logue en échantillon), observer 7 jours, puis `CSP_ENFORCE=1`. Ensuite, nonce via le middleware P0-2 (`script-src 'self' 'nonce-…' 'strict-dynamic'`) pour supprimer `'unsafe-inline'` des scripts.
- S3 : couvert par P0-2 (cookies HttpOnly gérés par `@supabase/ssr`).
- S4 : construire `connect-src` à l'exécution dans le middleware, ou faire échouer le build si `NEXT_PUBLIC_SUPABASE_URL` manque en production (`env.ts`).
- S5 : `putDoc` conditionnel (`insert … on conflict do nothing returning`) dans `claimSlug`.
- S6 : retirer `preload` tant que le domaine n'est pas inscrit volontairement sur la liste.

### P1 (dans le mois)

| # | Chantier | Fichiers et principe | Effort |
|---|---|---|---|
| P1-1 | Nettoyage des couches d'agents | Supprimer `adapters.ts`, `adapters-real.ts`, `demo-data.ts`, `data.ts#ranking/overtaker`, les 8 composants morts et les 5 SVG. Une seule source démo dans `src/lib/demo/`. Les pages `/app/*` appellent les modules directement | 1,5 j |
| P1-2 | Audit gratuit asynchrone | `POST /api/audit` répond 202, `after()` exécute l'audit, `GET /api/audit/[id]/status` est interrogé par `AuditForm`, et un job de repli reprend les audits bloqués | 1 j |
| P1-3 | Accessibilité | `<main id="contenu">` dans `app/app/layout.tsx`, `id` sur le rapport, liens soulignés, `dl`, `th`, menu mobile avec `inert` et `aria-modal`. Ajouter `qa/a11y.spec.ts` (Playwright et axe) dans la CI | 0,5 j |
| P1-4 | Performance de l'espace client | `cache()` sur `loadWorkspace`, supabase-js limité à `/app/connexion`, découpage de `AuditForm` | 0,5 j |
| P1-5 | Types | Types Supabase générés, fusion de `AuditResult` et `AuditResultV2Ext` en `Audit` | 1 j |
| P1-6 | Tests | Webhook Stripe (fixtures `stripe trigger`), `entitlements`, `jobs`, branche Supabase de `db.ts` contre un Postgres local (`supabase start` en CI). Objectif : 60 % de couverture des lignes `lib/` | 2 j |
| P1-7 | Admin des jobs | `/admin/jobs` : files, jobs morts, relance, coût IA par job | 0,5 j |
| P1-8 | README | Réécrire la grille de prix (V2), le parcours d'inscription, la file de jobs, les sauvegardes et la restauration | 0,5 j |

### P2 (quand le volume ou l'offre le justifie)

- **Membres et rôles** (offre Réseau et Agence) : table `memberships(business_id, user_id, role check in ('owner','editor','viewer'), invited_email, accepted_at)`. `owns_business()` devient `has_role(b, min_role)`. Invitation par `auth.admin.inviteUserByEmail` et un jeton signé. `owner_id` est conservé pour la facturation.
- **RLS sur les données V2** : sortir les collections clés (`exec.tasks`, `facts.brand`) de `documents` vers de vraies tables avec des politiques `has_role`, pour permettre des lectures en temps réel côté client.
- **Rebasculer sur Inngest ou Trigger.dev** si la file dépasse environ 5 000 jobs par jour (même interface `enqueue()`).
- **i18n** : `next-intl` et extraction des chaînes, seulement si l'ouverture à la Belgique, la Suisse ou le Québec est décidée.

## Récapitulatif : les 8 chantiers avant le premier client payant

| # | Chantier | Effort |
|---|---|---|
| P0-1 | Compte créé au paiement, rattachement sur e-mail confirmé, segment transmis, lien magique dans l'e-mail d'achat | 2 j |
| P0-2 | `@supabase/ssr`, middleware, cookies HttpOnly, fin du repli silencieux sur la démo | 1,5 j |
| P0-3 | Droits par plan (`entitlements.ts`) et portail Stripe par client | 1 j |
| P0-4 | Table `jobs` et worker : onboarding, premier audit, tâches, audits mensuels avec reprises | 2,5 j |
| P0-5 | `env.ts` validé au démarrage, Sentry, logs structurés, `/api/health` | 1 j |
| P0-6 | Export et suppression de compte, clé étrangère `documents`, 51 « [À COMPLÉTER] » remplis | 1,5 j |
| P0-7 | Git, CI GitHub Actions, migrations Supabase, sauvegarde nocturne chiffrée | 1 j |
| P0-8 | CSP appliquée avec rapports, inscription publique coupée, slug atomique | 0,5 j |
| | **Total** | **environ 11 jours** |
