/**
 * GET /app/agence/export?client=<id>&kind=constats|positions|reponses — CSV d'un client depuis le portefeuille.
 * Droit `agency.clientExports` (offre Agence) et adhésion à l'espace. Démo : données de démonstration.
 */
import { requireBusiness, toResponse, HttpError } from '@/lib/auth';
import { assertAgency, getEntitlements } from '@/lib/entitlements';
import { buildDemoWorkspaceById, isDemoBusinessId } from '@/lib/demo-v2';
import { listDocs } from '@/lib/store';
import { buildExport } from '@/lib/exports';
import { clientExportFilename, isClientExportKind, positionsCsv, CLIENT_EXPORT_KINDS } from '@/lib/agency/exports';
import { SEO_RUNS } from '@/lib/agency/load';
import { allFindings, findingsCsv, type SeoRun } from '@/components/app/seo/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function findings(id: string, name: string): Promise<string> {
  if (isDemoBusinessId(id)) {
    const ws = buildDemoWorkspaceById(id)!;
    const { demoSiteCrawl } = await import('@/lib/seoaudit/demo-crawl');
    const { auditBoth } = await import('@/components/app/seo/data');
    const { providersForBusiness } = await import('@/lib/seodata/providers');
    const { ctx, p } = await providersForBusiness(id);
    const perf = p.perf && ctx.domain ? await p.perf.measure(`https://${id === 'demo-ecom' ? 'www.' : ''}${ctx.domain}/`).catch(() => undefined) : undefined;
    const r = auditBoth(demoSiteCrawl(id), {
      segment: ws.business.segment,
      business: { id, name, descriptor: [ws.business.trade, ws.business.city].join(' · ') } as never,
      facts: ws.facts,
      latest: (ws.audits.at(-1) ?? null) as never,
    }, perf);
    return findingsCsv(allFindings(r.seo, r.geo));
  }
  const runs = (await listDocs<SeoRun>(SEO_RUNS, { businessId: id, limit: 16 }))
    .map((d) => d.data)
    .filter((r) => r?.businessId === id && r.seo && r.geo)
    .sort((a, b) => a.at.localeCompare(b.at));
  const last = runs.at(-1);
  return findingsCsv(last ? allFindings(last.seo, last.geo) : []);
}

async function positions(id: string): Promise<string> {
  const { providersForBusiness } = await import('@/lib/seodata/providers');
  const { buildReport, getRankConfig, rankHistory } = await import('@/lib/seodata/rank');
  const { ctx, p } = await providersForBusiness(id);
  const [config, history] = await Promise.all([getRankConfig(ctx), rankHistory(ctx, p, 12)]);
  return positionsCsv(buildReport(ctx, config, history)).csv;
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get('client') ?? '';
    const kind = u.searchParams.get('kind');
    if (!isClientExportKind(kind)) throw new HttpError(400, `Type d’export inconnu. Types : ${CLIENT_EXPORT_KINDS.join(', ')}.`);
    const { business } = await requireBusiness(req, id);
    const demo = isDemoBusinessId(id);
    if (!demo) assertAgency(getEntitlements(business), 'clientExports');
    let csv: string;
    if (kind === 'constats') csv = await findings(id, business.name);
    else if (kind === 'positions') csv = await positions(id);
    else csv = (await buildExport(business, 'answers', {}, { allAudits: false })).csv;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${clientExportFilename(kind, business.name, demo)}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return toResponse(e, 'app/agence/export');
  }
}
