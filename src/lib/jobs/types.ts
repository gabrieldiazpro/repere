/** Types de la file de tâches (contrat docs/v3/12-CONTRATS-V3.md, agent TACHES-FOND). */

export const JOB_TYPES = [
  'audit.run',
  'audit.scheduled',
  'tasks.generate',
  'digest.send',
  'report.scheduled',
  'measure.action',
  'siteaudit.run',
  'webhook.deliver',
  // V5 (INTEGRATION-V5) — supabase/migrations/0006_jobs_v5.sql élargit la contrainte de la table `jobs`.
  'seodata.gsc.sync',
  'seodata.rank.weekly',
  'seodata.rank.collect',
  'publish.verify',
  'analysis.rerun',
  'analysis.scheduled',
  'barometre.run',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type JobStatus = 'queued' | 'running' | 'done' | 'dead';

/** Charge utile reçue par un gestionnaire : la charge enfilée + `_job` (id, tentative, signal d'annulation). */
export type JobPayload = Record<string, unknown>;

export interface JobContext {
  id: string;
  type: JobType;
  attempt: number;
  maxAttempts: number;
  /** Annulé quand le délai par tâche (JOBS_TIMEOUT_MS) est dépassé. */
  signal: AbortSignal;
}

/**
 * Gestionnaire : doit être **idempotent** (une tâche peut être rejouée après un plantage ou un délai dépassé).
 * Peut renvoyer un petit objet JSON (résultat visible par GET /api/jobs/[id]).
 */
export type JobHandler = (payload: JobPayload) => Promise<void | Record<string, unknown>>;

export interface EnqueueOptions {
  runAt?: Date;
  /** Clé d'unicité : une seconde mise en file avec la même clé renvoie la tâche existante (quel que soit son statut). */
  dedupeKey?: string;
  businessId?: string;
  /** 1 = le plus urgent (défaut selon le type). */
  priority?: number;
  maxAttempts?: number;
}

export interface Job {
  id: string;
  type: JobType;
  payload: JobPayload;
  businessId: string | null;
  dedupeKey: string | null;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  lastError: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface NewJob {
  type: JobType;
  payload: JobPayload;
  businessId: string | null;
  dedupeKey: string | null;
  priority: number;
  maxAttempts: number;
  runAt: Date;
}

export interface JobStats {
  queued: number;
  running: number;
  done: number;
  dead: number;
  /** Âge en minutes de la plus ancienne tâche prête et non prise (null si aucune). */
  oldestQueuedMin: number | null;
  backend: 'memory' | 'supabase';
}

/** Persistance de la file : mémoire (démo) ou Postgres (Supabase, verrou `for update skip locked`). */
export interface JobBackend {
  readonly kind: 'memory' | 'supabase';
  insert(job: NewJob): Promise<{ job: Job; created: boolean }>;
  /** Réserve jusqu'à `limit` tâches prêtes (ou dont le bail a expiré), incrémente `attempts`. */
  claim(workerId: string, limit: number, leaseMs: number): Promise<Job[]>;
  complete(id: string, workerId: string, result: Record<string, unknown> | null): Promise<void>;
  retry(id: string, workerId: string, error: string, runAt: Date): Promise<void>;
  kill(id: string, workerId: string, error: string): Promise<void>;
  get(id: string): Promise<Job | null>;
  stats(): Promise<JobStats>;
  listByBusiness(businessId: string, limit?: number): Promise<Job[]>;
  deleteByBusiness(businessId: string): Promise<number>;
}

/** Erreur définitive : la tâche passe directement en `dead`, sans nouvelle tentative. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export const DEFAULT_PRIORITY: Record<JobType, number> = {
  'audit.run': 1,
  'webhook.deliver': 2,
  'tasks.generate': 3,
  'measure.action': 4,
  'siteaudit.run': 4,
  'digest.send': 5,
  'report.scheduled': 5,
  'audit.scheduled': 6,
  'seodata.gsc.sync': 5,
  'seodata.rank.weekly': 6,
  'seodata.rank.collect': 6,
  'publish.verify': 4,
  'analysis.rerun': 6,
  'analysis.scheduled': 7,
  'barometre.run': 8,
};
