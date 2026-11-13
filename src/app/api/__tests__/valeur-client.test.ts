import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-valeur-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'RATE_LIMIT_SALT']) delete process.env[k];

describe('compte maison « repere » (dogfooding)', () => {
  it('/api/schema/repere renvoie un JSON-LD sans champ [À COMPLÉTER]', async () => {
    const route = await import('@/app/api/schema/[businessId]/route');
    const res = await route.GET(new Request('http://localhost/api/schema/repere'), { params: Promise.resolve({ businessId: 'repere' }) });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Repéré');
    expect(body).not.toMatch(/compléter|COMPLÉTER/i);
  });
  it('/p/repere : le slug est servi et la fiche publiée', async () => {
    const { findBusinessIdBySlug, loadExecContext } = await import('@/lib/execution');
    expect(await findBusinessIdBySlug('repere')).toBe('repere');
    const ctx = await loadExecContext('repere');
    expect(ctx?.settings.slug).toBe('repere');
    expect(ctx?.demo).toBe(false);
    expect(ctx?.facts.facts.adresse).toBeUndefined();
  });
});

describe('cohérence des chiffres entre écrans (un seul calcul)', () => {
  it('rang, citations et réponses identiques : stats, benchmark démo, digest, copilote', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { auditStats, rankMove } = await import('@/lib/digest/stats');
    const { rankInAudit, clientMentions } = await import('@/lib/digest/benchmark');
    const { buildWeeklyDigest } = await import('@/lib/digest');
    const { loadCopilotContext, contextToText } = await import('@/lib/copilot');
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const ws = buildDemoWorkspace(seg);
      for (const a of ws.audits) {
        const s = auditStats(a);
        expect(a.benchmark).toEqual({ rank: s.rank, of: s.of, label: s.label });
        expect(rankInAudit(a)).toEqual(a.benchmark);
        expect(clientMentions(a)).toBe(s.citations);
        expect(s.answers).toBe(s.questions * s.providers.length * s.runs - (s.plannedAnswers - s.answers));
        // « Pourquoi ils passent devant » : uniquement des concurrents réellement devant, même base
        for (const g of a.gaps ?? []) expect(s.rows.find((r) => r.name === g.competitor)!.mentions).toBeGreaterThan(s.citations);
      }
      const latest = ws.audits.at(-1)!;
      const s = auditStats(latest);
      const d = await buildWeeklyDigest(ws.business.id);
      expect(d.benchmark).toEqual({ rank: s.rank, of: s.of, label: s.label });
      expect(d.rankMove?.label).toBe(rankMove(ws.audits, 'month')?.label);
      const ctx = (await loadCopilotContext(ws.business.id))!;
      expect(ctx.rank?.label).toBe(s.label);
      expect(contextToText(ctx)).toContain(s.methodLabel);
    }
  });
  it('« Nouveau » : un seul vrai entrant, en bas du classement', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { auditStats, newEntrants } = await import('@/lib/digest/stats');
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const ws = buildDemoWorkspace(seg);
      const n = newEntrants(ws.audits);
      expect(n.length).toBeLessThanOrEqual(2);
      const rows = auditStats(ws.audits.at(-1)!).rows;
      for (const name of n) expect(rows.findIndex((r) => r.name === name)).toBeGreaterThanOrEqual(rows.length - 3);
    }
  });
  it('phrase de la semaine : l’erreur IA passe en premier, avec la tâche de correction', async () => {
    const { buildWeeklyDigest } = await import('@/lib/digest');
    const d = await buildWeeklyDigest('demo');
    expect(d.headline).toMatch(/^Gemini donne de mauvais horaires pour Plomberie Martin/);
    expect(d.headlineSub).toMatch(/la bonne information est/);
    expect(d.secondLine).toMatch(/vous cite dans \d+ questions? sur \d+/);
    expect(d.fixTask?.minutes).toBeGreaterThan(0);
    const e = await buildWeeklyDigest('demo-ecom');
    expect(e.headline).toMatch(/se trompe sur la livraison de Maison Sora/);
  });
});

describe('données démo crédibles', () => {
  it('Maison Sora à Lyon partout ; concurrents PME et e-commerce fictifs', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { demoBusiness, demoFacts, demoAudits } = await import('@/components/app/demo-data');
    const ecom = buildDemoWorkspace('ecommerce');
    expect(ecom.business.city).toBe('Lyon');
    expect(ecom.facts.facts.adresse).toMatch(/69001 Lyon/);
    const fb = JSON.stringify([demoBusiness('ecommerce'), demoFacts('ecommerce'), demoAudits('ecommerce').at(-1)?.perception]);
    expect(fb).not.toMatch(/Nantes|nantais/);
    expect(demoFacts('ecommerce').facts.adresse).toBe(ecom.facts.facts.adresse);
    const real = /PayFit|Silae|Cegid|Lucca|Lamazuna|Respire|Cut by Fred|Oya\b/;
    for (const seg of ['pme', 'ecommerce'] as const) {
      const a = buildDemoWorkspace(seg).audits.at(-1)!;
      expect(JSON.stringify([a.competitors, a.gaps, a.input])).not.toMatch(real);
    }
  });
  it('Plomberie Martin présente sur Google (fiche existante)', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const a = buildDemoWorkspace('local').audits.at(-1)!;
    expect(a.sources?.domains.find((d) => d.domain === 'google.com')?.clientPresence).toBe('present');
  });
  it('trafic e-commerce cohérent avec un 10ᵉ rang, et CA attribué aux IA', async () => {
    const { getAiTraffic } = await import('@/lib/tracking');
    const t = await getAiTraffic('demo-ecom', 30);
    expect(t.totals.aiVisits).toBeLessThan(400);
    expect(t.commerce?.orders).toBe(t.totals.conversions);
    expect(t.commerce!.revenueEur).toBeGreaterThan(0);
    expect(t.commerce!.products.reduce((s, p) => s + p.orders, 0)).toBe(t.commerce!.orders);
  });
});

describe('livrables par parcours', () => {
  it('PME : pas de fiche Google ni de QR, comparatif rédigé ; e-commerce : avis après livraison, fiches Product sans valeur inventée', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { generateTasks } = await import('@/lib/execution');
    const pme = buildDemoWorkspace('pme');
    const tp = generateTasks(pme.audits.at(-1)!, pme.facts, { businessId: 'demo-pme', segment: 'pme' });
    expect(tp.some((t) => t.kind === 'gbp_profile')).toBe(false);
    const rr = tp.find((t) => t.kind === 'review_request')!;
    expect(JSON.stringify(rr)).not.toMatch(/QR|Google|Merci d’avoir fait appel/);
    const cmp = tp.find((t) => t.kind === 'content')!;
    expect(cmp.deliverable![0].content).toMatch(/## Pour qui choisir Paysia/);
    const fix = tp.find((t) => t.kind === 'fact_fix')!;
    expect(fix.steps![0]).not.toMatch(/fiche Google/);
    for (const t of tp) for (const d of t.deliverable ?? []) if (/longue/.test(d.label ?? '')) expect(d.content).not.toBe(t.deliverable!.find((x) => /moyen/.test(x.label ?? ''))?.content);
    const ecom = buildDemoWorkspace('ecommerce');
    const te = generateTasks(ecom.audits.at(-1)!, ecom.facts, { businessId: 'demo-ecom', segment: 'ecommerce' });
    expect(JSON.stringify(te.find((t) => t.kind === 'review_request'))).toMatch(/7 jours|J\+7/);
    const pf = te.filter((t) => t.kind === 'product_feed' && t.deliverable?.some((d) => d.type === 'jsonld'));
    expect(pf.length).toBeGreaterThanOrEqual(2);
    for (const t of pf) expect(JSON.stringify(t.deliverable)).not.toMatch(/\[(prix|SKU|URL de la fiche|bénéfice)\]/);
    const all = JSON.stringify(te);
    expect(all).not.toMatch(/bien choisir shampoing|Ce que comprend shampoing|Adresse de Maison Sora : Atelier/);
    expect(JSON.stringify(tp)).not.toMatch(/inclus depuis 2018/);
  });
  it('FAQ à coller : apostrophe lisible, pas de &#39;', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { generateTasks } = await import('@/lib/execution');
    const pme = buildDemoWorkspace('pme');
    const faq = generateTasks(pme.audits.at(-1)!, pme.facts, { businessId: 'demo-pme', segment: 'pme' }).find((t) => t.kind === 'faq_page')!;
    const html = faq.deliverable!.find((d) => d.type === 'html')!.content;
    expect(html).not.toContain('&#39;');
    expect(html).toMatch(/Qu'est-ce que Paysia/);
  });
  it('titres générés : espace insécable avant les deux-points', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const { generateTasks } = await import('@/lib/execution');
    const ws = buildDemoWorkspace('local');
    const fix = generateTasks(ws.audits.at(-1)!, ws.facts, { businessId: 'demo', segment: 'local' }).find((t) => t.kind === 'fact_fix')!;
    expect(fix.title).toContain('Corriger :');
  });
});

describe('/api/t sans RATE_LIMIT_SALT', () => {
  it('ne répond jamais 500', async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const route = await import('@/app/api/t/route');
      const res = await route.POST(new Request('http://localhost/api/t', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-forwarded-for': '10.1.1.1' }, body: JSON.stringify({ s: 'demo', p: '/', r: 'chatgpt.com' }) }));
      expect(res.status).toBeLessThan(500);
    } finally {
      env.NODE_ENV = prev;
    }
  });
});
