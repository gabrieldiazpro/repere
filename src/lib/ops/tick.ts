/**
 * Contrôle périodique (toutes les 5 minutes au plus) : santé, cron, pic d'erreurs, tâches abandonnées,
 * webhooks Stripe non livrés, plafond de coût du jour → alertes e-mail (anti-spam 1/h/type) et pause des tâches
 * non urgentes si le plafond est dépassé.
 *
 * Déclencheurs (aucun n'est indispensable, le premier qui passe fait le contrôle) :
 * - le worker /api/cron/worker (pg_cron chaque minute, ou cron Vercel quotidien) ;
 * - chaque appel à /api/health (le moniteur de disponibilité externe, toutes les 5 minutes) ;
 * - POST /api/ops/tick (Bearer CRON_SECRET), par ex. une seconde tâche pg_cron.
 */
import { after } from 'next/server';
import { getDoc, putDoc } from '@/lib/store';
import { log } from '@/lib/log';
import { getStripe } from '@/lib/stripe';
import { sendOpsAlert, type OpsAlertEntry, type SendAlertOptions } from './alerts';
import { dailyCosts, type CostDeps, type DailyCosts } from './costs';
import { OPS, opsConfig } from './config';
import { errorsLastHour } from './errors';
import { pauseForToday, guardState, isPausedState } from './guard';
import { gatherHealth, type HealthReport } from './health';
import { recordHeartbeat } from './heartbeat';

export const TICK_MIN_INTERVAL_MS = 4.5 * 60_000;

export interface StripeUndelivered {
  count: number;
  types: string[];
  oldestAt: string | null;
}

/**
 * Événements Stripe des 24 dernières heures dont la livraison au webhook n'a pas réussi (filtre `delivery_success`
 * de l'API Events), en ignorant les 10 dernières minutes (Stripe réessaie). null si Stripe n'est pas configuré.
 */
export async function stripeUndelivered(now: Date = new Date()): Promise<StripeUndelivered | null> {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null;
  const nowS = Math.floor(now.getTime() / 1000);
  const list = await stripe.events.list({ delivery_success: false, created: { gte: nowS - 86_400, lte: nowS - 600 }, limit: 20 }, { timeout: 5000, maxNetworkRetries: 0 });
  const data = list.data ?? [];
  return {
    count: data.length,
    types: [...new Set(data.map((e) => e.type))].slice(0, 5),
    oldestAt: data.length ? new Date(Math.min(...data.map((e) => e.created)) * 1000).toISOString() : null,
  };
}

interface TickState {
  lastAt: string | null;
  lastDead: number | null;
}

export interface TickDeps extends CostDeps {
  force?: boolean;
  health?: () => Promise<HealthReport>;
  stripe?: (now: Date) => Promise<StripeUndelivered | null>;
  alert?: SendAlertOptions;
}

export interface TickReport {
  skipped: boolean;
  at: string;
  status?: HealthReport['status'];
  costs?: DailyCosts;
  paused?: boolean;
  errorsHour?: number;
  alerts: OpsAlertEntry[];
}

const fmtEur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export async function runOpsTick(deps: TickDeps = {}): Promise<TickReport> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? process.env;
  const cfg = opsConfig(env);
  const report: TickReport = { skipped: false, at: now.toISOString(), alerts: [] };
  const state: TickState = { lastAt: null, lastDead: null, ...((await getDoc<TickState>(OPS.state, 'tick').catch(() => null))?.data ?? {}) };
  if (!deps.force && state.lastAt && now.getTime() - new Date(state.lastAt).getTime() < TICK_MIN_INTERVAL_MS) {
    return { ...report, skipped: true };
  }
  // Réserver le créneau tout de suite : deux déclencheurs simultanés ne doublent pas les contrôles.
  await putDoc<TickState>(OPS.state, 'tick', { ...state, lastAt: now.toISOString() }).catch(() => undefined);
  const alert = (kind: Parameters<typeof sendOpsAlert>[0], lines: string[]) =>
    sendOpsAlert(kind, lines, { now, env, ...deps.alert }).then((e) => {
      report.alerts.push(e);
    });

  // 1. Santé
  const health = await (deps.health ?? (() => gatherHealth(now)))().catch(() => null);
  if (health) {
    report.status = health.status;
    const failed = Object.entries(health.checks).filter(([, l]) => l === 'fail').map(([k]) => k);
    if (failed.length) {
      const d = health.detail;
      await alert('health_fail', [
        `Vérifications en échec : ${failed.join(', ')}.`,
        ...(d.db.error ? [`Base : ${d.db.error}`] : []),
        ...(d.jobs.error ? [`File : ${d.jobs.error}`] : []),
        ...d.env.errors.slice(0, 5).map((e) => `Configuration : ${e}`),
      ]);
    }
    if (health.checks.cron !== 'ok') {
      await alert('cron_stale', [
        health.cron.lastWorkerAt
          ? `Dernier passage du worker il y a ${health.cron.ageMin} min (${health.cron.ok === false ? 'en échec' : 'réussi'}).`
          : "Aucun passage du worker enregistré depuis la mise en service de la supervision.",
        'Vérifiez pg_cron (docs/MISE-EN-LIGNE.md, étape 10) ou le cron Vercel.',
      ]);
    }
    // 2. Tâches abandonnées depuis le dernier contrôle
    const dead = health.detail.jobs.stats?.dead ?? null;
    if (dead !== null) {
      if (state.lastDead !== null && dead - state.lastDead >= cfg.deadJobsAlert) {
        await alert('jobs_dead', [`${dead - state.lastDead} nouvelle(s) tâche(s) abandonnée(s) après plusieurs tentatives (total ${dead}).`, 'Détail des erreurs dans /admin/ops (origine « job »).']);
      }
      state.lastDead = dead;
    }
  }

  // 3. Pic d'erreurs
  try {
    const e = await errorsLastHour(now);
    report.errorsHour = e.current;
    const minute = now.getUTCMinutes();
    // Fenêtre glissante approximative : heure en cours + part de la précédente.
    const rolling = Math.round(e.current + (e.previous * (60 - minute)) / 60);
    if (rolling >= cfg.errorSpikePerHour) {
      await alert('error_spike', [`${rolling} erreurs sur la dernière heure (seuil ${cfg.errorSpikePerHour}).`, 'Groupes d’erreurs par signature dans /admin/ops.']);
    }
  } catch {
    /* compteur illisible */
  }

  // 4. Webhooks Stripe non livrés
  try {
    const s = await (deps.stripe ?? stripeUndelivered)(now);
    if (s && s.count > 0) {
      await alert('stripe_webhook', [
        `${s.count} événement(s) Stripe non livré(s) au webhook sur 24 h (${s.types.join(', ')}).`,
        `Le plus ancien : ${s.oldestAt}. Stripe réessaie pendant 3 jours ; vérifiez Stripe › Développeurs › Webhooks.`,
      ]);
    }
  } catch (e) {
    log.warn('ops.stripe_check_failed', { error: e instanceof Error ? e.message : String(e) });
  }

  // 5. Coûts du jour et garde-fou
  try {
    const costs = await dailyCosts({ now, env, audits: deps.audits });
    report.costs = costs;
    if (costs.over) {
      let paused = false;
      if (cfg.pauseOnCap) {
        await pauseForToday(`Dépense estimée ${fmtEur(costs.totalEur)} > plafond ${fmtEur(costs.capEur)}`, now);
        paused = isPausedState(await guardState(), now);
      }
      report.paused = paused;
      await alert('cost_cap', [
        `Dépense estimée du jour : ${fmtEur(costs.totalEur)} pour un plafond de ${fmtEur(costs.capEur)} (OPS_DAILY_COST_CAP_EUR).`,
        paused ? 'Les tâches non urgentes sont en pause jusqu’à demain ; les audits payés et les webhooks continuent.' : 'Aucune pause (OPS_PAUSE_ON_CAP=off ou levée par l’admin).',
        'Lever la pause pour la journée : /admin/ops.',
      ]);
    }
  } catch (e) {
    log.warn('ops.costs_failed', { error: e instanceof Error ? e.message : String(e) });
  }

  await putDoc<TickState>(OPS.state, 'tick', { ...state, lastAt: now.toISOString() }).catch(() => undefined);
  await recordHeartbeat('ops.tick', true, { detail: { status: report.status ?? null, alerts: report.alerts.length } }, now);
  return report;
}

/** Lance `fn` après la réponse HTTP (`after()` de Next) ; hors requête (tests, scripts) : ne fait rien. Ne lève jamais. */
export function afterResponse(fn: () => Promise<unknown>): void {
  try {
    after(() => fn().then(() => undefined).catch(() => undefined));
  } catch {
    /* hors du contexte d'une requête */
  }
}
