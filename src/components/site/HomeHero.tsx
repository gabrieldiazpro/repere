"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { QuickAuditForm } from "@/components/motion/QuickAuditForm";

type Seg = "local" | "pme" | "ecommerce";

const TABS: { seg: Seg; label: string; short: string }[] = [
  { seg: "local", label: "Commerce local", short: "Local" },
  { seg: "pme", label: "PME, services B2B", short: "PME" },
  { seg: "ecommerce", label: "E-commerce", short: "E-commerce" },
];

/**
 * Hero de l'accueil V5. `children` = H1 et sous-titre, rendus côté serveur (le H1 est l'élément LCP, jamais animé).
 * Un seul appel principal : « Analyser mon site » → /analyse?site=… (formulaire QuickAuditForm, branché par ANALYSE-UI :
 * une adresse part vers l'analyse 60 s, un simple nom vers le test de visibilité IA). Le type de site adapte l'exemple
 * et transmet `segment` à l'analyse. `preview` = aperçu d'analyse rendu côté serveur.
 */
export function HomeHero({ children, preview }: { children: ReactNode; preview?: ReactNode }) {
  const [seg, setSeg] = useState<Seg>("local");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = TABS.findIndex((t) => t.seg === seg);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length;
    if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    if (n >= 0) {
      e.preventDefault();
      setSeg(TABS[n].seg);
      refs.current[n]?.focus();
    }
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-14">
      <div>
        {children}

        <QuickAuditForm segment={seg} idPrefix="hero" className="mt-7" submitLabel="Analyser mon site" shortLabel="Analyser" />
        <div className="mt-3 flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2">
          <p id="hero-parcours" className="text-[0.85rem] text-muted">
            Votre site :
          </p>
          <div role="group" aria-labelledby="hero-parcours" className="relative grid flex-1 grid-cols-3 rounded-lg bg-white p-0.5 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-md bg-ink/[.07] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
              style={{ transform: `translateX(${idx * 100}%)` }}
            />
            {TABS.map((t, i) => (
              <button
                key={t.seg}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                aria-pressed={seg === t.seg}
                onClick={() => setSeg(t.seg)}
                onKeyDown={(e) => onKey(e, i)}
                className={`relative min-h-10 rounded-md px-1.5 text-[0.82rem] font-semibold leading-tight transition-colors duration-[var(--dur-base)] sm:text-[0.86rem] ${
                  seg === t.seg ? "text-ink" : "text-ink/60 hover:text-primary"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="max-sm:hidden">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-xl text-[0.88rem] text-muted">Gratuit, sans compte ni carte bancaire. Notre robot respecte votre robots.txt.</p>

        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.95rem]">
          <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M4.5 2.8v10.4L13 8z" />
            </svg>
            Voir la démo en vidéo
          </Link>
          <Link href={`/app?visite=1&segment=${seg}`} rel="nofollow" className="inline-flex min-h-11 items-center text-ink/75 underline-offset-4 hover:text-primary hover:underline">
            Explorer le compte démo
          </Link>
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-xl lg:mt-1 lg:max-w-none">{preview}</div>
    </div>
  );
}

export default HomeHero;
