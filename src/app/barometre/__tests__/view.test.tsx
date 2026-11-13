import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CATALOG } from '@/lib/barometre/catalog';
import { runBarometre } from '@/lib/barometre/pipeline';
import { getPageData } from '@/lib/barometre/public';
import { BudgetLedger } from '@/lib/barometre/storage';
import type { BarometreDef } from '@/lib/barometre/types';
import { fakeRealProvider, isolateStore } from '@/lib/barometre/__tests__/helpers';
import { BarometreIndexView, BarometreView, DISCLAIMER } from '../_components/BarometreView';
import { barometrePageLd, datasetLd } from '../_components/ld';

const def: BarometreDef = { ...CATALOG.find((d) => d.slug === 'plombiers-lyon')!, providers: ['chatgpt', 'perplexity', 'gemini'] };
const NOW = () => '2026-11-13T10:00:00.000Z';

beforeEach(() => {
  isolateStore();
  for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY']) vi.stubEnv(k, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('pages /barometre', () => {
  it('index sans baromètre mesuré : « premiers baromètres en préparation » + méthode, aucun lien vers une page', () => {
    const html = renderToStaticMarkup(<BarometreIndexView items={[]} />);
    expect(html).toContain('Premiers baromètres en préparation');
    expect(html).toContain('Méthode');
    expect(html).not.toContain('href="/barometre/');
  });

  it('page en démo locale seulement : bandeau, aucune donnée structurée, 404 ailleurs', async () => {
    await runBarometre(def, { demo: true, period: '2026-11', budget: new BudgetLedger('t', 100), now: NOW });
    expect(await getPageData('plombiers-lyon', { NODE_ENV: 'production', BAROMETRE_DEMO_PREVIEW: '1' })).toBeNull();
    const data = (await getPageData('plombiers-lyon', { NODE_ENV: 'development', BAROMETRE_DEMO_PREVIEW: '1' }))!;
    expect(data.demo).toBe(true);
    const html = renderToStaticMarkup(<BarometreView edition={data.edition} demo history={[]} url="http://localhost/barometre/plombiers-lyon" contactEmail="contact@example.test" />);
    expect(html).toContain('Démonstration : réponses simulées');
    expect(html).toContain(DISCLAIMER);
    expect(html).toContain('Plombier Exemple Alpha');
    expect(html).not.toContain('href="https://plombier-exemple'); // pas de lien sortant en démo
    expect(datasetLd(data.edition)).toBeNull();
  });

  it('page réelle : classement avec marges, sources, méthode, CSV, partage, test, retrait ; JSON-LD Dataset', async () => {
    const res = await runBarometre(def, { period: '2026-11', budget: new BudgetLedger('t', 100), providerFactory: (id, d) => fakeRealProvider(id, d), extractor: null, now: NOW });
    const data = (await getPageData('plombiers-lyon', { NODE_ENV: 'production' }))!;
    expect(data.demo).toBe(false);
    const html = renderToStaticMarkup(<BarometreView edition={data.edition} demo={false} history={data.history} url="https://repere-ia.fr/barometre/plombiers-lyon" contactEmail="contact@example.test" />);
    expect(html).not.toContain('Démonstration');
    expect(html).toContain('Qui les IA recommandent : Plombiers à Lyon');
    expect(html).toContain('Taux de citation');
    expect(html).toMatch(/\d+ %.{0,120}\(\d+ % à \d+ %\)/);
    expect(html).toContain('Les sources que les IA citent le plus');
    expect(html).toContain('/barometre/plombiers-lyon/donnees.csv?periode=2026-11');
    expect(html).toContain('linkedin.com/sharing');
    expect(html).toContain('href="/audit"');
    expect(html).toContain('Demande de retrait ou de rectification');
    expect(html).toContain('mailto:contact@example.test');
    expect(html).toContain(DISCLAIMER);
    const ld = barometrePageLd(res.edition!) as unknown as { '@graph': { '@type': string; distribution?: unknown[] }[] };
    const ds = ld['@graph'].find((n) => n['@type'] === 'Dataset')!;
    expect(ds.distribution).toHaveLength(1);
    const idx = renderToStaticMarkup(
      <BarometreIndexView items={[{ slug: 'plombiers-lyon', title: 'Plombiers à Lyon', segment: 'local', period: '2026-11', measuredTo: NOW(), answersValid: 108, providers: ['chatgpt'], top: [{ name: 'X', rate: 0.5 }] }]} />,
    );
    expect(idx).toContain('href="/barometre/plombiers-lyon"');
    expect(idx).not.toContain('en préparation');
  });
});
