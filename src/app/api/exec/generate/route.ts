import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clearSchemaCache, regenerateTasks } from '@/lib/execution';
import { canEditBusiness } from '@/lib/execution/auth';
import { getBusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({ businessId: z.string().min(1).max(100) });

/** POST /api/exec/generate — régénère les tâches depuis le dernier audit (statuts conservés). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  // Appels LLM payants : limite basse.
  const rl = await rateLimit('exec-generate', getClientIp(req), 10, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  const { businessId } = parsed.data;
  const auth = await canEditBusiness(req, businessId, { write: true });
  if (!auth.ok) return NextResponse.json({ error: auth.demo ? DEMO_READ_ONLY : 'Accès refusé.', demo: auth.demo ?? false }, { status: auth.status });
  // Offre Découverte : pas d'exécution (décision 2), appliqué côté serveur (appels LLM payants).
  if (!auth.demo) {
    const b = await getBusinessRecord(businessId).catch(() => null);
    if (b && !getEntitlements(b).execution) {
      return NextResponse.json({ error: 'Cette fonction est disponible avec l’offre Essentiel.', code: 'upgrade_required' }, { status: 402 });
    }
  }
  try {
    const res = await regenerateTasks(businessId);
    if (!res) return NextResponse.json({ error: 'Commerce introuvable.' }, { status: 404 });
    clearSchemaCache(businessId);
    return NextResponse.json({ ok: true, count: res.tasks.length, llm: res.llm, tasks: res.tasks });
  } catch (e) {
    console.error('[api/exec/generate]', e);
    return NextResponse.json({ error: 'Génération impossible.' }, { status: 500 });
  }
}
