/**
 * Cron quotidien des ré-audits (nom historique « monthly ») : n'exécute plus d'audit en ligne.
 * Il ENFILE une tâche `audit.scheduled` (balayage sans effet de bord, rejouable) qui sélectionne les commerces dont la fréquence
 * de l'offre est échue (mensuelle, hebdomadaire…) et enfile un `audit.run` par commerce (dédoublonné par période).
 * V5 : enfile aussi `analysis.scheduled` (réanalyses dues) et, si BAROMETRE_ENABLED=1, `barometre.run` (une fois par mois).
 * Puis il fait tourner le worker avec le budget restant (utile sur Vercel Hobby, où le worker n'a qu'un cron par jour).
 */
import { NextResponse } from 'next/server';
import { enqueue, getJob, runWorker } from '@/lib/jobs';
import { captureError, withRequest } from '@/lib/log';
import { cronAuthorized } from '../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const l = withRequest(req);
  const now = new Date();
  try {
    const { id } = await enqueue('audit.scheduled', { now: now.toISOString() });
    // V5 : balayage quotidien des réanalyses SEO + GEO dues (rythme de l'offre) et passe mensuelle des baromètres.
    const v5: Record<string, string> = {};
    try {
      v5.analysis = (await enqueue('analysis.scheduled', { now: now.toISOString() }, { dedupeKey: `analysis.scheduled:${now.toISOString().slice(0, 10)}` })).id;
      // Baromètres : seulement si le fondateur l'a décidé (coût IA ≈ 96,50 €/mois pour 50) ; le 2 du mois ou après.
      if (process.env.BAROMETRE_ENABLED === '1' && now.getUTCDate() >= 2) {
        v5.barometre = (await enqueue('barometre.run', {}, { dedupeKey: `barometre:${now.toISOString().slice(0, 7)}` })).id;
      }
    } catch (e) {
      captureError(e, { event: 'cron.monthly_v5_enqueue_failed' });
    }
    const worker = await runWorker();
    // Compte rendu par commerce (sans base, la file mémoire a déjà tout exécuté pendant `enqueue`).
    const sweep = await getJob(id);
    const ids = Array.isArray(sweep?.result?.jobIds) ? (sweep.result.jobIds as string[]) : [];
    const outcomes: Record<string, unknown>[] = [];
    for (const jid of ids) {
      const j = await getJob(jid);
      if (!j) continue;
      outcomes.push({
        businessId: j.businessId,
        jobId: j.id,
        status: j.status,
        attempts: j.attempts,
        ...(j.result ?? {}),
        ...(j.status !== 'done' && j.lastError ? { error: j.lastError } : {}),
      });
    }
    const body = {
      sweepJobId: id,
      v5,
      sweepStatus: sweep?.status ?? 'queued',
      due: ids.length,
      processed: outcomes.filter((o) => o.status === 'done' || o.status === 'dead').length,
      pending: outcomes.filter((o) => o.status === 'queued' || o.status === 'running').length,
      detectedAlerts: outcomes.reduce((n, o) => {
        const d = (o as Record<string, unknown>).detected;
        return n + (typeof d === 'number' ? d : 0);
      }, 0),
      worker: { processed: worker.processed, done: worker.done, retried: worker.retried, dead: worker.dead, durationMs: worker.durationMs, stoppedBy: worker.stoppedBy },
      outcomes,
    };
    l.info('cron.monthly', { sweepJobId: id, due: body.due, processed: body.processed, dead: worker.dead });
    return NextResponse.json(body);
  } catch (e) {
    captureError(e, { event: 'cron.monthly_failed' });
    return NextResponse.json({ error: 'Planification en échec.' }, { status: 500 });
  }
}
