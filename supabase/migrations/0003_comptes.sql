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
