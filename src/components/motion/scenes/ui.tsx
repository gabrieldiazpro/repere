/** Petits éléments partagés des scènes produit (rendu identique aux maquettes statiques de mockups.tsx). */
import type { ReactNode } from "react";
import { LogoMark } from "@/components/site/Logo";

export function SceneFrame({ account, path, children }: { account: string; path: string; children: ReactNode }) {
  return (
    <div className="app-frame relative overflow-hidden text-ink">
      <div className="flex items-center gap-2 border-b border-line/80 bg-canvas/70 px-3.5 py-2.5 text-[0.8rem]">
        <LogoMark size={18} />
        <span className="truncate font-semibold">{account}</span>
        <span aria-hidden="true" className="text-line">/</span>
        <span className="truncate text-muted">{path}</span>
        <span className="ml-auto shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Démo</span>
      </div>
      <div className="relative p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function Tick({ ok, label, className = "" }: { ok: boolean; label: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${
        ok ? "bg-success-bg text-success-ink" : "bg-danger-bg text-danger-ink"
      } ${className}`}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="sc-check">
        {ok ? (
          <path d="M2.5 6.3l2.2 2.2L9.5 3.7" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M3 3l6 6M9 3l-6 6" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </span>
  );
}

/** Classe d'apparition : `invisible` avant l'étape (la place reste réservée : CLS 0), animation à l'étape. */
export const reach = (phase: number, n: number, cls = "sc-enter") => (phase >= n ? cls : "invisible");

export const i = (n: number) => ({ ["--i" as string]: n });
