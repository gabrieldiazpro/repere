/**
 * GET /api/health/deep — contrôle approfondi, protégé (`Authorization: Bearer <CRON_SECRET>`, ou admin :
 * en-tête x-admin-token / cookie admin_token). Plus lent (jusqu'à ~10 s) : à ne pas donner au moniteur public.
 *
 * En plus de /api/health : écriture puis relecture dans le store, clé Stripe valide (lecture du solde) et
 * événements non livrés au webhook, clé Resend valide (liste des domaines), erreurs des 24 h, coûts du jour,
 * garde-fou, derniers passages des crons, dernières alertes. Aucune valeur secrète dans la réponse.
 */
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getDoc, putDoc } from '@/lib/store';
import { getStripe } from '@/lib/stripe';
import {
  OPS,
  dailyCosts,
  errorsLast24h,
  gatherHealth,
  guardState,
  isPausedState,
  listHeartbeats,
  listOpsAlerts,
  opsAuthorized,
  publicHealth,
  stripeUndelivered,
  type Level,
} from '@/lib/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Probe = { level: Level; ms?: number; note?: string };

async function timed(fn: () => Promise<string | void>): Promise<Probe> {
  const t0 = Date.now();
  try {
    const note = await fn();
    return { level: 'ok', ms: Date.now() - t0, ...(note ? { note } : {}) };
  } catch (e) {
    return { level: 'fail', ms: Date.now() - t0, note: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

export async function GET(req: Request) {
  if (!opsAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const now = new Date();
  const [health, store, stripe, resend, webhook, errors24h, costs, guard, heartbeats, alerts] = await Promise.all([
    gatherHealth(now),
    timed(async () => {
      const stamp = now.toISOString();
      await putDoc(OPS.state, 'deep-probe', { at: stamp });
      const back = await getDoc<{ at: string }>(OPS.state, 'deep-probe');
      if (back?.data.at !== stamp) throw new Error('relecture différente de l’écriture');
    }),
    timed(async () => {
      const s = getStripe();
      if (!s) return 'non configuré';
      await s.balance.retrieve({}, { timeout: 5000, maxNetworkRetries: 0 });
    }),
    timed(async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) return 'non configuré';
      const r = await Promise.race([
        new Resend(key).domains.list(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('délai dépassé (5 s)')), 5000)),
      ]);
      if (r.error) throw new Error(r.error.message);
      const domains = (r.data?.data ?? []) as { name: string; status: string }[];
      const verified = domains.filter((d) => d.status === 'verified').map((d) => d.name);
      if (!verified.length) throw new Error('aucun domaine d’envoi vérifié');
      return `domaines vérifiés : ${verified.join(', ')}`;
    }),
    stripeUndelivered(now).catch((e) => ({ error: e instanceof Error ? e.message.slice(0, 200) : 'erreur' })),
    errorsLast24h(now).catch(() => null),
    dailyCosts({ now }).catch(() => null),
    guardState().catch(() => null),
    listHeartbeats().catch(() => []),
    listOpsAlerts(10).catch(() => []),
  ]);
  const probes = { store, stripe, resend };
  const failed = Object.values(probes).some((p) => p.level === 'fail') || health.status === 'fail';
  const status: Level = failed ? 'fail' : health.status;
  return NextResponse.json(
    {
      ...publicHealth(health),
      status,
      detail: health.detail,
      cron: health.cron,
      probes,
      stripeWebhook: webhook,
      errors24h,
      costs,
      guard: guard ? { ...guard, pausedNow: isPausedState(guard, now) } : null,
      heartbeats,
      alerts,
    },
    { status: status === 'fail' ? 503 : 200, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } },
  );
}
