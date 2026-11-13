// État local du mode démo (cet appareil seulement) : statuts de tâches, tâches créées, fiche de vérité.
// Sert de repli quand les routes API ne sont pas disponibles ; toujours dit à l'écran.
import type { BrandFactField, ExecTask, TaskStatus } from '@/lib/engine/types-v2';
import { DEMO_TASKS_COOKIE, serializeDemoTaskState, type DemoTaskState } from './demoTaskState';

const K = 'rp_demo_v2';

interface LocalState {
  status: Record<string, TaskStatus>;
  /** date « C'est fait » (ISO) par tâche : sans elle, une action cochée retombait en bas après rechargement */
  doneAt: Record<string, string>;
  created: ExecTask[];
  facts: Record<string, Partial<Record<BrandFactField, string>>>;
}

function read(): LocalState {
  try {
    const raw = localStorage.getItem(K);
    if (raw) return { status: {}, doneAt: {}, created: [], facts: {}, ...(JSON.parse(raw) as Partial<LocalState>) };
  } catch {
    /* stockage indisponible */
  }
  return { status: {}, doneAt: {}, created: [], facts: {} };
}

function write(s: LocalState) {
  try {
    localStorage.setItem(K, JSON.stringify(s));
  } catch {
    /* tant pis */
  }
  // Copie compacte dans un cookie (30 jours) : le rendu serveur de l'accueil et du Centre d'actions la relit.
  try {
    const state: DemoTaskState = Object.fromEntries(Object.entries(s.status).map(([id, status]) => [id, { status, ...(s.doneAt[id] ? { doneAt: s.doneAt[id] } : {}) }]));
    document.cookie = `${DEMO_TASKS_COOKIE}=${serializeDemoTaskState(state)}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`;
  } catch {
    /* cookies indisponibles */
  }
}

export const localDemo = {
  status: () => read().status,
  /** statut et date « fait » de chaque tâche changée sur cet appareil */
  taskState(): DemoTaskState {
    const s = read();
    return Object.fromEntries(Object.entries(s.status).map(([id, status]) => [id, { status, ...(status === 'done' && s.doneAt[id] ? { doneAt: s.doneAt[id] } : {}) }]));
  },
  setStatus(id: string, st: TaskStatus, at: Date = new Date()) {
    const s = read();
    s.status[id] = st;
    if (st === 'done') s.doneAt[id] = s.doneAt[id] ?? at.toISOString();
    else delete s.doneAt[id];
    write(s);
  },
  created: (businessId: string) => read().created.filter((t) => t.businessId === businessId),
  addTask(t: ExecTask) {
    const s = read();
    s.created = [t, ...s.created.filter((x) => x.id !== t.id)];
    write(s);
  },
  facts: (businessId: string) => read().facts[businessId] ?? null,
  setFacts(businessId: string, f: Partial<Record<BrandFactField, string>>) {
    const s = read();
    s.facts[businessId] = f;
    write(s);
  },
};

/** En-têtes des appels d'API de l'app : la session part dans le cookie httpOnly (jamais lu en JavaScript). */
export function sessionHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}
