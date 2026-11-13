import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listDocs } from '../../../src/lib/store';
import { COLL } from '../../../src/lib/barometre/storage';
import { isolateStore } from '../../../src/lib/barometre/__tests__/helpers';
import { main, parseArgs } from '../run';

beforeEach(() => {
  isolateStore();
  for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'BAROMETRE_PROVIDERS']) vi.stubEnv(k, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('scripts/barometre/run.ts', () => {
  it('lit les options', () => {
    const a = parseArgs(['--demo', '--slug', 'plombiers-lyon,crm-pour-pme', '--period', '2026-10', '--budget', '80']);
    expect(a).toMatchObject({ demo: true, slugs: ['plombiers-lyon', 'crm-pour-pme'], period: '2026-10', budgetEur: 80, plan: false });
    expect(() => parseArgs(['--period', '2026-13'])).toThrow();
  });

  it('--plan : coût estimé, aucun appel', async () => {
    const out: string[] = [];
    expect(await main(['--plan', '--budget', '150'], (s) => out.push(s))).toBe(0);
    expect(out[0]).toMatch(/50 baromètres, 7200 appels, 9\d,\d\d € estimés/);
    expect(await listDocs(COLL.raw)).toHaveLength(0);
  });

  it('--demo : pipeline simulé de bout en bout, rien dans les éditions publiques', async () => {
    const out: string[] = [];
    expect(await main(['--demo', '--slug', 'crm-pour-pme', '--period', '2026-11'], (s) => out.push(s))).toBe(0);
    expect(out.join('\n')).toContain('[SIMULATION, jamais publiée]');
    expect(out.join('\n')).toContain('crm-pour-pme : collected');
    expect(await listDocs(COLL.editions)).toHaveLength(0);
    expect(await listDocs(COLL.demo)).toHaveLength(1);
  });

  it('mesure réelle sans clé : refus explicite', async () => {
    await expect(main(['--slug', 'plombiers-lyon', '--period', '2026-11'], () => undefined)).rejects.toThrow(/aucune IA configurée/);
  });

  it('slug inconnu et retrait', async () => {
    expect(await main(['--slug', 'inconnu'], () => undefined)).toBe(1);
    const out: string[] = [];
    expect(await main(['--withdraw', 'Plomberie Exemple', '--slug', 'plombiers-lyon'], (s) => out.push(s))).toBe(0);
    expect(out[0]).toContain('Retrait enregistré');
    expect(await listDocs(COLL.withdrawals)).toHaveLength(1);
  });
});
