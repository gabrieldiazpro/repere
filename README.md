# Repéré — le référencement IA clé en main des entreprises françaises

Application Next.js 15 (App Router, TypeScript strict, Tailwind v4), Supabase, Stripe, Resend. Elle mesure la
visibilité d'une entreprise dans les réponses des IA (ChatGPT, Perplexity, Gemini, Claude, et Mistral en option),
explique les écarts et fournit les actions à mener, pour trois parcours : commerce local, PME, e-commerce.

**L'application fonctionne sans aucune clé : c'est le mode démo.** Les IA sont simulées et les résultats étiquetés
« démo », les données vont dans `.data/*.json`, les e-mails s'affichent dans la console, le paiement redirige vers
`/merci?demo=1`, la file de tâches s'exécute en mémoire. Trois comptes de démonstration en lecture seule :
`demo` (Plomberie Martin), `demo-pme` (Paysia), `demo-ecom` (Maison Sora). Chaque service s'active dès que sa variable
d'environnement est renseignée.

---

## 1. Développer (5 minutes)

```bash
npm install
cp .env.example .env.local     # toutes les valeurs peuvent rester vides en développement
npm run dev                    # http://localhost:3000
```

| Commande | Rôle |
|---|---|
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (toute la suite) ; `npx vitest run src/lib/jobs` pour un dossier |
| `npm run check:env` | Vérifie que chaque variable lue dans `src/` est documentée dans `.env.example` |
| `npm run check` | Les quatre ci-dessus, comme la CI |
| `npm run seed:demo -- --segment pme` | Crée un commerce « [Démo] … » avec 6 mesures simulées (préproduction ; refusé en production) |

- Crons en local (sans `CRON_SECRET`, appel libre hors production) : `curl localhost:3000/api/cron/monthly`,
  `curl "localhost:3000/api/cron/weekly?force=1"`, `curl localhost:3000/api/cron/worker`.
- Santé : `curl localhost:3000/api/health`.
- `.data/` et `.env*` sont exclus de git (exception : `.env.example`).

CI : `.github/workflows/ci.yml` (lint, types, tests, variables, build en mode démo) à chaque push et pull request.
Si le dépôt git a pour racine le dossier parent de `app/`, déplacez `app/.github/` à la racine : le workflow détecte
seul le dossier de l'application.

---

## 2. Mettre en production

La liste à cocher complète est dans **`scripts/ops/mise-en-production.md`**. Résumé :

1. **Vercel** : importez le dépôt (Root Directory = `app` si besoin). Le plan **Pro** est nécessaire dès le premier
   paiement (le plan Hobby est réservé à un usage non commercial et limite les crons à une exécution par jour).
2. **Supabase** (région UE) : exécutez `supabase/schema.sql`, puis les migrations de `supabase/migrations/` dans
   l'ordre. Authentication › URL Configuration : Site URL et Redirect URLs `https://votre-domaine.fr/**` ; SMTP : Resend.
3. **Stripe** : un prix par offre (`STRIPE_PRICE_<PLANID>`, table ci-dessous), portail client activé, webhook
   `https://votre-domaine.fr/api/stripe/webhook` (événements `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.created|updated|deleted`,
   `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created` ; le script
   `node scripts/ops/stripe-setup.mjs` crée tout cela automatiquement, voir `docs/MISE-EN-LIGNE.md`).
4. **Resend** : sous-domaine dédié vérifié (SPF, DKIM, DMARC), `EMAIL_FROM`, `LEGAL_*`.
5. **Variables** : voir `.env.example`. En production, **l'application refuse de démarrer** si une variable
   obligatoire manque ou est mal formée (`src/lib/env.ts`) ; `GET /api/health` résume l'état.
6. **File de tâches** : pg_cron + pg_net appellent `/api/cron/worker` chaque minute (SQL dans
   `supabase/migrations/0004_jobs.sql`), ou cron Vercel Pro à `* * * * *`.
7. **Sauvegardes** : `scripts/ops/backup.md` (Supabase Pro et/ou dump nocturne chiffré `.github/workflows/backup.yml`).

### Offres (docs/v2/07-plans-v2.json, `src/lib/plans.ts`, droits dans `src/lib/entitlements.ts`)

| Parcours | Découverte | Essentiel | Accompagné | Audit ponctuel |
|---|---|---|---|---|
| Local | gratuit (5 questions, 1 mesure/mois, 3 IA) | 29 €/mois ou 290 €/an | 99 €/mois (3 mois min.) | 149 € ; Réseau 79 €/mois |
| PME | gratuit | 99 €/mois ou 990 €/an | 490 €/mois (3 mois min.) | 390 € |
| E-commerce | gratuit | 79 €/mois ou 790 €/an | 390 €/mois (3 mois min.) | 390 € |

Agence (149 €/mois) : liste d'attente. Rythme des mesures : mensuel en local, hebdomadaire en PME et e-commerce
(Essentiel et plus), selon `getEntitlements`. Prix hors taxe, à confirmer dans Stripe.

---

## 3. Tâches de fond (`src/lib/jobs`)

```ts
import { enqueue, registerHandler } from '@/lib/jobs';
await enqueue('audit.run', { businessId, trigger: 'onboarding' }, { businessId, dedupeKey: `audit.run:first:${businessId}` });
```

- **Avec Supabase** : table `jobs` (migration 0004). Le worker `/api/cron/worker` réserve les tâches par
  `for update skip locked` (bail = délai + 30 s), les exécute (délai `JOBS_TIMEOUT_MS`), reprogramme en échec avec un
  backoff exponentiel (1, 2, 4, 8 min… plafonné à 6 h), puis passe la tâche en `dead` après `JOBS_MAX_ATTEMPTS`
  (alerte Sentry + `/api/health` en `warn`). Une tâche urgente (priorité ≤ 3) lance aussi un petit worker
  immédiatement après la réponse HTTP (`after()`).
- **Sans base** : file en mémoire, exécution immédiate pendant `await enqueue(…)` (même API).
- `dedupeKey` : une seconde mise en file renvoie la tâche existante. Les gestionnaires sont idempotents.
- `GET /api/jobs/[id]` : état d'une tâche (premier audit en cours…) pour les membres du commerce.

| Type | Émis par | Effet |
|---|---|---|
| `audit.run` | inscription / paiement, ré-audit planifié | mesure avec les questions suivies et les IA de l'offre, sauvegarde ; si planifié : alertes, e-mail mensuel, paliers ; puis `tasks.generate` |
| `audit.scheduled` | `/api/cron/monthly` (chaque jour) | enfile un `audit.run` par commerce dont la fréquence de l'offre est échue |
| `tasks.generate` | après chaque audit | régénère les tâches (statuts conservés) |
| `digest.send` | `/api/cron/weekly` (lundi 7 h 30, Paris) | digest hebdomadaire par commerce |
| `report.scheduled`, `webhook.deliver`, `measure.action` | modules partage, intégrations, mesure | rapport planifié, webhook signé, mesure avant/après |
| `siteaudit.run` | audit de site | audit technique « prêt pour les IA » |

---

## 4. Observabilité et sécurité

- **Journal** : `src/lib/log.ts`, une ligne JSON par événement (`log.info('event', { … })`, `withRequest(req)`),
  e-mails et jetons masqués. **Erreurs** : `captureError(e, ctx)` envoie à Sentry par HTTP si `SENTRY_DSN` (sans SDK).
- **Santé** : `GET /api/health` → `{ status, mode, checks: { db, env, jobs } }` (503 si échec). Avec
  `Authorization: Bearer <CRON_SECRET>` : détail des briques configurées et de la file.
- **En-têtes** (`next.config.ts`) : CSP **appliquée** avec rapports vers `/api/health/csp-report`, HSTS (sans
  preload), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `X-Robots-Tag: noindex` sur
  `/app`, `/admin`, `/api`, `/rapport`. `CSP_REPORT_ONLY=1` pour diagnostiquer. Passage au nonce : annexe B de
  `scripts/ops/mise-en-production.md`.
- **RGPD** : `GET /api/account/data?businessId=…` (export JSON complet, propriétaire) et
  `DELETE /api/account/data?businessId=…` avec `{ "confirm": "<nom du commerce>" }` (suppression en cascade : documents,
  tâches, audits, alertes, adhésions ; refusée tant qu'un abonnement est actif ; adresse mise en opposition).

---

## 5. API principales

| Route | Rôle |
|---|---|
| `POST /api/audit`, `GET /api/audit/[id]` | Audit gratuit et lecture du résultat public |
| `POST /api/checkout`, `POST /api/stripe/webhook` | Paiement, création du compte et du commerce, premier audit enfilé |
| `GET /api/cron/monthly` · `weekly` · `worker` | Crons (Bearer `CRON_SECRET`) : planification, digest, exécution de la file |
| `GET /api/jobs/[id]` | État d'une tâche |
| `GET /api/health` | Santé (public résumé, détail avec le secret) |
| `GET`/`DELETE /api/account/data` | Export et suppression RGPD |
| `/api/tools/*` | Outils gratuits (robots IA, citabilité, JSON-LD, llms.txt…) |
| `/api/prompts`, `/api/export`, `/api/share`, `/api/integrations`, `/api/copilot`… | Espace client (session requise) |

---

## 6. Coûts

| Poste | Démarrage | ≈ 100 abonnés |
|---|---|---|
| Vercel | Pro dès le premier paiement | Pro |
| Supabase | Free (500 Mo, pause après 7 jours d'inactivité) | Pro conseillé (sauvegardes) |
| Resend | offre gratuite (quotas à vérifier) | offre payante possible |
| Stripe | commission par paiement, pas de fixe | idem |
| IA | ≈ 0,35 à 1,55 $ par audit réel (3 IA) | le premier poste de coût |

Les tarifs des fournisseurs changent : revérifiez-les avant le lancement (`docs/04-api-ia.md` §6). Fixez un plafond
de dépense chez chaque fournisseur d'IA.

---

## 7. Structure

```
src/lib/engine/        moteur d'audit multi-IA
src/lib/auth/          session (cookies httpOnly), requireBusiness, rôles ; src/lib/entitlements.ts : droits par offre
src/lib/jobs/          file de tâches (mémoire / Postgres), worker, gestionnaires
src/lib/env.ts         validation des variables (zod), refus de démarrer en production si incomplet
src/lib/log.ts         journal JSON, remontée d'erreurs compatible Sentry
src/lib/db.ts          données V1 (Supabase, sinon .data/*.json) ; src/lib/store.ts : documents des modules V2/V3
src/app/api/           routes (crons, jobs, health, account/data, tools…)
supabase/schema.sql    schéma de base ; supabase/migrations/ : migrations versionnées (0003 comptes, 0004 jobs)
scripts/ops/           check-env, seed de démo, sauvegardes, checklist de mise en production
.github/workflows/     CI et sauvegarde nocturne
```
