/**
 * Validation des fichiers SQL sur un vrai Postgres (PGlite, Postgres compilé en WebAssembly) :
 * ordre d'application, idempotence, RLS sur chaque table, politiques, rôles Supabase simulés,
 * script de migration (table de suivi) et fichier TOUT-EN-UN.sql.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_IN_ONE_FILE, buildAllInOne, checksum, cronSql, listMigrations, pendingMigrations } from '../lib/migrations.mjs';
import { migrate, pgConfig } from '../migrate.mjs';
import { EXPECTED_TABLES, SUPABASE_STUB_SQL } from './supabase-stub';

type Row = Record<string, unknown>;
type Migration = { name: string; sql: string; checksum: string };

/** Client compatible `pg` (query) au-dessus de PGlite (exec accepte plusieurs instructions). */
function asPgClient(db: PGlite) {
  return {
    async query(sql: string) {
      const res = await db.exec(sql);
      return { rows: (res.at(-1)?.rows ?? []) as Row[] };
    },
  };
}

async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB_SQL);
  return db;
}

const UA = '00000000-0000-4000-8000-00000000000a';
const UB = '00000000-0000-4000-8000-00000000000b';
const UC = '00000000-0000-4000-8000-00000000000c'; // e-mail non confirmé

/** Exécute `fn` sous un rôle Supabase, avec l'utilisateur `sub` (claim JWT), puis revient au superutilisateur. */
async function as<T>(db: PGlite, role: 'anon' | 'authenticated' | 'service_role', sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

let all: Migration[];

describe('fichiers SQL de Supabase', () => {
  let db: PGlite;

  beforeAll(async () => {
    all = await listMigrations();
    db = await freshDb();
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  it('liste les fichiers dans l’ordre : schema.sql puis 0003 → 0006', () => {
    const names = all.map((m) => m.name);
    expect(names[0]).toBe('schema.sql');
    const nums = names.slice(1).map((n) => Number(n.replace('migrations/', '').slice(0, 4)));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(names).toEqual(expect.arrayContaining(['migrations/0003_comptes.sql', 'migrations/0004_jobs.sql', 'migrations/0005_lead_sources.sql', 'migrations/0006_jobs_v5.sql']));
  });

  it('applique tout sur une base neuve, puis ne rejoue rien (suivi des migrations)', async () => {
    const client = asPgClient(db);
    const first = await migrate(client, { all, log: () => undefined });
    expect(first.map((m: Migration) => m.name)).toEqual(all.map((m) => m.name));
    const second = await migrate(client, { all, log: () => undefined });
    expect(second).toEqual([]);
    const tracked = await db.query<{ name: string }>('select name from repere_migrations order by name');
    expect(tracked.rows.map((r) => r.name).sort()).toEqual(all.map((m) => m.name).sort());
  }, 120_000);

  it('est idempotent : chaque fichier rejoué deux fois dans l’ordre sans erreur', async () => {
    for (let pass = 0; pass < 2; pass++) {
      for (const m of all) await expect(db.exec(m.sql), m.name).resolves.toBeDefined();
    }
    // schema.sql rejoué APRÈS les migrations (cas réel : mise à jour du schéma complet)
    await expect(db.exec(all[0].sql)).resolves.toBeDefined();
  }, 120_000);

  it('rejoue un fichier modifié depuis sa dernière application', () => {
    const applied = new Map(all.map((m) => [m.name, m.checksum]));
    applied.set('migrations/0004_jobs.sql', 'ancienne');
    const pending = pendingMigrations(all, applied);
    expect(pending.map((m: Migration) => m.name)).toEqual(['migrations/0004_jobs.sql']);
  });

  it('active la RLS sur CHAQUE table du schéma public', async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p') order by 1`,
    );
    const tables = r.rows.map((x) => x.relname);
    expect(tables).toEqual(expect.arrayContaining(EXPECTED_TABLES));
    const without = r.rows.filter((x) => !x.relrowsecurity).map((x) => x.relname);
    expect(without, 'tables sans RLS').toEqual([]);
  });

  it('pose les politiques attendues (lecture par adhésion, écritures limitées)', async () => {
    const r = await db.query<{ tablename: string; policyname: string; cmd: string }>(
      `select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2`,
    );
    const names = r.rows.map((x) => `${x.tablename}.${x.policyname}`);
    for (const p of [
      'businesses.businesses_select', 'businesses.businesses_update', 'audits.audits_select',
      'audit_runs.audit_runs_select', 'audit_runs.audit_runs_feedback', 'actions_progress.actions_select',
      'actions_progress.actions_insert', 'actions_progress.actions_update', 'subscriptions.subscriptions_select',
      'alerts.alerts_select', 'alerts.alerts_update', 'push_subscriptions.push_select', 'push_subscriptions.push_insert',
      'push_subscriptions.push_delete', 'memberships.memberships_select', 'invitations.invitations_select',
    ]) expect(names).toContain(p);
    // Tables serveur uniquement : aucune politique (donc aucun accès client).
    for (const t of ['leads', 'suppression', 'stripe_events', 'rate_events', 'documents', 'jobs', 'repere_migrations']) {
      expect(r.rows.filter((x) => x.tablename === t), t).toEqual([]);
    }
  });

  describe('rôles Supabase simulés', () => {
    let bizA = '';

    beforeAll(async () => {
      await db.exec(`
        insert into auth.users (id, email, email_confirmed_at) values
          ('${UA}', 'a@exemple.fr', now()), ('${UB}', 'b@exemple.fr', now()), ('${UC}', 'c@exemple.fr', null);
      `);
      const r = await db.query<{ id: string }>(
        `insert into businesses (owner_id, name, trade, city, contact_email) values ('${UA}', 'Commerce A', 'plombier', 'Lyon', 'a@exemple.fr') returning id`,
      );
      bizA = r.rows[0].id;
      await db.exec(`
        insert into memberships (business_id, user_id, role, email) values ('${bizA}', '${UA}', 'owner', 'a@exemple.fr');
        insert into businesses (name, trade, city, contact_email) values ('Commerce B', 'boulanger', 'Paris', 'b@exemple.fr');
        insert into businesses (name, trade, city, contact_email) values ('Commerce C', 'fleuriste', 'Nantes', 'c@exemple.fr');
        insert into leads (email) values ('prospect@exemple.fr');
        insert into audits (id, business_id, result) values ('audit-a', '${bizA}', '{}'::jsonb), ('audit-libre', null, '{}'::jsonb);
      `);
    }, 60_000);

    it('authenticated : ne voit que ses commerces et audits', async () => {
      const seen = await as(db, 'authenticated', UA, () => db.query<{ name: string }>('select name from businesses order by name'));
      expect(seen.rows.map((r) => r.name)).toEqual(['Commerce A']);
      const audits = await as(db, 'authenticated', UA, () => db.query<{ id: string }>('select id from audits'));
      expect(audits.rows.map((r) => r.id)).toEqual(['audit-a']);
      const other = await as(db, 'authenticated', UB, () => db.query('select * from businesses'));
      expect(other.rows).toEqual([]);
    });

    it('anon : ne lit aucun commerce, n’a aucun accès aux tables serveur ni aux fonctions sensibles', async () => {
      const biz = await as(db, 'anon', null, () => db.query('select * from businesses'));
      expect(biz.rows).toEqual([]);
      for (const t of ['leads', 'jobs', 'documents', 'stripe_events', 'suppression', 'rate_events', 'repere_migrations', 'memberships', 'invitations']) {
        await expect(as(db, 'anon', null, () => db.query(`select * from ${t}`)), t).rejects.toThrow(/permission denied/);
      }
      for (const f of [
        `select rate_hit('k', 5, 60000)`,
        `select claim_business('${UB}', gen_random_uuid())`,
        `select * from find_auth_user('a@exemple.fr')`,
        `select * from jobs_claim('w', 1, 1000)`,
        `select documents_incr('c', 'i', null, '{}'::jsonb)`,
      ]) {
        await expect(as(db, 'anon', null, () => db.query(f)), f).rejects.toThrow(/permission denied/);
      }
    });

    it('authenticated : ne peut modifier que les colonnes autorisées (pas l’offre)', async () => {
      await expect(
        as(db, 'authenticated', UA, () => db.query(`update businesses set plan = 'accompagne' where id = '${bizA}'`)),
      ).rejects.toThrow(/permission denied/);
      const r = await as(db, 'authenticated', UA, () => db.query(`update businesses set name = 'Commerce A bis' where id = '${bizA}'`));
      expect(r.affectedRows).toBe(1);
      const r2 = await as(db, 'authenticated', UB, () => db.query(`update businesses set name = 'pirate' where id = '${bizA}'`));
      expect(r2.affectedRows).toBe(0);
    });

    it('service_role : contourne la RLS (écritures serveur)', async () => {
      const r = await as(db, 'service_role', null, () => db.query('select count(*)::int as n from businesses'));
      expect((r.rows[0] as { n: number }).n).toBe(3);
      const leads = await as(db, 'service_role', null, () => db.query('select count(*)::int as n from leads'));
      expect((leads.rows[0] as { n: number }).n).toBe(1);
    });

    it('fonctions serveur : rattachement sûr, file de tâches, limitation de débit', async () => {
      const unconfirmed = await db.query<{ ok: boolean }>(
        `select claim_business('${UC}', (select id from businesses where name = 'Commerce C')) as ok`,
      );
      expect(unconfirmed.rows[0].ok).toBe(false);
      const confirmed = await db.query<{ ok: boolean }>(
        `select claim_business('${UB}', (select id from businesses where name = 'Commerce B')) as ok`,
      );
      expect(confirmed.rows[0].ok).toBe(true);
      const mine = await as(db, 'authenticated', UB, () => db.query<{ name: string }>('select name from businesses'));
      expect(mine.rows.map((r) => r.name)).toEqual(['Commerce B']);

      await db.exec(`insert into jobs (type, dedupe_key) values ('audit.run', 'test:1')`);
      const claimed = await db.query('select * from jobs_claim($1, 5, 60000)', ['w1']);
      expect(claimed.rows).toHaveLength(1);
      const again = await db.query('select * from jobs_claim($1, 5, 60000)', ['w2']);
      expect(again.rows).toHaveLength(0);
      const stats = await db.query<{ running: number }>('select running::int from jobs_stats()');
      expect(stats.rows[0].running).toBe(1);
      // V5 : types de tâches ajoutés par 0006 acceptés, type inconnu refusé.
      const { JOB_TYPES } = await import('@/lib/jobs/types');
      for (const t of JOB_TYPES) await db.exec(`insert into jobs (type, status) values ('${t}', 'done')`);
      await expect(db.exec(`insert into jobs (type) values ('inconnu.x')`)).rejects.toThrow();
      await db.exec(`delete from jobs where status = 'done'`);

      const hits = [];
      for (let i = 0; i < 3; i++) hits.push((await db.query<{ n: number }>(`select rate_hit('ip:x', 2, 60000) as n`)).rows[0].n);
      expect(hits).toEqual([1, 0, -1]);
    });
  });
});

describe('supabase/TOUT-EN-UN.sql', () => {
  it('est à jour avec schema.sql et les migrations (sinon : node scripts/ops/migrate.mjs --tout-en-un)', async () => {
    const files = await listMigrations();
    const committed = readFileSync(ALL_IN_ONE_FILE, 'utf8');
    expect(committed === buildAllInOne(files), 'TOUT-EN-UN.sql périmé : lancez node scripts/ops/migrate.mjs --tout-en-un').toBe(true);
  });

  it('s’applique sur une base neuve, deux fois de suite, et enregistre le suivi', async () => {
    const db = await freshDb();
    try {
      const sql = readFileSync(ALL_IN_ONE_FILE, 'utf8');
      await db.exec(sql);
      await db.exec(sql);
      const files = await listMigrations();
      const r = await db.query<{ name: string; checksum: string }>('select name, checksum from repere_migrations order by name');
      expect(r.rows).toEqual(files.map((m: Migration) => ({ name: m.name, checksum: m.checksum })).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)));
      // Le script en ligne de commande ne rejoue rien ensuite.
      expect(await migrate(asPgClient(db), { all: files, log: () => undefined })).toEqual([]);
    } finally {
      await db.close();
    }
  }, 120_000);
});

describe('migrate.mjs : connexion et planification', () => {
  it('refuse une URI avec le mot de passe non remplacé, active TLS hors poste local', () => {
    expect(() => pgConfig('postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres')).toThrow(/YOUR-PASSWORD/);
    expect(() => pgConfig('mysql://x')).toThrow(/postgresql/);
    expect(pgConfig('postgresql://u:p@localhost:5432/db').ssl).toBe(false);
    expect(pgConfig('postgresql://u:p@aws-0-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require').ssl).toEqual({ rejectUnauthorized: false });
    expect(pgConfig('postgresql://u:p@h.example:5432/postgres', 'PEM').ssl).toEqual({ ca: 'PEM', rejectUnauthorized: true });
  });

  it('génère le SQL pg_cron du worker avec l’URL et le secret', () => {
    const sql = cronSql({ appUrl: 'https://exemple.fr/', cronSecret: "s'ecret" });
    expect(sql).toContain(`url := 'https://exemple.fr/api/cron/worker'`);
    expect(sql).toContain(`'Bearer s''ecret'`);
    expect(sql).toContain(`cron.schedule('repere-worker', '* * * * *'`);
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
  });
});
