/**
 * POST /api/health/csp-report — rapports de violation CSP (`report-uri` et `report-to`, voir next.config.ts).
 * Journalisés en échantillon (CSP_REPORT_SAMPLE, 0,1 par défaut), corps borné à 16 Ko, sans donnée personnelle.
 */
import { log } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 16 * 1024;

function pick(r: Record<string, unknown>) {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).slice(0, 300) : undefined);
  return {
    directive: s('effective-directive') ?? s('effectiveDirective') ?? s('violated-directive'),
    blocked: s('blocked-uri') ?? s('blockedURL'),
    page: (s('document-uri') ?? s('documentURL'))?.split('?')[0],
    source: s('source-file') ?? s('sourceFile'),
    line: r['line-number'] ?? r.lineNumber,
    disposition: s('disposition'),
  };
}

export async function POST(req: Request) {
  const rate = Number(process.env.CSP_REPORT_SAMPLE ?? '0.1');
  if (Math.random() >= (Number.isFinite(rate) ? rate : 0.1)) return new Response(null, { status: 204 });
  try {
    const text = (await req.text()).slice(0, MAX);
    const parsed = JSON.parse(text) as unknown;
    const reports = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];
    for (const rep of reports) {
      if (!rep || typeof rep !== 'object') continue;
      const o = rep as Record<string, unknown>;
      const r = (o['csp-report'] ?? o.body ?? o) as Record<string, unknown>;
      if (r && typeof r === 'object') log.warn('csp.violation', pick(r));
    }
  } catch {
    /* rapport illisible : ignoré */
  }
  return new Response(null, { status: 204 });
}
