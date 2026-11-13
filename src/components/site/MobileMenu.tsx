"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import type { NavGroup, NavItem } from "./nav";
import { DEMO_HREF, LOGIN_HREF } from "./nav-links";

/**
 * Menu mobile : actions principales en tête (essai, démo), puis chaque groupe repliable (details/summary natifs,
 * clavier et lecteurs d'écran sans code), Tarifs et Connexion en liens directs.
 */
export function MobileMenu({ groups, links, resources, cta }: { groups: readonly NavGroup[]; links: readonly NavItem[]; resources: NavGroup; cta: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);
  const all = [...groups, resources];
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink ring-1 ring-inset ring-line lg:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {/* Les trois traits deviennent une croix (rotation autour du centre). */}
          <path d="M4 7h16" className="origin-center transition-transform duration-[var(--dur-base)]" style={{ transform: open ? "rotate(45deg) translateY(5px)" : "none" }} />
          <path d="M4 12h16" className="transition-opacity duration-[var(--dur-fast)]" style={{ opacity: open ? 0 : 1 }} />
          <path d="M4 17h10" className="origin-center transition-transform duration-[var(--dur-base)]" style={{ transform: open ? "rotate(-45deg) scaleX(1.6) translate(3px,-5px)" : "none" }} />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        data-open={open ? "" : undefined}
        className="site-menu absolute inset-x-0 top-16 shadow-[0_24px_40px_-24px_rgba(30,26,92,.45)] max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white lg:hidden"
      >
        <nav aria-label="Navigation mobile" className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6">
          <div className="grid grid-cols-2 gap-2">
            <Link href={cta} onClick={close} className={buttonClasses({ size: "md", className: "w-full" })}>
              Analyse gratuite
            </Link>
            <Link href={DEMO_HREF} onClick={close} className={buttonClasses({ size: "md", variant: "secondary", className: "w-full" })}>
              Voir la démo
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {all.map((g, gi) => (
              <li key={g.id} className="site-menu-item" style={{ ["--i" as string]: gi }}>
                <details className="site-details group">
                  <summary className="flex min-h-14 cursor-pointer items-center justify-between px-1 text-lg font-semibold text-ink">
                    {g.label}
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="transition-transform group-open:rotate-180">
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <ul className="pb-3">
                    {g.items.map((it) => (
                      <li key={it.href}>
                        <Link href={it.href} onClick={close} className="flex min-h-12 flex-col justify-center rounded-xl px-3">
                          <span className="font-semibold text-ink">{it.label}</span>
                          {it.text ? <span className="text-sm text-muted">{it.text}</span> : null}
                        </Link>
                      </li>
                    ))}
                    {g.footer ? (
                      <li>
                        <Link href={g.footer.href} onClick={close} className="flex min-h-12 items-center rounded-xl px-3 font-semibold text-primary">
                          {g.footer.label}
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </details>
              </li>
            ))}
            {[...links, { href: LOGIN_HREF, label: "Connexion" }].map((item, li) => (
              <li key={item.href} className="site-menu-item" style={{ ["--i" as string]: all.length + li }}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`flex min-h-14 items-center px-1 text-lg font-semibold ${pathname === item.href ? "text-primary" : "text-ink"}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 px-1 text-[0.9rem] text-muted">Offre Découverte gratuite, sans carte bancaire.</p>
        </nav>
      </div>
    </>
  );
}
