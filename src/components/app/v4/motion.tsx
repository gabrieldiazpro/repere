'use client';
// Mouvements utiles des écrans (V4) : apparition à l'entrée dans l'écran (data-in), barres qui se remplissent.
// Sans JavaScript : état final affiché directement. Avec prefers-reduced-motion : pas de déplacement (voir v4.css).
import { useEffect, useRef } from 'react';

function useInView<T extends HTMLElement>(once = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mouvement réduit : l'animation joue quand même (fondus, barres, surligneur) ; v4.css en retire le déplacement.
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.in = '1';
      return;
    }
    el.dataset.arm = '1';
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es)
          if (e.isIntersecting) {
            el.dataset.in = '1';
            if (once) io.disconnect();
          }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return ref;
}

/** Conteneur qui joue ses animations (surlignage, cascade, barres) quand il entre dans l'écran. */
export function InView({ as: Tag = 'div', className = '', children, ...rest }: { as?: 'div' | 'section' | 'ul' | 'ol'; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const ref = useInView<HTMLElement>();
  const T = Tag as 'div';
  return (
    <T ref={ref as React.Ref<HTMLDivElement>} className={`v4-inview ${className}`} {...rest}>
      {children}
    </T>
  );
}

/** Barre de proportion qui se remplit (0–1). La valeur est portée par le texte voisin, la barre est décorative. */
export function FillBar({ value, tone = 'brand', className = '', delay = 0 }: { value: number; tone?: 'brand' | 'good' | 'bad' | 'warn' | 'neutral'; className?: string; delay?: number }) {
  const ref = useInView<HTMLSpanElement>();
  const v = Math.max(0, Math.min(1, value));
  return (
    <span ref={ref} className={`v4-fill ${className}`} data-tone={tone} aria-hidden="true">
      <span style={{ ['--v' as string]: v, ['--d' as string]: `${delay}ms` }} />
    </span>
  );
}
