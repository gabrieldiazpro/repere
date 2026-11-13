import Link from 'next/link';
import type { Metadata } from 'next';
import { PageShell, h1Class, h1Style } from '@/lib/seo/shell';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: "Cette page n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: '/', label: "Page d'accueil" },
  { href: '/audit', label: 'Lancer un test gratuit' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/guides', label: 'Guides pratiques' },
  { href: '/questions', label: 'Questions fréquentes' },
  { href: '/geo', label: "Qu'est-ce que le GEO ?" },
];

export default function NotFound() {
  return (
    <PageShell narrow>
      <h1 className={h1Class} style={h1Style}>Page introuvable</h1>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        Cette page n&apos;existe pas ou a été déplacée. Voici où aller :
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="underline" style={{ color: 'var(--primary)' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
