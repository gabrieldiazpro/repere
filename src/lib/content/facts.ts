/**
 * Fiche « faits clés » : la SEULE base factuelle des brouillons. Ce que le client saisit ici prime ; à défaut, les
 * champs équivalents de la fiche de vérité (/app/verite) sont repris, en lecture seule. Un fait absent n'est jamais
 * deviné : il devient « [à compléter : …] » dans le brouillon et bloque la publication.
 */
import type { BrandFactField } from '@/lib/engine/types-v2';
import { FACT_KEYS, isFactKey, type FactKey, type FactSheet } from './types';

export const FACT_LABEL: Record<FactKey, { label: string; help: string; example: string; long?: boolean }> = {
  activite: { label: 'Activité', help: 'Votre métier en une phrase, comme vous le diriez à un client.', example: 'Plombier chauffagiste, dépannage et installation' },
  services: { label: 'Services ou produits', help: 'Un par ligne, avec ce qui est inclus.', example: 'Recherche de fuite\nRemplacement de chauffe-eau', long: true },
  zone: { label: 'Zone d’intervention ou de livraison', help: 'Villes, arrondissements, rayon, pays.', example: 'Lyon 3e, 6e, 7e et Villeurbanne' },
  adresse: { label: 'Adresse', help: 'Telle qu’elle figure sur votre fiche Google.', example: '12 rue Paul Bert, 69003 Lyon' },
  telephone: { label: 'Téléphone', help: 'Le numéro que vous voulez voir cité.', example: '04 78 00 00 00' },
  email: { label: 'E-mail de contact', help: 'Adresse publique, si vous en affichez une.', example: 'contact@exemple.fr' },
  horaires: { label: 'Horaires', help: 'Jours et heures, urgences et jours fériés compris.', example: 'Lun–ven 8 h–19 h, sam 9 h–12 h' },
  prix: { label: 'Tarifs', help: 'Prix réels ou fourchettes, un par ligne, avec ce qui est compris (déplacement, TVA…).', example: 'Déplacement : 49 € TTC\nRecherche de fuite : à partir de 120 € TTC', long: true },
  delais: { label: 'Délais', help: 'Délai d’intervention, de devis, de livraison.', example: 'Devis sous 24 h, intervention sous 48 h' },
  garanties: { label: 'Garanties et assurances', help: 'Garanties légales et commerciales, assurance décennale…', example: 'Garantie pièces et main-d’œuvre 2 ans', long: true },
  paiement: { label: 'Moyens de paiement', help: 'Carte, virement, paiement en plusieurs fois…', example: 'Carte bancaire, virement, chèque' },
  certifications: { label: 'Labels et certifications', help: 'Avec l’organisme (RGE, Qualibat, bio…). Seulement ceux que vous détenez.', example: 'RGE Qualibat n° …' },
  creation: { label: 'Année de création', help: '', example: '2012' },
  dirigeant: { label: 'Dirigeant ou fondateur', help: 'Nom et rôle, si vous souhaitez l’afficher.', example: 'Paul Martin, gérant' },
  equipe: { label: 'Équipe', help: 'Taille, métiers, qualifications.', example: '4 techniciens salariés' },
  histoire: { label: 'Votre histoire', help: 'Quelques phrases vraies : origine, étapes, valeurs démontrées.', example: '', long: true },
  difference: { label: 'Ce qui vous distingue', help: 'Des faits vérifiables, pas des slogans (« devis écrit avant toute intervention »).', example: '', long: true },
  clients: { label: 'Clients ou références', help: 'Uniquement avec leur accord.', example: '' },
  livraison: { label: 'Livraison', help: 'Délais, frais, pays desservis.', example: '' },
  retours: { label: 'Retours et remboursements', help: 'Délai, conditions, frais.', example: '' },
  avis: { label: 'Avis clients', help: 'Note moyenne ET la plateforme (ex. « 4,8 sur 5, 112 avis Google, novembre 2026 »).', example: '' },
};

/** Fiche de vérité → faits clés (champs équivalents). */
const FROM_VERITE: Partial<Record<BrandFactField, FactKey>> = {
  adresse: 'adresse',
  telephone: 'telephone',
  horaires: 'horaires',
  prix: 'prix',
  zone: 'zone',
  services: 'services',
  dirigeant: 'dirigeant',
  creation: 'creation',
  clients: 'clients',
  livraison: 'livraison',
  retours: 'retours',
  certifications: 'certifications',
  produits: 'services',
};

export const MAX_FACT_LENGTH = 2000;

export function cleanFactValue(v: unknown): string {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_FACT_LENGTH);
}

/** Saisie du client → faits propres (clés connues, valeurs bornées, vides retirés). */
export function sanitizeFacts(input: unknown): Partial<Record<FactKey, string>> {
  const out: Partial<Record<FactKey, string>> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!isFactKey(k)) continue;
    const c = cleanFactValue(v);
    if (c) out[k] = c;
  }
  return out;
}

/** Fusion : saisie du client > fiche de vérité. */
export function mergeFacts(client: Partial<Record<FactKey, string>>, verite: Partial<Record<string, string>> = {}, updatedAt?: string): FactSheet {
  const out: FactSheet = {};
  for (const [field, key] of Object.entries(FROM_VERITE) as [BrandFactField, FactKey][]) {
    const v = cleanFactValue(verite[field]);
    if (v && !out[key]) out[key] = { value: v, origin: 'verite' };
  }
  for (const k of FACT_KEYS) {
    const v = cleanFactValue(client[k]);
    if (v) out[k] = { value: v, origin: 'client', ...(updatedAt ? { updatedAt } : {}) };
  }
  return out;
}

export const factValue = (s: FactSheet, k: FactKey): string | null => s[k]?.value ?? null;

/** Lignes d'un fait multi-lignes (services, tarifs…). */
export function factLines(s: FactSheet, k: FactKey): string[] {
  const v = factValue(s, k);
  if (!v) return [];
  return v
    .split(/\n|;|•/)
    .map((x) => x.replace(/^[-–*\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Texte source autorisé (contrôle anti-invention) : tous les faits + nom + site. */
export function factSource(s: FactSheet, extra: (string | null | undefined)[] = []): string {
  return [...FACT_KEYS.map((k) => s[k]?.value ?? ''), ...extra].filter(Boolean).join('\n');
}

/** Part de la fiche remplie (0–1), sur les faits utiles au type de site. */
export function completeness(s: FactSheet, keys: readonly FactKey[]): number {
  if (!keys.length) return 1;
  return keys.filter((k) => !!s[k]?.value).length / keys.length;
}

export const ESSENTIAL_FACTS: Record<'local' | 'pme' | 'ecommerce', FactKey[]> = {
  local: ['activite', 'services', 'zone', 'adresse', 'telephone', 'horaires', 'prix', 'delais', 'garanties', 'paiement'],
  pme: ['activite', 'services', 'zone', 'prix', 'delais', 'garanties', 'creation', 'equipe', 'difference', 'clients'],
  ecommerce: ['activite', 'services', 'prix', 'livraison', 'retours', 'paiement', 'garanties', 'email', 'avis', 'difference'],
};
