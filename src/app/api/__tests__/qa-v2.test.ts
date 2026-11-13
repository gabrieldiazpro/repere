/**
 * Tests d'intégration QA V2 (fonctionnel + intégration) : engagement Accompagné, identifiants d'offre,
 * cron mensuel + alertes, cohérence des comptes démo (fiche de vérité unique, phrase du digest, rang),
 * réexport EXECUTION, PDF 5 pages, page hébergée et JSON-LD, bot HMAC, comptes démo en lecture seule.
 * Mode démo : ni Supabase, ni Stripe, ni clés d'IA.
 */
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 120_000 });

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-qa-v2-'));
Object.assign(process.env, { CRON_SECRET: 'qa-cron', AUDIT_SIGNING_SECRET: 'qa-signing-secret' });
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']) {
  delete process.env[k];
}

const B = 'http://localhost:3000';
let ip = 0;
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${B}${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.77.${Math.floor(++ip / 250)}.${ip % 250}`, ...headers },
    body: JSON.stringify(body),
  });

const { PLAN_IDS, commitmentCheckoutTerms } = await import('@/lib/plans');
const { commitmentUntilFromMetadata } = await import('@/lib/stripe');

describe('offres et paiement', () => {
  it('/api/checkout accepte TOUS les identifiants d’offre utilisés dans le code (rapport, tarifs, app)', async () => {
    const root = path.join(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== '__tests__' && f !== 'node_modules') walk(p);
        } else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(root);
    const re = /\b(?:(?:local|pme|ecom|agency)_(?:audit_free|audit_deep|essentiel_month|essentiel_year|accompagne_month|reseau_month|reseau_year|partner|month|year|exec_local|exec_pme|exec_ecommerce)|audit_free|action_plan|suivi_month|suivi_year|bundle_start|pro_month|pro_year)\b/g;
    const used = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(re)) used.add(m[0]);
    // identifiants construits dynamiquement par le rapport : `${p}_audit_deep` etc. avec p ∈ local | pme | ecom
    for (const p of ['local', 'pme', 'ecom']) for (const s of ['audit_deep', 'accompagne_month', 'essentiel_month']) used.add(`${p}_${s}`);
    expect(used.size).toBeGreaterThan(20);
    for (const id of used) expect(PLAN_IDS, `offre « ${id} » absente de plans.ts`).toContain(id);

    const route = await import('../checkout/route');
    for (const id of ['pme_accompagne_month', 'ecom_accompagne_month', 'local_accompagne_month', 'pme_audit_deep', 'ecom_essentiel_year', 'local_reseau_month', 'suivi_month']) {
      const res = await route.POST(post('/api/checkout', { planId: id, auditId: 'demo-pme-6' }));
      expect(res.status, id).toBe(200);
      expect(((await res.json()) as { url: string }).url).toContain(`plan=${id}`);
    }
    expect((await route.POST(post('/api/checkout', { planId: 'agency_month' }))).status).toBe(400);
    expect((await route.POST(post('/api/checkout', { planId: 'ecommerce_essentiel_month' }))).status).toBe(400);
  });

  it('webhook : commitment_until lu dans la metadata de l’Accompagné (3 mois), borné par l’offre', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const terms = commitmentCheckoutTerms('pme_accompagne_month', now)!;
    expect(terms.metadata.commitment_until).toBe('2027-02-09');
    const created = Math.floor(now.getTime() / 1000);
    expect(commitmentUntilFromMetadata('pme_accompagne_month', terms.metadata, created)).toBe('2027-02-09');
    // metadata absente : recalculée depuis la date de création
    expect(commitmentUntilFromMetadata('ecom_accompagne_month', {}, created)).toBe('2027-02-09');
    // metadata trafiquée au-delà de la durée de l'offre : ignorée
    expect(commitmentUntilFromMetadata('local_accompagne_month', { commitment_until: '2030-01-01' }, created)).toBe('2027-02-09');
    // offre sans engagement
    expect(commitmentUntilFromMetadata('pme_essentiel_month', terms.metadata, created)).toBeNull();
  });

  it('upsertSubscription conserve commitmentUntil', async () => {
    const { upsertSubscription, listSubscriptionsByCustomer } = await import('@/lib/db');
    await upsertSubscription({ stripeCustomerId: 'cus_qa', stripeSubscriptionId: 'sub_qa', planId: 'pme_accompagne_month', status: 'active', commitmentUntil: '2027-02-09' });
    await upsertSubscription({ stripeCustomerId: 'cus_qa', stripeSubscriptionId: 'sub_qa', planId: 'pme_accompagne_month', status: 'past_due' });
    const [s] = await listSubscriptionsByCustomer('cus_qa');
    expect(s.commitmentUntil).toBe('2027-02-09');
    expect(s.status).toBe('past_due');
  });
});

describe('comptes démo : une seule source de vérité, chiffres cohérents', () => {
  it('fiche de vérité démo = fiche du moteur (createMockFacts)', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { createMockFacts } = await import('@/lib/engine');
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const ws = buildDemoWorkspace(seg);
      expect(ws.facts.facts).toEqual(createMockFacts(ws.audits[0].input).facts);
    }
    const src = readFileSync(path.join(process.cwd(), 'src/lib/demo-v2.ts'), 'utf8');
    expect(src).not.toMatch(/Oberkampf|Chaussée-d|Burdeau/);
  });

  it('phrase de la semaine : jamais « 0 question », cohérente avec le score ; rang identique partout', async () => {
    const { buildWeeklyDigest, citedQuestions } = await import('@/lib/digest');
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { getAudit } = await import('@/lib/db');
    for (const [seg, id] of [['local', 'demo'], ['pme', 'demo-pme'], ['ecommerce', 'demo-ecom']] as const) {
      const ws = buildDemoWorkspace(seg);
      const latest = ws.audits.at(-1)!;
      const d = await buildWeeklyDigest(id);
      expect(d.headline).not.toMatch(/dans 0 question/);
      const q = citedQuestions(latest, 'chatgpt');
      expect(q.cited).toBeGreaterThan(0);
      // proportion de questions citées ≈ taux de mention (à une question près)
      expect(Math.abs(q.cited / q.total - latest.mentionRate)).toBeLessThanOrEqual(1 / q.total + 0.01);
      // les questions citées ne baissent pas quand le score monte
      const series = ws.audits.map((a) => citedQuestions(a, 'chatgpt').cited);
      for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
      // même rang dans le digest, l'audit servi au rapport/PDF et l'espace
      const served = (await getAudit(latest.id)) as typeof latest;
      expect(served.score).toBe(latest.score);
      expect(served.benchmark).toEqual(latest.benchmark);
      expect(d.benchmark).toEqual(latest.benchmark);
      expect(served.sources?.domains.length).toBe(latest.sources?.domains.length);
    }
  });

  it('PDF démo : 5 pages exactement pour les 3 parcours', async () => {
    const { getAudit } = await import('@/lib/db');
    const { renderReportPdf } = await import('@/lib/pdf/Report');
    const countPages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    for (const id of ['demo-6', 'demo-pme-6', 'demo-ecom-6']) {
      const a = await getAudit(id);
      expect(countPages(await renderReportPdf(a!)), id).toBe(5);
    }
  });
});

describe('intégration EXECUTION', () => {
  it('digest/execution-adapter réexporte @/lib/execution', async () => {
    const adapter = await import('@/lib/digest/execution-adapter');
    const execution = await import('@/lib/execution');
    for (const k of ['listTasks', 'weeklyTasks', 'updateTaskStatus', 'seedDemoExec', 'buildJsonLd', 'createFactFixTask'] as const) {
      expect((adapter as Record<string, unknown>)[k]).toBe((execution as Record<string, unknown>)[k]);
    }
  });

  it('/api/schema/[id] et /p/[slug] (démo)', async () => {
    const { GET } = await import('@/app/api/schema/[businessId]/route');
    const res = await GET(new Request(`${B}/api/schema/demo-pme`), { params: Promise.resolve({ businessId: 'demo-pme' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { '@graph': { '@type': string; name?: string }[] };
    expect(data['@graph'].some((n) => n.name === 'Paysia')).toBe(true);
    const { findBusinessIdBySlug, loadExecContext } = await import('@/lib/execution');
    expect(await findBusinessIdBySlug('paysia')).toBe('demo-pme');
    expect((await loadExecContext('demo-pme'))?.facts.facts.prix).toMatch(/8 € HT/);
  });
});

describe('cron mensuel', () => {
  it('relance l’audit, enregistre les alertes V2 (detectAlerts) et partage l’état avec le cron hebdo', async () => {
    const { createBusiness, saveAudit, listAlerts } = await import('@/lib/db');
    const { createMockAudit } = await import('@/lib/engine');
    const { saveFacts } = await import('@/lib/facts');
    const { getDoc } = await import('@/lib/store');
    const input = { businessName: 'Serrurerie Mensuelle', trade: 'serrurier', city: 'Paris', district: '11e' };
    const b = await createBusiness({ ...input, name: input.businessName, plan: 'essentiel', contactEmail: 's@exemple.fr' } as Parameters<typeof createBusiness>[0]);
    const old = { ...createMockAudit(input, 'mensuel-0'), createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString() };
    await saveAudit(old, { businessId: b.id, trigger: 'manual' });
    // fiche de vérité renseignée : le contrôle d'exactitude est relancé sur le nouvel audit
    const { createMockFacts } = await import('@/lib/engine');
    await saveFacts(b.id, createMockFacts(input).facts);

    const cron = await import('../cron/monthly/route');
    expect((await cron.GET(new Request(`${B}/api/cron/monthly`))).status).toBe(401);
    const res = await cron.GET(new Request(`${B}/api/cron/monthly`, { headers: { authorization: 'Bearer qa-cron' } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { outcomes: { businessId: string; detected?: number; error?: string }[]; detectedAlerts: number };
    const mine = body.outcomes.find((o) => o.businessId === b.id)!;
    expect(mine.error).toBeUndefined();
    expect(mine.detected).toBeGreaterThan(0);
    const alerts = await listAlerts(b.id);
    const v2 = alerts.filter((a) => ['competitor_overtook', 'new_competitor', 'fact_error', 'visibility_change'].includes(a.type));
    expect(v2.length).toBe(mine.detected);
    expect((await getDoc<{ lastAlertAuditId?: string }>('digest.state', b.id))?.data.lastAlertAuditId).toBeTruthy();
  });

  it('cron hebdo : Bearer exigé', async () => {
    const weekly = await import('../cron/weekly/route');
    expect((await weekly.GET(new Request(`${B}/api/cron/weekly?force=1`))).status).toBe(401);
    expect((await weekly.GET(new Request(`${B}/api/cron/weekly?force=1`, { headers: { authorization: 'Bearer faux' } }))).status).toBe(401);
    const ok = await weekly.GET(new Request(`${B}/api/cron/weekly?force=1`, { headers: { authorization: 'Bearer qa-cron' } }));
    expect(ok.status).toBe(200);
  });
});

describe('trafic IA (routes)', () => {
  it('POST /api/t (référent chatgpt.com, origine du site) puis agrégat /api/t/summary ; /api/t/bot HMAC', async () => {
    const { createBusiness } = await import('@/lib/db');
    const { botKeyFor } = await import('@/lib/tracking');
    const b = await createBusiness({ name: 'Trafic Réel', trade: 'fleuriste', city: 'Lyon', website: 'https://www.trafic-reel.fr', plan: 'essentiel' } as Parameters<typeof createBusiness>[0]);
    const t = await import('../t/route');
    const s = await import('../t/summary/route');
    const bot = await import('../t/bot/route');
    expect((await t.POST(post('/api/t', { s: b.id, p: '/tarifs', r: 'https://chatgpt.com/', u: '', m: '' }, { origin: 'https://www.trafic-reel.fr' }))).status).toBe(204);
    expect((await t.POST(post('/api/t', { s: b.id, p: '/tarifs', r: 'https://chatgpt.com/' }, { origin: 'https://concurrent.fr' }))).status).toBe(204); // ignoré
    const sum = (await (await s.GET(new Request(`${B}/api/t/summary?businessId=${b.id}&days=7`))).json()) as { totals: { aiVisits: number; byEngine: Record<string, number> }; topLandingPages: { path: string }[] };
    expect(sum.totals.aiVisits).toBe(1);
    expect(sum.totals.byEngine.chatgpt).toBe(1);
    expect(sum.topLandingPages[0].path).toBe('/tarifs');

    const body = { businessId: b.id, ua: 'Mozilla/5.0 (compatible; GPTBot/1.2)', path: '/' };
    expect((await bot.POST(post('/api/t/bot', body, { 'x-repere-key': 'a'.repeat(64) }))).status).toBe(401);
    expect((await bot.POST(post('/api/t/bot', body, { 'x-repere-key': botKeyFor(b.id) }))).status).toBe(204);
    // F1 : la clé de relais n'est pas le jeton du plan d'action
    const { signPlanToken } = await import('@/lib/pdf/sign');
    expect(botKeyFor(b.id)).not.toBe(signPlanToken(b.id));
  });
});
