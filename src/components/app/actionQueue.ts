// File locale des coches d'actions faites hors ligne (iOS n'a pas Background Sync) :
// rejouée aux événements `online` et `visibilitychange`.
const KEY = 'rp_action_queue_v1';

export interface QueuedAction { businessId: string; actionId: string; done: boolean; at: number }

function read(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function write(list: QueuedAction[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : tant pis, l'état reste affiché */
  }
}

export function pendingFor(businessId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const q of read()) if (q.businessId === businessId) out[q.actionId] = q.done;
  return out;
}

export function enqueue(item: Omit<QueuedAction, 'at'>) {
  const list = read().filter((q) => !(q.businessId === item.businessId && q.actionId === item.actionId));
  list.push({ ...item, at: Date.now() });
  write(list);
}

/**
 * Session : cookie httpOnly envoyé automatiquement (credentials same-origin), jamais lu en JavaScript.
 * Un refus définitif (compte démo en lecture seule, accès refusé) retire l'action de la file : seules les erreurs
 * réseau ou serveur (5xx, 429) la gardent pour un nouvel essai.
 */
export async function postAction(item: Omit<QueuedAction, 'at'>): Promise<boolean> {
  const res = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
    credentials: 'same-origin',
  });
  return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429);
}

let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const q of read()) {
      try {
        if (await postAction(q)) {
          write(read().filter((x) => !(x.businessId === q.businessId && x.actionId === q.actionId && x.at === q.at)));
          sent++;
        }
      } catch {
        break; // toujours hors ligne
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
