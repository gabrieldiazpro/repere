// Création d'une tâche depuis un écran (audit de page, technique, vérité…) : POST /api/exec/tasks.
// Compte démo (lecture seule côté serveur) : la tâche est gardée sur cet appareil et le dit.
import type { ExecTask } from '@/lib/engine/types-v2';
import { localDemo, sessionHeaders } from '../localDemo';

export interface NewTask {
  title: string;
  why?: string;
  minutes?: number;
  impact?: 1 | 2 | 3;
  steps?: string[];
}

export type CreateResult = { ok: true; demo: boolean; task: ExecTask } | { ok: false; error: string };

export function clampTask(t: NewTask): NewTask {
  const title = t.title.replace(/\s+/g, ' ').trim();
  return {
    title: title.length > 160 ? `${title.slice(0, 157)}…` : title.padEnd(3, '.'),
    why: t.why?.slice(0, 600),
    minutes: t.minutes ? Math.min(600, Math.max(1, Math.round(t.minutes))) : undefined,
    impact: t.impact,
    steps: t.steps?.filter(Boolean).slice(0, 12).map((s) => s.slice(0, 300)),
  };
}

export async function createTask(businessId: string, demo: boolean, input: NewTask): Promise<CreateResult> {
  const task = clampTask(input);
  try {
    const res = await fetch('/api/exec/tasks', {
      method: 'POST',
      headers: sessionHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ businessId, task }),
    });
    const j = (await res.json().catch(() => null)) as { task?: ExecTask; error?: string } | null;
    if (res.ok && j?.task) return { ok: true, demo: false, task: j.task };
    if (!demo) return { ok: false, error: j?.error ?? 'La tâche n’a pas été créée. Réessayez.' };
  } catch {
    if (!demo) return { ok: false, error: 'La tâche n’a pas été créée : vérifiez votre connexion puis réessayez.' };
  }
  const local: ExecTask = {
    id: `local-${Date.now().toString(36)}`,
    businessId,
    kind: 'other',
    title: task.title,
    why: task.why ?? '',
    automation: 'guide',
    minutes: task.minutes ?? 30,
    impact: task.impact ?? 2,
    status: 'todo',
    steps: task.steps,
    createdAt: new Date().toISOString(),
  };
  localDemo.addTask(local);
  return { ok: true, demo: true, task: local };
}
