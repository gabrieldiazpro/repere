/** Derniers passages des crons et du worker (collection `ops.heartbeat`, un document par nom). */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { OPS } from './config';

export interface Heartbeat {
  name: string;
  at: string;
  ok: boolean;
  durationMs?: number;
  detail?: Record<string, unknown>;
}

/** Ne lève jamais. */
export async function recordHeartbeat(name: string, ok = true, extra: Omit<Heartbeat, 'name' | 'at' | 'ok'> = {}, now: Date = new Date()): Promise<void> {
  try {
    await putDoc<Heartbeat>(OPS.heartbeat, name, { name, at: now.toISOString(), ok, ...extra });
  } catch {
    /* store indisponible : la santé le signalera */
  }
}

export async function getHeartbeat(name: string): Promise<Heartbeat | null> {
  return (await getDoc<Heartbeat>(OPS.heartbeat, name))?.data ?? null;
}

export async function listHeartbeats(): Promise<Heartbeat[]> {
  return (await listDocs<Heartbeat>(OPS.heartbeat, { limit: 50 })).map((d) => d.data);
}
