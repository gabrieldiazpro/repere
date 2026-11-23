/**
 * Pilote automatique (V10, PILOTE-AUTO) — mandat et gestes du client.
 * GET  /api/v5/autopilot?businessId=                         → { mandate, state, journal, demo, offer }
 * POST /api/v5/autopilot { businessId, action, … }
 *   action = 'sign' { categories, accepted }   (owner/admin) : signe (ou re-signe) le mandat ; lance une première analyse
 *          | 'pause' | 'resume' | 'revoke'     (owner/admin)
 *          | 'undo' { csId }                   (admin)       : annule une série (valeurs d'avant remises)
 *          | 'block' { draftId }               (member)      : bloque la mise en ligne d'un contenu en relecture
 * Comptes démo : lecture seule (403 sur toute action : la démo simule dans le navigateur).
 */
import { HttpError, type Role } from '@/lib/auth';
import { getClientIp } from '@/lib/ratelimit';
import { getBusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { isRegulatedTrade } from '@/lib/regulated';
import { AutopilotError, blockContent, demoAutopilot, getMandate, getState, listAutopilotJournal, pauseMandate, resumeMandate, revokeMandate, signMandate, undoSeries } from '@/lib/autopilot';
import { toResponse } from '@/lib/auth';
import { access, assertSameOrigin, body, CS_ID_RE, handle, json, limit } from '../publish/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS: Record<string, Role> = { sign: 'admin', pause: 'admin', resume: 'admin', revoke: 'admin', undo: 'admin', block: 'member' };
const DRAFT_RE = /^ct_[A-Za-z0-9_-]{4,60}$/;

const wrap = (fn: () => Promise<Response>) =>
  handle(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AutopilotError) return toResponse(new HttpError(e.status, e.message, e.code), 'autopilot');
      throw e;
    }
  });

export async function GET(req: Request) {
  return wrap(async () => {
    const { businessId, demo } = await access(req, new URL(req.url).searchParams.get('businessId'));
    const b = demo ? null : await getBusinessRecord(businessId);
    if (demo) {
      const v = demoAutopilot(businessId, 'local');
      return json({ ...v, offer: true });
    }
    const [mandate, state, journal] = await Promise.all([getMandate(businessId), getState(businessId), listAutopilotJournal(businessId, 200)]);
    return json({ demo: false, offer: b ? getEntitlements(b).autopilot : false, mandate, state, journal: journal.reverse() });
  });
}

export async function POST(req: Request) {
  return wrap(async () => {
    assertSameOrigin(req);
    const b = await body(req);
    const action = typeof b.action === 'string' ? b.action : '';
    const minRole = ACTIONS[action];
    if (!minRole) throw new HttpError(400, 'Action inconnue.');
    const { businessId, actor, demo } = await access(req, b.businessId, { write: true, minRole });
    if (demo) throw new HttpError(403, 'Compte de démonstration : rien n’est enregistré, aucune modification réelle.', 'demo_read_only');
    await limit(req, `autopilot:${businessId}`, 60);
    const now = new Date();
    switch (action) {
      case 'sign': {
        const rec = await getBusinessRecord(businessId);
        if (!rec) throw new HttpError(404, 'Espace introuvable.');
        const ent = getEntitlements(rec);
        if (!ent.autopilot) throw new HttpError(402, 'Le mandat se signe avec l’offre Pilote automatique.', 'upgrade_required');
        if (!actor.email || actor.id === 'sandbox-owner') throw new HttpError(403, 'Connectez-vous avec votre adresse pour signer le mandat.', 'human_required');
        const m = await signMandate(
          businessId,
          {
            categories: b.categories,
            accepted: b.accepted,
            signer: { userId: actor.id, email: actor.email },
            businessName: rec.name,
            site: rec.website ?? '',
            regulated: isRegulatedTrade(rec.trade),
            limits: { series: ent.publish.changeSetsPerMonth, contents: ent.contentsPerMonth },
            ip: getClientIp(req),
            userAgent: req.headers.get('user-agent'),
          },
          now,
        );
        // « C'est parti » : une première analyse du site, qui déclenche le pilote (dédoublonnée par jour).
        try {
          const { enqueue } = await import('@/lib/jobs');
          if (rec.website) await enqueue('analysis.rerun', { businessId, reason: 'autopilot' }, { businessId, dedupeKey: `autopilot-start:${businessId}:${now.toISOString().slice(0, 10)}` });
        } catch {
          /* la réanalyse planifiée de l'offre prendra le relais */
        }
        return json({ mandate: m });
      }
      case 'pause':
        return json({ mandate: await pauseMandate(businessId, actor, { reason: 'client' }, now) });
      case 'resume': {
        const m = await resumeMandate(businessId, actor, now);
        const state = await getState(businessId);
        if (state.guard) {
          const { saveState } = await import('@/lib/autopilot/store');
          await saveState({ ...state, guard: null }, now);
        }
        return json({ mandate: m });
      }
      case 'revoke':
        return json({ mandate: await revokeMandate(businessId, actor, now) });
      case 'undo': {
        const csId = typeof b.csId === 'string' ? b.csId : '';
        if (!CS_ID_RE.test(csId)) throw new HttpError(400, 'Série inconnue.');
        return json(await undoSeries(businessId, csId, actor, now));
      }
      case 'block': {
        const draftId = typeof b.draftId === 'string' ? b.draftId : '';
        if (!DRAFT_RE.test(draftId)) throw new HttpError(400, 'Contenu inconnu.');
        return json(await blockContent(businessId, draftId, actor, now));
      }
    }
    throw new HttpError(400, 'Action inconnue.');
  });
}
