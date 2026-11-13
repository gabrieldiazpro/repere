/**
 * Parallaxe légère (primitive 7) : ±24 px liés au défilement, en CSS pur (animation-timeline: view()).
 * À réserver aux trames et halos décoratifs, jamais au texte. Sans support ou en mouvement réduit : statique.
 */
import type { ReactNode } from "react";

export function Parallax({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div aria-hidden="true" className={`plx ${className}`}>
      {children}
    </div>
  );
}

export default Parallax;
