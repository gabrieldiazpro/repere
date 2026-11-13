/**
 * PerfProvider : PageSpeed Insights v5 (labo Lighthouse + terrain CrUX intégré) et CrUX API (terrain par URL puis par
 * origine quand PSI n'en donne pas). Gratuit, clé Google Cloud `PAGESPEED_API_KEY` (CrUX : `CRUX_API_KEY`, défaut la
 * même clé). Sans clé : « non configuré », aucune mesure inventée.
 */
import { SeoDataError, endpoints, env, requestJson } from './http';
import type { Device, PerfData, PerfDevice, PerfField, PerfLab, Rating } from './types';

export const PERF_THRESHOLDS = {
  lcpMs: [2500, 4000],
  inpMs: [200, 500],
  cls: [0.1, 0.25],
  fcpMs: [1800, 3000],
  ttfbMs: [800, 1800],
} as const;

export function rate(metric: keyof typeof PERF_THRESHOLDS, v: number | null | undefined): Rating | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const [good, poor] = PERF_THRESHOLDS[metric];
  return v <= good ? 'good' : v <= poor ? 'needs-improvement' : 'poor';
}

export function fieldFrom(scope: PerfField['scope'], v: Omit<PerfField, 'ratings' | 'passesCwv' | 'scope' | 'source'>, source: PerfField['source'], period?: PerfField['period']): PerfField {
  const ratings = { lcp: rate('lcpMs', v.lcpMs), inp: rate('inpMs', v.inpMs), cls: rate('cls', v.cls) };
  const all = [ratings.lcp, ratings.inp, ratings.cls];
  return { scope, ...v, ratings, passesCwv: all.some((r) => r === null) ? (all.some((r) => r === 'poor' || r === 'needs-improvement') ? false : null) : all.every((r) => r === 'good'), period: period ?? null, source };
}

export interface PerfProvider {
  readonly name: string;
  readonly demo: boolean;
  measure(url: string, opts?: { devices?: Device[]; signal?: AbortSignal }): Promise<PerfData>;
}

// ---------------------------------------------------------------------------
// PageSpeed Insights
// ---------------------------------------------------------------------------

interface PsiMetric { percentile?: number; category?: string }
interface PsiLoading { metrics?: Record<string, PsiMetric>; origin_fallback?: boolean; id?: string }
interface PsiAudit { title?: string; numericValue?: number; score?: number | null; details?: { type?: string; overallSavingsMs?: number } }
export interface PsiResponse {
  id?: string;
  loadingExperience?: PsiLoading;
  originLoadingExperience?: PsiLoading;
  lighthouseResult?: { finalUrl?: string; categories?: { performance?: { score?: number | null } }; audits?: Record<string, PsiAudit> };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Terrain PSI (CLS en centièmes dans PSI : 5 → 0,05). */
export function psiField(le: PsiLoading | undefined, scope: PerfField['scope']): PerfField | null {
  const m = le?.metrics;
  if (!m || Object.keys(m).length === 0) return null;
  const clsRaw = num(m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile);
  return fieldFrom(
    le?.origin_fallback ? 'origin' : scope,
    {
      lcpMs: num(m.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
      inpMs: num(m.INTERACTION_TO_NEXT_PAINT?.percentile),
      cls: clsRaw === null ? null : Math.round(clsRaw) / 100,
      fcpMs: num(m.FIRST_CONTENTFUL_PAINT_MS?.percentile),
      ttfbMs: num(m.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile),
    },
    'pagespeed-insights',
  );
}

export function psiLab(r: PsiResponse): PerfLab | null {
  const lh = r.lighthouseResult;
  if (!lh) return null;
  const a = lh.audits ?? {};
  const score = num(lh.categories?.performance?.score);
  const opportunities = Object.entries(a)
    .filter(([, v]) => v.details?.type === 'opportunity' && (v.score ?? 1) < 0.9)
    .map(([id, v]) => ({ id, title: String(v.title ?? id), savingsMs: num(v.details?.overallSavingsMs) }))
    .sort((x, y) => (y.savingsMs ?? 0) - (x.savingsMs ?? 0))
    .slice(0, 10);
  const round = (v: number | null) => (v === null ? null : Math.round(v));
  const cls = num(a['cumulative-layout-shift']?.numericValue);
  return {
    performance: score === null ? null : Math.round(score * 100),
    lcpMs: round(num(a['largest-contentful-paint']?.numericValue)),
    cls: cls === null ? null : Math.round(cls * 1000) / 1000,
    tbtMs: round(num(a['total-blocking-time']?.numericValue)),
    fcpMs: round(num(a['first-contentful-paint']?.numericValue)),
    speedIndexMs: round(num(a['speed-index']?.numericValue)),
    opportunities,
  };
}

// ---------------------------------------------------------------------------
// CrUX API
// ---------------------------------------------------------------------------

interface CruxDate { year: number; month: number; day: number }
export interface CruxResponse {
  record?: {
    key?: { url?: string; origin?: string; formFactor?: string };
    metrics?: Record<string, { percentiles?: { p75?: number | string } }>;
    collectionPeriod?: { firstDate?: CruxDate; lastDate?: CruxDate };
  };
}

const ymd = (d?: CruxDate) => (d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : '');

export function cruxField(r: CruxResponse, scope: PerfField['scope']): PerfField | null {
  const m = r.record?.metrics;
  if (!m) return null;
  const p = (k: string) => num(m[k]?.percentiles?.p75);
  const cp = r.record?.collectionPeriod;
  return fieldFrom(
    scope,
    {
      lcpMs: p('largest_contentful_paint'),
      inpMs: p('interaction_to_next_paint'),
      cls: p('cumulative_layout_shift'), // chaîne « 0.05 » dans CrUX
      fcpMs: p('first_contentful_paint'),
      ttfbMs: p('experimental_time_to_first_byte'),
    },
    'crux',
    cp?.firstDate && cp.lastDate ? { from: ymd(cp.firstDate), to: ymd(cp.lastDate) } : null,
  );
}

// ---------------------------------------------------------------------------
// Fournisseur réel
// ---------------------------------------------------------------------------

export const perfKeys = () => ({ psi: env('PAGESPEED_API_KEY'), crux: env('CRUX_API_KEY') || env('PAGESPEED_API_KEY') });
export const perfConfigured = () => Boolean(perfKeys().psi || perfKeys().crux);

export class GooglePerfProvider implements PerfProvider {
  readonly name = 'pagespeed-insights';
  readonly demo = false;
  constructor(private keys: { psi: string; crux: string } = perfKeys()) {
    if (!keys.psi && !keys.crux) throw new SeoDataError('not_configured', 'PageSpeed Insights non configuré : ajoutez PAGESPEED_API_KEY.');
  }

  async psi(url: string, device: Device, signal?: AbortSignal): Promise<PsiResponse> {
    const q = new URLSearchParams({ url, strategy: device === 'mobile' ? 'mobile' : 'desktop', category: 'performance', locale: 'fr' });
    if (this.keys.psi) q.set('key', this.keys.psi);
    // Lighthouse côté Google : jusqu'à ~30–60 s pour une page lourde.
    return requestJson<PsiResponse>(`${endpoints().pagespeed}?${q}`, { provider: 'PageSpeed Insights', timeoutMs: 60_000, signal });
  }

  /** null si CrUX n'a pas de données (404 « chrome ux report data not found »). */
  async crux(target: { url?: string; origin?: string }, device: Device, signal?: AbortSignal): Promise<CruxResponse | null> {
    if (!this.keys.crux) return null;
    try {
      return await requestJson<CruxResponse>(`${endpoints().crux}?key=${encodeURIComponent(this.keys.crux)}`, {
        provider: 'CrUX',
        json: { ...target, formFactor: device === 'mobile' ? 'PHONE' : 'DESKTOP' },
        signal,
      });
    } catch (e) {
      if (e instanceof SeoDataError && e.code === 'not_found') return null;
      throw e;
    }
  }

  async measure(url: string, opts: { devices?: Device[]; signal?: AbortSignal } = {}): Promise<PerfData> {
    const devices = opts.devices?.length ? opts.devices : (['mobile', 'desktop'] as Device[]);
    const out: PerfData = { url, fetchedAt: new Date().toISOString(), demo: false, devices: {}, errors: [], sources: [] };
    const sources = new Set<string>();
    await Promise.all(
      devices.map(async (device) => {
        const d: PerfDevice = { device, field: null, lab: null };
        try {
          if (this.keys.psi) {
            const r = await this.psi(url, device, opts.signal);
            d.lab = psiLab(r);
            d.field = psiField(r.loadingExperience, 'url') ?? psiField(r.originLoadingExperience, 'origin');
            sources.add('pagespeed-insights');
          }
          if (!d.field && this.keys.crux) {
            const byUrl = await this.crux({ url }, device, opts.signal);
            d.field = byUrl ? cruxField(byUrl, 'url') : null;
            if (!d.field) {
              const origin = new URL(url).origin;
              const byOrigin = await this.crux({ origin }, device, opts.signal);
              d.field = byOrigin ? cruxField(byOrigin, 'origin') : null;
            }
            if (d.field) sources.add('crux');
          }
          out.devices[device] = d;
        } catch (e) {
          out.errors.push({ device, message: e instanceof Error ? e.message : String(e) });
          if (d.lab || d.field) out.devices[device] = d;
        }
      }),
    );
    out.sources = [...sources];
    if (Object.keys(out.devices).length === 0 && out.errors.length) {
      const first = out.errors[0].message;
      throw new SeoDataError(/quota|429/i.test(first) ? 'quota' : 'upstream', first);
    }
    return out;
  }
}

/**
 * Adaptateur pour ANALYSE-60S (`AnalysisModules.pagespeed`) : mobile seulement, page d'accueil.
 * null = non configuré (l'analyse le dit sans inventer).
 */
export async function pagespeedSummary(url: string, signal?: AbortSignal): Promise<{
  strategy: 'mobile'; url: string; performance: number | null; lcpMs?: number | null; cls?: number | null; inpMs?: number | null; field?: boolean; source: string;
} | null> {
  if (!perfConfigured()) return null;
  const p = await new GooglePerfProvider().measure(url, { devices: ['mobile'], signal });
  const m = p.devices.mobile;
  if (!m) return null;
  return {
    strategy: 'mobile',
    url,
    performance: m.lab?.performance ?? null,
    lcpMs: m.field?.lcpMs ?? m.lab?.lcpMs ?? null,
    cls: m.field?.cls ?? m.lab?.cls ?? null,
    inpMs: m.field?.inpMs ?? null,
    field: Boolean(m.field),
    source: m.field?.source === 'crux' ? 'PageSpeed Insights + CrUX' : 'PageSpeed Insights',
  };
}
