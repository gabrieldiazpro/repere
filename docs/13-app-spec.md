# 13 - Spec produit « L'app » (PWA abonnés 29 €/mois)

Agent PRODUIT APP. Périmètre : écrans, parcours, notifications, schéma Supabase + RLS, manifest, service worker, rétention.
Contraintes (00-ARCHITECTURE) : Next.js 15 App Router, Supabase (Postgres + magic link), Stripe, Resend, Vercel Cron, 0-50 EUR de budget, français, ton sans jargon.
Routes : `src/app/app/page.tsx` (accueil, liste si plusieurs commerces) et `src/app/app/[businessId]/...`.

## 0. Synthèse de la recherche (voir section 12 pour les sources)

**iOS (Safari/WebKit)**
- Pas d'invite d'installation automatique, pas d'événement `beforeinstallprompt` : l'installation est manuelle (Partager > Sur l'écran d'accueil). Il faut donc un tutoriel visuel in-app.
- Web push : iOS/iPadOS 16.4 et plus, **uniquement si l'app est installée sur l'écran d'accueil** et ouverte depuis l'icône. Dans un onglet Safari, rien ne marche. La demande de permission doit suivre un **geste utilisateur** (clic), jamais au chargement.
- Stockage de l'app installée séparé de celui de Safari (la session de connexion faite dans Safari n'est pas reprise : prévoir une reconnexion par lien magique ou code à 6 chiffres dans la PWA).
- Pas de Background Sync / Periodic Sync : rafraîchir à l'événement `visibilitychange` / `online`.
- Cache limité (~50 Mo selon MagicBell) et purge possible après ~7 jours sans ouverture : ne jamais compter sur le cache comme source de vérité.
- Badge d'icône (Badging API) disponible depuis 16.4.
- UE : un article indique que PWA et push seraient coupés dans l'UE depuis iOS 17.4. Mon information (non vérifiée par la recherche) est qu'Apple est revenu en arrière avant la sortie de 17.4 et que les PWA restent en mode standalone dans l'UE. L'article semble périmé. **À tester sur un iPhone réel en France avant le lancement** ; le fallback e-mail (section 5) rend le produit viable même si le push échoue.

**Android (Chrome)**
- `beforeinstallprompt` disponible : on capture l'événement et on propose un bouton « Installer l'app » au bon moment (après le premier score, pas à la première seconde). Critères : manifest valide (nom, icônes 192/512, `start_url`, `display`), HTTPS, service worker.
- Web push stable, installée ou non (mais meilleur taux d'opt-in une fois installée). Le WebAPK donne une vraie icône et un écran de démarrage.

**Tableau de bord pour non-techniciens**
- Une question à laquelle l'écran répond en 5 secondes : « Est-ce que je progresse, et que dois-je faire ? ».
- Chiffre clé en haut, détails derrière un tap (résumé d'abord, détail à la demande).
- Libellés clairs, zéro acronyme (GEO jamais affiché ; « visibilité dans les IA »).
- Couleur = sens (vert/orange/rouge) mais jamais seule (icône + mot), contraste élevé ; rouge réservé aux vrais problèmes.
- Ce qui demande une action est impossible à rater (badge, bandeau).

## 1. Principes produit
1. Un seul chiffre (score /100) + une flèche d'évolution + une prochaine action.
2. Mobile first, pouce : navigation en barre d'onglets basse (5 entrées), cibles tactiles >= 44 px.
3. Honnêteté : le score est une estimation basée sur un échantillon de réponses d'IA ; afficher la confiance (`faible/moyenne/bonne`, champ `confidence` du contrat de types) et l'étiquette « démo » quand `demo = true`.
4. Pas de promesse de gain garanti : les « gains estimés » sont des fourchettes de points de score, étiquetées « estimation ».
5. Tout écran fonctionne en lecture hors-ligne sur le dernier état en cache (avec bandeau « données du <date> »).

Navigation (barre basse) : Accueil · IA · Actions · Concurrents · Plus (Requêtes, Historique, Alertes, Compte).
Sélecteur de commerce en en-tête si plusieurs `businesses` (seulement si le compte en a plus d'un).

## 2. Écrans

Notation : **Composants** / **Données** (tables Supabase) / **États vides** / **Actions**.
`audit courant` = dernière ligne `audits` du commerce avec `status = 'done'`.

### 2.1 Accueil - score et évolution (`/app/[businessId]`)
- **Composants**
  - Jauge de score /100 (grand chiffre, couleur : < 30 rouge, 30-59 orange, >= 60 vert, + libellé « Peu visible / En progrès / Bien visible »).
  - Pastille d'évolution : « +6 points depuis le mois dernier » (flèche + texte).
  - Courbe d'évolution sur 6 à 12 mois (points = audits mensuels), tap sur un point ouvre le rapport.
  - Carte « Prochaine meilleure action » (la première action non cochée par gain estimé décroissant) avec bouton « Voir le plan ».
  - Carte « Qui est cité à votre place » : top 3 concurrents (nom, part de voix).
  - Mini-barres par IA (ChatGPT, Perplexity, Gemini, Claude) renvoyant au détail.
  - Bandeau : prochain audit prévu le <date> ; badge « démo » si `demo`.
  - Bandeau d'installation/notifications (voir parcours 3.1).
- **Données** : `businesses`, `audits` (score, sub_scores, mention_rate, share_of_voice, confidence, created_at), `actions_progress` (prochaine action), `subscriptions` (statut pour bandeau d'impayé).
- **États vides**
  - Aucun audit encore terminé (juste après paiement) : écran « Votre premier audit est en cours (environ 2 min) », skeleton + progression, rafraîchi par Realtime ou polling 5 s.
  - Un seul audit : pas de courbe, message « La courbe apparaîtra après votre prochain audit le <date> ».
  - Score 0 : message encourageant « Les IA ne vous citent pas encore. Voici par où commencer » + plan d'action.
  - Audit en erreur : « L'audit n'a pas pu aboutir, on réessaie automatiquement » + bouton « Relancer ».
- **Actions** : relancer un audit (limité à 1 manuel/semaine, coût API), ouvrir le détail IA, ouvrir le plan, changer de commerce, partager le score (image/PDF).

### 2.2 Détail par IA (`/app/[businessId]/ia/[provider]`)
- **Composants** : onglets ChatGPT / Perplexity / Gemini / Claude (seulement les providers actifs, null masqué) ; sous-score /100 + évolution ; « Cité dans X questions sur Y » ; liste des questions avec pastille Cité / Pas cité / Cité en position n ; extrait de réponse (`snippet`) dépliable ; sources citées par l'IA (domaines) ; explication en une phrase de ce que l'IA a répondu.
- **Données** : `audit_runs` (provider, query_text, intent, mentioned, rank, competitors, snippet, citations, demo) filtrés par `audit_id`, `audits.sub_scores`.
- **États vides** : provider non utilisé (clé API absente) : « Cette IA n'est pas encore suivie » ; aucune mention : « Aucune des N questions ne vous cite sur <IA> » + lien vers le plan.
- **Actions** : filtrer par intention (meilleur, proche de moi, urgent, spécifique, avis), copier une question pour la tester soi-même dans l'IA (lien profond), signaler une détection erronée (`audit_runs.feedback`, améliore la détection).

### 2.3 Concurrents (`/app/[businessId]/concurrents`)
- **Composants** : classement des concurrents cités (nom, nombre de mentions, part de voix, barre) avec « Vous » inséré à son rang ; évolution vs mois précédent (nouveau / monte / descend) ; fiche concurrent (dans quelles questions et sur quelles IA il est cité).
- **Données** : agrégat `audit_runs.competitors` (jsonb) par `audit_id` ; comparaison avec l'audit précédent ; `alerts` de type `new_competitor`.
- **États vides** : « Aucun concurrent n'est cité : vous avez une longueur d'avance, ou les IA répondent de façon générique » ; moins de 2 audits : pas de tendance.
- **Actions** : masquer un faux concurrent (`businesses.ignored_competitors`), ouvrir le site du concurrent, créer une alerte « me prévenir si X dépasse mon score ».

### 2.4 Requêtes (`/app/[businessId]/requetes`)
- **Composants** : liste des questions testées (ex. « meilleur plombier Paris 11e »), pour chacune un résumé « Cité par 2 IA sur 4 », intention, tendance ; bouton « Ajouter ma question » (limite 5 requêtes personnalisées incluses) ; explication courte « Ce sont les questions que vos clients posent aux IA ».
- **Données** : `audits.queries` (jsonb QuerySpec[]), `businesses.custom_queries`, `audit_runs` agrégé par `query_id`.
- **États vides** : aucune requête perso : suggestions pré-remplies (3 chips) ; audit non terminé : skeleton.
- **Actions** : ajouter, supprimer, épingler une requête ; elle est prise en compte au prochain audit (affiché clairement).

### 2.5 Plan d'action - checklist cochable (`/app/[businessId]/actions`)
- **Composants** : en-tête « X actions faites sur Y, gain déjà obtenu : +N points (estimé) » ; barre de progression ; liste triée par gain estimé décroissant, groupée « À faire maintenant / Plus tard / Fait » ; chaque ligne : case à cocher 44 px, titre en verbe d'action (« Ajoutez votre fiche Google Business Profile »), difficulté (Facile/Moyen), durée (« 10 min »), **gain estimé (« +3 à +6 points », étiquette estimation)**, détail dépliable (pas-à-pas, lien externe, modèle de texte à copier) ; bouton « Le faire plus tard » (snooze) ; note libre.
- **Données** : `actions_progress` (action_key, title, status, est_gain_min, est_gain_max, effort_minutes, done_at, snoozed_until, note) liée à `audits.id` ; catalogue d'actions généré par `src/lib/engine/actions.ts` à chaque audit puis fusionné (l'état coché est conservé par `action_key` d'un audit à l'autre).
- **États vides** : pas d'actions (audit en cours) : « Votre plan arrive avec le premier audit » ; tout est coché : « Bravo, plan terminé. Prochain audit le <date> pour mesurer l'effet » ; actions de l'offre « Plan d'action 149 EUR » non achetées : les 3 premières visibles, le reste flouté avec CTA d'achat (voir pricing).
- **Actions** : cocher/décocher (mise à jour optimiste, file d'attente hors-ligne), snooze, ajouter une note, partager à un prestataire (lien/e-mail), envoyer feedback « utile / pas applicable ».
- Rappel honnête : après avoir coché, le gain réel n'est visible qu'à l'audit suivant (affichage « effet mesuré le <date> » puis « réel : +x » en comparant avant/après).

### 2.6 Historique des rapports (`/app/[businessId]/historique`)
- **Composants** : liste chronologique (mois, score, variation, confiance) ; tap = rapport détaillé ; bouton « Télécharger le PDF » (`/api/report/[id]/pdf`) ; comparaison de deux audits (sélection de 2 lignes).
- **Données** : `audits` (tous `done`), lien PDF généré à la volée.
- **États vides** : « Votre premier rapport apparaîtra ici » ; un seul rapport : pas de comparaison.
- **Actions** : télécharger PDF, recevoir par e-mail (Resend), partager, supprimer (RGPD, sur demande dans Compte).

### 2.7 Réglages des alertes (`/app/[businessId]/alertes`)
- **Composants** : interrupteurs par type (voir section 5) pour Push et E-mail séparément ; seuil de variation (« me prévenir si le score bouge de ±5 points ») ; fréquence du résumé (mensuel / mensuel + hebdo) ; heures calmes (par défaut 20h-8h, fuseau Europe/Paris) ; bouton « Activer les notifications sur cet appareil » (geste utilisateur) ; liste des appareils inscrits (révocation) ; bouton « Envoyer une notification de test ».
- **Données** : `businesses.alert_prefs` (jsonb), `push_subscriptions` (endpoint, keys, user_agent, created_at), `alerts` (liste récente).
- **États vides** : push non supporté / non installé (iOS dans Safari) : encart « Pour recevoir des notifications sur iPhone, installez d'abord l'app » + tutoriel en 3 vignettes ; permission refusée : explication pour la réactiver dans Réglages iOS/Android + e-mail activé par défaut.
- **Actions** : activer/désactiver, tester, révoquer un appareil, changer l'e-mail de réception.

### 2.8 Compte et abonnement (`/app/compte`)
- **Composants** : e-mail de connexion ; commerces (ajout d'un 2e commerce : mention du tarif supplémentaire à définir par l'agent pricing) ; carte abonnement (statut, prochain prélèvement, 29 EUR/mois) ; bouton « Gérer mon abonnement » (portail client Stripe : factures, carte, résiliation) ; achat du Plan d'action (149 EUR) si absent ; installer l'app ; exporter mes données ; supprimer mon compte ; liens CGV / confidentialité / mentions légales.
- **Données** : `subscriptions` (status, current_period_end, cancel_at_period_end, plan), `businesses`, auth Supabase.
- **États vides/erreurs** : paiement échoué (`past_due`) : bandeau rouge « Mettez à jour votre carte » avec 7 jours de grâce ; abonnement résilié : accès lecture seule jusqu'à `current_period_end`, puis page « Réactiver » conservant l'historique 12 mois ; essai non utilisé.
- **Actions** : portail Stripe, déconnexion, export JSON/CSV, suppression (effacement en cascade + résiliation Stripe), contact support.

## 3. Parcours utilisateur

### 3.1 Premier lancement après paiement
1. L'utilisateur paie via Stripe Checkout (depuis le rapport gratuit `rapport/[id]`, lequel contient déjà `business` et `audit`). Redirection vers `/app/bienvenue?session_id=...`.
2. Webhook `checkout.session.completed` (source de vérité, pas la redirection) : crée/met à jour `subscriptions`, relie le `leads.id` au `businesses`, crée l'utilisateur Supabase par e-mail du paiement (ou le retrouve) et envoie le lien magique (Resend, secours si l'e-mail Stripe est différent).
3. Page de bienvenue : connexion automatique si le lien magique est ouvert ; sinon « On vous a envoyé un lien, ouvrez-le sur ce téléphone ». Sur iOS, prévenir que l'ouverture dans la PWA installée demandera un nouveau lien/code (stockage séparé) : proposer un **code à 6 chiffres** saisissable dans la PWA.
4. Réutilisation du **rapport gratuit comme premier audit** (aucun nouvel appel IA pour éviter coût et attente) : le score s'affiche immédiatement. Le premier re-audit mensuel est planifié à J+30 (et possibilité d'un re-audit manuel après avoir coché des actions).
5. Étape 1/3 « Voici votre score » (écran Accueil avec animation unique).
6. Étape 2/3 « Installez l'app » : Android = bouton natif via `beforeinstallprompt` ; iOS = tutoriel 3 vignettes (Partager > Sur l'écran d'accueil > Ajouter), détecté par UA + `display-mode: standalone` ; option « Plus tard ».
7. Étape 3/3 « Activer les alertes » : uniquement une fois l'app ouverte en mode standalone (iOS) ; bouton explicite -> `Notification.requestPermission()` dans le handler du clic -> enregistrement push -> notification de test.
8. Fin : redirection vers l'Accueil avec la carte « Votre première action » (la plus facile à fort gain).
- Mesure : `activation = score vu + 1 action cochée ou 1 alerte activée sous 7 jours`.

### 3.2 Notification de changement de score
1. Cron mensuel (`/api/cron/monthly`, Vercel Cron) ré-audite chaque commerce actif ; les `audit_runs` sont écrits, `audits.status = done`, score calculé.
2. Comparaison au dernier audit : si |delta| >= seuil utilisateur (défaut 5) ou franchissement de palier (30/60), création d'une ligne `alerts` (type `score_up` / `score_down`).
3. Envoi : web push (si abonné et hors heures calmes) + e-mail Resend (récap), selon `alert_prefs`.
4. Texte push (court, concret) : « Votre visibilité IA est passée de 34 à 41 (+7). Voir ce qui a changé. » / en baisse : « Votre score baisse de 8 points. On vous explique pourquoi. »
5. Tap -> `/app/[businessId]?alerte=<id>` : l'accueil ouvre la carte « Ce qui a changé » (IA concernée, concurrents entrés/sortis, actions cochées avant/après) et marque `alerts.read_at`.
6. Si non lu sous 48 h : relance e-mail unique.
- Garde-fous : pas plus de 1 push par jour et 4 par mois ; regrouper les événements d'un même audit en une seule notification.

### 3.3 Cocher une action
1. L'utilisateur ouvre « Plan d'action », coche « Ajoutez votre fiche Google Business Profile ».
2. UI optimiste : case cochée, progression et « gain déjà obtenu » mis à jour immédiatement, retour haptique léger.
3. `PATCH /api/actions/[id]` (ou appel Supabase client direct avec RLS) met `status = 'done'`, `done_at = now()`. Hors-ligne : file locale rejouée à la reconnexion (événements `online` et `visibilitychange`, car Background Sync est indisponible sur iOS).
4. Micro-récompense : message « +3 à +6 points attendus au prochain audit » (étiquette estimation).
5. Proposition suivante : « Prochaine action : <titre> (10 min) ».
6. Au prochain audit, comparaison avant/après : « Vous avez fait 3 actions, le score a gagné +7 points » (corrélation, pas causalité : libellé prudent).
7. Si 14 jours sans action cochée : e-mail/push « 1 action de 10 minutes pour gagner jusqu'à +5 points ».

## 4. Cartographie composants/données (récap)
| Écran | Tables lues | Tables écrites |
|---|---|---|
| Accueil | businesses, audits, actions_progress, subscriptions, alerts | alerts.read_at |
| Détail IA | audits, audit_runs | audit_runs.feedback |
| Concurrents | audits, audit_runs, alerts | businesses.ignored_competitors |
| Requêtes | audits, audit_runs, businesses | businesses.custom_queries |
| Plan d'action | actions_progress | actions_progress |
| Historique | audits | (suppression) |
| Alertes | businesses, push_subscriptions, alerts | businesses.alert_prefs, push_subscriptions |
| Compte | subscriptions, businesses | via Stripe portal / API |

## 5. Notifications

Canaux : web push (Web Push API + VAPID, bibliothèque `web-push`, gratuit) et e-mail (Resend, gratuit jusqu'à 3 000 e-mails/mois, 100/jour au moment de la recherche à revérifier). Envoi côté serveur uniquement (cron + webhooks).

| Déclencheur | Push | E-mail | Défaut | Détail |
|---|---|---|---|---|
| Audit mensuel terminé | oui | oui (rapport + PDF) | on | Toujours envoyé, résumé court |
| Score en hausse >= seuil | oui | oui | on | « +7 points » |
| Score en baisse >= seuil | oui | oui | on | Ton rassurant, pointe l'action utile |
| Franchissement de palier (30, 60, 80) | oui | non | on | Moment de réussite |
| Nouveau concurrent cité en top 3 | oui | non | on | |
| Un concurrent vous dépasse | oui | oui | off | Sur demande |
| Relance actions (14 j sans coche) | oui | oui | on | Max 1/14 jours |
| Action snoozée arrivée à échéance | oui | non | on | |
| Paiement échoué / carte expirante | non | oui (obligatoire) | on | Transactionnel, non désactivable |
| Abonnement résilié / réactivation | non | oui | on | Transactionnel |
| Bienvenue + lien magique | non | oui | on | Transactionnel |
| Résumé hebdo (optionnel) | non | oui | off | |

Règles : heures calmes 20h-8h (Europe/Paris) ; plafond 1 push/jour ; désabonnement e-mail en un clic (obligation d'en-tête `List-Unsubscribe`) ; consentement push explicite (RGPD/ePrivacy) ; les e-mails transactionnels ne sont pas du marketing. Les endpoints push en erreur 404/410 sont supprimés de `push_subscriptions`. Sur iOS le push exige l'installation ; sans elle, e-mail seul.

## 6. Schéma SQL Supabase proposé (`supabase/schema.sql`)

```sql
-- =========================================================
-- AuditIA Local - schéma Supabase (Postgres 15+)
-- Auth : Supabase Auth (magic link). Écritures sensibles via service_role.
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- types ----------
create type audit_status as enum ('pending','running','done','failed');
create type audit_trigger as enum ('free','monthly','manual');
create type action_status as enum ('todo','done','snoozed','dismissed');
create type alert_type as enum (
  'audit_done','score_up','score_down','milestone',
  'new_competitor','competitor_overtook','actions_reminder',
  'payment_failed','subscription_canceled'
);
create type lead_source as enum ('landing','audit_form','seo_page','demo','other');

-- ---------- fonctions utilitaires ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- businesses ----------
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  trade text not null,                       -- métier (plombier, restaurant italien...)
  city text not null,
  district text,
  website text,
  contact_email text,
  custom_queries jsonb not null default '[]'::jsonb,       -- max 5, validé côté API
  ignored_competitors text[] not null default '{}',
  alert_prefs jsonb not null default jsonb_build_object(
    'push', jsonb_build_object('score_change', true, 'milestone', true, 'new_competitor', true, 'actions_reminder', true),
    'email', jsonb_build_object('audit_done', true, 'score_change', true, 'actions_reminder', true, 'weekly_digest', false),
    'threshold', 5,
    'quiet_hours', jsonb_build_object('start', '20:00', 'end', '08:00', 'tz', 'Europe/Paris')
  ),
  source_lead_id uuid,                        -- lead d'origine (FK ajoutée après création de leads)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on businesses(owner_id);
create trigger businesses_updated before update on businesses
  for each row execute function set_updated_at();

-- ---------- audits (un snapshot = un score à une date) ----------
create table audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  trigger audit_trigger not null default 'monthly',
  status audit_status not null default 'pending',
  score smallint check (score between 0 and 100),
  sub_scores jsonb not null default '{}'::jsonb,   -- {"chatgpt":42,"perplexity":null,...}
  mention_rate numeric(5,4),
  avg_rank numeric(4,2),
  share_of_voice numeric(5,4),
  competitors jsonb not null default '[]'::jsonb,  -- CompetitorStat[]
  queries jsonb not null default '[]'::jsonb,      -- QuerySpec[]
  confidence text check (confidence in ('faible','moyenne','bonne')),
  demo boolean not null default false,
  error text,
  cost_eur numeric(8,4) default 0,                 -- suivi du coût API
  period date not null default (date_trunc('month', now())::date),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index audits_business_created_idx on audits(business_id, created_at desc);
-- un seul audit mensuel automatique par commerce et par mois
create unique index audits_monthly_unique
  on audits(business_id, period) where trigger = 'monthly';

-- ---------- audit_runs (une réponse d'IA à une question, un passage) ----------
create table audit_runs (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade, -- dénormalisé pour RLS rapide
  provider text not null check (provider in ('chatgpt','perplexity','gemini','claude')),
  query_id text not null,
  query_text text not null,
  intent text check (intent in ('best','nearby','urgent','specific','review')),
  run smallint not null default 1,
  mentioned boolean not null default false,
  rank smallint,
  competitors text[] not null default '{}',
  snippet text,
  citations text[] not null default '{}',
  answer_text text,                         -- réponse brute (peut être purgée après 90 jours)
  demo boolean not null default false,
  error text,
  feedback text check (feedback in ('ok','wrong')),
  created_at timestamptz not null default now()
);
create index audit_runs_audit_idx on audit_runs(audit_id);
create index audit_runs_business_idx on audit_runs(business_id);

-- ---------- actions_progress (plan d'action, état coché) ----------
create table actions_progress (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,   -- audit qui a généré/mis à jour l'action
  action_key text not null,                  -- identifiant stable (ex. 'gbp_profile', 'schema_localbusiness')
  title text not null,
  description text,
  steps jsonb not null default '[]'::jsonb,
  difficulty text check (difficulty in ('facile','moyen','avance')),
  effort_minutes int,
  est_gain_min smallint not null default 0,  -- points estimés (estimation, pas une garantie)
  est_gain_max smallint not null default 0,
  status action_status not null default 'todo',
  snoozed_until date,
  done_at timestamptz,
  note text,
  measured_gain smallint,                    -- delta de score mesuré à l'audit suivant (indicatif)
  feedback text check (feedback in ('useful','not_applicable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, action_key)
);
create index actions_business_status_idx on actions_progress(business_id, status);
create trigger actions_updated before update on actions_progress
  for each row execute function set_updated_at();

-- ---------- subscriptions (miroir Stripe, écrit par le webhook) ----------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan text not null default 'suivi_mensuel' check (plan in ('suivi_mensuel')),
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete','unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  action_plan_purchased boolean not null default false,  -- achat unique 149 EUR
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on subscriptions(user_id);
create index subscriptions_customer_idx on subscriptions(stripe_customer_id);
create trigger subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ---------- leads (audit gratuit, avant paiement) ----------
create table leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  trade text,
  city text,
  district text,
  website text,
  score smallint,
  free_audit_id uuid,                        -- référence logique vers l'audit gratuit
  source lead_source not null default 'audit_form',
  utm jsonb not null default '{}'::jsonb,
  marketing_consent boolean not null default false,   -- case non pré-cochée (RGPD)
  consent_at timestamptz,
  converted_business_id uuid references businesses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leads_email_idx on leads(lower(email));
alter table businesses
  add constraint businesses_source_lead_fk foreign key (source_lead_id) references leads(id) on delete set null;

-- ---------- alerts (journal des alertes, source du centre de notifications) ----------
create table alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,
  type alert_type not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,   -- ex. {"from":34,"to":41}
  push_sent_at timestamptz,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index alerts_business_created_idx on alerts(business_id, created_at desc);
create index alerts_unread_idx on alerts(business_id) where read_at is null;

-- ---------- push_subscriptions (appareils inscrits au web push) ----------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_user_idx on push_subscriptions(user_id);

-- =========================================================
-- RLS
-- =========================================================
alter table businesses         enable row level security;
alter table audits             enable row level security;
alter table audit_runs         enable row level security;
alter table actions_progress   enable row level security;
alter table subscriptions      enable row level security;
alter table leads              enable row level security;
alter table alerts             enable row level security;
alter table push_subscriptions enable row level security;

-- helper : le commerce appartient-il à l'utilisateur connecté ?
create or replace function owns_business(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

-- businesses : le propriétaire lit et modifie ; création/suppression via API serveur (service_role)
create policy businesses_select on businesses for select using (owner_id = auth.uid());
create policy businesses_update on businesses for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- audits : lecture seule pour le propriétaire (écriture par le moteur = service_role)
create policy audits_select on audits for select using (owns_business(business_id));

-- audit_runs : lecture ; le propriétaire peut seulement poser un feedback
create policy audit_runs_select on audit_runs for select using (owns_business(business_id));
create policy audit_runs_feedback on audit_runs for update
  using (owns_business(business_id)) with check (owns_business(business_id));
-- (restreindre les colonnes modifiables : voir REVOKE/GRANT ci-dessous)

-- actions_progress : le propriétaire lit et met à jour (cocher, note, snooze)
create policy actions_select on actions_progress for select using (owns_business(business_id));
create policy actions_update on actions_progress for update
  using (owns_business(business_id)) with check (owns_business(business_id));

-- subscriptions : lecture seule de la sienne (écriture = webhook service_role)
create policy subscriptions_select on subscriptions for select using (user_id = auth.uid());

-- leads : aucune policy = inaccessible au client ; insertion/lecture par l'API serveur (service_role)

-- alerts : lecture + marquer comme lu
create policy alerts_select on alerts for select using (owns_business(business_id));
create policy alerts_update on alerts for update
  using (owns_business(business_id)) with check (owns_business(business_id));

-- push_subscriptions : chacun gère ses appareils
create policy push_select on push_subscriptions for select using (user_id = auth.uid());
create policy push_insert on push_subscriptions for insert with check (user_id = auth.uid());
create policy push_delete on push_subscriptions for delete using (user_id = auth.uid());

-- Restreindre les colonnes éditables côté client (défense en profondeur)
revoke update on businesses from authenticated;
grant  update (name, trade, city, district, website, contact_email, custom_queries,
               ignored_competitors, alert_prefs) on businesses to authenticated;
revoke update on audit_runs from authenticated;
grant  update (feedback) on audit_runs to authenticated;
revoke update on actions_progress from authenticated;
grant  update (status, snoozed_until, done_at, note, feedback) on actions_progress to authenticated;
revoke update on alerts from authenticated;
grant  update (read_at) on alerts to authenticated;

-- Vue pratique : dernière évolution du score
create or replace view business_score_history with (security_invoker = true) as
select a.business_id, a.id as audit_id, a.created_at, a.score,
       a.score - lag(a.score) over (partition by a.business_id order by a.created_at) as delta
from audits a where a.status = 'done';
```

Notes d'implémentation :
- Le cron, le webhook Stripe et le moteur utilisent la clé `service_role` (jamais exposée au client) ; elle contourne la RLS.
- `leads` est volontairement sans policy : `/api/leads` écrit via `service_role` après validation (anti-spam : limite de débit par IP, honeypot).
- `answer_text` des `audit_runs` : purge à 90 jours (job SQL) pour limiter le stockage du tier gratuit (500 Mo) et les données.
- Index/volumétrie : 1 audit = environ 4 IA x 10 questions x 3 passages = 120 lignes `audit_runs`. À 500 abonnés, environ 60 000 lignes/mois : surveiller la taille, agréger puis purger.
- Realtime : activer sur `audits` (statut) pour l'écran « audit en cours ».

## 7. Manifest (`public/manifest.webmanifest`)

```json
{
  "id": "/app",
  "name": "AuditIA Local - Visibilité IA",
  "short_name": "AuditIA",
  "description": "Suivez si les assistants IA recommandent votre commerce.",
  "lang": "fr-FR",
  "dir": "ltr",
  "start_url": "/app?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#0f766e",
  "categories": ["business", "productivity"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Mon plan d'action", "url": "/app/actions?source=shortcut", "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Mon score", "url": "/app?source=shortcut" }
  ]
}
```
- Dans le `<head>` : `<link rel="manifest">`, `<meta name="theme-color">`, et pour iOS `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">` (180x180, sans transparence), `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-title" content="AuditIA">`, `viewport-fit=cover` et gestion des `safe-area-inset-*`.
- `scope: "/"` plutôt que `/app` pour que les liens de connexion et d'achat restent dans l'app ; `start_url` avec `?source=pwa` pour mesurer les lancements installés.
- Les `shortcuts` sont ignorés sur iOS (fonctionnent sur Android).

## 8. Service worker (`public/sw.js`) - stratégie de cache

Principes : simple (cf. 00-ARCHITECTURE), versionné, sans jamais mettre en cache de donnée privée sensible dans le cache partagé.

| Ressource | Stratégie | Détail |
|---|---|---|
| App shell (`/offline`, icônes, polices, CSS/JS statiques `/_next/static/*`) | Cache-first (précache à l'`install`) | Fichiers immuables hachés par Next |
| Navigations HTML (`/app/*`) | Network-first, timeout 3 s, repli sur cache puis `/offline` | Page fraîche si possible |
| Lectures Supabase (`GET` REST de scores, actions) | Stale-while-revalidate **côté client** (React Query/SWR + IndexedDB) plutôt que SW | Évite de stocker des JWT dans le cache SW |
| `/api/*` (POST/PATCH/auth/webhooks/stripe) | Network-only, jamais en cache | |
| Pages publiques (landing, tarifs, SEO) | Network-first | Pas de précache |
| Images | Stale-while-revalidate, plafond 50 entrées | Respecte le quota iOS |

```js
// public/sw.js - squelette
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const SHELL_URLS = ['/offline', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)));
  // pas de skipWaiting automatique : on laisse l'app proposer « Mettre à jour »
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL, PAGES];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // Supabase/Stripe : réseau direct
  if (url.pathname.startsWith('/api/')) return;                              // jamais en cache

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      const copy = r.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return r;
    })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
        const net = await fetch(req, { signal: ctrl.signal }); clearTimeout(t);
        if (url.pathname.startsWith('/app')) { const c = await caches.open(PAGES); c.put(req, net.clone()); }
        return net;
      } catch {
        return (await caches.match(req)) || (await caches.match('/offline'));
      }
    })());
  }
});

// Web push : payload JSON {title, body, url, tag}
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'AuditIA', {
    body: d.body, tag: d.tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png',
    data: { url: d.url || '/app' },
  }));
});
// iOS exige que chaque push affiche une notification visible (pas de push silencieux).

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = e.notification.data.url;
    for (const c of all) if ('focus' in c) { await c.focus(); return c.navigate(target); }
    return clients.openWindow(target);
  })());
});
```
Points d'attention :
- Cache des pages `/app/*` : les pages sont rendues côté serveur avec des données privées. Les purger à la déconnexion (`caches.delete(PAGES)`) pour éviter la fuite sur appareil partagé.
- Ne pas supposer la persistance du cache sur iOS (purge après environ 7 jours d'inactivité) : l'offline est un confort, pas une garantie.
- Mise à jour : détecter `registration.waiting` et afficher un toast « Nouvelle version disponible - Mettre à jour ».
- Clés VAPID dans `.env.example` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- Mode démo : l'app doit fonctionner sans clés (push désactivé proprement, e-mails journalisés).

## 9. Métriques de rétention

Objectif : rétention mensuelle des abonnés (churn) < 6 %/mois pour un produit à 29 EUR ; la valeur perçue doit être visible chaque mois.

**Funnel d'activation**
- Visite rapport gratuit -> paiement (conversion).
- Paiement -> première ouverture de l'app sous 24 h.
- Installation PWA sous 7 j (`display-mode: standalone` ou événement `appinstalled`).
- Opt-in notifications sous 7 j (par plateforme iOS/Android).
- Activation = >= 1 action cochée ou >= 1 alerte activée sous 7 j.

**Engagement**
- Utilisateurs actifs par mois (ouverture app), WAU/MAU.
- Sessions par abonné par mois (cible >= 3).
- Taux d'ouverture des notifications push et e-mails.
- % d'abonnés avec >= 1 action cochée dans le mois ; actions cochées moyennes.
- Délai entre l'envoi du rapport mensuel et sa première ouverture.

**Valeur perçue**
- % d'abonnés dont le score a progressé sur 3 mois ; delta moyen.
- Corrélation actions cochées / delta de score (indicatif).
- Feedback « utile / pas applicable » par action.

**Rétention / revenus**
- Cohortes mensuelles (M1, M3, M6) de rétention d'abonnement.
- Churn volontaire vs involontaire (paiement échoué, `past_due`).
- Raison de résiliation (question obligatoire en 1 tap dans le portail/offboarding).
- Taux de réactivation après résiliation, LTV, délai de rentabilité vs coût d'API par abonné (`audits.cost_eur`).

**Signaux d'alerte interne (churn risk)** : aucune ouverture depuis 30 j ; push révoqué ; score en baisse 2 mois de suite sans action ; paiement échoué. Déclenchent un e-mail de reprise personnalisé.

**Mise en oeuvre** : événements anonymisés dans une table `events` (optionnelle, v2) ou Plausible/PostHog tier gratuit ; respect du consentement (pas de traceur tiers sans consentement, mesure d'audience exemptée de la CNIL avec un outil configuré en conséquence).

## 10. Questions ouvertes pour les autres agents
- **Pricing** : tarif d'un 2e commerce ; période d'essai ; accès au Plan d'action à 149 EUR (inclus ou non pour les abonnés) ; remise annuelle.
- **Engine** : format stable de `actions.ts` (`action_key`, `est_gain_min/max`, `steps`) ; confirmer que le rapport gratuit est réutilisable comme premier audit ; coût par audit pour planifier le quota de re-audits manuels.
- **Légal** : mentions de consentement push/e-mail, durées de conservation (réponses brutes 90 j), suppression de compte ; CGV pour l'abonnement et la résiliation.
- **Front** : bibliothèque de graphiques légère (jauge/courbe SVG maison pour limiter le poids).

## 11. Plan de livraison suggéré
1. MVP : Accueil, Plan d'action, Historique, Compte, manifest + SW minimal, e-mails mensuels (Resend).
2. V1.1 : Détail IA, Concurrents, Requêtes, web push, réglages d'alertes.
3. V1.2 : Relances de rétention, comparaison avant/après, partage.

## 12. Sources
- [MagicBell - PWA iOS limitations and Safari support (guide complet)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) : installation manuelle iOS, push 16.4+, quotas de stockage, absence de Background Sync, badges, point UE (potentiellement périmé).
- [Pushpad - iOS special requirements for web push notifications](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) : push seulement depuis l'app installée, permission sur geste utilisateur, détection `display-mode: standalone`, stockage séparé.
- [Forrester - Web push comes to iOS but web apps are still second class](https://www.forrester.com/blogs/web-push-comes-to-ios-but-web-apps-are-still-second-class/) : résultat de recherche, non lu en détail.
- [MobiLoud - Progressive Web Apps on iOS](https://www.mobiloud.com/blog/progressive-web-apps-ios) et [Monterail - PWA for Apple iOS](https://monterail.com/blog/pwa-for-apple-ios) : résultats de recherche, non lus en détail.
- [web.dev - Installation prompt (`beforeinstallprompt`)](https://web.dev/learn/pwa/installation-prompt) : page non récupérée (robots) ; contenu Android/Chrome cité de mémoire, à revérifier.
- [Firt.dev - PWA secrets (Maximiliano Firtman)](https://firt.dev/pwa-secrets/) : référence sur le comportement des PWA par plateforme, non lue en détail.
- [DesignMonks - Dashboard design dos and don'ts](https://www.designmonks.co/blog/dashboard-design-dos-and-donts) : hiérarchie, test des 5 secondes, couleurs porteuses de sens, résumé puis détail.
- [insightsoftware - Dos and don'ts of dashboard design](https://insightsoftware.com/blog/the-dos-and-donts-of-dashboard-design) et [Querio - UI/UX pour simplifier l'analytique aux non-techniciens](https://querio.ai/articles/ui-ux-simplify-analytics-non-technical-users) : résultats de recherche, non lus en détail.

Limites de la recherche : seules 3 pages ont été lues en entier (MagicBell, Pushpad, DesignMonks) ; l'affirmation sur l'UE et les limites de Resend/Supabase sont à revérifier avant le lancement.
