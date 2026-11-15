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
  trade: 'référencement SEO et IA (GEO)',
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

/**
 * Faits publiés, alignés mot pour mot sur le kit d'identité (docs/visibilite-repere/01-textes-identite.md) et sur la
 * grille src/lib/plans.ts (prix nets, TVA non applicable). Si un fait change, il change d'abord dans le kit.
 */
export const HOUSE_FACTS: Partial<Record<BrandFactField, string>> = {
  site: 'repere-ia.fr',
  services:
    "Analyse réelle du site en 60 secondes (jusqu'à 60 pages sans compte), 185 contrôles SEO et audit GEO, mesure de ce que répondent ChatGPT, Gemini, Perplexity et Claude avec marge d'erreur, vérification de l'exactitude des faits, suivi des positions Google et de la Search Console, agent qui applique les corrections sur WordPress, Shopify, Webflow ou PrestaShop après validation, offre Agence en marque blanche",
  prix: "Découverte gratuite, sans carte bancaire ; Essentiel 29 € par mois (commerce local), 79 € par mois (e-commerce), 99 € par mois (PME) ; Accompagné dès 99 € par mois ; Agence 149 € par mois ; TVA non applicable, art. 293 B du CGI",
  clients: 'TPE, PME, commerces locaux, e-commerces et agences en France',
  zone: 'France entière',
  statut: 'en activité',
};

/** Champs à compléter par l'équipe avant publication (non publiés). */
export const HOUSE_TODO: BrandFactField[] = ['adresse', 'telephone', 'dirigeant', 'creation'];

export function houseFacts(): BrandFacts {
  return { businessId: HOUSE_ID, facts: { ...HOUSE_FACTS }, updatedAt: '2026-11-09T00:00:00.000Z' };
}
