/**
 * GET /api/v5/analysis/[id]?t=<jeton> — une analyse 60 s.
 * Accès : jeton de partage valide (lien signé, 90 jours) OU membre de l'espace auquel l'analyse est rattachée.
 * Sinon 404 (on ne révèle pas l'existence de l'analyse). Le membre reçoit aussi l'historique du domaine.
 */
import { requireBusiness } from '@/lib/auth';
import { domainHistory, getStoredAnalysis, toPublicAnalysis, tokenMatches } from '@/lib/analysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notFound = () => Response.json({ error: 'Analyse introuvable ou lien expiré.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return Response.json({ error: 'Identifiant invalide.' }, { status: 400 });
  try {
    const doc = await getStoredAnalysis(id);
    if (!doc) return notFound();
    const token = new URL(req.url).searchParams.get('t') ?? req.headers.get('x-share-token');
    if (tokenMatches(doc, token)) {
      return Response.json({ analysis: toPublicAnalysis(doc.analysis), access: 'link' }, { headers: { 'Cache-Control': 'private, max-age=60', 'X-Robots-Tag': 'noindex' } });
    }
    if (doc.businessId) {
      try {
        await requireBusiness(req, doc.businessId);
        return Response.json(
          { analysis: toPublicAnalysis(doc.analysis), access: 'member', history: await domainHistory(doc.domain) },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      } catch {
        return notFound();
      }
    }
    return notFound();
  } catch (e) {
    console.error('[api/v5/analysis/id]', e);
    return Response.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
