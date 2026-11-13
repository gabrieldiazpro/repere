import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCustomTask, createFactFixTask, listTasks, weeklyTasks } from '@/lib/execution';
import { canEditBusiness } from '@/lib/execution/auth';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/exec/tasks?businessId=…[&view=week] — toutes les tâches, ou les 3 de la semaine. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId manquant.' }, { status: 400 });
  const auth = await canEditBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  try {
    if (url.searchParams.get('view') === 'week') return NextResponse.json({ tasks: await weeklyTasks(businessId) });
    const [tasks, week] = await Promise.all([listTasks(businessId), weeklyTasks(businessId)]);
    return NextResponse.json({ tasks, week: week.map((t) => t.id) });
  } catch (e) {
    console.error('[api/exec/tasks]', e);
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });
  }
}

const FIELDS = ['adresse', 'telephone', 'horaires', 'prix', 'zone', 'services', 'dirigeant', 'creation', 'site', 'statut', 'produits', 'livraison', 'clients'] as const;

const Body = z.union([
  z.object({
    businessId: z.string().min(1).max(100),
    factFix: z.object({
      field: z.enum(FIELDS),
      expected: z.string().min(1).max(500),
      stated: z.string().min(1).max(500),
      provider: z.enum(['chatgpt', 'perplexity', 'gemini', 'claude']),
      quote: z.string().max(1000).optional(),
      severity: z.enum(['haute', 'moyenne', 'basse']).optional(),
    }),
  }),
  z.object({
    businessId: z.string().min(1).max(100),
    task: z.object({
      title: z.string().min(3).max(160),
      why: z.string().max(600).optional(),
      minutes: z.number().int().min(1).max(600).optional(),
      impact: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      steps: z.array(z.string().max(300)).max(12).optional(),
    }),
  }),
]);

/** POST /api/exec/tasks — crée une tâche « corriger » (bouton Vérité) ou une tâche libre. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('exec-tasks', getClientIp(req), 120, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  const { businessId } = parsed.data;
  const auth = await canEditBusiness(req, businessId, { write: true });
  if (!auth.ok) return NextResponse.json({ error: auth.demo ? DEMO_READ_ONLY : 'Accès refusé.', demo: auth.demo ?? false }, { status: auth.status });
  try {
    const task = 'factFix' in parsed.data ? await createFactFixTask(businessId, parsed.data.factFix) : await createCustomTask(businessId, parsed.data.task);
    if (!task) return NextResponse.json({ error: 'Commerce introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (e) {
    console.error('[api/exec/tasks]', e);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
}
