/** GET /api/account/session — état de connexion et espaces de l'utilisateur (pour l'en-tête et le sélecteur). */
import { getSession, toResponse } from '@/lib/auth';
import { authMode } from '@/lib/auth/config';
import { json } from '@/lib/auth/http';
import { listAccountBusinesses } from '@/lib/auth/businesses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) return json({ authenticated: false, mode: authMode() });
    const businesses = await listAccountBusinesses(session);
    return json({ authenticated: true, mode: authMode(), email: session.email, businesses });
  } catch (e) {
    return toResponse(e, 'api/account/session');
  }
}
