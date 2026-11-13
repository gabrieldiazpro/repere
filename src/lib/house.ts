/**
 * Compte « maison » de Repéré (dogfooding) : Repéré se référence lui-même avec ses propres outils.
 * Servi par /p/repere (fiche officielle + FAQ) et /api/schema/repere (JSON-LD). Le site public (agent SEO) s'y branche
 * via HOUSE_BUSINESS_ID (src/lib/seo/site.ts).
 *
 * Fiche de vérité RÉELLE : seuls les faits établis sont publiés. Les champs encore « [À COMPLÉTER] » (entité légale,
 * adresse, téléphone, dirigeant, date de création) sont listés dans HOUSE_TODO et ne sont JAMAIS publiés.
 */
import type { BusinessRecord } from '@/lib/db';
import type { BrandFactField, BrandFacts } from '@/lib/engine/types-v2';

export const HOUSE_ID = 'repere';
export const HOUSE_SLUG = 'repere';

export function isHouseBusinessId(id: string | null | undefined): boolean {
  return id === HOUSE_ID;
}

export const HOUSE_BUSINESS: BusinessRecord = {
  id: HOUSE_ID,
  name: 'Repéré',
  trade: 'référencement IA / GEO',
  city: 'France',
  website: 'repere-ia.fr',
  segment: 'pme',
  plan: 'suivi',
  lastScore: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  ownerId: null,
  isActive: false, // pas de cron tant que l'audit maison n'est pas lancé
  alertThreshold: 5,
};

/** Faits publiés (prix : grille docs/v2/07-plans-v2.json, nets, TVA non applicable). */
export const HOUSE_FACTS: Partial<Record<BrandFactField, string>> = {
  site: 'repere-ia.fr',
  services:
    'Audit de visibilité dans les IA (ChatGPT, Perplexity, Gemini, Claude), suivi mensuel, détection des informations fausses données par les IA, sources à obtenir, tâches hebdomadaires avec textes et balisage prêts à publier, copilote',
  prix: 'Audit gratuit ; suivi à partir de 29 € par mois pour un commerce local, 79 € par mois pour une boutique en ligne, 99 € par mois pour une PME ; TVA non applicable, art. 293 B du CGI',
  clients: 'Commerces et artisans, PME et boutiques en ligne françaises',
  zone: 'France entière',
  statut: 'en activité',
};

/** Champs à compléter par l'équipe avant publication (non publiés). */
export const HOUSE_TODO: BrandFactField[] = ['adresse', 'telephone', 'dirigeant', 'creation'];

export function houseFacts(): BrandFacts {
  return { businessId: HOUSE_ID, facts: { ...HOUSE_FACTS }, updatedAt: '2026-11-09T00:00:00.000Z' };
}
