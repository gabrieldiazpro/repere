/**
 * Annotations sur les courbes.
 * GET    /api/annotations?businessId=&from=&to=&series=  → { annotations }
 * POST   /api/annotations { businessId, date: 'AAAA-MM-JJ', label, series? } → { annotation }
 * DELETE /api/annotations?businessId=&id=
 */
import { addAnnotation, deleteAnnotation, isValidDate, listAnnotations, SERIES, type Series } from '@/lib/annotations';
import { requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('annotations', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    await requireBusiness(req, businessId);
    const from = u.searchParams.get('from');
    const to = u.searchParams.get('to');
    const s = u.searchParams.get('series');
    const annotations = await listAnnotations(businessId, {
      from: isValidDate(from) ? from : undefined,
      to: isValidDate(to) ? to : undefined,
      series: s && (SERIES as readonly string[]).includes(s) ? (s as Series) : undefined,
    });
    return jsonOk({ annotations });
  });
}

export async function POST(req: Request) {
  return handle('annotations', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    await limit(req, 'annotations', 120);
    await requireBusiness(req, businessId, { write: true, minRole: 'member' });
    const annotation = await addAnnotation(businessId, {
      date: String(body.date ?? ''),
      label: String(body.label ?? ''),
      series: typeof body.series === 'string' ? (body.series as Series) : undefined,
    });
    return jsonOk({ annotation }, 201);
  });
}

export async function DELETE(req: Request) {
  return handle('annotations', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    const id = u.searchParams.get('id') ?? '';
    if (!/^an_[A-Za-z0-9_-]{4,80}$/.test(id)) throw new HttpError(400, 'Repère invalide.');
    await requireBusiness(req, businessId, { write: true, minRole: 'member' });
    if (!(await deleteAnnotation(businessId, id))) throw new HttpError(404, 'Repère introuvable.');
    return jsonOk({ deleted: true });
  });
}
