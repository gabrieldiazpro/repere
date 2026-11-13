/**
 * Seed de préproduction : crée un commerce de démonstration ÉTIQUETÉ (« [Démo] … ») avec 6 mesures simulées
 * (audits mock, `demo: true`), puis génère ses tâches via la file. Sert à vérifier une préproduction branchée
 * sur une vraie base (Supabase) sans client réel. Ne touche jamais aux comptes démo intégrés (`demo`, `demo-pme`,
 * `demo-ecom`, générés par le code).
 *
 *   npm run seed:demo -- [--segment local|pme|ecommerce] [--dry-run]
 *   (= vite-node --config vitest.config.ts scripts/ops/seed-demo.ts, pour résoudre l'alias @/)
 *
 * Refuse de tourner en production (VERCEL_ENV/APP_ENV=production) sauf `--force-production` : à ne jamais faire.
 */
import { createBusiness, saveAudit } from '@/lib/db';
import { createMockAudit } from '@/lib/engine';
import { enqueue, runWorker } from '@/lib/jobs';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, def: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 && args[i + 1] ? args[i + 1] : def;
};

const PRESETS = {
  local: { name: '[Démo] Boulangerie Exemple', trade: 'boulanger', city: 'Lyon', district: '3e', segment: 'local' as const },
  pme: { name: '[Démo] Cabinet Exemple', trade: 'cabinet comptable', city: 'Nantes', segment: 'pme' as const, category: 'expertise comptable' },
  ecommerce: { name: '[Démo] Boutique Exemple', trade: 'cosmétiques', city: 'Paris', segment: 'ecommerce' as const, productCategories: ['crème solaire bio'] },
};

async function main() {
  const production = process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production';
  if (production && !flag('force-production')) {
    console.error('Refusé : environnement de production. Le seed est réservé au développement et à la préproduction.');
    process.exit(1);
  }
  const segment = opt('segment', 'local') as keyof typeof PRESETS;
  const p = PRESETS[segment] ?? PRESETS.local;
  const input = { businessName: p.name, ...p };
  console.log(`Seed ${segment} : ${p.name} (${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Supabase' : 'store local .data/'})`);
  if (flag('dry-run')) {
    console.log('--dry-run : rien n’est écrit.');
    return;
  }
  const b = await createBusiness({
    name: p.name,
    trade: p.trade,
    city: p.city,
    district: 'district' in p ? p.district : undefined,
    segment: p.segment,
    plan: 'essentiel',
    auditInput: input,
  });
  const now = Date.now();
  for (let m = 5; m >= 0; m--) {
    const a = createMockAudit(input as Parameters<typeof createMockAudit>[0], `seed-${b.id}-${m}`);
    await saveAudit({ ...a, demo: true, createdAt: new Date(now - m * 30 * 86_400_000).toISOString() }, { businessId: b.id, trigger: 'manual' });
  }
  const { id } = await enqueue('tasks.generate', { businessId: b.id }, { businessId: b.id, dedupeKey: `seed:tasks:${b.id}` });
  const report = await runWorker({ budgetMs: 120_000 });
  console.log(`Commerce ${b.id} créé, 6 mesures simulées, tâche ${id} (${report.done} tâche(s) exécutée(s)).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
