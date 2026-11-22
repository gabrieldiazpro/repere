/**
 * Outil gratuit V8 (agent ECOM) : simulateur « Ce que la visibilité IA représente pour ma boutique ».
 * Hypothèses, sources et calcul : ./simulateur.ts. Aucun chiffre présenté comme une promesse.
 */
import type { ToolDef } from '../registry';
import { GOOGLE_FR, HYPOTHESES, SIM_UPDATED } from './simulateur';

export const V8_SLUGS = ['simulateur-boutique'] as const;
export type V8Slug = (typeof V8_SLUGS)[number];

const uniqueSources = () => {
  const seen = new Set<string>();
  const out: { label: string; url: string; note?: string }[] = [];
  for (const s of [...HYPOTHESES.flatMap((h) => h.sources), GOOGLE_FR]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ label: s.label, url: s.url, note: `Publié le ${s.date.split('-').reverse().join('/')}. ${s.fact}` });
  }
  return out;
};

export const V8_TOOLS: (ToolDef & { slug: V8Slug })[] = [
  {
    slug: 'simulateur-boutique',
    updated: SIM_UPDATED,
    name: 'Simulateur pour ma boutique',
    h1: 'Ce que la visibilité dans les IA représente pour votre boutique',
    lead: 'Entrez vos chiffres : visites, conversion, panier moyen, part venue de Google. Le simulateur montre une fourchette basse, médiane et haute, avec chaque hypothèse sourcée, datée et modifiable. Une estimation, pas une promesse.',
    metaTitle: 'Simulateur : la visibilité IA pour ma boutique (gratuit)',
    description: 'Estimez, avec vos propres chiffres, ce que les aperçus IA de Google et les assistants comme ChatGPT représentent pour votre boutique : fourchette sourcée, hypothèses modifiables.',
    output: 'Avant / après en fourchette (basse, médiane, haute), hypothèses sourcées et modifiables',
    parcours: ['ecommerce'],
    bridge: 'La simulation part d’études publiques. L’analyse gratuite regarde votre vraie boutique : ce que Google et les IA en lisent, et ce qui l’empêche d’être citée.',
    howItWorks: [
      'Vous saisissez vos chiffres mensuels (Google Analytics ou votre tableau de bord Shopify, WooCommerce, PrestaShop, Magento…). Le calcul se fait dans votre navigateur : rien n’est envoyé ni enregistré.',
      'Le simulateur compare deux situations : « avant », les aperçus IA de Google s’affichent sans citer votre boutique ; « après », ils la citent et les assistants (ChatGPT, Perplexity, Gemini…) vous envoient autant de visiteurs qu’à un site moyen.',
      'Chaque hypothèse a trois valeurs tirées d’études publiques datées. Vous pouvez toutes les changer : la fourchette se recalcule aussitôt.',
    ],
    reading: [
      'Lisez la fourchette, pas un chiffre : l’écart entre le scénario bas et le scénario haut dit à quel point les études divergent encore. Le scénario médian combine les valeurs centrales.',
      '« Ventes exposées » : ce que les aperçus IA peuvent retirer à vos ventes venues de Google quand ils ne vous citent pas. Vos chiffres actuels servent de référence ; si les aperçus IA touchent déjà vos recherches, une partie de cet effet y est déjà.',
      'Les études sont surtout américaines et récentes : les aperçus IA ne sont arrivés en France que le 22 juillet 2026. Remplacez les hypothèses par vos propres mesures dès que vous en avez.',
    ],
    limits: [
      'Ce n’est pas une mesure de votre boutique : le simulateur ne sait pas si les IA vous citent aujourd’hui. L’analyse gratuite, elle, le vérifie.',
      'Aucune étude publique ne mesure le trafic d’une boutique effectivement recommandée par les IA : nous prenons la moyenne observée sur des milliers de sites, à remplacer par la vôtre.',
      'La citation dans un aperçu IA est associée à plus de clics, mais l’étude qui le mesure précise que cela peut refléter la notoriété plutôt que la causer.',
      'Saisonnalité, prix, concurrence, publicité payante et ventes influencées sans clic (un client qui revient plus tard par une autre porte) ne sont pas modélisés.',
    ],
    faq: [
      { q: 'Ce chiffre est-il une promesse de Repéré ?', a: 'Non. C’est une estimation à partir d’études publiques, sur vos chiffres. Personne ne peut garantir qu’une IA citera votre boutique ; Repéré mesure si c’est le cas et corrige ce qui l’en empêche, avec votre validation.' },
      { q: 'D’où viennent les hypothèses ?', a: 'D’études publiées entre juillet 2025 et octobre 2026 : Pew Research Center, Seer Interactive, Semrush, Contentsquare, Conductor, Adobe et une étude parue dans Marketing Science (973 boutiques). Chaque valeur affiche sa source, sa date et le calcul éventuel.' },
      { q: 'Pourquoi trois scénarios au lieu d’un chiffre ?', a: 'Parce que les études ne disent pas la même chose : selon Adobe, les visiteurs venus des IA convertissaient 9 % moins bien en août 2025 et 90 % mieux en septembre 2026. Un chiffre unique masquerait cette incertitude.' },
      { q: 'Où trouver la part de mon trafic venue des IA ?', a: 'Dans Google Analytics 4, rapport Acquisition, en filtrant les sources comme chatgpt.com, perplexity.ai, gemini.google.com ou copilot.microsoft.com. Une partie de ces visites arrive sans source identifiable : la mesure est donc un minimum.' },
      { q: 'Mes chiffres sont-ils enregistrés ?', a: 'Non. Le calcul se fait entièrement dans votre navigateur ; rien n’est envoyé à nos serveurs.' },
      { q: 'Et ensuite ?', a: 'Lancez l’analyse gratuite de votre boutique : elle vérifie ce que Google et les IA lisent de vos pages produit. Avec l’offre e-commerce, l’agent Repéré prépare les corrections (titres, descriptions, textes d’images…) et ne publie rien sans votre accord.' },
    ],
    sources: uniqueSources(),
    related: [
      { label: 'Analyse complète SEO et IA de votre boutique (gratuite)', href: '/analyse' },
      { label: 'Repéré pour l’e-commerce', href: '/e-commerce' },
      { label: 'Outil : fiche produit lisible par les IA', href: '/outils/fiche-produit' },
    ],
  },
];
