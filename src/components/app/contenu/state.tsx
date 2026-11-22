'use client';
// État partagé des écrans « Contenus ». Compte réel : actions serveur (src/app/app/contenu/actions.ts) puis
// rafraîchissement. Compte démo : SIMULATION dans le navigateur (sessionStorage), jamais envoyée au serveur.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ContentDraft, ContentOpportunity, MentionTracking } from '@/lib/content/types';
import type { ContentData } from './server';

interface Sim {
  drafts: Record<string, ContentDraft>;
  tracking: Record<string, MentionTracking>;
  dismissed: string[];
}

interface Ctx extends ContentData {
  putDraft: (d: ContentDraft) => void;
  putTracking: (t: MentionTracking) => void;
  dismiss: (opId: string) => void;
  refresh: () => void;
  resetSimulation: () => void;
  simulated: boolean;
  quotaUsed: number;
}

const C = createContext<Ctx | null>(null);
const key = (b: string) => `rp-contenu-sim:${b}`;

function readSim(b: string): Sim | null {
  try {
    const raw = window.sessionStorage.getItem(key(b));
    return raw ? (JSON.parse(raw) as Sim) : null;
  } catch {
    return null;
  }
}
function writeSim(b: string, s: Sim | null) {
  try {
    if (s) window.sessionStorage.setItem(key(b), JSON.stringify(s));
    else window.sessionStorage.removeItem(key(b));
  } catch {
    /* navigation privée : la simulation reste en mémoire */
  }
}

export function ContentProvider({ initial, children }: { initial: ContentData; children: ReactNode }) {
  const router = useRouter();
  const [sim, setSim] = useState<Sim | null>(null);
  const [live, setLive] = useState<{ drafts: Record<string, ContentDraft>; tracking: Record<string, MentionTracking>; dismissed: string[] }>({ drafts: {}, tracking: {}, dismissed: [] });

  useEffect(() => {
    if (initial.demo) setSim(readSim(initial.businessId));
  }, [initial.demo, initial.businessId]);
  // Après un rafraîchissement serveur, les données serveur font foi.
  useEffect(() => {
    setLive({ drafts: {}, tracking: {}, dismissed: [] });
  }, [initial]);

  const update = useCallback(
    (fn: (s: Sim) => Sim) => {
      if (initial.demo) {
        setSim((prev) => {
          const next = fn(prev ?? { drafts: {}, tracking: {}, dismissed: [] });
          writeSim(initial.businessId, next);
          return next;
        });
      } else setLive((prev) => fn(prev));
    },
    [initial.demo, initial.businessId],
  );

  const value = useMemo<Ctx>(() => {
    const over = initial.demo ? (sim ?? { drafts: {}, tracking: {}, dismissed: [] }) : live;
    const known = new Set(initial.drafts.map((d) => d.id));
    const drafts = [...Object.values(over.drafts).filter((d) => !known.has(d.id)), ...initial.drafts.map((d) => over.drafts[d.id] ?? d)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const taken = new Set(drafts.filter((d) => d.status !== 'rejected').map((d) => d.opportunityId));
    const opportunities: ContentOpportunity[] = initial.opportunities.filter((o) => !taken.has(o.id) && !over.dismissed.includes(o.id));
    const tracking = [...initial.tracking.filter((t) => !over.tracking[t.id]), ...Object.values(over.tracking)];
    const month = new Date().toISOString().slice(0, 7);
    const quotaUsed = drafts.filter((d) => d.consumedAt?.slice(0, 7) === month).length;
    return {
      ...initial,
      drafts,
      opportunities,
      tracking,
      quotaUsed,
      quota: { ...initial.quota, used: quotaUsed, left: Math.max(0, initial.quota.limit - quotaUsed) },
      putDraft: (d) => update((s) => ({ ...s, drafts: { ...s.drafts, [d.id]: d } })),
      putTracking: (t) => update((s) => ({ ...s, tracking: { ...s.tracking, [t.id]: t } })),
      dismiss: (id) => update((s) => ({ ...s, dismissed: [...s.dismissed, id] })),
      refresh: () => router.refresh(),
      resetSimulation: () => {
        writeSim(initial.businessId, null);
        setSim(null);
      },
      simulated: !!sim && (Object.keys(sim.drafts).length > 0 || Object.keys(sim.tracking).length > 0 || sim.dismissed.length > 0),
    };
  }, [initial, sim, live, update, router]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useContent(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('useContent hors de ContentProvider');
  return v;
}
