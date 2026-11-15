import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/site/Logo';
import { buttonClasses } from '@/components/ui/Button';
import { h1Class, h1Style } from '@/lib/seo/shell';
import { BRAND, CONTACT_EMAIL } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: "Cette page n'existe pas ou a été déplacée.",
  robots: { index: false, follow: true },
};

/**
 * Page 404 volontairement légère (V6, poids des pages) : Next sérialise l'arbre de cette page dans la charge RSC de
 * CHAQUE page du site (frontière « introuvable » du layout racine). Avec l'en-tête et le pied de page complets, c'était
 * ~20 Ko de plus partout. Ici : logo, message, liens vers les sections principales, contact et pages légales.
 */
const LINKS = [
  { href: '/', label: "Page d'accueil" },
  { href: '/analyse', label: 'Analyse gratuite de votre site' },
  { href: '/audit', label: 'Test de visibilité IA par nom' },
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/guides', label: 'Guides pratiques' },
  { href: '/outils', label: 'Outils gratuits' },
  { href: '/questions', label: 'Questions fréquentes' },
  { href: '/aide', label: "Centre d'aide" },
  { href: '/contact', label: 'Contact' },
];

const LEGAL = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export default function NotFound() {
  return (
    <>
      <header className="border-b border-line/60 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo size={30} />
          <Link href="/analyse" className={buttonClasses({ size: 'sm', className: 'whitespace-nowrap' })}>
            Analyse gratuite
          </Link>
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6" style={{ color: 'var(--ink)' }}>
        <h1 className={h1Class} style={h1Style}>Page introuvable</h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
          Cette page n&apos;existe pas ou a été déplacée. Voici où aller :
        </p>
        <ul className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-11 items-center underline underline-offset-2" style={{ color: 'var(--primary)' }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8" style={{ color: 'var(--muted)' }}>
          Un lien cassé sur notre site ? Écrivez-nous à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: 'var(--primary)' }}>
            {CONTACT_EMAIL}
          </a>
          , nous le corrigeons.
        </p>
      </main>
      <footer className="border-t border-line/60 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm sm:px-6 lg:px-8" style={{ color: 'var(--muted)' }}>
          <p>© {new Date().getFullYear()} {BRAND}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
