import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-plans-'));
for (const k of ['STRIPE_SECRET_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const plans = await import('@/lib/plans');
const { commitmentSessionParams } = await import('../commitment');
const route = await import('../route');

const json = JSON.parse(readFileSync(path.join(process.cwd(), '../docs/v2/07-plans-v2.json'), 'utf8')) as {
  id: string; segment: string; name: string; priceCents: number; interval: string; features: string[]; highlighted: boolean; cta: string;
}[];

describe('plans V2', () => {
  it('reprend exactement docs/v2/07-plans-v2.json', () => {
    expect(plans.V2_PLANS.map((p) => p.id)).toEqual(json.map((p) => p.id));
    for (const j of json) {
      const p = plans.getPlan(j.id as never);
      expect({ segment: p.segment, name: p.name, priceCents: p.priceCents, interval: p.interval, features: p.features, highlighted: p.highlighted, cta: p.cta }).toEqual({
        segment: j.segment, name: j.name, priceCents: j.priceCents, interval: j.interval, features: j.features, highlighted: j.highlighted, cta: j.cta,
      });
    }
  });
  it('Agence : liste d’attente (available:false), autres parcours disponibles', () => {
    expect(plans.V2_PLANS.filter((p) => p.segment === 'agence').every((p) => !p.available)).toBe(true);
    expect(plans.V2_PLANS.filter((p) => p.segment !== 'agence').every((p) => p.available)).toBe(true);
    expect(plans.plansForSegment('agence')).toEqual([]);
    expect(plans.plansForSegment('pme').map((p) => p.id)).toEqual(['pme_audit_free', 'pme_audit_deep', 'pme_essentiel_month', 'pme_essentiel_year', 'pme_accompagne_month']);
  });
  it('Accompagné = 3 mois d’engagement ; garantie 14 j seulement sur les audits ponctuels', () => {
    for (const p of plans.V2_PLANS) {
      expect(plans.commitmentMonths(p.id)).toBe(p.id.includes('_accompagne_') ? 3 : 0);
      if (p.guaranteeDays) expect(p.interval).toBe('one_time');
    }
  });
  it('alias V1 conservés et niveaux', () => {
    expect(plans.isPlanId('suivi_month')).toBe(true);
    expect(plans.getPlan('bundle_start').legacy).toBe(true);
    expect(plans.resolvePlanId('action_plan')).toBe('local_audit_deep');
    expect(plans.planTier('suivi_month')).toBe('suivi');
    expect(plans.planTier('pme_essentiel_year')).toBe('essentiel');
    expect(plans.planTier('ecom_accompagne_month')).toBe('accompagne');
    expect(plans.planTier('local_reseau_month')).toBe('reseau');
    expect(plans.planTier('pme_audit_deep')).toBe('free');
    expect(plans.includesActionPlan('local_audit_deep')).toBe(true);
  });
});

describe('checkout Accompagné', () => {
  it('metadata d’engagement et mention sur la page Stripe', () => {
    const p = commitmentSessionParams({ planId: 'pme_accompagne_month', email: 'a@b.fr' }, 'price_123', 'https://repere.test', new Date('2026-11-09T10:00:00Z'));
    expect(p.mode).toBe('subscription');
    expect(p.metadata).toMatchObject({ plan_id: 'pme_accompagne_month', commitment_months: '3', commitment_until: '2027-02-09' });
    expect(p.subscription_data?.metadata).toMatchObject({ commitment_months: '3' });
    const ct = p.custom_text as { submit?: { message: string }; terms_of_service_acceptance?: { message: string } };
    expect(ct.submit?.message).toMatch(/3 mois minimum/);
    expect(ct.terms_of_service_acceptance?.message).toMatch(/3 mois minimum/);
    expect(p.consent_collection?.terms_of_service).toBe('required');
    // Déclaration professionnelle (RACCORDS-FINAUX) : dans la case obligatoire, sous le bouton, et en metadata.
    expect(ct.terms_of_service_acceptance?.message).toMatch(/activité professionnelle/);
    expect(ct.submit?.message).toMatch(/réservé aux professionnels/);
    expect(p.metadata).toMatchObject({ pro_declaration: 'pro-v1-2026-11-13' });
    expect(p.metadata).not.toHaveProperty('pro_declared_at');
    const withBox = commitmentSessionParams({ planId: 'pme_accompagne_month', proDeclaredAt: '2026-11-13T10:00:00.000Z' }, 'price_123', 'https://repere.test', new Date('2026-11-09T10:00:00Z'));
    expect(withBox.subscription_data?.metadata).toMatchObject({ pro_declared_at: '2026-11-13T10:00:00.000Z' });
    expect(() => commitmentSessionParams({ planId: 'pme_essentiel_month' }, 'price_1', 'https://x')).toThrow();
  });
  it('POST /api/checkout sans Stripe : redirection démo, agence refusée', async () => {
    const post = (body: unknown) => route.POST(new Request('http://localhost/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.7.7' }, body: JSON.stringify(body) }));
    const ok = await post({ planId: 'local_accompagne_month' });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { url: string }).url).toBe('/merci?demo=1&plan=local_accompagne_month');
    const agency = await post({ planId: 'agency_month' });
    expect(agency.status).toBe(400);
    expect((await post({ planId: 'ecom_audit_free' })).status).toBe(400);
  });
});
