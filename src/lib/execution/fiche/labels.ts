/**
 * Libellés de la fiche officielle (sans dépendance : utilisables dans les composants client).
 */
import type { Segment } from '@/lib/engine/types-v2';
import type { TextKey } from './types';

export interface FieldDef {
  label: string;
  help: string;
  long?: boolean;
  /** affiché par défaut pour ces parcours (les autres restent dans « plus d'informations ») */
  segments?: Segment[];
  max: number;
}

export const FICHE_FIELDS: Record<TextKey, FieldDef> = {
  nom: { label: 'Nom officiel', help: 'Tel qu’il doit apparaître partout (site, fiche Google, annuaires).', max: 120 },
  activite: { label: 'Activité', help: 'Votre métier en une phrase, comme vous le diriez à un client.', max: 200 },
  adresse: { label: 'Adresse', help: 'Avec le code postal, telle qu’elle figure sur votre fiche Google.', max: 200, segments: ['local', 'pme', 'ecommerce'] },
  zone: { label: 'Zone d’intervention ou de livraison', help: 'Villes, arrondissements, pays : séparés par des virgules.', max: 300 },
  horaires: { label: 'Horaires', help: 'Ex. « Lun–ven 8 h–19 h, sam 9 h–13 h ». Les fermetures exceptionnelles se saisissent à part.', max: 300, segments: ['local'] },
  telephone: { label: 'Téléphone', help: 'Le numéro que vous voulez voir cité.', max: 30 },
  email: { label: 'E-mail de contact', help: 'Adresse publique, si vous en affichez une.', max: 120 },
  site: { label: 'Site officiel', help: 'L’adresse de votre site (ex. mon-site.fr).', max: 200 },
  prix: { label: 'Tarifs (texte)', help: 'Conditions générales : déplacement, devis, TVA… Les prix par service se saisissent dans « Services ».', long: true, max: 500 },
  delais: { label: 'Délais', help: 'Délai d’intervention, de devis ou d’expédition.', max: 300 },
  garanties: { label: 'Garanties et assurances', help: 'Garanties légales et commerciales, assurance décennale…', long: true, max: 500 },
  paiement: { label: 'Moyens de paiement', help: 'Séparés par des virgules (carte bancaire, virement, chèque…).', max: 200 },
  langues: { label: 'Langues parlées', help: 'Séparées par des virgules (français, anglais…).', max: 120 },
  creation: { label: 'Année de création', help: 'Ex. 2009.', max: 20 },
  dirigeant: { label: 'Dirigeant ou fondateur', help: 'Nom et rôle, si vous souhaitez l’afficher.', max: 120 },
  equipe: { label: 'Équipe', help: 'Taille, métiers, qualifications.', max: 300 },
  histoire: { label: 'Votre histoire', help: 'Quelques phrases vraies : origine, étapes.', long: true, max: 1000 },
  difference: { label: 'Ce qui vous distingue', help: 'Des faits vérifiables, pas des slogans.', long: true, max: 600 },
  clients: { label: 'Clients ou références', help: 'Uniquement avec leur accord.', max: 300 },
  produits: { label: 'Produits', help: 'Vos gammes, en une phrase.', max: 500, segments: ['ecommerce'] },
  livraison: { label: 'Livraison', help: 'Délais, frais, pays desservis.', max: 300, segments: ['ecommerce'] },
  retours: { label: 'Retours et remboursements', help: 'Délai, conditions, frais.', max: 300, segments: ['ecommerce'] },
  ingredients: { label: 'Composition', help: 'Ingrédients, matières (INCI…).', long: true, max: 1000, segments: ['ecommerce'] },
  avis: { label: 'Avis clients', help: 'Note ET plateforme (« 4,8 sur 5, 112 avis Google, novembre 2026 »).', max: 200 },
  statut: { label: 'Statut', help: 'Ouvert, fermé temporairement…', max: 80 },
};

/** Faits essentiels par parcours (complétude, ordre d'affichage). */
export const ESSENTIAL: Record<Segment, TextKey[]> = {
  local: ['nom', 'activite', 'adresse', 'zone', 'horaires', 'telephone', 'site', 'prix', 'garanties', 'paiement', 'langues'],
  pme: ['nom', 'activite', 'adresse', 'zone', 'telephone', 'email', 'site', 'prix', 'garanties', 'langues', 'creation'],
  ecommerce: ['nom', 'activite', 'produits', 'site', 'email', 'livraison', 'retours', 'paiement', 'garanties', 'adresse', 'langues'],
};

