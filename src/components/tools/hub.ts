/** Regroupement des outils pour le hub /outils (sans dépendance client : lisible côté serveur). */
import type { IconName } from '@/components/app/icons';

/** Date de mise à jour du hub (V6 : 11 outils SEO ajoutés). */
export const HUB_UPDATED = '2026-11-15';

/**
 * Les 20 outils rangés selon le chemin d'une page vers Google et les IA : s'afficher, être indexée, laisser entrer
 * les robots d'IA, être comprise, être lue et citée.
 */
export const HUB_GROUPS: { id: string; title: string; text: string; step: string; icon: IconName; slugs: string[] }[] = [
  {
    id: 'afficher',
    step: 'S’afficher',
    icon: 'search',
    title: 'Votre page s’affiche-t-elle bien dans Google ?',
    text: 'Titre, description, aperçu de partage : ce que voient ceux qui cherchent.',
    slugs: ['apercu-google', 'balises-title-meta', 'open-graph'],
  },
  {
    id: 'indexer',
    step: 'Être indexée',
    icon: 'list',
    title: 'Google peut-il explorer et indexer vos pages ?',
    text: 'Indexabilité, redirections, sitemap, en-têtes, versions linguistiques.',
    slugs: ['indexabilite', 'redirections', 'validateur-sitemap', 'en-tetes-http', 'hreflang'],
  },
  {
    id: 'entrer',
    step: 'Laisser entrer les IA',
    icon: 'lock',
    title: 'Les robots d’IA peuvent-ils entrer ?',
    text: 'Accès autorisé, page lisible sans JavaScript.',
    slugs: ['pret-pour-les-ia', 'robots-ia', 'generateur-robots-txt', 'rendu-sans-javascript'],
  },
  {
    id: 'comprendre',
    step: 'Être comprise',
    icon: 'database',
    title: 'Comprennent-ils ce que vous faites ?',
    text: 'Qui vous êtes, où, ce que vous vendez : balisé pour eux.',
    slugs: ['json-ld', 'llms-txt', 'fiche-produit'],
  },
  {
    id: 'citer',
    step: 'Être lue et citée',
    icon: 'quote',
    title: 'Vos pages se lisent-elles, et se citent-elles ?',
    text: 'Textes clairs, liens sains, passages nets, avis, avantage sur le concurrent.',
    slugs: ['lisibilite', 'analyse-liens', 'citabilite', 'comparateur', 'lien-avis-google'],
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
  'apercu-google': 'search',
  'balises-title-meta': 'file',
  'open-graph': 'share',
  indexabilite: 'list',
  redirections: 'compass',
  'validateur-sitemap': 'map',
  'en-tetes-http': 'gear',
  hreflang: 'globe',
  'generateur-robots-txt': 'shield',
  lisibilite: 'eye',
  'analyse-liens': 'link',
};
