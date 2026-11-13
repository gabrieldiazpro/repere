import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTaskStatus } from '@/lib/execution';
import { onTaskDone } from '@/lib/measure';
import { canEditBusiness } from '@/lib/execution/auth';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  businessId: z.string().min(1).max(100),
  status: z.enum(['todo', 'in_progress', 'done', 'skipped']),
});

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/exec/tasks/[id] — { businessId, status } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('exec-status', getClientIp(req), 300, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  const { businessId, status } = parsed.data;
  const auth = await canEditBusiness(req, businessId, { write: true });
  if (!auth.ok) return NextResponse.json({ error: auth.demo ? DEMO_READ_ONLY : 'Accès refusé.', demo: auth.demo ?? false }, { status: auth.status });
  try {
    const task = await updateTaskStatus(businessId, id, status);
    if (!task) return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });
    // Mesure avant/après (idempotente, ne bloque jamais l'enregistrement).
    if (status === 'done') await onTaskDone(businessId, task).catch((e) => console.warn('[api/exec/tasks/id] mesure', e));
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    console.error('[api/exec/tasks/id]', e);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
