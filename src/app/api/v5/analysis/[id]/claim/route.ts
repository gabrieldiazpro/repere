/**
 * POST /api/v5/analysis/[id]/claim { t, email } — V8 (inscription libre depuis le rapport) : la personne qui détient le
 * lien signé de l'analyse y ajoute son adresse e-mail (seul son hachage est gardé), pour que l'inscription rattache
 * l'analyse à son espace même si aucun e-mail n'avait été saisi au lancement. Le rattachement lui-même reste fait à
 * la confirmation de l'adresse (clic sur le lien), par lib/auth/claims.ts.
 * Réponse identique en cas de refus (pas d'information sur l'analyse) ; même origine ; 10 demandes par heure et par IP.
 */
import { toResponse } from '@/lib/auth';
import { assertSameOrigin, json, limit, readJson, str } from '@/lib/auth/http';
import { HttpError } from '@/lib/auth/roles';
import { isEmail } from '@/lib/auth/users';
import { addRequesterEmail } from '@/lib/analysis/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    assertSameOrigin(req);
    await limit(req, 'analysis-claim', 10);
    const { id } = await params;
    const body = await readJson(req);
    if (!/^an_[A-Za-z0-9_-]{1,77}$/.test(id)) throw new HttpError(400, 'Identifiant invalide.');
    if (!isEmail(body.email)) throw new HttpError(400, 'Cette adresse e-mail semble incomplète.');
    const ok = await addRequesterEmail(id, str(body.t, 100), str(body.email, 254)).catch(() => false);
    return json({ ok: true, ...(ok ? { linked: true } : {}) });
  } catch (e) {
    return toResponse(e, 'api/v5/analysis/claim');
  }
}
