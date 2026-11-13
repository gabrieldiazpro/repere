/**
 * Gestionnaires par défaut (mode démo, sans clé) : audit.run (sauvegarde, idempotence par marqueur, tasks.generate
 * enchaîné), audit.scheduled (fréquence de l'offre, dédoublonnage par période), comptes démo en lecture seule,
 * délégations tolérantes.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-jobs-h-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'RESEND_API_KEY']) {
  delete process.env[k];
}
process.env.PROMPTS_SITE_FETCH = 'off';

const { createBusiness, saveAudit, listAuditsForBusiness } = await import('@/lib/db');
const { createMockAudit } = await import('@/lib/engine');
const jobs = await import('@/lib/jobs');
const { handleAuditRun, handleAuditScheduled, installBuiltinHandlers, auditInputFor, pickFn, delegateHandler } = await import('@/lib/jobs/handlers');

beforeEach(() => {
  jobs.resetJobsForTests();
  installBuiltinHandlers();
});

async function newBusiness(name: string, plan: string, segment: 'local' | 'pme' = 'local', lastAuditDaysAgo: number | null = 40) {
  const input = { businessName: name, trade: 'serrurier', city: 'Paris', district: '11e', segment };
  const b = await createBusiness({ name, trade: input.trade, city: input.city, district: input.district, plan: plan as never, segment, contactEmail: 'contact@exemple.fr' });
  if (lastAuditDaysAgo !== null) {
    const old = { ...createMockAudit(input, `${name}-0`), createdAt: new Date(Date.now() - lastAuditDaysAgo * 86_400_000).toISOString() };
    await saveAudit(old, { businessId: b.id, trigger: 'manual' });
  }
  return b;
}

describe('audit.run', () => {
  it('mesure, sauvegarde, enchaîne tasks.generate ; dédoublonné par clé', async () => {
    const b = await newBusiness('Serrurerie Tâches', 'essentiel', 'local', null);
    const { id } = await jobs.enqueue('audit.run', { businessId: b.id, trigger: 'onboarding' }, { businessId: b.id, dedupeKey: `audit.run:first:${b.id}` });
    const job = await jobs.getJob(id);
    expect(job?.status).toBe('done');
    expect(job?.result).toMatchObject({ auditId: expect.any(String), score: expect.any(Number) });
    expect(await listAuditsForBusiness(b.id)).toHaveLength(1);
    const tasks = (await jobs.listJobsForBusiness(b.id)).filter((j) => j.type === 'tasks.generate');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('done');
    await jobs.enqueue('audit.run', { businessId: b.id }, { businessId: b.id, dedupeKey: `audit.run:first:${b.id}` });
    expect(await listAuditsForBusiness(b.id)).toHaveLength(1);
  });

  it('rejouée avec le même identifiant de tâche : pas de second audit (marqueur)', async () => {
    const b = await newBusiness('Serrurerie Rejouée', 'essentiel', 'local', null);
    const ctx = { id: `test-${b.id}`, type: 'audit.run', attempt: 1, maxAttempts: 5, signal: new AbortController().signal };
    const r1 = await handleAuditRun({ businessId: b.id, _job: ctx });
    const r2 = await handleAuditRun({ businessId: b.id, _job: { ...ctx, attempt: 2 } });
    expect(r2.auditId).toBe(r1.auditId);
    expect(await listAuditsForBusiness(b.id)).toHaveLength(1);
  });

  it('planifiée : alertes et e-mail mensuel (corps de l’ancien cron)', async () => {
    const b = await newBusiness('Serrurerie Planifiée', 'essentiel');
    const r = await handleAuditRun({ businessId: b.id, trigger: 'scheduled' });
    // Aucune mesure comparable (même jour, FIX-MESURES) : « première mesure de référence », aucun écart annoncé.
    expect(r).toMatchObject({ variant: expect.stringMatching(/up|down|stable|first/), email: expect.any(String) });
    expect(typeof r.detected).toBe('number');
  });

  it('compte démo : jamais écrit ; commerce inconnu : abandon définitif', async () => {
    expect(await handleAuditRun({ businessId: 'demo' })).toMatchObject({ skipped: expect.stringContaining('démonstration') });
    await expect(handleAuditRun({ businessId: '00000000-0000-4000-8000-000000000000' })).rejects.toBeInstanceOf(jobs.PermanentJobError);
    await expect(handleAuditRun({})).rejects.toBeInstanceOf(jobs.PermanentJobError);
  });

  it('entrée d’audit : garde les champs PME du dernier audit, la fiche fait foi, jamais l’e-mail', () => {
    const input = auditInputFor(
      { id: 'x', name: 'Paysia', trade: 'logiciel', city: 'Lyon', segment: 'pme', plan: 'essentiel', lastScore: null, createdAt: '', ownerId: null, isActive: true, alertThreshold: 5 },
      { input: { businessName: 'Ancien nom', category: 'logiciel de paie', email: 'x@y.fr', segment: 'pme' } },
    );
    expect(input).toMatchObject({ businessName: 'Paysia', category: 'logiciel de paie', segment: 'pme' });
    expect(input.email).toBeUndefined();
  });
});

describe('audit.scheduled', () => {
  it('enfile selon la fréquence de l’offre, une fois par période', async () => {
    const monthlyDue = await newBusiness('Local Mensuel Dû', 'essentiel', 'local', 40);
    const monthlyFresh = await newBusiness('Local Mensuel Récent', 'essentiel', 'local', 10);
    const weeklyDue = await newBusiness('PME Hebdo Due', 'essentiel', 'pme', 10);
    const seen: string[] = [];
    jobs.registerHandler('audit.run', async (p) => void seen.push(String(p.businessId)));
    const r = await handleAuditScheduled({});
    expect(seen).toContain(monthlyDue.id);
    expect(seen).toContain(weeklyDue.id);
    expect(seen).not.toContain(monthlyFresh.id);
    expect(r.queued).toBe((r.jobIds as string[]).length);
    // Second balayage dans la même période : aucune nouvelle exécution.
    const before = seen.length;
    await handleAuditScheduled({});
    expect(seen.length).toBe(before);
  });
});

describe('délégations tolérantes', () => {
  it('pickFn trouve un export par nom ; module sans export → erreur claire (reprise)', async () => {
    expect(pickFn({ a: 1, b: async () => 2 }, 'x', 'b')).toBeTypeOf('function');
    expect(pickFn(null, 'b')).toBeNull();
    const h = delegateHandler('siteaudit.run');
    await expect(h({})).rejects.toThrow();
  });
});
