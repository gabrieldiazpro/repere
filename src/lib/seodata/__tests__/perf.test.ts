import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setSeoDataEndpoints, SeoDataError } from '../http';
import { GooglePerfProvider, pagespeedSummary, perfConfigured, rate } from '../perf';
import { startFakeServer, type FakeServer } from './fake-server';

/** Réponse PSI v5 abrégée, champs d'après la documentation (loadingExperience / lighthouseResult). */
const psi = (strategy: string, withField: boolean) => ({
  id: 'https://exemple.fr/',
  loadingExperience: withField
    ? {
        id: 'https://exemple.fr/',
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: strategy === 'mobile' ? 3100 : 1700, category: 'AVERAGE' },
          INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: 'FAST' },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: 'FAST' },
          FIRST_CONTENTFUL_PAINT_MS: { percentile: 1500 },
          EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 600 },
        },
        overall_category: 'AVERAGE',
      }
    : { id: 'https://exemple.fr/' },
  originLoadingExperience: { id: 'https://exemple.fr' },
  lighthouseResult: {
    finalUrl: 'https://exemple.fr/',
    categories: { performance: { score: strategy === 'mobile' ? 0.61 : 0.9 } },
    audits: {
      'largest-contentful-paint': { numericValue: 3456.7 },
      'cumulative-layout-shift': { numericValue: 0.0812 },
      'total-blocking-time': { numericValue: 310.2 },
      'first-contentful-paint': { numericValue: 1800 },
      'speed-index': { numericValue: 4100 },
      'render-blocking-resources': { title: 'Éliminer les ressources qui bloquent le rendu', score: 0.3, details: { type: 'opportunity', overallSavingsMs: 900 } },
      'uses-webp-images': { title: 'Images modernes', score: 1, details: { type: 'opportunity', overallSavingsMs: 0 } },
    },
  },
});

/** Réponse CrUX API (records:queryRecord) : p75 entier, CLS en chaîne. */
const crux = (scope: 'url' | 'origin') => ({
  record: {
    key: { formFactor: 'PHONE', [scope]: scope === 'url' ? 'https://exemple.fr/page' : 'https://exemple.fr' },
    metrics: {
      largest_contentful_paint: { percentiles: { p75: 2300 } },
      interaction_to_next_paint: { percentiles: { p75: 150 } },
      cumulative_layout_shift: { percentiles: { p75: '0.04' } },
      first_contentful_paint: { percentiles: { p75: 1200 } },
      experimental_time_to_first_byte: { percentiles: { p75: 500 } },
    },
    collectionPeriod: { firstDate: { year: 2026, month: 10, day: 14 }, lastDate: { year: 2026, month: 11, day: 10 } },
  },
});

let s: FakeServer;
beforeAll(async () => {
  s = await startFakeServer();
  setSeoDataEndpoints({ pagespeed: `${s.url}/psi`, crux: `${s.url}/crux` });
});
afterAll(async () => {
  setSeoDataEndpoints(null);
  await s.close();
});
beforeEach(() => {
  s.requests.length = 0;
  delete process.env.PAGESPEED_API_KEY;
  delete process.env.CRUX_API_KEY;
});

describe('PerfProvider (PageSpeed Insights + CrUX)', () => {
  it('seuils officiels des Signaux Web essentiels', () => {
    expect(rate('lcpMs', 2500)).toBe('good');
    expect(rate('lcpMs', 2501)).toBe('needs-improvement');
    expect(rate('inpMs', 501)).toBe('poor');
    expect(rate('cls', 0.1)).toBe('good');
    expect(rate('cls', null)).toBeNull();
  });

  it('non configuré sans clé : aucune mesure, adaptateur ANALYSE-60S → null', async () => {
    expect(perfConfigured()).toBe(false);
    expect(() => new GooglePerfProvider()).toThrow(SeoDataError);
    expect(await pagespeedSummary('https://exemple.fr/')).toBeNull();
    expect(s.requests).toHaveLength(0);
  });

  it('terrain PSI + labo, mobile et bureau, CLS PSI converti des centièmes', async () => {
    s.on('GET', '/psi', (r) => ({ json: psi(r.query.get('strategy')!, true) }));
    const p = await new GooglePerfProvider({ psi: 'cle-test', crux: '' }).measure('https://exemple.fr/');
    expect(s.requests.every((r) => r.query.get('key') === 'cle-test' && r.query.get('category') === 'performance')).toBe(true);
    const m = p.devices.mobile!;
    expect(m.field).toMatchObject({ scope: 'url', lcpMs: 3100, inpMs: 180, cls: 0.05, source: 'pagespeed-insights', passesCwv: false });
    expect(m.field!.ratings).toEqual({ lcp: 'needs-improvement', inp: 'good', cls: 'good' });
    expect(m.lab).toMatchObject({ performance: 61, lcpMs: 3457, cls: 0.081, tbtMs: 310 });
    expect(m.lab!.opportunities.map((o) => o.id)).toEqual(['render-blocking-resources']);
    expect(p.devices.desktop!.field!.passesCwv).toBe(true);
    expect(p.demo).toBe(false);
  });

  it('sans terrain PSI : CrUX par URL, puis par origine si la page manque de trafic (404)', async () => {
    s.on('GET', '/psi', (r) => ({ json: psi(r.query.get('strategy')!, false) }));
    s.on('POST', '/crux', (r) => {
      const b = r.json as { url?: string; origin?: string; formFactor: string };
      expect(['PHONE', 'DESKTOP']).toContain(b.formFactor);
      return b.url ? { status: 404, json: { error: { code: 404, message: 'chrome ux report data not found', status: 'NOT_FOUND' } } } : { json: crux('origin') };
    });
    const p = await new GooglePerfProvider({ psi: 'k', crux: 'k' }).measure('https://exemple.fr/page', { devices: ['mobile'] });
    expect(p.devices.mobile!.field).toMatchObject({ scope: 'origin', cls: 0.04, lcpMs: 2300, source: 'crux', passesCwv: true, period: { from: '2026-10-14', to: '2026-11-10' } });
    expect(p.sources.sort()).toEqual(['crux', 'pagespeed-insights']);
  });

  it('quota dépassé (429) : erreur « quota » reprenable', async () => {
    s.on('GET', '/psi', () => ({ status: 429, json: { error: { code: 429, message: 'Quota exceeded for quota metric', errors: [{ reason: 'rateLimitExceeded' }] } } }));
    const e = await new GooglePerfProvider({ psi: 'k', crux: '' }).measure('https://exemple.fr/', { devices: ['mobile'] }).catch((x) => x);
    expect(e).toBeInstanceOf(SeoDataError);
    expect(e.code).toBe('quota');
    expect(e.retryable).toBe(true);
  });

  it('adaptateur ANALYSE-60S : mobile, terrain prioritaire', async () => {
    process.env.PAGESPEED_API_KEY = 'k';
    s.on('GET', '/psi', (r) => ({ json: psi(r.query.get('strategy')!, true) }));
    s.on('POST', '/crux', () => ({ json: crux('url') }));
    const r = await pagespeedSummary('https://exemple.fr/');
    expect(r).toEqual({ strategy: 'mobile', url: 'https://exemple.fr/', performance: 61, lcpMs: 3100, cls: 0.05, inpMs: 180, field: true, source: 'PageSpeed Insights' });
    expect(s.requests.filter((x) => x.path === '/psi').map((x) => x.query.get('strategy'))).toEqual(['mobile']);
  });
});
