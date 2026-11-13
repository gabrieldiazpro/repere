/**
 * Un ChangeSet et son cycle de vie.
 * GET  /api/v5/publish/changesets/[id]?businessId=                    → { changeSet, journal }
 * POST /api/v5/publish/changesets/[id] { businessId, action, … }
 *   action = 'propose'                       (member) : lit l'état réel chez la plateforme (avant exact)
 *          | 'edit' { changeId, value }       (member) : modifie un texte proposé (la validation tombe)
 *          | 'validate' { exclude?, note? }   (admin)  : validation explicite (qui, quand)
 *          | 'reject' { reason? }             (admin)
 *          | 'apply'                          (admin)  : écrit, relit, repère sur les courbes, remesure J+7
 *          | 'verify'                         (admin)  : relit à nouveau (cache, export déposé)
 *          | 'revert' { changeIds?, force? }  (admin)  : retour arrière (tout ou partie)
 * Comptes démo : lecture seule (403 sur toute action).
 */
import { getBusinessRecord } from '@/lib/db';
import { assertCanApplyPublish, getEntitlements } from '@/lib/entitlements';
import { HttpError, type Role } from '@/lib/auth';
import {
  applyChangeSet,
  changeSetJournal,
  editChange,
  getChangeSet,
  proposeChangeSet,
  rejectChangeSet,
  revertChangeSet,
  validateChangeSet,
  verifyChangeSet,
  type ChangeSet,
} from '@/lib/publish';
import { summarizeChange } from '@/lib/publish/model';
import { CS_ID_RE, access, assertSameOrigin, body, handle, json, limit, strArr } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS: Record<string, Role> = { propose: 'member', edit: 'member', validate: 'admin', reject: 'admin', apply: 'admin', verify: 'admin', revert: 'admin' };

const view = (cs: ChangeSet) => ({ ...cs, changes: cs.changes.map((c) => summarizeChange(c)) });

export async function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    if (!CS_ID_RE.test(id)) throw new HttpError(400, 'Identifiant invalide.');
    const { businessId, demo } = await access(req, new URL(req.url).searchParams.get('businessId'));
    const cs = await getChangeSet(businessId, id);
    if (!cs) throw new HttpError(404, 'Modifications introuvables.');
    return json({ changeSet: view(cs), journal: await changeSetJournal(businessId, id), demo });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    assertSameOrigin(req);
    const { id } = await params;
    if (!CS_ID_RE.test(id)) throw new HttpError(400, 'Identifiant invalide.');
    const b = await body(req);
    const action = typeof b.action === 'string' ? b.action : '';
    const minRole = ACTIONS[action];
    if (!minRole) throw new HttpError(400, 'Action inconnue.');
    await limit(req, `publish-${action}`, action === 'apply' || action === 'revert' ? 30 : 120);
    const { businessId, actor } = await access(req, b.businessId, { write: true, minRole });
    let cs: ChangeSet;
    switch (action) {
      case 'propose':
        cs = await proposeChangeSet(businessId, id, actor);
        break;
      case 'edit':
        if (typeof b.changeId !== 'string' || typeof b.value !== 'string') throw new HttpError(400, 'Modification invalide.');
        cs = await editChange(businessId, id, b.changeId, b.value, actor);
        break;
      case 'validate':
        cs = await validateChangeSet(businessId, id, actor, { exclude: strArr(b.exclude), note: typeof b.note === 'string' ? b.note : undefined });
        break;
      case 'reject':
        cs = await rejectChangeSet(businessId, id, actor, typeof b.reason === 'string' ? b.reason : undefined);
        break;
      case 'apply': {
        // Droits V5 : application directe chez le client à partir d'Essentiel ; l'export reste ouvert à tous.
        const current = await getChangeSet(businessId, id);
        if (current && current.platform !== 'export') {
          const rec = await getBusinessRecord(businessId);
          if (rec) assertCanApplyPublish(getEntitlements(rec));
        }
        cs = await applyChangeSet(businessId, id, actor);
        break;
      }
      case 'verify':
        cs = await verifyChangeSet(businessId, id, actor);
        break;
      default:
        cs = await revertChangeSet(businessId, id, actor, { changeIds: strArr(b.changeIds), force: b.force === true });
    }
    return json({ changeSet: view(cs) });
  });
}
