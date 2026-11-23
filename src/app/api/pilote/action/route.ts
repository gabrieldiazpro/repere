/**
 * POST /api/pilote/action { t } — geste du client depuis un e-mail du pilote (lien signé, sans connexion) : annuler une
 * série, bloquer un contenu en relecture, mettre le pilote en pause. Appelé par la page de confirmation /pilote/action
 * (jamais d'action sur un simple GET : les antivirus de messagerie ouvrent les liens).
 */
import { NextResponse } from 'next/server';
import { AutopilotError, blockContent, pauseFromLink, undoSeries, verifyActionToken } from '@/lib/autopilot';
import { PublishError } from '@/lib/publish/types';
import { getClientIp, HOUR_MS, rateLimit } from '@/lib/ratelimit';
import { isDemoBusinessId } from '@/lib/demo-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rl = await rateLimit('pilote-action', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives, réessayez plus tard.' }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const raw = form?.get('t');
  const tok = verifyActionToken(typeof raw === 'string' ? raw : null);
  const back = (q: string) => NextResponse.redirect(new URL(`/pilote/action?${q}`, req.url), 303);
  if (!tok) return back('r=invalide');
  if (isDemoBusinessId(tok.businessId)) return back('r=demo');
  const who = { id: 'lien-email', role: 'client_link' };
  try {
    if (tok.kind === 'undo') await undoSeries(tok.businessId, tok.ref, who);
    else if (tok.kind === 'block') await blockContent(tok.businessId, tok.ref, who);
    else await pauseFromLink(tok.businessId, who);
    return back(`r=ok&k=${tok.kind}`);
  } catch (e) {
    const code = e instanceof AutopilotError || e instanceof PublishError ? e.code ?? 'erreur' : 'erreur';
    console.warn('[api/pilote/action]', e instanceof Error ? e.message : e);
    return back(`r=echec&k=${tok.kind}&c=${encodeURIComponent(String(code).slice(0, 30))}`);
  }
}
