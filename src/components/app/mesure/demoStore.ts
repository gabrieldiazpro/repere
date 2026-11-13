// Modifications faites sur un compte démo : gardées sur cet appareil (jamais envoyées), toujours signalées « démo ».
const KEY = 'rp_mesure_demo_v3';

export interface DemoNote {
  id: string;
  date: string;
  label: string;
}

export interface DemoPromptEdit {
  text?: string;
  theme?: string;
  tags?: string[];
  active?: boolean;
}

export interface DemoPromptNew {
  id: string;
  text: string;
  theme: string;
  tags: string[];
  active: boolean;
  createdAt: string;
}

interface State {
  notes: Record<string, DemoNote[]>;
  edits: Record<string, Record<string, DemoPromptEdit>>;
  added: Record<string, DemoPromptNew[]>;
}

function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { notes: {}, edits: {}, added: {}, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    /* stockage indisponible */
  }
  return { notes: {}, edits: {}, added: {} };
}

function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* tant pis : l'état reste affiché jusqu'au rechargement */
  }
}

const rid = () => `local_${Math.random().toString(36).slice(2, 10)}`;

export const demoStore = {
  notes: (businessId: string): DemoNote[] => read().notes[businessId] ?? [],
  addNote(businessId: string, date: string, label: string): DemoNote {
    const s = read();
    const n = { id: rid(), date, label };
    s.notes[businessId] = [...(s.notes[businessId] ?? []), n];
    write(s);
    return n;
  },
  removeNote(businessId: string, id: string) {
    const s = read();
    s.notes[businessId] = (s.notes[businessId] ?? []).filter((n) => n.id !== id);
    write(s);
  },
  edits: (businessId: string) => read().edits[businessId] ?? {},
  edit(businessId: string, promptId: string, patch: DemoPromptEdit) {
    const s = read();
    const all = s.edits[businessId] ?? {};
    all[promptId] = { ...(all[promptId] ?? {}), ...patch };
    s.edits[businessId] = all;
    write(s);
  },
  added: (businessId: string): DemoPromptNew[] => read().added[businessId] ?? [],
  add(businessId: string, p: Omit<DemoPromptNew, 'id' | 'createdAt'>): DemoPromptNew {
    const s = read();
    const n = { ...p, id: rid(), createdAt: new Date().toISOString() };
    s.added[businessId] = [...(s.added[businessId] ?? []), n];
    write(s);
    return n;
  },
  reset(businessId: string) {
    const s = read();
    delete s.notes[businessId];
    delete s.edits[businessId];
    delete s.added[businessId];
    write(s);
  },
};
