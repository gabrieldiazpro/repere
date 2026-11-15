import { ogCard } from '@/lib/seo/og';
import { findBusinessIdBySlug, loadExecContext } from '@/lib/execution';

/** Image de partage d'une page officielle hébergée : nom de l'entreprise et nature de la page (V6). */
export const alt = 'Page officielle et questions fréquentes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const KIND = { local: 'Fiche officielle', pme: 'Présentation officielle', ecommerce: 'Fiche officielle de la marque' } as const;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let name = 'Page officielle';
  let kind = 'Informations vérifiées';
  try {
    const id = /^[a-z0-9-]{2,60}$/.test(slug) ? await findBusinessIdBySlug(slug) : null;
    const ctx = id ? await loadExecContext(id) : null;
    if (ctx && ctx.settings.slug === slug && ctx.settings.published !== false) {
      name = ctx.business.name;
      kind = KIND[ctx.segment];
    }
  } catch {
    /* image générique */
  }
  return ogCard(name, kind);
}
