"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { NavGroup, NavItem } from "./nav";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const isActiveFor = (pathname: string | null, href: string) => {
  const h = href.split("?")[0];
  return pathname === h || !!pathname?.startsWith(h + "/");
};

/** Trait sous l'entrée de menu de la page en cours (état actif visible sans dépendre de la couleur seule). */
function ActiveBar({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-2.5 -bottom-[13px] h-[3px] origin-center rounded-full bg-primary transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] ${on ? "scale-x-100" : "scale-x-0"}`}
    />
  );
}

/** Menu déroulant du header. Les liens sont rendus côté serveur (présents dans le HTML), seul l'ouverture est cliente. */
function Dropdown({ label, items, wide, footer, align = "center" }: { label: string; items: readonly NavItem[]; wide?: boolean; footer?: NavItem; align?: "center" | "start" | "end" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLLIElement>(null);
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
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  // Un lien avec paramètre (« /tarifs?segment=agence ») ne rend pas le menu actif : Tarifs l'est déjà.
  const active = items.some((s) => !s.href.includes("?") && isActiveFor(pathname, s.href));
  return (
    <li ref={ref} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[0.95rem] xl:px-3 font-medium transition-colors duration-[var(--dur-base)] hover:bg-canvas hover:text-ink ${active ? "text-primary" : "text-ink/75"} ${open ? "bg-canvas text-ink" : ""}`}
      >
        {label}
        <Chevron open={open} />
        <ActiveBar on={active} />
      </button>
      <div
        id={id}
        hidden={!open}
        data-open={open ? "" : undefined}
        className={`site-menu absolute top-full mt-2 rounded-2xl ${align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"} bg-white p-2 shadow-[0_0_0_1px_rgba(27,31,46,.08),0_24px_48px_-20px_rgba(30,26,92,.35)] ${wide ? "w-[34rem]" : "w-[22rem]"}`}
      >
        <ul className={wide ? "grid grid-cols-2" : undefined}>
          {items.map((s) => (
            <li key={s.href}>
              <Link href={s.href} aria-current={isActiveFor(pathname, s.href) ? "page" : undefined} className="block rounded-xl px-3.5 py-3 hover:bg-canvas">
                <span className="block font-semibold text-ink">{s.label}</span>
                {s.text ? <span className="block text-sm text-muted">{s.text}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        {footer ? (
          <Link href={footer.href} className="mt-1 block rounded-xl border-t border-line px-3.5 py-3 font-semibold text-primary hover:bg-canvas">
            {footer.label}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActiveFor(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`relative rounded-lg px-2.5 py-2 text-[0.95rem] font-medium transition-colors duration-[var(--dur-base)] xl:px-3 hover:bg-canvas hover:text-ink ${active ? "text-primary" : "text-ink/75"}`}
      >
        {item.label}
        <ActiveBar on={active} />
      </Link>
    </li>
  );
}

export function HeaderNav({ groups, links, resources }: { groups: readonly NavGroup[]; links: readonly NavItem[]; resources: NavGroup }) {
  return (
    <nav aria-label="Navigation principale" className="hidden lg:block">
      <ul className="flex items-center gap-0.5 xl:gap-1">
        {groups.map((g, i) => (
          <Dropdown key={g.id} label={g.label} items={g.items} wide={g.wide} footer={g.footer} align={i === 0 ? "start" : "center"} />
        ))}
        {links.map((l) => (
          <NavLink key={l.href} item={l} />
        ))}
        <Dropdown label={resources.label} items={resources.items} wide={resources.wide} footer={resources.footer} align="end" />
      </ul>
    </nav>
  );
}
