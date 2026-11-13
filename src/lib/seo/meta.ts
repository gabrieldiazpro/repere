import type { Metadata } from 'next';
import { BRAND, abs } from './site';

export interface PageMetaInput {
  /** Title sans le suffixe « | Repéré » (ajouté par le gabarit du layout), sauf si `absoluteTitle`. */
  title: string;
  description: string;
  /** Chemin canonique, ex. '/tarifs'. Toujours auto-référent. */
  path: string;
  type?: 'website' | 'article';
  absoluteTitle?: boolean;
  noindex?: boolean;
  /**
   * Image OG explicite. Par défaut : ogImageFor(path). Next n'hérite pas de l'image d'un segment parent quand la page
   * définit son propre bloc openGraph, d'où cette URL toujours explicite.
   */
  ogImage?: string;
  /** Titre plus court ou plus parlant pour les aperçus de partage (par défaut : title). */
  ogTitle?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * Métadonnées complètes d'une page publique : title, description, canonical, Open Graph et Twitter.
 * Le merge de Next étant superficiel, chaque page doit fournir son propre bloc openGraph : c'est ce que fait ce helper.
 * L'image OG est celle de la page (fichier opengraph-image.tsx du segment) ou, à défaut, celle du site.
 */
/** Pages qui ont leur propre fichier opengraph-image.tsx (src/app/<chemin>/opengraph-image.tsx). */
const OWN_OG = new Set(['/local', '/pme', '/e-commerce', '/tarifs', '/methode', '/geo', '/glossaire', '/questions', '/comparatif', '/etudes', '/guides', '/visibilite-ia', '/a-propos']);

/**
 * URL de l'image OG d'une page. Une image explicite dans les métadonnées l'emporte sur les fichiers opengraph-image
 * des segments : on pointe donc nous-mêmes vers le fichier de la page quand il existe, sinon vers l'image du site.
 */
export function ogImageFor(path: string): string {
  if (OWN_OG.has(path)) return `${path}/opengraph-image`;
  if (/^\/(guides|etudes)\/[^/]+$/.test(path)) return `${path}/opengraph-image`;
  if (/^\/visibilite-ia\/[^/]+$/.test(path) && !/^\/visibilite-ia\/(pme|e-commerce)$/.test(path)) return `${path}/opengraph-image`;
  return '/opengraph-image';
}

/** Longueur au-delà de laquelle Google coupe souvent un titre (règle de notre propre audit SEO). */
export const TITLE_MAX = 60;
/** Longueur au-delà de laquelle Google coupe une meta description (règle de notre propre audit SEO). */
export const DESCRIPTION_MAX = 160;

/**
 * Meta description d'au plus 160 caractères : on garde les phrases entières qui tiennent ; sinon on coupe au dernier
 * mot avant la limite, avec « … ». Le texte complet reste sur la page et dans le JSON-LD.
 */
export function fitDescription(d: string, max = DESCRIPTION_MAX): string {
  const s = d.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  // Fin de phrase = ponctuation suivie d'un espace (« robots.txt » ou « 1,5 » ne coupent pas).
  const sentences = s.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const x of sentences) {
    const next = out ? `${out} ${x}` : x;
    if (next.length > max) break;
    out = next;
  }
  if (out.length >= 70) return out;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}

export function pageMeta(p: PageMetaInput): Metadata {
  // Le suffixe « | Repéré » n'est ajouté que s'il tient : sinon le titre serait coupé dans Google (on mange notre cuisine).
  const absolute = p.absoluteTitle || `${p.title} | ${BRAND}`.length > TITLE_MAX;
  const fullTitle = absolute ? p.title : `${p.title} | ${BRAND}`;
  const ogTitle = p.ogTitle ?? fullTitle;
  const description = fitDescription(p.description);
  const image = { url: p.ogImage ?? ogImageFor(p.path), width: 1200, height: 630, alt: ogTitle };
  return {
    title: absolute ? { absolute: p.title } : p.title,
    description,
    alternates: { canonical: p.path },
    openGraph: {
      title: ogTitle,
      description,
      url: abs(p.path),
      type: p.type ?? 'website',
      locale: 'fr_FR',
      siteName: BRAND,
      images: [image],
      ...(p.type === 'article' && p.publishedTime ? { publishedTime: p.publishedTime } : {}),
      ...(p.type === 'article' && p.modifiedTime ? { modifiedTime: p.modifiedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description, images: [image] },
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
