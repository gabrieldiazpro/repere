/** Regroupement des outils pour le hub /outils (sans dépendance client : lisible côté serveur). */
import type { IconName } from '@/components/app/icons';

/** Les 9 outils rangés selon le chemin d'un robot d'IA : entrer, comprendre, citer. */
export const HUB_GROUPS: { id: string; title: string; text: string; slugs: string[] }[] = [
  {
    id: 'entrer',
    title: 'Les robots d’IA peuvent-ils entrer ?',
    text: 'Accès autorisé, page lisible sans JavaScript.',
    slugs: ['pret-pour-les-ia', 'robots-ia', 'rendu-sans-javascript'],
  },
  {
    id: 'comprendre',
    title: 'Comprennent-ils ce que vous faites ?',
    text: 'Qui vous êtes, où, ce que vous vendez : balisé pour eux.',
    slugs: ['json-ld', 'llms-txt', 'fiche-produit'],
  },
  {
    id: 'citer',
    title: 'Ont-ils de quoi vous citer ?',
    text: 'Des passages nets, des avis, un avantage sur le concurrent.',
    slugs: ['citabilite', 'comparateur', 'lien-avis-google'],
  },
];

export const TOOL_ICON: Record<string, IconName> = {
  'pret-pour-les-ia': 'check',
  'robots-ia': 'lock',
  'rendu-sans-javascript': 'eye',
  'json-ld': 'database',
  'llms-txt': 'file',
  'fiche-produit': 'box',
  citabilite: 'quote',
  comparateur: 'podium',
  'lien-avis-google': 'star',
};
