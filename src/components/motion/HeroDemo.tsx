"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { QuickAuditForm } from "./QuickAuditForm";
import { HeroScene } from "./scenes/HeroScene";
import type { HeroSceneData, HeroSegment } from "./scenes/hero-data";

const TABS: { seg: HeroSegment; label: string; short?: string }[] = [
  { seg: "local", label: "Artisan, commerce", short: "Commerce" },
  { seg: "pme", label: "PME et services", short: "PME" },
  { seg: "ecommerce", label: "E-commerce" },
];

/**
 * Hero de l'accueil (docs/v3/07 §5.2). `children` = pastille, H1 et sous-titre, rendus côté serveur (le H1 est
 * l'élément LCP et n'est jamais animé). À gauche : onglets de parcours, mini-formulaire visible au premier écran
 * sur mobile, liens vers la démo. À droite : la scène « Qui l'IA recommande ? », relancée à chaque onglet.
 */
export function HeroDemo({
  children,
  scenes,
  defaultSegment = "local",
}: {
  children: ReactNode;
  /** Scènes des 3 comptes démo, calculées côté serveur (src/components/site/demo-figures.ts). */
  scenes: Record<HeroSegment, HeroSceneData>;
  defaultSegment?: HeroSegment;
}) {
  const [seg, setSeg] = useState<HeroSegment>(defaultSegment);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
      <div>
        {children}

        <div className="mt-7 max-w-xl">
          <fieldset>
            <legend className="text-[0.9rem] font-semibold text-ink">Votre activité</legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:inline-grid sm:grid-cols-[auto_auto_auto]">
              {TABS.map((t) => (
                <button
                  key={t.seg}
                  type="button"
                  aria-pressed={seg === t.seg}
                  onClick={() => setSeg(t.seg)}
                  className={`min-h-10 rounded-lg px-1.5 text-[0.84rem] font-semibold leading-tight sm:px-3 sm:text-[0.92rem] transition-colors duration-[var(--dur-base)] ${
                    seg === t.seg ? "bg-primary text-white" : "text-ink/75 hover:bg-primary-bg hover:text-primary"
                  }`}
                >
                  {t.short ? (
                    <>
                      <span className="sm:hidden">{t.short}</span>
                      <span className="max-sm:hidden">{t.label}</span>
                    </>
                  ) : (
                    t.label
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <QuickAuditForm segment={seg} idPrefix="hero" className="mt-4" />
        <div className="max-w-xl">
          <p className="mt-2.5 text-[0.88rem] text-muted">Gratuit, sans carte bancaire. Résultat en quelques minutes.</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M4.5 2.8v10.4L13 8z" />
            </svg>
            Voir la démo
          </Link>
          <Link
            href={`/app?visite=1&segment=${seg}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            Visiter le compte démo
          </Link>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xl lg:mt-2 lg:max-w-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-10 -z-0 rounded-[3rem] bg-[radial-gradient(60%_55%_at_60%_40%,rgba(55,48,163,.13),transparent_70%),radial-gradient(40%_40%_at_25%_85%,rgba(245,165,36,.14),transparent_70%)]"
        />
        <div className="relative">
          <HeroScene segment={seg} data={scenes[seg]} />
        </div>
      </div>
    </div>
  );
}

export default HeroDemo;
