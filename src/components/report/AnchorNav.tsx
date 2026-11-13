'use client';

import { useEffect, useRef, useState } from 'react';
import v3 from './v3.module.css';

/**
 * Navigation par ancres, collante sous le bandeau démo. Ne montre que les sections présentes dans la page,
 * suit la section lue (IntersectionObserver) et déplie la section ciblée sur mobile.
 */
export function AnchorNav({ anchors, demo = false }: { anchors: { id: string; label: string }[]; demo?: boolean }) {
  const [present, setPresent] = useState(anchors);
  const [active, setActive] = useState<string>(anchors[0]?.id ?? '');
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const found = anchors.filter((a) => document.getElementById(a.id));
    setPresent(found);
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Number.POSITIVE_INFINITY);
        const top = [...visible.entries()].filter(([, y]) => Number.isFinite(y)).sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    );
    for (const a of found) {
      const el = document.getElementById(a.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [anchors]);

  // Garde le lien actif visible dans la barre défilante (mobile).
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLAnchorElement>(`a[data-id="${active}"]`);
    const list = listRef.current;
    if (!link || !list) return;
    const left = link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2;
    list.scrollTo?.({ left, behavior: 'smooth' });
  }, [active]);

  if (present.length < 2) return null;
  return (
    <nav className={`${v3.anchorNav} ${demo ? v3.anchorNavDemo : ''}`} aria-label="Sections du rapport">
      <ul ref={listRef}>
        {present.map((a) => (
          <li key={a.id}>
            <a
              href={`#${a.id}`}
              data-id={a.id}
              aria-current={active === a.id ? 'location' : undefined}
              className={active === a.id ? v3.anchorOn : undefined}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('rapport:open', { detail: a.id }));
                setActive(a.id);
              }}
            >
              {a.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
