/**
 * Passe mensuelle des baromètres Repéré.
 *
 *   npx vite-node --config vitest.config.ts scripts/barometre/run.ts [options]
 *
 * Options :
 *   --plan                 affiche le plan et le coût estimé, sans aucun appel
 *   --slug a,b             seulement ces baromètres (sinon tout le catalogue, par priorité)
 *   --period AAAA-MM       mois mesuré (défaut : mois courant UTC) ; relancer reprend là où la collecte s'est arrêtée
 *   --budget 150           budget du mois en euros (défaut : BAROMETRE_BUDGET_EUR, sinon 120)
 *   --concurrency 4        appels simultanés par baromètre (1 à 8)
 *   --demo                 fournisseur SIMULÉ (aucun réseau, aucun coût) : éditions rangées à part, jamais publiées
 *   --withdraw "Nom"       enregistre une demande de retrait (avec --slug : seulement ces baromètres)
 *
 * Mesure réelle : il faut les clés des IA (OPENAI_API_KEY, PERPLEXITY_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY,
 * MISTRAL_API_KEY en option) et, en production, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (table `documents`).
 * Sans clé, le script refuse la mesure réelle (il ne retombe jamais sur le simulé).
 */
import { CATALOG, validateCatalog } from '../../src/lib/barometre/catalog';
import { estimateMonthly, monthlyBudget, planWithinBudget } from '../../src/lib/barometre/cost';
import { runMonthly } from '../../src/lib/barometre/pipeline';
import { addWithdrawal, currentPeriod, loadBudget } from '../../src/lib/barometre/storage';

export interface CliArgs {
  plan: boolean;
  demo: boolean;
  slugs: string[];
  period: string;
  budgetEur?: number;
  concurrency?: number;
  withdraw?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const val = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
  };
  const period = val('period') ?? currentPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error(`--period invalide : ${period} (attendu AAAA-MM)`);
  const budget = val('budget');
  const conc = val('concurrency');
  return {
    plan: argv.includes('--plan'),
    demo: argv.includes('--demo'),
    slugs: (val('slug') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    period,
    ...(budget != null ? { budgetEur: Number(budget) } : {}),
    ...(conc != null ? { concurrency: Number(conc) } : {}),
    ...(val('withdraw') ? { withdraw: val('withdraw') } : {}),
  };
}

const eur = (x: number) => `${x.toFixed(2).replace('.', ',')} €`;

export async function main(argv: string[], out: (s: string) => void = (s) => console.log(s)): Promise<number> {
  const args = parseArgs(argv);
  const errs = validateCatalog();
  if (errs.length) {
    out(`Catalogue invalide :\n- ${errs.join('\n- ')}`);
    return 1;
  }
  const unknown = args.slugs.filter((s) => !CATALOG.some((d) => d.slug === s));
  if (unknown.length) {
    out(`Baromètre(s) inconnu(s) : ${unknown.join(', ')}`);
    return 1;
  }
  if (args.withdraw) {
    const w = await addWithdrawal(args.withdraw, args.slugs);
    out(`Retrait enregistré : « ${w.name} » (${w.slugs.length ? w.slugs.join(', ') : 'tous les baromètres'}).`);
    return 0;
  }
  const defs = args.slugs.length ? CATALOG.filter((d) => args.slugs.includes(d.slug)) : CATALOG;
  const limit = args.budgetEur ?? monthlyBudget();
  if (args.plan) {
    const ledger = await loadBudget(args.period, limit);
    const all = estimateMonthly(defs);
    const plan = planWithinBudget(defs, ledger.remaining());
    out(`Plan ${args.period} : ${all.count} baromètres, ${all.calls} appels, ${eur(all.costEur)} estimés.`);
    out(`Budget ${eur(limit)}, déjà dépensé ${eur(ledger.spentEur)} : ${plan.selected.length} retenus, ${plan.skipped.length} reportés.`);
    for (const s of plan.selected) out(`  ${s.slug} : ${s.questions} questions × ${s.providers.length} IA × ${s.runs} passages = ${s.calls} appels, ${eur(s.costEur)}`);
    if (plan.skipped.length) out(`  Reportés (budget) : ${plan.skipped.map((s) => s.slug).join(', ')}`);
    return 0;
  }
  const res = await runMonthly({ demo: args.demo, slugs: args.slugs, period: args.period, budgetEur: limit, concurrency: args.concurrency, log: out });
  out(`${args.demo ? '[SIMULATION, jamais publiée] ' : ''}${res.period} : ${res.results.length} baromètres traités, ${eur(res.spentEur)} dépensés sur ${eur(res.limitEur)}.`);
  for (const r of res.results) out(`  ${r.slug} : ${r.status}, ${r.calls} appels, ${r.publishable ? 'publiable' : 'non publié'}`);
  if (res.skippedForBudget.length) out(`  Reportés (budget) : ${res.skippedForBudget.join(', ')}`);
  return res.results.every((r) => r.status === 'collected') ? 0 : 2;
}

const direct = !process.env.VITEST && process.argv.some((a) => /scripts[\\/]barometre[\\/]run\.ts$/.test(a));
if (direct) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
