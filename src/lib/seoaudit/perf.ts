/**
 * Adaptateur : `PerfData` de SEO-DATA (src/lib/seodata/types.ts, une mesure PageSpeed + CrUX par URL)
 * → `PerfData` minimal de l'audit (src/lib/seoaudit/types.ts). Les deux formes sont acceptées par `auditSeo`.
 */
import type { PerfData as SeoDataPerf } from '@/lib/seodata/types';
import type { PerfData, PerfMetrics } from './types';

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function isSeoDataPerf(x: unknown): x is SeoDataPerf {
  return !!x && typeof x === 'object' && 'devices' in x && 'url' in x;
}

/** Une ou plusieurs mesures SEO-DATA (une par URL) → PerfData de l'audit. */
export function fromSeoDataPerf(input: SeoDataPerf | SeoDataPerf[]): PerfData {
  const list = Array.isArray(input) ? input : [input];
  const out: PerfData = { source: 'mixed', fetchedAt: list[0]?.fetchedAt ?? new Date().toISOString(), pages: [], demo: list.some((p) => p.demo) };
  for (const m of list) {
    for (const dev of ['mobile', 'desktop'] as const) {
      const d = m.devices[dev];
      if (!d) continue;
      const field: PerfMetrics | undefined = d.field ? { lcpMs: n(d.field.lcpMs), inpMs: n(d.field.inpMs), cls: n(d.field.cls), ttfbMs: n(d.field.ttfbMs), fcpMs: n(d.field.fcpMs) } : undefined;
      if (d.field?.scope === 'origin' && field) {
        out.origin = { ...(out.origin ?? {}), [dev]: field };
      }
      const lab = d.lab ? { lcpMs: n(d.lab.lcpMs), cls: n(d.lab.cls), tbtMs: n(d.lab.tbtMs), fcpMs: n(d.lab.fcpMs), performanceScore: n(d.lab.performance) } : undefined;
      out.pages!.push({ url: m.url, strategy: dev, ...(field && d.field?.scope === 'url' ? { field } : {}), ...(lab ? { lab } : {}) });
    }
  }
  return out;
}

export function normalizePerf(p: PerfData | SeoDataPerf | SeoDataPerf[] | undefined): PerfData | undefined {
  if (!p) return undefined;
  if (Array.isArray(p) || isSeoDataPerf(p)) return fromSeoDataPerf(p);
  return p;
}
