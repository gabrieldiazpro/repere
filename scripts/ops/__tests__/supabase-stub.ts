/**
 * Simulation minimale de ce que Supabase fournit avant nos fichiers SQL : rôles anon / authenticated /
 * service_role, schéma auth (users, uid()), privilèges par défaut du schéma public (Supabase accorde tout à ces
 * trois rôles : seules la RLS et nos « revoke » protègent les données).
 */
export const SUPABASE_STUB_SQL = `
do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

/** Tables du schéma public exposées par l'API Supabase (PostgREST) : toutes doivent avoir la RLS active. */
export const EXPECTED_TABLES = [
  'actions_progress',
  'alerts',
  'audit_runs',
  'audits',
  'businesses',
  'documents',
  'invitations',
  'jobs',
  'leads',
  'memberships',
  'push_subscriptions',
  'rate_events',
  'repere_migrations',
  'stripe_events',
  'subscriptions',
  'suppression',
];
