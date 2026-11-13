/**
 * Équipe d'un espace (rôles : owner, admin, member, viewer).
 * GET    /api/team?businessId=…                         → membres, invitations en attente, sièges (tout membre)
 * POST   /api/team { businessId, email, role }           → invitation par e-mail (admin et plus)
 * PATCH  /api/team { businessId, userId, role }          → changement de rôle (admin et plus)
 * DELETE /api/team?businessId=…&userId=… | &invitationId=… → retrait d'un membre (ou départ volontaire) / révocation
 */
import { requireBusiness, toResponse } from '@/lib/auth';
import { assertSameOrigin, json, limit, readJson, str } from '@/lib/auth/http';
import { HttpError, type Role } from '@/lib/auth/roles';
import { changeRole, inviteMember, removeMember, revokeInvitation, teamView } from '@/lib/auth/team';
import { isProduction } from '@/lib/auth/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function memberRole(role: Role | 'demo'): Role {
  if (role === 'demo') throw new HttpError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.', 'demo_read_only');
  return role;
}

export async function GET(req: Request) {
  try {
    const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
    const { business, role, session } = await requireBusiness(req, businessId);
    if (role === 'demo') return json({ members: [], invitations: [], seats: { used: 1, max: 5 }, canManage: false, assignable: [], demo: true });
    return json(await teamView(business, { userId: session?.userId ?? '', role }));
  } catch (e) {
    return toResponse(e, 'api/team');
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await limit(req, 'team-invite', 30);
    const body = await readJson(req);
    const { business, role, session } = await requireBusiness(req, str(body.businessId, 100), { minRole: 'admin', write: true });
    if (!session) throw new HttpError(401);
    const r = await inviteMember(business, { session, role: memberRole(role) }, { email: body.email, role: body.role });
    return json(
      {
        ok: true,
        invitation: { id: r.invitation.id, email: r.invitation.email, role: r.invitation.role, expiresAt: r.invitation.expiresAt },
        // hors production : lien renvoyé pour tester sans service d'e-mail
        ...(isProduction() ? {} : { devLink: r.url }),
      },
      { status: 201 },
    );
  } catch (e) {
    return toResponse(e, 'api/team');
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const { business, role, session } = await requireBusiness(req, str(body.businessId, 100), { minRole: 'admin', write: true });
    await changeRole(business, { userId: session?.userId ?? '', role: memberRole(role) }, str(body.userId, 100), body.role);
    return json({ ok: true });
  } catch (e) {
    return toResponse(e, 'api/team');
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const sp = new URL(req.url).searchParams;
    const invitationId = sp.get('invitationId');
    const userId = sp.get('userId');
    if (invitationId) {
      const { business } = await requireBusiness(req, sp.get('businessId') ?? '', { minRole: 'admin', write: true });
      await revokeInvitation(business.id, invitationId);
      return json({ ok: true });
    }
    if (!userId) throw new HttpError(400, 'Membre inconnu.');
    // Tout membre peut quitter l'espace ; retirer quelqu'un d'autre exige admin (vérifié dans removeMember).
    const { business, role, session } = await requireBusiness(req, sp.get('businessId') ?? '', { write: true, minRole: 'viewer' });
    await removeMember(business, { userId: session?.userId ?? '', role: memberRole(role) }, userId);
    return json({ ok: true });
  } catch (e) {
    return toResponse(e, 'api/team');
  }
}
