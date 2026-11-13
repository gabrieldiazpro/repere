/**
 * src/lib/env.ts (validation, modes, refus de démarrer en production) et src/lib/log.ts (JSON, masquage, Sentry).
 * Rangés ici : périmètre de l'agent TACHES-FOND.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertEnv, EnvError, isDemoMode, validateEnv } from '@/lib/env';
import { buildSentryEnvelope, log, parseDsn, redact, redactString, setLogSink, withRequest } from '@/lib/log';

const PROD_OK = {
  VERCEL_ENV: 'production',
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(60),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_APP_URL: 'https://repere-ia.fr',
  STRIPE_SECRET_KEY: 'sk_live_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_123',
  RESEND_API_KEY: 're_123',
  CRON_SECRET: 'c'.repeat(32),
  UNSUBSCRIBE_SECRET: 'u'.repeat(32),
  AUDIT_SIGNING_SECRET: 'a'.repeat(32),
  RATE_LIMIT_SALT: 's'.repeat(32),
  SENTRY_DSN: 'https://pub@o1.ingest.sentry.io/42',
  OPENAI_API_KEY: 'sk-x',
  AUTH_SECRET: 'x'.repeat(32),
  SHARE_SECRET: 'y'.repeat(32),
  INTEGRATIONS_SECRET: 'z'.repeat(32),
};

describe('env', () => {
  it('sans rien : mode démo explicite, valide', () => {
    const r = validateEnv({});
    expect(r).toMatchObject({ ok: true, mode: 'demo', production: false, errors: [] });
    expect(r.env.JOBS_TIMEOUT_MS).toBe(90_000);
    expect(isDemoMode({})).toBe(true);
  });

  it('production complète : valide, sans avertissement', () => {
    const r = validateEnv(PROD_OK);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.mode).toBe('production');
    expect(assertEnv(PROD_OK).NEXT_PUBLIC_APP_URL).toBe('https://repere-ia.fr');
  });

  it('production sans base : refus de démarrer avec un message qui nomme les variables', () => {
    const src = { ...PROD_OK, SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' };
    const r = validateEnv(src);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']));
    expect(() => assertEnv(src)).toThrow(EnvError);
    expect(() => assertEnv(src)).toThrow(/SUPABASE_SERVICE_ROLE_KEY manquante/);
  });

  it('production : secrets mal formés refusés (préfixes, longueur, https)', () => {
    const r = validateEnv({ ...PROD_OK, STRIPE_WEBHOOK_SECRET: 'abc', CRON_SECRET: 'court', NEXT_PUBLIC_APP_URL: 'http://repere-ia.fr' });
    expect(r.errors.join('\n')).toMatch(/STRIPE_WEBHOOK_SECRET invalide/);
    expect(r.errors.join('\n')).toMatch(/CRON_SECRET invalide/);
    expect(r.errors.join('\n')).toMatch(/NEXT_PUBLIC_APP_URL invalide/);
  });

  it('DEMO_MODE=1 en production : démarre, avec un avertissement', () => {
    const r = validateEnv({ VERCEL_ENV: 'production', DEMO_MODE: '1' });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('demo');
    expect(r.warnings.join(' ')).toMatch(/DEMO_MODE/);
  });

  it('le build n’est jamais bloqué', () => {
    const r = validateEnv({ VERCEL_ENV: 'production', NEXT_PHASE: 'phase-production-build' });
    expect(r.production).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('URL invalide et nombre invalide : erreurs de schéma', () => {
    const r = validateEnv({ SENTRY_DSN: 'pas une url', JOBS_BATCH: 'dix' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('SENTRY_DSN'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('JOBS_BATCH'))).toBe(true);
  });

  it('développement : manques en avertissements, jamais bloquants', () => {
    const r = validateEnv({ SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(60) });
    expect(r.mode).toBe('development');
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('STRIPE_SECRET_KEY'))).toBe(true);
  });
});

describe('log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('une ligne JSON par événement, e-mails et secrets masqués', () => {
    const lines: string[] = [];
    const restore = setLogSink((_l, line) => lines.push(line));
    try {
      withRequest(new Request('https://x.fr/api/jobs/1', { headers: { 'x-vercel-id': 'cdg1::abc' } })).warn('test.event', {
        email: 'jean.dupont@exemple.fr',
        apiKey: 'sk_live_abcdef123456',
        note: 'Bearer abcdefghijkl',
      });
    } finally {
      restore();
    }
    expect(lines).toHaveLength(1);
    const e = JSON.parse(lines[0]);
    expect(e).toMatchObject({ level: 'warn', event: 'test.event', requestId: 'cdg1::abc', route: '/api/jobs/1', apiKey: '[masqué]' });
    expect(e.email).toBe('j***@exemple.fr');
    expect(e.note).not.toContain('abcdefghijkl');
  });

  it('redact : bornes de profondeur et de taille', () => {
    expect(redactString('écrire à a.b@c.fr')).toBe('écrire à a***@c.fr');
    const deep = redact({ a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } }) as Record<string, unknown>;
    expect(JSON.stringify(deep)).toContain('[profondeur]');
  });

  it('Sentry : DSN analysé, enveloppe conforme, envoi HTTP si SENTRY_DSN', async () => {
    const dsn = 'https://pubkey@o123.ingest.sentry.io/4567';
    expect(parseDsn(dsn)).toMatchObject({ publicKey: 'pubkey', projectId: '4567', envelopeUrl: 'https://o123.ingest.sentry.io/api/4567/envelope/' });
    expect(parseDsn('nimporte')).toBeNull();
    const { body, eventId } = buildSentryEnvelope(new Error('boum pour x@y.fr'), { jobType: 'audit.run' }, dsn);
    const [header, item, payload] = body.trim().split('\n');
    expect(JSON.parse(header).event_id).toBe(eventId);
    expect(JSON.parse(item).type).toBe('event');
    const ev = JSON.parse(payload);
    expect(ev.exception.values[0].value).toBe('boum pour x***@y.fr');
    expect(ev.tags.jobType).toBe('audit.run');

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const prev = process.env.SENTRY_DSN;
    process.env.SENTRY_DSN = dsn;
    const restore = setLogSink(() => undefined);
    try {
      log.error('test.error', new Error('échec'));
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      restore();
      if (prev === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = prev;
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o123.ingest.sentry.io/api/4567/envelope/');
    expect(String((init.headers as Record<string, string>)['x-sentry-auth'])).toContain('sentry_key=pubkey');
  });
});
