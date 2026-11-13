import type { ReactNode } from 'react';
import '@/components/tools/tools.css';

/** Outils gratuits : styles locaux (préfixe rt-), animations coupées sous prefers-reduced-motion. */
export default function OutilsLayout({ children }: { children: ReactNode }) {
  return children;
}
