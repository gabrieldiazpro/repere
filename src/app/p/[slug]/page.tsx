import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadPublicFiche } from '@/lib/execution/fiche';
import { FicheDocument } from './FicheDocument';
import { fitDescription } from '@/lib/seo/meta';
import { abs } from '@/lib/seo/site';

/**
 * Fiche officielle publique (V9). HTML rendu côté serveur, sans script client.
 * - JSON-LD Organization / LocalBusiness exact et complet : vraies entreprises seulement, JAMAIS pour un compte démo.
 * - Indexable seulement si l'entreprise l'a activé (opt-in explicite dans /app/fiche) ; noindex sinon et pour les démos.
 * - Versions pour les IA : /p/<slug>.md (Markdown) et /p/<slug>/llms.txt.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const ogImage = (slug: string) => abs(`/p/${slug}/opengraph-image`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadPublicFiche(slug);
  if (!p) return { title: { absolute: 'Page introuvable' }, robots: { index: false, follow: false } };
  // V10 (décision 14) : un compte démo porte la mention « entreprise fictive » jusque dans le titre.
  const title = p.demo ? `${p.name} (entreprise fictive), fiche de démonstration`.slice(0, 60) : `${p.name} : ${p.kind.toLowerCase()}`;
  const description = fitDescription(`${p.name} : ${p.activity}. Informations publiées par l’entreprise : coordonnées${p.ctx.segment === 'local' ? ', horaires' : ''}, services et prix, labels, liens officiels.`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: p.pageUrl, types: { 'text/markdown': `${p.pageUrl}.md` } },
    robots: p.indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, url: p.pageUrl, type: 'website', locale: 'fr_FR', siteName: p.name, images: [{ url: ogImage(slug), width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage(slug)] },
  };
}

export default async function OfficialFichePage({ params }: Props) {
  const { slug } = await params;
  const p = await loadPublicFiche(slug);
  if (!p) notFound();
  return <FicheDocument p={p} />;
}
