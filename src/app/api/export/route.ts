/** GET /api/export?businessId=&kind=&from=&to= — CSV (UTF-8 avec BOM, « ; »), droit `exports`. Démo autorisée. */
import { buildExport, isExportKind, EXPORT_KINDS, EXPORT_LABELS } from '@/lib/exports';
import { assertEntitled, getEntitlements, requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('export', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    const kind = u.searchParams.get('kind');
    if (!kind) return jsonOk({ kinds: EXPORT_KINDS.map((k) => ({ kind: k, label: EXPORT_LABELS[k] })) });
    if (!isExportKind(kind)) throw new HttpError(400, `Type d’export inconnu. Types : ${EXPORT_KINDS.join(', ')}.`);
    await limit(req, 'export', 120);
    const { business } = await requireBusiness(req, businessId);
    assertEntitled(getEntitlements(business), 'exports');
    const from = u.searchParams.get('from') ?? undefined;
    const to = u.searchParams.get('to') ?? undefined;
    const { filename, csv } = await buildExport(business, kind, { from, to }, { allAudits: u.searchParams.get('all') === '1' });
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
