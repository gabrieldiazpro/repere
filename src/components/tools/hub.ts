/** Regroupement des outils pour le hub /outils (sans dépendance client : lisible côté serveur). */
import type { IconName } from '@/components/app/icons';

/** Date de mise à jour du hub (V6 : 11 outils SEO ajoutés ; V7 : 11 de plus, 31 en tout). */
export const HUB_UPDATED = '2026-11-15';

/**
 * Les 31 outils rangés selon le chemin d'une page vers Google et les IA : s'afficher, être indexée, laisser entrer
 * les robots d'IA, être comprise, être lue et citée.
 */
export const HUB_GROUPS: { id: string; title: string; text: string; step: string; icon: IconName; slugs: string[] }[] = [
  {
    id: 'afficher',
    step: 'S’afficher',
    icon: 'search',
    title: 'Votre page s’affiche-t-elle bien dans Google ?',
    text: 'Titre, description, aperçu de partage, affichage mobile, liens suivis.',
    slugs: ['apercu-google', 'balises-title-meta', 'open-graph', 'compatibilite-mobile', 'generateur-utm'],
  },
  {
    id: 'indexer',
    step: 'Être indexée',
    icon: 'list',
    title: 'Google peut-il explorer et indexer vos pages ?',
    text: 'Indexabilité, redirections, sitemap, en-têtes, HTTPS, doublons, langues.',
    slugs: ['indexabilite', 'redirections', 'validateur-sitemap', 'en-tetes-http', 'https-contenu-mixte', 'contenu-duplique', 'hreflang'],
  },
  {
    id: 'entrer',
    step: 'Laisser entrer les IA',
    icon: 'lock',
    title: 'Les robots d’IA peuvent-ils entrer ?',
    text: 'Accès autorisé, page lisible sans JavaScript, page légère.',
    slugs: ['pret-pour-les-ia', 'robots-ia', 'generateur-robots-txt', 'rendu-sans-javascript', 'poids-page'],
  },
  {
    id: 'comprendre',
    step: 'Être comprise',
    icon: 'database',
    title: 'Comprennent-ils ce que vous faites ?',
    text: 'Qui vous êtes, où, ce que vous vendez : balisé, décrit, cohérent.',
    slugs: ['json-ld', 'resultats-enrichis', 'textes-alternatifs', 'coherence-nap', 'llms-txt', 'fiche-produit'],
  },
  {
    id: 'citer',
    step: 'Être lue et citée',
    icon: 'quote',
    title: 'Vos pages se lisent-elles, et se citent-elles ?',
    text: 'Plan clair, textes lisibles et datés, faits nets, liens sains, avis.',
    slugs: ['structure-titres', 'lisibilite', 'citabilite', 'fraicheur-page', 'fiche-faits-cles', 'analyse-liens', 'comparateur', 'lien-avis-google'],
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
  'resultats-enrichis': 'spark',
  'structure-titres': 'list',
  'textes-alternatifs': 'eye',
  'poids-page': 'bolt',
  'compatibilite-mobile': 'monitor',
  'https-contenu-mixte': 'lock',
  'contenu-duplique': 'copy',
  'fraicheur-page': 'bell',
  'coherence-nap': 'store',
  'generateur-utm': 'trend',
  'fiche-faits-cles': 'flag',
};
