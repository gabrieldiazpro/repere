/**
 * /api/account/data?businessId=… — RGPD.
 *   GET    : export JSON complet du commerce (téléchargement). Propriétaire ; comptes démo lisibles.
 *   DELETE : suppression en cascade, propriétaire uniquement, corps `{ "confirm": "<nom exact du commerce>" }`.
 */
import { NextResponse } from 'next/server';
import { HttpError, requireBusiness, toResponse } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/auth/http';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { confirmationMatches, deleteBusinessData, DeletionBlockedError, exportBusinessData } from './gdpr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function businessIdOf(req: Request): string {
  return new URL(req.url).searchParams.get('businessId') ?? '';
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'commerce'
  );
}

export async function GET(req: Request) {
  try {
    const businessId = businessIdOf(req);
    const access = isDemoBusinessId(businessId) ? await requireBusiness(req, businessId) : await requireBusiness(req, businessId, { minRole: 'owner' });
    const data = await exportBusinessData(access.business, { userId: access.session?.userId, email: access.session?.email });
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="repere-donnees-${slug(access.business.name)}-${day}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return toResponse(e, 'api/account/data');
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req); // F6 de qa/v3/securite-v3.md
    const businessId = businessIdOf(req);
    const { business } = await requireBusiness(req, businessId, { minRole: 'owner', write: true });
    let body: { confirm?: unknown } = {};
    try {
      body = (await req.json()) as { confirm?: unknown };
    } catch {
      /* corps absent */
    }
    if (!confirmationMatches(business, body.confirm)) {
      throw new HttpError(400, `Pour confirmer, saisissez exactement le nom « ${business.name} ». Cette suppression est définitive.`);
    }
    const report = await deleteBusinessData(business);
    return NextResponse.json({ ok: true, deleted: report, message: 'Vos données ont été supprimées. Cette action est définitive.' });
  } catch (e) {
    if (e instanceof DeletionBlockedError) return NextResponse.json({ ok: false, error: e.message, code: 'subscription_active' }, { status: 409 });
    return toResponse(e, 'api/account/data');
  }
}
