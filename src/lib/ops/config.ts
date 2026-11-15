/**
 * Réglages de la supervision (toutes facultatives, valeurs par défaut sûres). Voir .env.example, section « Supervision ».
 */
type Source = Record<string, string | undefined>;

function num(k: string, def: number, source: Source): number {
  const raw = source[k]?.trim();
  if (!raw) return def;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export interface OpsConfig {
  /** Destinataire des alertes (vide : alertes seulement journalisées et visibles dans /admin/ops). */
  alertEmail: string | null;
  /** Plafond de dépense estimée des fournisseurs (IA, DataForSEO) par jour de Paris, en euros. 0 = pas de plafond. */
  dailyCostCapEur: number;
  /** Mettre en pause les tâches non urgentes quand le plafond est dépassé (défaut : oui). */
  pauseOnCap: boolean;
  /** Erreurs par heure glissante au-delà desquelles on alerte. */
  errorSpikePerHour: number;
  /** Nouvelles tâches abandonnées (dead) depuis le dernier contrôle au-delà desquelles on alerte. */
  deadJobsAlert: number;
  /** Âge maximal (minutes) du dernier passage du worker avant de signaler un cron arrêté. */
  cronMaxAgeMin: number;
  /** Intervalle minimal entre deux alertes d'un même type (minutes). */
  alertThrottleMin: number;
}

export function opsConfig(source: Source = process.env): OpsConfig {
  const email = source.ALERT_EMAIL?.trim();
  return {
    alertEmail: email && /.+@.+\..+/.test(email) ? email : null,
    dailyCostCapEur: num('OPS_DAILY_COST_CAP_EUR', 10, source),
    pauseOnCap: (source.OPS_PAUSE_ON_CAP ?? 'on').trim().toLowerCase() !== 'off',
    errorSpikePerHour: Math.max(1, num('OPS_ERROR_SPIKE_PER_HOUR', 20, source)),
    deadJobsAlert: Math.max(1, num('OPS_DEAD_JOBS_ALERT', 1, source)),
    // Vercel Hobby : un passage par jour sans pg_cron (25 h de marge) ; avec pg_cron, mettre 10.
    cronMaxAgeMin: Math.max(2, num('OPS_CRON_MAX_AGE_MIN', 1500, source)),
    alertThrottleMin: 60,
  };
}

/** Collections du store (préfixe `ops.`). */
export const OPS = {
  errors: 'ops.errors',
  errorCount: 'ops.errcount',
  alerts: 'ops.alerts',
  alertLog: 'ops.alertlog',
  heartbeat: 'ops.heartbeat',
  incidents: 'ops.incidents',
  state: 'ops.state',
  costs: 'ops.costs',
  costSnap: 'ops.costsnap',
} as const;

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });

/** Jour de Paris « AAAA-MM-JJ ». */
export function parisDay(d: Date = new Date()): string {
  return dayFmt.format(d);
}

/** Heure de Paris « AAAA-MM-JJTHH ». */
export function parisHour(d: Date = new Date()): string {
  const p = Object.fromEntries(hourFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}`;
}

/** Début du jour de Paris contenant `d`, en UTC. */
export function parisDayStart(d: Date = new Date()): Date {
  const day = parisDay(d);
  // On cherche l'instant UTC dont le jour de Paris vaut `day` à 00 h : décalage +1 h ou +2 h selon l'heure d'été.
  for (const offset of [-1, -2, 0]) {
    const t = new Date(`${day}T00:00:00Z`);
    t.setUTCHours(t.getUTCHours() + offset);
    if (parisDay(t) === day && parisHour(t).endsWith('T00')) return t;
  }
  return new Date(`${day}T00:00:00Z`);
}

/** Début du jour de Paris suivant, en UTC. */
export function nextParisDayStart(d: Date = new Date()): Date {
  return parisDayStart(new Date(parisDayStart(d).getTime() + 26 * 3600_000));
}
