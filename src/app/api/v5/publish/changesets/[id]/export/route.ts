/** GET /api/v5/publish/changesets/[id]/export?businessId= → archive ZIP (fichiers à déposer + instructions + état « avant »). */
import { HttpError } from '@/lib/auth';
import { exportChangeSet } from '@/lib/publish';
import { CS_ID_RE, access, handle } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    if (!CS_ID_RE.test(id)) throw new HttpError(400, 'Identifiant invalide.');
    const { businessId } = await access(req, new URL(req.url).searchParams.get('businessId'));
    const { filename, zip } = await exportChangeSet(businessId, id);
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'no-store' },
    });
  });
}
