/** POST { businessId } (admin) → révoque l'accès chez Google, supprime la connexion et les données importées. */
import { revoke } from '@/lib/seodata/google-oauth';
import { dropSearchConsoleData } from '@/lib/seodata/searchconsole';
import { access, businessIdOf, errorResponse, json, readBody } from '../../../seodata/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const businessId = businessIdOf(body.businessId);
    await access(req, businessId, { write: true, minRole: 'admin' });
    return json({ connected: false, ...(await revoke(businessId, dropSearchConsoleData)) });
  } catch (e) {
    return errorResponse(e, 'connect.google.revoke');
  }
}
