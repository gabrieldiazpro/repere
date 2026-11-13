/**
 * FIX-MESURES : (1) tout écart de score annoncé (e-mail mensuel, rapport programmé, copilote, alertes) se calcule contre
 * la dernière mesure COMPARABLE (previousComparable : mêmes questions, ≥ 6 jours), sinon « première mesure de
 * référence » ; (2) grille thème × IA des comptes démo : les IA ne donnent pas toutes le même taux ; (3) audit
 * approfondi acheté seul : 1 mois d'Essentiel offert, rappel J-5, puis Découverte.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-fix-mesures-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'RESEND_API_KEY']) delete process.env[k];

const { buildDemoWorkspace } = await import('@/lib/demo-v2');
const { buildVoiceMatrix } = await import('@/lib/engine/analytics');
const { citationPlan } = await import('@/lib/engine/providers/mock-align');
const { previousComparable } = await import('@/lib/digest/stats');
const { renderScheduledReport } = await import('@/lib/notify/reports');
const { sendMonthlyAlertEmail } = await import('@/lib/email');
const { afterScheduledAudit } = await import('@/lib/jobs/handlers');
const db = await import('@/lib/db');
const ent = await import('@/lib/entitlements');

type A = ReturnType<typeof buildDemoWorkspace>['audits'][number];

/** Même audit, autres questions (audit gratuit d'un autre périmètre), daté `days` jours avant `ref`. */
function otherScope(ref: A, days: number, score: number): A {
  const at = new Date(Date.parse(ref.measuredAt ?? ref.createdAt) - days * 86_400_000).toISOString();
  return { ...ref, id: `${ref.id}-autre`, score, createdAt: at, measuredAt: at, queries: ref.queries.map((q, i) => ({ ...q, text: `Question sans rapport numéro ${i} ?` })) };
}

function captureEmails() {
  const out: string[] = [];
  const spy = vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    const s = String(args[0] ?? '');
    if (s.startsWith('[email')) out.push(s);
  });
  return { out, spy };
}

afterEach(() => vi.restoreAllMocks());

describe('1. Écart de score : seulement contre la dernière mesure comparable', () => {
  const ws = buildDemoWorkspace('pme', new Date('2026-11-13T00:00:00Z'));
  const last = ws.audits.at(-1)!;
  const prevMonth = ws.audits.at(-2)!;

  it('previousComparable : la mesure du mois précédent, jamais un audit d’un autre périmètre', () => {
    expect(previousComparable(ws.audits)?.id).toBe(prevMonth.id);
    expect(previousComparable([otherScope(last, 30, 10), last])).toBeNull();
    // Même questions mais 2 jours d'écart : pas comparable non plus.
    const close = { ...prevMonth, id: 'proche', createdAt: new Date(Date.parse(last.createdAt) - 2 * 86_400_000).toISOString(), measuredAt: new Date(Date.parse(last.createdAt) - 2 * 86_400_000).toISOString() };
    expect(previousComparable([close, last])).toBeNull();
  });

  it('e-mail mensuel sans mesure comparable : « mesure de référence », aucun écart', async () => {
    const { out } = captureEmails();
    const r = await sendMonthlyAlertEmail('client@exemple.fr', { business: { id: 'b', name: 'Paysia' }, current: last, previous: null });
    expect(r.variant).toBe('first');
    const mail = out.join('\n');
    expect(mail).toMatch(/mesure de référence/);
    expect(mail).not.toMatch(/points/);
    expect(mail).not.toMatch(/stable ce mois-ci/);
  });

  it('e-mail mensuel avec mesure comparable : écart annoncé', async () => {
    const { out } = captureEmails();
    const r = await sendMonthlyAlertEmail('client@exemple.fr', { business: { id: 'b', name: 'Paysia' }, current: last, previous: prevMonth });
    expect(r.variant).toBe('up');
    expect(out.join('\n')).toContain(`+${last.score - prevMonth.score} points`);
  });

  it('afterScheduledAudit : alerte « Première mesure de référence », ni écart ni palier', async () => {
    captureEmails();
    const b = await db.createBusiness({ name: 'Paysia test', trade: 'logiciel de paie', city: 'Paris', segment: 'pme', contactEmail: 'paie@exemple.fr' });
    const rec = (await db.getBusinessRecord(b.id))!;
    const r = await afterScheduledAudit(rec, null, last);
    expect(r).toMatchObject({ delta: null, variant: 'first' });
    const r2 = await afterScheduledAudit(rec, prevMonth, last);
    expect(r2).toMatchObject({ delta: last.score - prevMonth.score, variant: 'up' });
  });

  it('rapport programmé : pas d’écart contre un audit d’un autre périmètre', () => {
    const first = renderScheduledReport('Paysia', [otherScope(last, 30, 10), last], { frequency: 'monthly', to: 'a@exemple.fr' })!;
    expect(first.text).toMatch(/Première mesure de référence/);
    expect(first.text).not.toMatch(/En hausse|En baisse|Stable par rapport/);
    const ok = renderScheduledReport('Paysia', ws.audits, { frequency: 'monthly', to: 'a@exemple.fr' })!;
    expect(ok.text).toMatch(/depuis la mesure précédente|Stable par rapport/);
  });
});

describe('2. Grille thème × IA des comptes démo', () => {
  for (const seg of ['local', 'pme', 'ecommerce'] as const) {
    for (const now of ['2026-11-13T00:00:00Z', '2027-03-02T00:00:00Z']) {
      it(`${seg} (${now.slice(0, 7)}) : les IA diffèrent par thème`, () => {
        const ws = buildDemoWorkspace(seg, new Date(now));
        const a = ws.audits.at(-1)!;
        const v = buildVoiceMatrix(a);
        expect(v.providers.length).toBeGreaterThanOrEqual(3);
        let differing = 0;
        let identical = 0;
        v.cells.forEach((row) => {
          const rates = row.filter(Boolean).map((c) => c!.mentionRate);
          if (rates.length < 2) return;
          if (new Set(rates).size > 1) differing++;
          else if (rates.length >= 3) identical++;
        });
        expect(differing).toBeGreaterThanOrEqual(2);
        expect(identical).toBeLessThanOrEqual(2);
        // Grille stockée (lue par /app/concurrents) = grille recalculée.
        if (a.voice) expect(a.voice.cells.map((r) => r.map((c) => c?.mentionRate ?? null))).toEqual(v.cells.map((r) => r.map((c) => c?.mentionRate ?? null)));
      });
    }
    it(`${seg} : « cité » toujours dérivé du texte, Perplexity cite plus que Gemini`, () => {
      const ws = buildDemoWorkspace(seg, new Date('2026-11-13T00:00:00Z'));
      const a = ws.audits.at(-1)!;
      const name = a.input.businessName;
      for (const m of a.mentions) {
        const ans = a.answers.find((x) => x.provider === m.provider && x.queryId === m.queryId && x.run === m.run);
        if (m.mentioned) expect(ans?.text ?? '').toContain(name);
        else expect(ans?.text ?? '').not.toContain(name);
      }
      const v = buildVoiceMatrix(a);
      const by = Object.fromEntries(v.byProvider.map((p) => [p.provider, p.mentionRate]));
      expect(by.perplexity).toBeGreaterThan(by.gemini);
    });
  }

  it('citationPlan : déterministe et monotone (un mois de plus ne retire pas de citation)', () => {
    const qs = new Map([
      ['chatgpt', [{ id: 'q1', theme: 'Prix' }, { id: 'q2', theme: 'Comparatifs' }, { id: 'q3', theme: 'Proximité' }]],
      ['perplexity', [{ id: 'q1', theme: 'Prix' }, { id: 'q2', theme: 'Comparatifs' }, { id: 'q3', theme: 'Proximité' }]],
      ['gemini', [{ id: 'q1', theme: 'Prix' }, { id: 'q2', theme: 'Comparatifs' }, { id: 'q3', theme: 'Proximité' }]],
    ]);
    expect([...citationPlan('s', 0.4, qs)]).toEqual([...citationPlan('s', 0.4, qs)]);
    const lo = citationPlan('s', 0.3, qs);
    const hi = citationPlan('s', 0.7, qs);
    for (const k of lo) expect(hi.has(k)).toBe(true);
    expect(lo.has('perplexity|q2')).toBe(true);
  });
});

describe('3. Audit approfondi acheté seul : 1 mois d’Essentiel offert', () => {
  const t0 = new Date('2026-11-01T10:00:00Z');
  const day = (n: number) => new Date(t0.getTime() + n * 86_400_000);
  const make = (name: string, extra: Partial<Parameters<typeof db.createBusiness>[0]> = {}) =>
    db.createBusiness({ name, trade: 'logiciel de paie', city: 'Paris', segment: 'pme', contactEmail: `${name.toLowerCase().replace(/\W/g, '')}@exemple.fr`, ...extra });

  it('droits Essentiel 30 jours, rappel J-5 (une fois), puis Découverte sans perte', async () => {
    const { out } = captureEmails();
    const b = await make('Offre A');
    expect(ent.getEntitlements((await db.getBusinessRecord(b.id))!).tier).toBe('decouverte');
    const o = await ent.grantAuditOffer(b.id, 'pme_audit_deep', t0);
    expect(o).toMatchObject({ status: 'active', until: day(30).toISOString() });
    const during = ent.getEntitlements((await db.getBusinessRecord(b.id))!);
    expect(during).toMatchObject({ tier: 'essentiel', prompts: 50, execution: true });

    expect(await ent.sweepAuditOffers(day(20))).toMatchObject({ reminded: 0, ended: 0 });
    expect(await ent.sweepAuditOffers(day(25))).toMatchObject({ reminded: 1, ended: 0 });
    expect(out.join('\n')).toMatch(/Essentiel offert se termine/);
    expect(out.join('\n')).toMatch(/\/tarifs\?segment=pme/);
    expect(await ent.sweepAuditOffers(day(26))).toMatchObject({ reminded: 0, ended: 0 });

    expect(await ent.sweepAuditOffers(day(30))).toMatchObject({ ended: 1 });
    const after = (await db.getBusinessRecord(b.id))!;
    expect(ent.getEntitlements(after).tier).toBe('decouverte');
    expect(after.plan).toBe('free');
    expect(await ent.sweepAuditOffers(day(31))).toMatchObject({ reminded: 0, ended: 0, relayed: 0 });
  });

  it('idempotent : un événement rejoué ne prolonge ni ne réaccorde rien', async () => {
    const b = await make('Offre B');
    const o1 = await ent.grantAuditOffer(b.id, 'pme_audit_deep', t0);
    const o2 = await ent.grantAuditOffer(b.id, 'pme_audit_deep', day(3));
    expect(o2).toEqual(o1);
    expect(await ent.grantAuditOffer(b.id, 'pme_essentiel_month', t0)).toBeNull();
  });

  it('un abonnement payé pendant la période prend le relais sans être rétrogradé', async () => {
    const b = await make('Offre C');
    await ent.grantAuditOffer(b.id, 'pme_audit_deep', t0);
    // Ce que fait le webhook à la souscription (customer.subscription.created).
    await db.updateBusiness(b.id, { plan: 'essentiel', planId: 'pme_essentiel_month' });
    expect((await ent.sweepAuditOffers(day(31))).relayed).toBe(1);
    expect((await ent.getAuditOffer(b.id))?.status).toBe('relayed');
    const r = (await db.getBusinessRecord(b.id))!;
    expect(r).toMatchObject({ plan: 'essentiel', planId: 'pme_essentiel_month' });
    expect(ent.getEntitlements(r).tier).toBe('essentiel');
  });

  it('un client déjà Accompagné n’est jamais rétrogradé par l’achat d’un audit', async () => {
    const b = await make('Offre D', { plan: 'accompagne', planId: 'pme_accompagne_month' });
    const o = await ent.grantAuditOffer(b.id, 'pme_audit_deep', t0);
    expect(o?.status).toBe('skipped');
    await ent.sweepAuditOffers(day(31));
    expect(ent.getEntitlements((await db.getBusinessRecord(b.id))!).tier).toBe('accompagne');
  });

  it('parcours local (149 €) : Essentiel local', async () => {
    const b = await make('Offre E', { segment: 'local', trade: 'plombier' });
    await ent.grantAuditOffer(b.id, 'local_audit_deep', t0);
    expect(ent.getEntitlements((await db.getBusinessRecord(b.id))!)).toMatchObject({ tier: 'essentiel', prompts: 20 });
  });
});
