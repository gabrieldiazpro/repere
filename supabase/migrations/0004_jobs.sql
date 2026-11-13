-- 0004_jobs.sql — file de tâches de Repéré (agent TACHES-FOND, docs/v3/12-CONTRATS-V3.md)
-- Idempotent : peut être rejouée sans risque. Accès service_role uniquement (aucune lecture anon / authenticated).
--
-- Statuts : queued → running → done | dead (une tâche en échec repasse en queued avec run_at reculé : backoff).
-- Verrou : `locked_by` + `lock_expires_at` (bail). Un worker interrompu (timeout Vercel) libère ses tâches à
-- l'expiration du bail : elles sont reprises par le worker suivant (gestionnaires idempotents).

create extension if not exists pgcrypto;

create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('audit.run','audit.scheduled','tasks.generate','digest.send',
                                                 'report.scheduled','measure.action','siteaudit.run','webhook.deliver')),
  payload         jsonb not null default '{}'::jsonb,
  business_id     text,                         -- text : accepte aussi les identifiants hors uuid ; purgé par l'export/suppression RGPD
  dedupe_key      text unique,                  -- ex. 'audit.scheduled:<bid>:2026-11' ; une 2e mise en file renvoie la tâche existante
  status          text not null default 'queued' check (status in ('queued','running','done','dead')),
  priority        smallint not null default 5,  -- 1 = le plus urgent
  attempts        int not null default 0,
  max_attempts    int not null default 5,
  run_at          timestamptz not null default now(),
  locked_by       text,
  lock_expires_at timestamptz,
  last_error      text,
  result          jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists jobs_ready_idx on jobs (priority, run_at) where status = 'queued';
create index if not exists jobs_running_idx on jobs (lock_expires_at) where status = 'running';
create index if not exists jobs_business_idx on jobs (business_id, created_at desc);
create index if not exists jobs_finished_idx on jobs (finished_at) where status in ('done','dead');

alter table jobs enable row level security;  -- aucune politique : service_role uniquement
revoke all on jobs from anon, authenticated;

-- Réservation atomique de N tâches prêtes (ou dont le bail a expiré) : `for update skip locked`,
-- deux workers simultanés ne prennent jamais la même tâche.
create or replace function jobs_claim(p_worker text, p_limit int default 5, p_lease_ms int default 120000)
returns setof jobs language sql security definer set search_path = public as $$
  update jobs j
     set status = 'running',
         locked_by = p_worker,
         lock_expires_at = now() + make_interval(secs => p_lease_ms / 1000.0),
         attempts = j.attempts + 1,
         updated_at = now()
   where j.id in (
     select id from jobs
      where (status = 'queued' and run_at <= now())
         or (status = 'running' and lock_expires_at < now())
      order by priority, run_at, created_at
      limit greatest(p_limit, 0)
      for update skip locked)
  returning j.*;
$$;

-- Indicateurs pour /api/health (une seule requête).
create or replace function jobs_stats()
returns table (queued bigint, running bigint, done bigint, dead bigint, oldest_queued_min int)
language sql security definer set search_path = public as $$
  select count(*) filter (where status = 'queued'),
         count(*) filter (where status = 'running'),
         count(*) filter (where status = 'done'),
         count(*) filter (where status = 'dead'),
         (select floor(extract(epoch from now() - min(run_at)) / 60)::int
            from jobs where status = 'queued' and run_at <= now())
    from jobs;
$$;

-- Purge : tâches terminées de plus de 30 jours, mortes de plus de 90 jours.
create or replace function jobs_purge() returns int
language sql security definer set search_path = public as $$
  with d as (
    delete from jobs
     where (status = 'done' and finished_at < now() - interval '30 days')
        or (status = 'dead' and finished_at < now() - interval '90 days')
    returning 1)
  select count(*)::int from d;
$$;

revoke all on function jobs_claim(text, int, int) from public, anon, authenticated;
revoke all on function jobs_stats() from public, anon, authenticated;
revoke all on function jobs_purge() from public, anon, authenticated;

-- Déclenchement chaque minute, indépendant du plan Vercel (facultatif, recommandé) : pg_cron + pg_net.
-- Remplacer <domaine> et <CRON_SECRET>, puis exécuter une fois dans l'éditeur SQL :
--   create extension if not exists pg_cron; create extension if not exists pg_net;
--   select cron.schedule('repere-worker', '* * * * *', $$ select net.http_post(
--     url := 'https://<domaine>/api/cron/worker',
--     headers := jsonb_build_object('authorization', 'Bearer <CRON_SECRET>'),
--     timeout_milliseconds := 5000) $$);
--   select cron.schedule('repere-jobs-purge', '23 3 * * *', 'select jobs_purge()');
