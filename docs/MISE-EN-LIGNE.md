# Mettre Repéré en ligne — le guide pas à pas

Ce guide part de zéro et s'arrête quand le site encaisse son premier paiement. Il est écrit pour quelqu'un qui n'est
pas développeur : chaque étape dit **ce que vous cliquez**, **ce que vous collez**, **ce que vous lancez**, et
**comment vérifier que c'est bon** avant de passer à la suivante.

- **Temps de travail** : environ 3 h 30, en une ou deux sessions.
- **Temps d'attente** (pendant lequel vous pouvez faire autre chose) : propagation DNS du domaine et des e-mails
  (quelques minutes à 48 h), validation du compte Stripe (variable), vérification Google (jusqu'à 5 jours ouvrés).
- **Il vous faut** : un nom de domaine, une carte bancaire, les papiers de la société (Kbis ou avis de situation
  INSEE), un ordinateur avec un terminal (« Terminal » sur Mac, « PowerShell » sur Windows).

> **Règle d'or.** Toutes les clés vont dans **un seul fichier**, `app/.env.production.local`, que les scripts créent
> et vérifient pour vous. Ce fichier ne doit jamais être envoyé par e-mail, collé dans un chat ni versionné (il est
> déjà exclu de git). Gardez-en une copie dans votre gestionnaire de mots de passe.

## Récapitulatif

| # | Étape | Temps | Commande ou action principale | C'est bon quand… |
|---|---|---|---|---|
| 0 | Préparer l'ordinateur | 10 min | `npm install` | `node -v` affiche v22.18 ou plus |
| 1 | Créer le fichier des secrets | 2 min | `node scripts/ops/secrets.mjs` | « ✓ … créé : 9 secrets internes » |
| 2 | Supabase (base de données) | 25 min | `node scripts/ops/migrate.mjs` | « ✓ Base à jour » |
| 3 | Resend (e-mails) | 15 min + DNS | coller la clé | domaine « Verified » chez Resend |
| 4 | Vercel (hébergement) et domaine | 20 min | importer le projet | le domaine affiche le site |
| 5 | Stripe (paiement) | 20 min | `node scripts/ops/stripe-setup.mjs --live` | « Valeurs écrites dans .env.production.local » |
| 6 | Clés des IA | 20 min | coller les clés | `--liste` les montre ✓ |
| 7 | Identité légale | 10 min | coller vos informations officielles | `check-env --prod` n'en signale plus |
| 8 | Contrôle complet | 2 min | `node scripts/ops/check-env.mjs --prod` | « ✓ PRÊT » |
| 9 | Envoyer les variables à Vercel | 10 min | `node scripts/ops/secrets.mjs --vercel-fichier` | redéploiement terminé |
| 10 | Tâches de fond chaque minute | 3 min | `node scripts/ops/migrate.mjs --cron` | « ✓ Planification en place » |
| 11 | Vérifier le site en ligne | 5 min | `node scripts/ops/verifier-prod.mjs https://votre-domaine.fr` | « ✓ EN LIGNE ET CONFORME » |
| 12 | Achat test réel, remboursé | 10 min | un vrai paiement | compte créé, e-mail reçu |
| 13 | Google (fiche, API, Places) | 30 min + attente | voir l'étape | voir l'étape |
| 14 | Données SEO et publication (V5, facultatif) | 30 min | coller les clés, `migrate.mjs` | `--liste` les montre ✓ |

Toutes les commandes se lancent **dans le dossier `app`** du projet (`cd chemin/vers/auditia/app`).

---

## 0. Préparer l'ordinateur (10 min)

1. Installez **Node.js 24 LTS** (ou 22.18 minimum) depuis https://nodejs.org (bouton « LTS »), comme n'importe quel
   logiciel.
2. Ouvrez le terminal, placez-vous dans le dossier `app` du projet, puis lancez :
   ```bash
   npm install
   ```

**Vérifier** : `node -v` affiche `v22.18` ou plus (ou `v24…`), et `npm install` se termine sans « ERR! ».

## 1. Créer le fichier des secrets (2 min)

```bash
node scripts/ops/secrets.mjs
```

Le script crée `.env.production.local` avec **9 secrets internes** déjà générés (64 caractères aléatoires chacun :
sessions, liens signés, protection des tâches planifiées, accès `/admin`…) et une case vide, commentée, pour chaque
clé à coller, avec l'adresse exacte de la page où la trouver.

- À tout moment, pour voir ce qui reste à coller : `node scripts/ops/secrets.mjs --liste`
  (✓ remplie, ✗ obligatoire manquante, · facultative).
- Le script **n'écrase jamais** un fichier existant. `--completer` ajoute ce qui manque sans rien modifier.
- **Ne lancez jamais `--force` une fois le site ouvert** : il change les secrets, ce qui déconnecte tout le monde, rend
  invalides les liens déjà envoyés et rend illisibles les connexions (Slack, Shopify…) chiffrées par
  `INTEGRATIONS_SECRET`.
- Pour modifier le fichier : ouvrez-le avec un éditeur de texte simple (TextEdit en mode « texte brut », Bloc-notes,
  VS Code). Une valeur par ligne, **sans espace autour du `=`**.

**Vérifier** : le message « ✓ .env.production.local créé : 9 secrets internes en place ».

## 2. Supabase : la base de données (25 min)

1. Créez un compte sur https://supabase.com, puis **New project** :
   - **Region** : une région de l'Union européenne (Paris `eu-west-3` ou Francfort `eu-central-1`) ;
   - **Database password** : cliquez « Generate a password » et **copiez-le** dans votre gestionnaire de mots de passe.
   - Offre gratuite pour commencer ; passez à **Pro** avant d'avoir des clients payants (sauvegardes quotidiennes, pas
     de mise en pause après 7 jours d'inactivité).
2. Bouton **Connect** en haut de la page du projet
   (https://supabase.com/dashboard/project/_?showConnect=true) :
   - copiez la **Project URL** (`https://xxxx.supabase.co`) dans `SUPABASE_URL` **et** `NEXT_PUBLIC_SUPABASE_URL` ;
   - onglet de connexion à la base, **Session pooler**, copiez l'URI dans `DATABASE_URL` et remplacez `[YOUR-PASSWORD]`
     par le mot de passe de l'étape 1 (si le mot de passe contient `@`, `#`, `?`, `&` ou `/`, régénérez-en un sans ces
     caractères, c'est plus simple). Le « Session pooler » fonctionne sur tous les réseaux ; la connexion directe exige
     IPv6.
3. **Settings › API Keys** (https://supabase.com/dashboard/project/_/settings/api-keys) :
   - clé **Publishable** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY` ;
   - clé **Secret** (`sb_secret_…`, bouton « Reveal ») → `SUPABASE_SERVICE_ROLE_KEY`.
   - Les anciennes clés `anon` / `service_role` (qui commencent par `eyJ`) fonctionnent aussi ; le contrôle de l'étape 8
     vérifie que vous ne les avez pas inversées.
4. Créez les tables :
   ```bash
   node scripts/ops/migrate.mjs --dry-run    # montre les 4 fichiers qui vont être appliqués
   node scripts/ops/migrate.mjs              # les applique
   ```
   **Sans terminal**, autre possibilité : Supabase › **SQL Editor** › **New query**, collez **tout** le fichier
   `app/supabase/TOUT-EN-UN.sql`, puis **Run**. Le fichier se rejoue sans risque.
5. **Authentication › URL Configuration** : **Site URL** = `https://votre-domaine.fr` ; **Redirect URLs** : ajoutez
   `https://votre-domaine.fr/connexion/callback`.
6. **Authentication › Sign In / Providers** : désactivez **Allow new users to sign up** (seul le serveur de Repéré crée
   les comptes, après un paiement ou une inscription vérifiée).
7. Les e-mails de connexion passent par Resend : faites-le à la fin de l'étape 3 (réglage SMTP).

**Vérifier** : `node scripts/ops/migrate.mjs` affiche « ✓ Base à jour : 4 fichiers déjà appliqués, rien à faire » ;
dans Supabase › **Table Editor**, vous voyez notamment `businesses`, `audits`, `jobs`, `memberships`. Après chaque
mise à jour de l'application, relancez simplement `node scripts/ops/migrate.mjs` : il n'applique que ce qui a changé.

> Ce qui a été prouvé avant de vous remettre ces fichiers : le schéma et les migrations 0003 à 0005 ont été appliqués
> sur un vrai Postgres, deux fois de suite sans erreur, la sécurité par ligne (RLS) est active sur chaque table, et
> un visiteur anonyme ne peut lire ni les prospects, ni les tâches, ni les paiements (tests
> `scripts/ops/__tests__/migrations.test.ts`).

## 3. Resend : les e-mails (15 min, puis attente DNS)

1. Créez un compte sur https://resend.com, puis **Domains** (https://resend.com/domains) › **Add Domain**. Utilisez un
   **sous-domaine dédié**, par exemple `mail.votre-domaine.fr`, région **EU (Ireland)**.
2. Resend affiche des enregistrements DNS (SPF, DKIM, et un enregistrement MX de retour) : ajoutez-les tels quels chez
   votre registraire de domaine (OVH, Gandi, Ionos… rubrique « Zone DNS »). Ajoutez aussi un enregistrement DMARC :
   type `TXT`, nom `_dmarc.mail`, valeur `v=DMARC1; p=none; rua=mailto:votre-adresse@votre-domaine.fr`.
3. Revenez sur Resend et cliquez **Verify** (la propagation prend de quelques minutes à quelques heures).
4. **API Keys** (https://resend.com/api-keys) › **Create API Key**, permission **Sending access**, limitée à votre
   domaine → `RESEND_API_KEY` (commence par `re_`, affichée une seule fois).
5. Dans le fichier : `EMAIL_FROM=Repéré <bonjour@mail.votre-domaine.fr>` (adresse sur le domaine vérifié) ;
   `NEXT_PUBLIC_CONTACT_EMAIL` = l'adresse de contact publique.
6. **Supabase › Authentication › Emails › SMTP Settings** : activez le SMTP personnalisé avec Host `smtp.resend.com`,
   Port `465`, Username `resend`, Password = votre clé `re_…`, expéditeur = la même adresse que `EMAIL_FROM`. **Save**.

**Vérifier** : le domaine est **Verified** chez Resend.

## 4. Vercel : l'hébergement et le domaine (20 min)

1. Créez un compte sur https://vercel.com et choisissez l'offre **Pro** : l'offre gratuite « Hobby » est réservée à un
   usage non commercial.
2. **Add New › Project**, importez le dépôt du projet. **Root Directory** : `app`. Ne remplissez pas encore les
   variables (étape 9), cliquez **Deploy** : le premier déploiement démarre en mode démonstration, c'est normal.
3. **Settings › Domains** : ajoutez `votre-domaine.fr` (et `www.votre-domaine.fr` qui redirige vers lui), puis créez
   chez votre registraire les enregistrements DNS que Vercel affiche.
4. Dans le fichier : `NEXT_PUBLIC_APP_URL=https://votre-domaine.fr` et `NEXT_PUBLIC_SITE_URL=https://votre-domaine.fr`
   (même valeur, sans barre finale).

**Vérifier** : `https://votre-domaine.fr` affiche le site (bandeau « démo » à ce stade) avec le cadenas HTTPS.

## 5. Stripe : le paiement (20 min)

1. Créez votre compte sur https://dashboard.stripe.com et **activez les paiements** (informations de la société,
   représentant légal, IBAN de versement). Tant que ce n'est pas fait, le mode « live » est indisponible.
2. **Développeurs › Clés API** (https://dashboard.stripe.com/apikeys), en mode **live** : copiez la **clé secrète**
   (`sk_live_…`) dans `STRIPE_SECRET_KEY`. Stripe ne la montre qu'une fois : gardez-en une copie.
3. Essai à blanc (ne modifie rien chez Stripe) :
   ```bash
   node scripts/ops/stripe-setup.mjs --dry-run
   ```
   Il liste ce qui va être créé : un produit par offre, **14 prix** lus dans `src/lib/plans.ts` (Local : audit
   149 €, Essentiel 29 €/mois ou 290 €/an, Accompagné 99 €/mois, Réseau 79 €/mois ou 790 €/an ; PME : audit 390 €,
   Essentiel 99 €/mois ou 990 €/an, Accompagné 490 €/mois ; E-commerce : audit 390 €, Essentiel 79 €/mois ou 790 €/an,
   Accompagné 390 €/mois), le **webhook** `https://votre-domaine.fr/api/stripe/webhook` avec ses 8 événements (dont
   `invoice.paid`), et le **portail client**.
4. Pour de vrai :
   ```bash
   node scripts/ops/stripe-setup.mjs --live
   ```
   Le script écrit lui-même les 14 `STRIPE_PRICE_…` et `STRIPE_WEBHOOK_SECRET` dans votre fichier. Il se relance sans
   risque : il ne recrée rien de ce qui existe. Si un prix change un jour dans `plans.ts`, relancez-le : il crée le
   nouveau prix, archive l'ancien (les abonnés en cours gardent le leur) et met à jour le fichier.
5. Si le script affiche « ! Portail client » : ouvrez https://dashboard.stripe.com/settings/billing/portal, cliquez
   **Save** une fois (sans rien changer), puis relancez `node scripts/ops/stripe-setup.mjs --live`.

**Envie d'essayer d'abord sans argent réel ?** Mettez une clé de sandbox `sk_test_…` (même page, sélecteur de compte
en haut à gauche), lancez `node scripts/ops/stripe-setup.mjs --ecrire`, testez, puis remettez la clé `sk_live_` et
relancez avec `--live` avant l'ouverture : les identifiants de prix de test ne marchent pas en live.

> **Point d'attention** : le portail Stripe permet de résilier en fin de période. Pour l'offre Accompagné (3 mois
> minimum), une résiliation pendant l'engagement reste due selon vos CGV : surveillez les résiliations des trois
> premiers mois.

**Vérifier** : la sortie se termine par « ✓ Valeurs écrites dans .env.production.local ». Dans Stripe, **Catalogue de
produits** montre les offres « Repéré … » et **Workbench › Webhooks** montre l'endpoint.

## 6. Les clés des IA (20 min)

Collez au moins les trois premières (l'audit de base interroge ChatGPT, Gemini et Perplexity). Chez **chaque**
fournisseur, fixez un **plafond de dépense mensuel** : c'est votre premier poste de coût.

| Variable | Page où créer la clé | Format |
|---|---|---|
| `OPENAI_API_KEY` (ChatGPT) | https://platform.openai.com/api-keys | `sk-…` |
| `GEMINI_API_KEY` (Gemini) | https://aistudio.google.com/apikey | `AIza…` ou `AQ.…` |
| `PERPLEXITY_API_KEY` | https://console.perplexity.ai/project/keys | `pplx-…` |
| `ANTHROPIC_API_KEY` (Claude, offres Essentiel PME/e-commerce et Accompagné) | https://platform.claude.com/settings/keys | `sk-ant-…` |
| `MISTRAL_API_KEY` (offres Accompagné PME/e-commerce) | https://console.mistral.ai/api-keys (moyen de paiement requis) | 32 caractères |

Facultatif : `SENTRY_DSN` (suivi des erreurs, offre gratuite, https://sentry.io › projet › Client Keys).

**Vérifier** : `node scripts/ops/secrets.mjs --liste` montre ✓ devant ces clés.

## 7. L'identité légale (10 min)

Ces informations sont publiées dans les mentions légales, les CGV, la politique de confidentialité, les données
structurées (JSON-LD) et `llms.txt`. **Recopiez-les de vos documents officiels** (extrait Kbis, avis INSEE, fiche
https://annuaire-entreprises.data.gouv.fr) : les scripts n'inventent rien et refusent les textes provisoires.

| Variable | Exemple de forme (pas une vraie valeur) | Obligatoire |
|---|---|---|
| `NEXT_PUBLIC_LEGAL_NAME` | dénomination exacte de la société | oui |
| `NEXT_PUBLIC_LEGAL_FORM` | `SAS au capital de 1 000 €` | oui |
| `NEXT_PUBLIC_LEGAL_SIREN` | 9 chiffres (la clé de contrôle est vérifiée) | oui |
| `NEXT_PUBLIC_LEGAL_SIRET` | 14 chiffres | non |
| `NEXT_PUBLIC_LEGAL_RCS_CITY` | ville du greffe, ex. `Lyon` | oui pour une société |
| `NEXT_PUBLIC_LEGAL_STREET`, `_POSTAL_CODE`, `_CITY` | adresse du siège | oui |
| `NEXT_PUBLIC_LEGAL_EMAIL`, `NEXT_PUBLIC_LEGAL_PHONE` | contact de l'éditeur | oui |
| `NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR` | `Prénom NOM, président` | oui |
| `NEXT_PUBLIC_FOUNDER_NAME`, `NEXT_PUBLIC_FOUNDER_BIO` | nom et 2-3 phrases de parcours vérifiable | oui (page /a-propos) |
| `NEXT_PUBLIC_FOUNDER_LINKEDIN`, `NEXT_PUBLIC_FOUNDER_IMAGE`, `NEXT_PUBLIC_SAME_AS`, `NEXT_PUBLIC_LEGAL_FOUNDING_DATE` | liens et date | non |

Les champs contenant des espaces s'écrivent entre guillemets : `NEXT_PUBLIC_LEGAL_FORM="SAS au capital de 1 000 €"`.

Tant qu'un champ obligatoire manque, la page concernée affiche un repère visible « [À COMPLÉTER : …] », `/a-propos`
reste hors de Google, et le contrôle de l'étape 8 **bloque** la mise en ligne. Les autres passages entre crochets des
pages légales (délais, prestataires, hébergeurs…) relèvent de la relecture juridique, pas de ce fichier : la
vérification de l'étape 11 les signale aussi.

## 8. Contrôle complet avant envoi (2 min)

```bash
node scripts/ops/check-env.mjs --prod
```

Il vérifie, **sans afficher aucune valeur secrète** : la présence et la longueur des secrets internes (tous
différents), le format de chaque clé (Stripe `sk_live_`/`whsec_`/`price_`, Resend `re_`, Supabase publique ≠
secrète et du bon projet, IA…), un prix Stripe pour chacune des 14 offres vendues, l'identité légale complète
(`ENTITY_READY`), que les modes de dépannage sont éteints (`DEMO_MODE`, `AUTH_LOCAL_ACCOUNTS`, `CSP_DISABLE`), et rejoue
la validation que l'application fait elle-même au démarrage.

**Vérifier** : « Contrôle de production : ✓ PRÊT ». Sinon, chaque ligne ✗ dit quoi corriger et où trouver la valeur.

## 9. Envoyer les variables à Vercel (10 min)

```bash
node scripts/ops/secrets.mjs --vercel-fichier
```

Il écrit `.env.vercel.local` : toutes vos variables **sauf** `DATABASE_URL` (utile aux scripts seulement), plus les
copies serveur de l'identité pour le pied des e-mails (`LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_SIREN`).

1. Vercel › votre projet › **Settings › Environment Variables** › **Import .env** › choisissez `.env.vercel.local`.
2. Cochez l'environnement **Production** uniquement, type **Secret** pour les clés, puis **Save**.
3. **Deployments** › le dernier déploiement › **⋯ › Redeploy** (les variables ne s'appliquent qu'aux nouveaux
   déploiements, et les informations publiques comme l'identité légale sont intégrées à la construction du site).
4. Supprimez le fichier d'import : `rm .env.vercel.local`.

Avec la ligne de commande Vercel à la place : `node scripts/ops/secrets.mjs --vercel` imprime une commande
`vercel env add` par variable.

**Vérifier** : le redéploiement se termine en « Ready » ; `https://votre-domaine.fr` n'affiche plus de bandeau démo.

## 10. Tâches de fond chaque minute (3 min)

Les audits, résumés et rapports planifiés passent par une file de tâches qu'il faut réveiller chaque minute. Vercel ne
le fait qu'une fois par jour dans `vercel.json` ; Supabase s'en charge gratuitement :

```bash
node scripts/ops/migrate.mjs --cron
```

(Sans terminal : `node scripts/ops/migrate.mjs --cron --dry-run` affiche le SQL à coller dans Supabase › SQL Editor.
Il contient `CRON_SECRET` : ne le partagez pas.)

**Vérifier** : « ✓ Planification en place : repere-jobs-purge, repere-purge, repere-worker ». Dans Supabase ›
**Integrations › Cron**, les trois tâches apparaissent et s'exécutent.

## 11. Vérifier le site en ligne (5 min)

```bash
node scripts/ops/verifier-prod.mjs https://votre-domaine.fr
```

Contrôlé de l'extérieur, sans rien modifier : pages clés (accueil, tarifs, parcours, audit, méthode, à propos,
contact) et adresse canonique ; pages légales sans « [À COMPLÉTER] » ; en-têtes de sécurité (CSP appliquée, HSTS,
anti-iframe, nosniff, Referrer-Policy, Permissions-Policy) et redirection http → https ; `robots.txt`, `sitemap.xml`,
`llms.txt` sur le bon domaine ; identité publiée (`ENTITY_READY`) ; **webhook Stripe joignable et configuré** (une
requête sans signature, refusée avant tout traitement : rien n'est déclenché) ; santé de la base, de la configuration
et de la file de tâches (`/api/health`, détail grâce à `CRON_SECRET` lu dans votre fichier).

**Vérifier** : « ✓ EN LIGNE ET CONFORME ». Ajoutez ensuite un moniteur gratuit (UptimeRobot, Better Stack) sur
`https://votre-domaine.fr/api/health`, alerte si la réponse n'est pas 200.

## 12. Achat test réel, puis remboursement (10 min)

1. Sur `https://votre-domaine.fr/tarifs`, achetez l'offre la moins chère avec votre propre carte.
2. Vous recevez l'e-mail d'accès ; l'espace client s'ouvre et le premier audit se lance.
3. Stripe › **Paiements** › ce paiement › **Rembourser**, puis **Clients** › l'abonnement éventuel › **Annuler**.

**Vérifier** : Stripe › Workbench › Webhooks › l'endpoint montre des livraisons réussies (200).

## 13. Google : fiche d'établissement, API Business Profile, clé Places

### a) La fiche Google de Repéré — vérifiez d'abord l'éligibilité

Google n'accepte une fiche que si l'entreprise **rencontre ses clients en personne** aux horaires indiqués ; les
entreprises **uniquement en ligne** sont explicitement exclues
([règles d'éligibilité](https://support.google.com/business/answer/13763036)). Un service en ligne comme Repéré n'y
a droit que si vous recevez réellement des clients (bureau avec accueil aux horaires affichés) ou si vous vous déplacez
chez eux (zone d'intervention, adresse masquée). Une domiciliation ou une boîte postale ne suffit pas. **En cas de
doute, ne créez pas de fiche** : une fiche non conforme peut être suspendue. Si vous êtes éligible :

1. Connectez-vous au compte Google professionnel qui gérera la fiche, puis allez sur https://business.google.com/add.
2. Suivez les écrans : nom exact de l'entreprise (sans mots-clés ajoutés), catégorie, adresse réelle ou zone
   d'intervention, téléphone, site `https://votre-domaine.fr`.
3. Choisissez la méthode de vérification proposée (vidéo, téléphone, SMS, e-mail, appel vidéo, courrier) depuis
   https://business.google.com › **Get verified**
   ([procédure](https://support.google.com/business/answer/7107242)). L'examen prend jusqu'à 5 jours ouvrés.

### b) L'API Business Profile (facultative : Repéré fonctionne sans)

Repéré n'utilise **pas** cette API : l'audit de fiche des clients lit l'**API Places** si une clé est configurée, et
sinon (ou si Google refuse la requête) le calcule à partir d'une **saisie guidée** ; les posts Google sont préparés
puis publiés à la main par le client. C'est vérifié par des tests
(`scripts/ops/__tests__/mise-en-ligne.test.ts`, « fiche Google sans accès API »).

Pour demander l'accès plus tard (publication automatique), conditions de Google
([prérequis](https://developers.google.com/my-business/content/prereqs)) : gérer une fiche **vérifiée et active
depuis plus de 60 jours** et avoir un site qui représente l'entreprise de cette fiche, plus un projet Google Cloud.

1. Sur https://console.cloud.google.com, créez un projet (ou utilisez celui de l'étape c) et copiez son **numéro de
   projet** (carte « Project info » du tableau de bord).
2. Remplissez le formulaire https://support.google.com/business/contact/api_default, choix **Application for Basic API
   Access**, avec une adresse e-mail propriétaire ou gestionnaire de la fiche.
3. Attendez l'e-mail de Google. **Vérifier** : dans la console Cloud, les quotas des API Business Profile passent de
   0 à 300 requêtes par minute.

### c) La clé Google Places (recommandée pour l'offre Local)

Elle permet de lire automatiquement la fiche Google d'un commerce client à partir de son identifiant de lieu
([procédure officielle](https://developers.google.com/maps/documentation/places/web-service/get-api-key)).

1. https://console.cloud.google.com/projectselector/billing : rattachez un **compte de facturation** au projet
   (obligatoire, même dans la gratuité mensuelle).
2. https://console.cloud.google.com/apis/library/places.googleapis.com : **Enable** (« Places API (New) »).
3. https://console.cloud.google.com/projectselector/google/maps-apis/credentials : **Create credentials › API key** ;
   dans **API restrictions**, ne gardez que **Places API (New)**. **Create**, puis **Show key**.
4. Collez-la dans `GOOGLE_PLACES_KEY`, relancez les étapes 8 et 9.
5. Dans **Google Cloud › Billing › Budgets & alerts**, créez un budget avec alerte. La facturation est par type de
   données demandées ; la note, le nombre d'avis et les horaires relèvent de la catégorie la plus chère (gratuité
   mensuelle d'environ 1 000 appels pour cette catégorie à la date de vérification : revérifiez les tarifs).

**Vérifier** : dans l'espace d'un commerce local, l'audit de fiche avec un identifiant de lieu n'affiche plus
« Lecture automatique de la fiche non configurée ».

---

## 14. Données SEO et publication (V5, facultatif : Repéré fonctionne sans)

Sans ces clés, l'analyse SEO + GEO fonctionne (exploration réelle du site) ; seules les données externes affichent
« non configuré » : **aucun chiffre n'est estimé ni inventé**. Toutes les variables sont facultatives.

**a) Base de données** : `node scripts/ops/migrate.mjs` applique `0006_jobs_v5.sql` (nouveaux types de tâches :
Search Console, positions, relecture des publications, réanalyses, baromètres). **Vérifier** : « ✓ Base à jour ».
Sans terminal : recollez `supabase/TOUT-EN-UN.sql` dans l'éditeur SQL de Supabase.

**b) PageSpeed et Core Web Vitals (gratuit, recommandé)**
1. https://console.cloud.google.com/apis/library : activez **PageSpeed Insights API** et **Chrome UX Report API**.
2. https://console.cloud.google.com/apis/credentials › **Create credentials › API key** ; restreignez-la à ces deux API.
3. Collez-la dans `PAGESPEED_API_KEY` (`CRUX_API_KEY` reste vide : la même clé sert). **Vérifier** : l'analyse d'un
   site affiche « Vitesse mobile (PageSpeed) » au lieu de « non configuré ».

**c) Search Console (gratuit)** — même client OAuth que GA4.
1. https://console.cloud.google.com/apis/library : activez **Google Search Console API**.
2. https://console.cloud.google.com/apis/credentials › votre **ID client OAuth** (application Web) : ajoutez l'URI de
   redirection `https://votre-domaine.fr/api/v5/connect/google/callback`.
3. `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (s'ils ne sont pas déjà remplis pour GA4). **Vérifier** : dans l'app,
   « Connecter Search Console » ouvre l'écran d'autorisation de Google.

**d) DataForSEO (payant à l'appel : positions, volumes, mots-clés, liens)**
1. https://app.dataforseo.com/register, puis dépôt minimal (50 $ à la date de vérification).
2. https://app.dataforseo.com/api-access : copiez l'**identifiant API** dans `DATAFORSEO_LOGIN` et le **mot de passe
   API** (différent de celui du compte) dans `DATAFORSEO_PASSWORD`.
3. Coût estimé : 0 à 5 € par client et par mois, plafonné par offre (`seoData` dans `src/lib/entitlements.ts`).
   `SEODATA_EUR_PER_USD` (défaut 0,92) sert à convertir les coûts en euros.
4. **Liens entrants (facultatif, 100 $/mois ≈ 92 €)** : réservés aux offres **Accompagné et Agence** (les autres offres
   voient « Inclus dans les offres Accompagné et Agence », sans aucun chiffre). Rentable dès **1 abonné Accompagné**
   (99 €/mois ≥ 92 €). Pour activer : souscrire l'engagement Backlinks chez DataForSEO, puis `SEODATA_BACKLINKS_ENABLED=1`
   (et `SEODATA_BACKLINKS_FIXED_USD` si le montant n'est pas 100). Sans cette variable, aucun appel « liens » n'est fait.

**e) Agent de publication**
- **Shopify** : l'autorisation demande désormais aussi `write_products`, `write_content`,
  `write_online_store_navigation`. Dans le Partner Dashboard, rien à changer côté URL ; les boutiques connectées avant
  la V5 restent connectées en lecture et doivent **ré-autoriser** Repéré pour que l'agent publie.
  `SHOPIFY_THEME_WRITE=1` seulement après l'exemption Shopify pour `write_themes` (robots.txt, llms.txt du thème).
- **WordPress** : le client installe l'extension `integrations/wordpress` (version 1.1.0 ou plus, aussi téléchargeable depuis l’app) pour que Yoast ou
  Rank Math acceptent le titre et la description SEO par l'API ; sans elle, ces modifications passent par l'export.
- **Fiche Google** : `PUBLISH_GBP_ENABLED=1` uniquement après l'accord d'accès à l'API Business Profile (étape 13 b).
- **Offres** : export pour tous ; application directe à partir d'Essentiel (proposition : 20 / 100 / 200 séries
  appliquées par mois en Essentiel / Accompagné / Agence, à valider).
- **Agent automatique** : après chaque exploration ou réanalyse d'un espace, l'agent prépare des **brouillons** de
  corrections selon les réglages du client (types autorisés, rythme, notification) ; rien n'est appliqué sans
  validation. `PUBLISH_AGENT_AUTO=0` le coupe pour tous.

**f) Analyse gratuite en 60 s (page /analyse) — rien à configurer**
- Fonctionne sans clé (exploration réelle + audit SEO et GEO) ; avec des clés d'IA, un contrôle IA rapide s'ajoute,
  plafonné par `ANALYSIS_MAX_AI_CALLS` (défaut 18 appels par analyse, 0 = aucun).
- Limites anti-abus (défauts) : `ANALYSIS_RATE_LIMIT_PER_HOUR`=6 et `ANALYSIS_RATE_LIMIT_PER_DAY`=15 par adresse IP,
  `ANALYSIS_PER_DOMAIN_PER_HOUR`=4 par site, `ANALYSIS_GLOBAL_PER_HOUR`=120 et `ANALYSIS_GLOBAL_PER_DAY`=600 au total.
- Le lien du rapport part par e-mail si le visiteur a saisi son adresse (Resend, lien de désinscription, 3 envois
  par adresse et par jour) ; `ANALYSIS_EMAIL_REPORT=0` coupe cet envoi.
- `GEO_LLM=off` : aucune IA dans l'optimisation GEO (gabarits seulement) ; vide = clés d'IA existantes.

**g) Réanalyses et baromètres**
- Les réanalyses des espaces (60 pages en Découverte, 500 en Essentiel, 2 000 en Accompagné) partent du cron quotidien
  (`/api/cron/monthly`). Pour explorer réellement 2 000 pages, mettez `JOBS_TIMEOUT_MS=280000`.
- `BAROMETRE_ENABLED=1` lance la passe mensuelle des baromètres (le 2 du mois ou après), plafonnée par
  `BAROMETRE_BUDGET_EUR` (défaut 120). Sans cela : rien n'est mesuré ni publié. **Lancement progressif** :
  `BAROMETRE_MAX` baromètres par mois (défaut **10**, les plus prometteurs d'abord : plombiers, serruriers, électriciens,
  agences immobilières et coiffeurs à Paris ; plombiers, serruriers, agences immobilières à Lyon ; plombiers, serruriers
  à Marseille). Coût estimé (4 IA, 144 réponses par baromètre ≈ 1,93 €) :

  | BAROMETRE_MAX | Coût estimé / mois | Rentable dès |
  |---|---|---|
  | 10 (défaut) | ≈ 19,30 € | 1 abonné Essentiel local (29 €) attribué aux baromètres |
  | 20 | ≈ 38,60 € | 2 Essentiel local, ou 1 Essentiel e-commerce (79 €) |
  | 50 (catalogue complet) | ≈ 96,50 € | 4 Essentiel local, ou 1 Accompagné (99 €) |

  Vérifier le plan sans aucun appel : `npx vite-node --config vitest.config.ts scripts/barometre/run.ts --plan`.
- Nouveau cron déclaré dans `vercel.json` : `/api/v5/seodata/cron` (quotidien).

**h) Où lire le retour sur investissement : `/admin/roi`** (réservé admin, lien depuis `/admin`)
- Par source payante : coût du mois **mesuré** (registre des baromètres `barometre.budget` ; registres DataForSEO
  `seodata.costs` convertis avec `SEODATA_EUR_PER_USD`, plus l'engagement Backlinks quand il est activé — compté comme
  ce qu'il ajoute à la facture : max(engagement, autres appels + liens) − autres appels), revenu, ratio revenu / coût.
- Baromètres : visites des pages `/barometre/**` par source et site d'origine ; analyses 60 s, audits gratuits,
  inscriptions et abonnements payants dont la première page vue (ou les UTM des liens du baromètre) vient d'un
  baromètre ; revenu mensuel récurrent attribué ; liens entrants gagnés par les pages (si les liens sont activés, relevé
  mensuel plafonné par `ROI_LINKS_CAP_EUR`, défaut 2 €).
- Liens entrants : abonnés Accompagné et Agence (qui ont l'onglet), MRR de ces offres, usage réel de l'onglet Liens.
- **Règle d'arrêt affichée** : « si le ratio reste < 1 après 3 mois, couper », avec la date de démarrage (premier mois
  de dépense relevé, ou `ROI_BAROMETRE_START` / `ROI_BACKLINKS_START` au format AAAA-MM-JJ). Couper = retirer
  `BAROMETRE_ENABLED` ou `SEODATA_BACKLINKS_ENABLED` (et résilier l'engagement DataForSEO).
- Attribution sans cookie (conforme à l'article 11 de la politique de confidentialité) : première page gardée en
  mémoire de l'onglet, UTM sur les liens des baromètres, origine enregistrée côté serveur avec l'analyse, l'audit ou
  l'espace créé ; « Ne pas me suivre » respecté. Le relevé mensuel est enregistré par le cron quotidien et à chaque
  ouverture de la page. Sans données : état vide, aucun chiffre estimé.

**Vérifier** : `node scripts/ops/secrets.mjs --liste` montre la rubrique « Données SEO » ; `node scripts/ops/check-env.mjs --prod`
ne signale aucune incohérence (identifiant sans mot de passe, etc.).

---

## Après l'ouverture

- **Chaque mise à jour de l'application** : `node scripts/ops/migrate.mjs`, puis `node scripts/ops/check-env.mjs --prod`
  (une nouvelle offre peut demander un prix : `node scripts/ops/stripe-setup.mjs --live`), redéploiement, puis
  `node scripts/ops/verifier-prod.mjs https://votre-domaine.fr`.
- **Sauvegardes** : `app/scripts/ops/backup.md` (faites un premier test de restauration).
- **Une semaine après l'ouverture** : relisez les rapports de sécurité du contenu (`csp.violation`) dans les journaux
  Vercel.

## En cas de problème

| Message | Cause probable | Solution |
|---|---|---|
| `password authentication failed` | mot de passe de base erroné dans `DATABASE_URL` | Supabase › Database › Settings › réinitialiser, recoller |
| `ENOTFOUND` / `ENETUNREACH` (migrate) | URI de connexion directe (IPv6) | prendre l'URI **Session pooler** |
| `Clé LIVE détectée : ajoutez --live` | sécurité du script Stripe | relancer avec `--live` |
| `STRIPE_SECRET_KEY … clé PUBLIQUE` | clé `pk_` copiée au lieu de `sk_` | recopier la clé secrète |
| `c'est une clé SECRÈTE : collez ici la clé publishable` | clés Supabase inversées | échanger les deux valeurs |
| `Node … est trop ancien` | Node < 22.18 | installer Node 24 LTS |
| `webhook … 503` (verifier-prod) | clés Stripe absentes sur Vercel | étape 9, puis redéployer |
| `[À COMPLÉTER]` visibles (verifier-prod) | identité manquante, ou texte juridique à finaliser | étape 7 ; relecture des CGV par un juriste |
| Le site reste en « démo » | variables non importées en Production, ou pas de redéploiement | étape 9 |

## Sources vérifiées le 13 novembre 2026

- Supabase : [clés d'API](https://supabase.com/docs/guides/api/api-keys), [connexion à la base](https://supabase.com/docs/guides/database/connecting-to-postgres), [SMTP Resend pour Supabase](https://www.resend.com/docs/send-with-supabase-smtp)
- Stripe : [clés d'API](https://docs.stripe.com/keys), [configurations du portail client](https://docs.stripe.com/api/customer_portal/configurations)
- Resend : [créer une clé](https://resend.com/docs/create-an-api-key)
- Vercel : [ajouter des variables d'environnement](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables)
- IA : [Claude](https://platform.claude.com/docs/en/get-api-key), [Gemini](https://ai.google.dev/gemini-api/docs/api-key), [Perplexity](https://docs.perplexity.ai/docs/getting-started/quickstart), [Mistral](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key)
- Données SEO : [clé PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started), [API CrUX](https://developer.chrome.com/docs/crux/api), [accès API DataForSEO](https://app.dataforseo.com/api-access), portées Shopify ([liste officielle](https://shopify.dev/docs/api/usage/access-scopes))
- Google : [éligibilité des fiches](https://support.google.com/business/answer/13763036), [ajouter une fiche](https://support.google.com/places/answer/142902), [vérification](https://support.google.com/business/answer/7107242), [prérequis API Business Profile](https://developers.google.com/my-business/content/prereqs), [clé Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
