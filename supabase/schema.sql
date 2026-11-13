-- =========================================================
-- Repéré — référencement IA — schéma Supabase (Postgres 15+), V2
-- V2 : parcours (businesses.segment), niveaux essentiel/accompagne/reseau, offres V2, alertes V2,
--      table générique `documents` (src/lib/store.ts) pour les modules V2 (facts.*, digest.*, copilot.*, exec.*, track.*).
-- D'après docs/13-app-spec.md §6, adapté au contrat src/lib/db.ts :
--   * audits.id est un text (id produit par le moteur) + colonne `result` (AuditResult complet) ;
--   * un audit gratuit n'a pas de commerce (business_id nullable) ;
--   * un commerce peut exister avant la création du compte (owner_id nullable, rattaché à la 1re connexion) ;
--   * tables suppression (liste d'opposition), stripe_events (idempotence), rate_events (anti-abus).
-- Auth : Supabase Auth (magic link). Écritures serveur via la clé service_role (contourne la RLS).
-- À exécuter une fois dans Supabase > SQL Editor. Ré-exécutable (if not exists / or replace).
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- types ----------
do $$ begin
  create type audit_status as enum ('pending','running','done','failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type audit_trigger as enum ('free','monthly','manual');
exception when duplicate_object then null; end $$;
do $$ begin
  create type action_status as enum ('todo','done','snoozed','dismissed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type alert_type as enum (
    'audit_done','score_up','score_down','milestone',
    'new_competitor','competitor_overtook','actions_reminder',
    'payment_failed','subscription_canceled',
    'fact_error','visibility_change','weekly_digest'
  );
exception when duplicate_object then null; end $$;
-- V2 : nouveaux types d'alerte (bases déjà créées)
alter type alert_type add value if not exists 'fact_error';
alter type alert_type add value if not exists 'visibility_change';
alter type alert_type add value if not exists 'weekly_digest';
do $$ begin
  create type lead_source as enum ('site','prospection','landing','audit_form','seo_page','demo','other','waitlist');
exception when duplicate_object then null; end $$;
-- Liste d'attente Pro / Agence (qa/ARBITRAGES.md n° 3) : bases déjà créées.
alter type lead_source add value if not exists 'waitlist';
-- V3 : outils gratuits (/outils) et formulaire de contact (supabase/migrations/0005_lead_sources.sql).
alter type lead_source add value if not exists 'tool';
alter type lead_source add value if not exists 'contact';

-- ---------- fonctions utilitaires ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- leads (audit gratuit, avant paiement) ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text,
  trade text,
  city text,
  district text,
  website text,
  score smallint,
  free_audit_id text,                                  -- référence logique vers audits.id
  source lead_source not null default 'site',
  utm jsonb not null default '{}'::jsonb,
  marketing_consent boolean not null default false,    -- case non pré-cochée (RGPD)
  consent_at timestamptz,
  converted_business_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists leads_email_idx on leads(lower(email));
create index if not exists leads_created_idx on leads(created_at desc);

-- ---------- businesses ----------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,   -- null tant que le client ne s'est pas connecté
  name text not null check (char_length(name) between 1 and 120),
  trade text not null,
  city text not null,
  district text,
  website text,
  contact_email text,
  plan text not null default 'free',
  segment text not null default 'local',
  last_score smallint check (last_score between 0 and 100),
  stripe_customer_id text,
  custom_queries jsonb not null default '[]'::jsonb,
  ignored_competitors text[] not null default '{}',
  alert_prefs jsonb not null default jsonb_build_object(
    'push', jsonb_build_object('score_change', true, 'milestone', true, 'new_competitor', true, 'actions_reminder', true),
    'email', jsonb_build_object('audit_done', true, 'score_change', true, 'actions_reminder', true, 'weekly_digest', false),
    'threshold', 5,
    'quiet_hours', jsonb_build_object('start', '20:00', 'end', '08:00', 'tz', 'Europe/Paris')
  ),
  source_lead_id uuid references leads(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- V2 (bases déjà créées) : parcours + niveaux d'accès V2
alter table businesses add column if not exists segment text not null default 'local';
alter table businesses drop constraint if exists businesses_plan_check;
alter table businesses add constraint businesses_plan_check
  check (plan in ('free','suivi','pro','agency','essentiel','accompagne','reseau'));
alter table businesses drop constraint if exists businesses_segment_check;
alter table businesses add constraint businesses_segment_check check (segment in ('local','pme','ecommerce'));
create index if not exists businesses_owner_idx on businesses(owner_id);
create index if not exists businesses_plan_active_idx on businesses(plan, is_active) where plan <> 'free';
create index if not exists businesses_contact_email_idx on businesses(lower(contact_email));
drop trigger if exists businesses_updated on businesses;
create trigger businesses_updated before update on businesses
  for each row execute function set_updated_at();

do $$ begin
  alter table leads add constraint leads_converted_business_fk
    foreign key (converted_business_id) references businesses(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------- audits (un snapshot = un score à une date) ----------
create table if not exists audits (
  id text primary key,                                   -- AuditResult.id
  business_id uuid references businesses(id) on delete cascade,  -- null = audit gratuit non rattaché
  trigger audit_trigger not null default 'free',
  status audit_status not null default 'done',
  score smallint check (score between 0 and 100),
  sub_scores jsonb not null default '{}'::jsonb,
  mention_rate numeric(5,4),
  avg_rank numeric(5,2),
  share_of_voice numeric(5,4),
  competitors jsonb not null default '[]'::jsonb,
  queries jsonb not null default '[]'::jsonb,
  confidence text check (confidence in ('faible','moyenne','bonne')),
  demo boolean not null default false,
  result jsonb not null,                                 -- AuditResult complet (source pour l'app et le PDF)
  error text,
  cost_eur numeric(8,4) default 0,
  period date not null default (date_trunc('month', now())::date),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists audits_business_created_idx on audits(business_id, created_at desc);
create index if not exists audits_created_idx on audits(created_at desc);
-- un seul audit mensuel automatique par commerce et par mois
create unique index if not exists audits_monthly_unique
  on audits(business_id, period) where trigger = 'monthly';

-- ---------- audit_runs (détail par réponse d'IA ; optionnel, le détail est aussi dans audits.result) ----------
create table if not exists audit_runs (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null references audits(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
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
  answer_text text,
  demo boolean not null default false,
  error text,
  feedback text check (feedback in ('ok','wrong')),
  created_at timestamptz not null default now()
);
create index if not exists audit_runs_audit_idx on audit_runs(audit_id);
create index if not exists audit_runs_business_idx on audit_runs(business_id);

-- ---------- actions_progress (plan d'action, état coché) ----------
create table if not exists actions_progress (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  audit_id text references audits(id) on delete set null,
  action_key text not null,                 -- ActionItem.id
  title text not null default '',
  description text,
  steps jsonb not null default '[]'::jsonb,
  difficulty text check (difficulty in ('facile','moyen','avance')),
  effort_minutes int,
  est_gain_min smallint not null default 0,
  est_gain_max smallint not null default 0,
  status action_status not null default 'todo',
  snoozed_until date,
  done_at timestamptz,
  note text,
  measured_gain smallint,
  feedback text check (feedback in ('useful','not_applicable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, action_key)
);
create index if not exists actions_business_status_idx on actions_progress(business_id, status);
drop trigger if exists actions_updated on actions_progress;
create trigger actions_updated before update on actions_progress
  for each row execute function set_updated_at();

-- ---------- subscriptions (miroir Stripe, écrit par le webhook) ----------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete set null,
  email text,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,                 -- null pour un achat unique (plan d'action)
  plan text not null,
  status text not null check (status in ('trialing','active','past_due','canceled','incomplete','unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  action_plan_purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Offres V1 conservées + grille V2 (src/lib/plans.ts)
alter table subscriptions drop constraint if exists subscriptions_plan_check;
alter table subscriptions add constraint subscriptions_plan_check check (plan in (
  'audit_free','action_plan','suivi_month','suivi_year','bundle_start','pro_month','pro_year',
  'local_audit_free','local_audit_deep','local_essentiel_month','local_essentiel_year','local_accompagne_month',
  'local_reseau_month','local_reseau_year',
  'pme_audit_free','pme_audit_deep','pme_essentiel_month','pme_essentiel_year','pme_accompagne_month',
  'ecom_audit_free','ecom_audit_deep','ecom_essentiel_month','ecom_essentiel_year','ecom_accompagne_month',
  'agency_partner','agency_month','agency_year','agency_exec_local','agency_exec_ecommerce','agency_exec_pme'
));
-- Engagement (Accompagné : 3 mois minimum), renseigné par le webhook depuis la metadata Stripe
alter table subscriptions add column if not exists commitment_until date;
create index if not exists subscriptions_user_idx on subscriptions(user_id);
create index if not exists subscriptions_customer_idx on subscriptions(stripe_customer_id);
create index if not exists subscriptions_business_idx on subscriptions(business_id);
drop trigger if exists subscriptions_updated on subscriptions;
create trigger subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ---------- alerts (journal des alertes, centre de notifications) ----------
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  audit_id text references audits(id) on delete set null,
  type alert_type not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  push_sent_at timestamptz,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_business_created_idx on alerts(business_id, created_at desc);
create index if not exists alerts_unread_idx on alerts(business_id) where read_at is null;

-- ---------- push_subscriptions (appareils inscrits au web push) ----------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_user_idx on push_subscriptions(user_id);

-- ---------- suppression (liste d'opposition, e-mail haché SHA-256 ; jamais vidée) ----------
create table if not exists suppression (
  email_hash text primary key,
  reason text not null default 'unsubscribe',
  created_at timestamptz not null default now()
);

-- ---------- stripe_events (idempotence du webhook) ----------
create table if not exists stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------- rate_events (limitation de débit ; clé = hash salé de l'IP) ----------
create table if not exists rate_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_key_created_idx on rate_events(key, created_at desc);

-- Limitation de débit ATOMIQUE (qa/securite.md C1) : verrou consultatif par clé, donc pas de course
-- « compter puis insérer ». Renvoie le nombre d'appels restants, ou -1 si la limite est atteinte.
-- Utilisée par src/lib/ratelimit.ts pour les limites par IP, par e-mail et les plafonds globaux
-- (clés « audit-global-h:… », « audit-global-d:… », « email-global-d:… »).
create or replace function rate_hit(p_key text, p_limit int, p_window_ms bigint)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  select count(*) into n from rate_events
   where key = p_key and created_at >= now() - make_interval(secs => p_window_ms / 1000.0);
  if n >= p_limit then return -1; end if;
  insert into rate_events(key) values (p_key);
  return p_limit - n - 1;
end $$;
revoke all on function rate_hit(text, int, bigint) from public, anon, authenticated;

-- =========================================================
-- Rattachement : l'ancien déclencheur à l'insertion d'un utilisateur (claim_businesses_for_new_user) est SUPPRIMÉ
-- (faille A3/S1 : il rattachait sans vérifier l'e-mail). Remplacé par claim_business / claim_paid_businesses,
-- section « V3 — Comptes » en fin de fichier (= supabase/migrations/0003_comptes.sql).
-- =========================================================

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
alter table suppression        enable row level security;
alter table stripe_events      enable row level security;
alter table rate_events        enable row level security;

create or replace function owns_business(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

drop policy if exists businesses_select on businesses;
create policy businesses_select on businesses for select using (owner_id = auth.uid());
drop policy if exists businesses_update on businesses;
create policy businesses_update on businesses for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- audits : lecture par le propriétaire. Les audits gratuits (business_id null) ne sont lus que via l'API serveur.
drop policy if exists audits_select on audits;
create policy audits_select on audits for select using (business_id is not null and owns_business(business_id));

drop policy if exists audit_runs_select on audit_runs;
create policy audit_runs_select on audit_runs for select using (owns_business(business_id));
drop policy if exists audit_runs_feedback on audit_runs;
create policy audit_runs_feedback on audit_runs for update
  using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists actions_select on actions_progress;
create policy actions_select on actions_progress for select using (owns_business(business_id));
drop policy if exists actions_insert on actions_progress;
create policy actions_insert on actions_progress for insert with check (owns_business(business_id));
drop policy if exists actions_update on actions_progress;
create policy actions_update on actions_progress for update
  using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists subscriptions_select on subscriptions;
create policy subscriptions_select on subscriptions for select using (user_id = auth.uid());

drop policy if exists alerts_select on alerts;
create policy alerts_select on alerts for select using (owns_business(business_id));
drop policy if exists alerts_update on alerts;
create policy alerts_update on alerts for update
  using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists push_select on push_subscriptions;
create policy push_select on push_subscriptions for select using (user_id = auth.uid());
drop policy if exists push_insert on push_subscriptions;
create policy push_insert on push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists push_delete on push_subscriptions;
create policy push_delete on push_subscriptions for delete using (user_id = auth.uid());

-- leads, suppression, stripe_events, rate_events : aucune policy = inaccessibles au client
-- (lecture/écriture uniquement par l'API serveur avec service_role).

-- Colonnes éditables côté client (défense en profondeur)
revoke update on businesses from authenticated;
grant  update (name, trade, city, district, website, contact_email, custom_queries,
               ignored_competitors, alert_prefs) on businesses to authenticated;
revoke update on audit_runs from authenticated;
grant  update (feedback) on audit_runs to authenticated;
revoke update on actions_progress from authenticated;
grant  update (status, snoozed_until, done_at, note, feedback) on actions_progress to authenticated;
revoke update on alerts from authenticated;
grant  update (read_at) on alerts to authenticated;
revoke all on leads, suppression, stripe_events, rate_events from anon, authenticated;

-- Vue : évolution du score
create or replace view business_score_history with (security_invoker = true) as
select a.business_id, a.id as audit_id, a.created_at, a.score,
       a.score - lag(a.score) over (partition by a.business_id order by a.created_at) as delta
from audits a where a.status = 'done' and a.business_id is not null;

-- =========================================================
-- V2 — documents génériques (src/lib/store.ts, DOCUMENTS_SQL) : une ligne par document de module
-- (collections préfixées : facts.brand, facts.checks, digest.weekly, digest.sent, digest.state,
--  copilot.threads, copilot.usage, exec.*, track.*, bench.*). Accès service_role uniquement (aucune policy).
-- =========================================================
create table if not exists documents (
  collection text not null,
  id text not null,
  business_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists documents_business_idx on documents (collection, business_id, updated_at desc);
alter table documents enable row level security; -- accès service_role uniquement

create or replace function documents_incr(p_collection text, p_id text, p_business_id text, p_deltas jsonb)
returns void language plpgsql security definer as $$
declare k text; v numeric;
begin
  insert into documents (collection, id, business_id, data) values (p_collection, p_id, p_business_id, '{}'::jsonb)
  on conflict (collection, id) do nothing;
  for k, v in select key, value::numeric from jsonb_each_text(p_deltas) loop
    update documents set data = jsonb_set(data, array[k], to_jsonb(coalesce((data->>k)::numeric, 0) + v)), updated_at = now()
    where collection = p_collection and id = p_id;
  end loop;
end $$;
revoke all on documents from anon, authenticated;
revoke all on function documents_incr(text, text, text, jsonb) from public, anon, authenticated;

-- =========================================================
-- Purges RGPD (docs/06-juridique.md) — à planifier avec pg_cron (Database > Extensions)
-- ou à lancer à la main chaque mois :
--   select purge_old_data();
-- =========================================================
create or replace function purge_old_data() returns void
language sql security definer set search_path = public as $$
  delete from rate_events where created_at < now() - interval '2 days';
  -- V2 : historique du copilote 12 mois, compteurs de coût 90 jours
  delete from documents where collection = 'copilot.threads' and updated_at < now() - interval '12 months';
  delete from documents where collection = 'copilot.usage' and updated_at < now() - interval '90 days';
  update audit_runs set answer_text = null where answer_text is not null and created_at < now() - interval '90 days';
  -- audits gratuits non rattachés : 12 mois
  delete from audits where business_id is null and created_at < now() - interval '12 months';
  -- leads sans conversion : 12 mois (site) / 3 ans (prospection)
  delete from leads where converted_business_id is null and source <> 'prospection'
    and created_at < now() - interval '12 months';
  delete from leads where converted_business_id is null and source = 'prospection'
    and created_at < now() - interval '3 years';
$$;
-- Exemple pg_cron : select cron.schedule('purge-repere', '17 3 * * *', 'select purge_old_data()');

-- =========================================================
-- V3 — Comptes (agent COMPTES) : équipes, invitations, rattachement sûr, offre exacte.
-- Idempotent : rejouable sans risque. Reprise intégrale dans supabase/schema.sql.
-- Console Supabase : désactiver « Allow new users to sign up » (seul le serveur crée des comptes) et ajouter
-- <APP_URL>/connexion/callback aux « Redirect URLs ».
-- =========================================================

-- ---------- businesses : offre exacte, parcours, espace à compléter, entrée de l'audit d'origine ----------
alter table businesses add column if not exists plan_id text;
alter table businesses add column if not exists needs_setup boolean not null default false;
alter table businesses add column if not exists audit_input jsonb;
alter table businesses add column if not exists segment text not null default 'local';
alter table businesses drop constraint if exists businesses_segment_check;
alter table businesses add constraint businesses_segment_check check (segment in ('local','pme','ecommerce'));
-- Espace payé « à compléter » (nom, métier, ville saisis sur /bienvenue)
alter table businesses alter column trade set default '';
alter table businesses alter column city set default '';

-- ---------- memberships : un utilisateur, un rôle, par commerce ----------
create table if not exists memberships (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  email text,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);

-- Propriétaires V2 (owner_id) → adhésion owner
insert into memberships (business_id, user_id, role, email)
select b.id, b.owner_id, 'owner', lower(b.contact_email)
  from businesses b where b.owner_id is not null
on conflict (business_id, user_id) do nothing;

-- ---------- invitations (jeton haché, jamais stocké en clair) ----------
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member','viewer')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_business_idx on invitations(business_id) where accepted_at is null and revoked_at is null;

-- ---------- Rattachement : plus JAMAIS à l'insertion d'un utilisateur non confirmé (faille A3/S1) ----------
drop trigger if exists on_auth_user_created_claim on auth.users;
drop function if exists claim_businesses_for_new_user();

-- Recherche d'un compte par e-mail (auth.admin.listUsers ne filtre pas). Serveur uniquement.
create or replace function find_auth_user(p_email text)
returns table (id uuid, email text, email_confirmed_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, u.email_confirmed_at from auth.users u where lower(u.email) = lower(p_email) limit 1;
$$;

-- Rattache UN commerce sans propriétaire à un utilisateur CONFIRMÉ dont l'e-mail est le contact du commerce.
create or replace function claim_business(p_user uuid, p_business uuid) returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; n int;
begin
  select lower(email) into v_email from auth.users where id = p_user and email_confirmed_at is not null;
  if v_email is null then return false; end if;
  update businesses set owner_id = p_user
   where id = p_business and owner_id is null and lower(contact_email) = v_email;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  insert into memberships (business_id, user_id, role, email) values (p_business, p_user, 'owner', v_email)
  on conflict (business_id, user_id) do update set role = 'owner';
  update subscriptions set user_id = p_user where user_id is null and business_id = p_business;
  return true;
end $$;

-- Filet de sécurité à chaque connexion : commerces PAYÉS (ligne subscriptions) à cet e-mail confirmé.
create or replace function claim_paid_businesses(p_user uuid) returns setof uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_email text; r record;
begin
  select lower(email) into v_email from auth.users where id = p_user and email_confirmed_at is not null;
  if v_email is null then return; end if;
  for r in
    select b.id from businesses b
     where b.owner_id is null and lower(b.contact_email) = v_email
       and exists (select 1 from subscriptions s where s.business_id = b.id)
  loop
    if claim_business(p_user, r.id) then return next r.id; end if;
  end loop;
  return;
end $$;

revoke all on function find_auth_user(text) from public, anon, authenticated;
revoke all on function claim_business(uuid, uuid) from public, anon, authenticated;
revoke all on function claim_paid_businesses(uuid) from public, anon, authenticated;

-- ---------- RLS par adhésion (le serveur utilise service_role ; ces règles protègent un accès direct) ----------
create or replace function member_role_rank(b uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(case role when 'owner' then 4 when 'admin' then 3 when 'member' then 2 when 'viewer' then 1 end), 0)
    from memberships where business_id = b and user_id = auth.uid();
$$;

-- owns_business (policies V1/V2) : désormais « membre de l'espace », quel que soit le rôle.
create or replace function owns_business(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select member_role_rank(b) > 0 or exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

alter table memberships enable row level security;
alter table invitations enable row level security;

drop policy if exists businesses_select on businesses;
create policy businesses_select on businesses for select using (owns_business(id));
drop policy if exists businesses_update on businesses;
create policy businesses_update on businesses for update
  using (member_role_rank(id) >= 3 or owner_id = auth.uid())
  with check (member_role_rank(id) >= 3 or owner_id = auth.uid());

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select using (member_role_rank(business_id) > 0);

drop policy if exists invitations_select on invitations;
create policy invitations_select on invitations for select using (member_role_rank(business_id) >= 3);

-- actions_progress : les lecteurs (viewer) ne cochent pas
drop policy if exists actions_insert on actions_progress;
create policy actions_insert on actions_progress for insert with check (member_role_rank(business_id) >= 2);
drop policy if exists actions_update on actions_progress;
create policy actions_update on actions_progress for update
  using (member_role_rank(business_id) >= 2) with check (member_role_rank(business_id) >= 2);

revoke all on memberships, invitations from anon;
