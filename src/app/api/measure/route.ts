/**
 * Mesure avant / après d'une action.
 * GET  /api/measure?businessId=[&taskId=]  → { impacts } ou { impact }
 * POST /api/measure { businessId, taskId } → déclenche la mesure d'une tâche faite (repère, état « avant »,
 *      relances J+14 / J+30, notification). Idempotent. À brancher sur la complétion des tâches.
 */
import { getActionImpact, listActionImpacts, onTaskDone } from '@/lib/measure';
import { listTasks } from '@/lib/execution';
import { requireBusiness, HttpError } from '@/lib/notify/platform';
import { businessIdOf, handle, jsonOk, limit, readJson } from '@/lib/notify/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TASK_RE = /^[A-Za-z0-9_:.-]{1,100}$/;

export async function GET(req: Request) {
  return handle('measure', async () => {
    const u = new URL(req.url);
    const businessId = businessIdOf(u.searchParams.get('businessId'));
    await requireBusiness(req, businessId);
    const taskId = u.searchParams.get('taskId');
    if (taskId) {
      if (!TASK_RE.test(taskId)) throw new HttpError(400, 'Tâche invalide.');
      const impact = await getActionImpact(taskId, { businessId });
      if (!impact) throw new HttpError(404, 'Aucune mesure pour cette tâche.');
      return jsonOk({ impact });
    }
    return jsonOk({ impacts: await listActionImpacts(businessId) });
  });
}

export async function POST(req: Request) {
  return handle('measure', async () => {
    const body = await readJson(req);
    const businessId = businessIdOf(body.businessId);
    const taskId = typeof body.taskId === 'string' && TASK_RE.test(body.taskId) ? body.taskId : '';
    if (!taskId) throw new HttpError(400, 'Tâche invalide.');
    await limit(req, 'measure', 60);
    await requireBusiness(req, businessId, { write: true, minRole: 'member' });
    const task = (await listTasks(businessId)).find((t) => t.id === taskId);
    if (!task) throw new HttpError(404, 'Tâche introuvable.');
    if (task.status !== 'done') throw new HttpError(409, 'La tâche n’est pas marquée comme faite.');
    await onTaskDone(businessId, task);
    return jsonOk({ impact: await getActionImpact(taskId, { businessId }) });
  });
}
