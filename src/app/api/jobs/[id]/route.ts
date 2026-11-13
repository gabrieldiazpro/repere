/**
 * GET /api/jobs/[id] — état d'une tâche (ex. premier audit en cours après l'achat), interrogé par l'interface.
 * Accès : tâche rattachée à un commerce → `requireBusiness` (lecture). Jamais la charge utile ni l'erreur brute.
 */
import { NextResponse } from 'next/server';
import { requireBusiness, toResponse } from '@/lib/auth';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_RESULT_KEYS = ['auditId', 'score', 'previous', 'delta', 'skipped', 'tasks'] as const;

const LABEL: Record<string, string> = {
  queued: 'En attente',
  running: 'En cours',
  done: 'Terminé',
  dead: 'Échec : notre équipe est prévenue',
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return NextResponse.json({ error: 'Tâche inconnue.' }, { status: 404 });
  try {
    const job = await getJob(id);
    if (!job || !job.businessId) return NextResponse.json({ error: 'Tâche inconnue.' }, { status: 404 });
    await requireBusiness(req, job.businessId);
    const result: Record<string, unknown> = {};
    for (const k of PUBLIC_RESULT_KEYS) if (job.result && k in job.result) result[k] = job.result[k];
    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      label: job.status === 'queued' && job.attempts > 0 ? 'Nouvelle tentative programmée' : LABEL[job.status],
      attempts: job.attempts,
      runAt: job.runAt,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      result,
    });
  } catch (e) {
    return toResponse(e, 'api/jobs');
  }
}
