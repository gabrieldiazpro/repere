'use client';
// État partagé des écrans de l'agent. Compte réel : réponses des routes /api/v5/publish (puis rafraîchissement serveur).
// Compte démo : SIMULATION dans le navigateur (sessionStorage), jamais envoyée au serveur.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../metiers/client';
import type { PublishConnectionView } from '@/lib/publish/connections';
import type { AgentSettings, ChangeSet, JournalEntry, ViewerRole } from './model';
import type { AgentEffect } from './effect';

export interface AgentClientData {
  businessId: string;
  demo: boolean;
  role: ViewerRole;
  meId: string | null;
  changeSets: ChangeSet[];
  journal: JournalEntry[];
  connections: PublishConnectionView[];
  effects: Record<string, AgentEffect>;
  settings: AgentSettings;
}

interface Sim {
  cs: Record<string, ChangeSet>;
  journal: JournalEntry[];
  connections?: PublishConnectionView[];
  settings?: AgentSettings;
}

interface Ctx extends AgentClientData {
  /** remplace une proposition (réponse du serveur ou simulation) */
  putChangeSet: (cs: ChangeSet, entries?: JournalEntry[]) => void;
  putConnections: (c: PublishConnectionView[], entries?: JournalEntry[]) => void;
  putSettings: (s: AgentSettings) => void;
  /** POST vers une route de l'agent (comptes réels) */
  post: <T>(url: string, body: Record<string, unknown>, method?: string) => Promise<{ ok: boolean; data?: T; error?: string; code?: string }>;
  refresh: () => void;
  resetSimulation: () => void;
  simulated: boolean;
}

const AgentCtx = createContext<Ctx | null>(null);

const key = (b: string) => `rp-agent-sim:${b}`;

function readSim(businessId: string): Sim | null {
  try {
    const raw = window.sessionStorage.getItem(key(businessId));
    return raw ? (JSON.parse(raw) as Sim) : null;
  } catch {
    return null;
  }
}

function writeSim(businessId: string, sim: Sim | null) {
  try {
    if (sim) window.sessionStorage.setItem(key(businessId), JSON.stringify(sim));
    else window.sessionStorage.removeItem(key(businessId));
  } catch {
    /* navigation privée : la simulation reste en mémoire */
  }
}

export function AgentProvider({ initial, children }: { initial: AgentClientData; children: ReactNode }) {
  const router = useRouter();
  const [sim, setSim] = useState<Sim | null>(null);
  const [live, setLive] = useState<{ cs: Record<string, ChangeSet>; journal: JournalEntry[]; connections?: PublishConnectionView[]; settings?: AgentSettings }>({ cs: {}, journal: [] });

  useEffect(() => {
    if (initial.demo) setSim(readSim(initial.businessId));
  }, [initial.demo, initial.businessId]);

  // Après un rafraîchissement serveur (compte réel), les données serveur font foi.
  useEffect(() => {
    setLive({ cs: {}, journal: [] });
  }, [initial]);

  const overlay = initial.demo ? sim : live;

  const value = useMemo<Ctx>(() => {
    const o = overlay ?? { cs: {}, journal: [] };
    const ids = new Set(initial.changeSets.map((c) => c.id));
    const changeSets = [...initial.changeSets.map((c) => o.cs[c.id] ?? c), ...Object.values(o.cs).filter((c) => !ids.has(c.id))];
    const journal = [...o.journal, ...initial.journal].sort((a, b) => b.at.localeCompare(a.at));
    const update = (fn: (s: Sim) => Sim) => {
      if (initial.demo) {
        setSim((prev) => {
          const next = fn(prev ?? { cs: {}, journal: [] });
          writeSim(initial.businessId, next);
          return next;
        });
      } else setLive((prev) => fn(prev));
    };
    return {
      ...initial,
      changeSets,
      journal,
      connections: o.connections ?? initial.connections,
      settings: o.settings ?? initial.settings,
      simulated: Boolean(initial.demo && sim && (Object.keys(sim.cs).length || sim.journal.length || sim.connections || sim.settings)),
      putChangeSet: (cs, entries = []) => update((s) => ({ ...s, cs: { ...s.cs, [cs.id]: cs }, journal: [...entries, ...s.journal] })),
      putConnections: (c, entries = []) => update((s) => ({ ...s, connections: c, journal: [...entries, ...s.journal] })),
      putSettings: (st) => update((s) => ({ ...s, settings: st })),
      post: async <T,>(url: string, body: Record<string, unknown>, method = 'POST') => {
        const r = await api<T>(url, { method, body: { businessId: initial.businessId, ...body } });
        return { ok: r.ok, data: r.data, error: r.error, code: r.code };
      },
      refresh: () => router.refresh(),
      resetSimulation: () => {
        writeSim(initial.businessId, null);
        setSim(null);
      },
    };
  }, [initial, overlay, sim, router]);

  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}

export function useAgent(): Ctx {
  const c = useContext(AgentCtx);
  if (!c) throw new Error('useAgent hors de AgentProvider');
  return c;
}

/** Petite aide : renvoie une fonction stable qui attend `ms` (la progression animée reste lisible même si le serveur répond vite). */
export function useWait() {
  return useCallback((ms: number) => new Promise<void>((r) => setTimeout(r, ms)), []);
}
