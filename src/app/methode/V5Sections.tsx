/**
 * Méthode V5 : l'analyse du site (exploration, audit SEO, audit GEO, données Google, agent). Les chiffres viennent du
 * code (catalogue SEO-AUDIT, sections GEO-OPT, droits par offre) ; les règles renvoient à docs/v5/seo-controles.md et
 * docs/v5/geo-methode.md, résumés ici pour le public.
 */
import Link from 'next/link';
import { h2Class } from '@/lib/seo/shell';
import { TableWrap } from '@/lib/seo/editorial';
import { GEO_SECTIONS, SEO_CHECK_COUNT, SEO_SECTION_COUNT, seoSectionCounts } from '@/components/site/v5-blocks';
import { PUBLIC_ANALYSIS_MAX_PAGES } from '@/lib/entitlements';

export const METHOD_V5_TOC = [
  { id: 'exploration', label: 'L’exploration du site' },
  { id: 'seo', label: `L’audit SEO (${SEO_CHECK_COUNT} contrôles)` },
  { id: 'geo', label: 'L’audit GEO et ses niveaux de preuve' },
  { id: 'donnees-google', label: 'Search Console, positions, vitesse' },
  { id: 'agent', label: 'L’agent de publication' },
];

export function MethodV5Sections() {
  const seo = seoSectionCounts();
  return (
    <>
      <h2 id="exploration" className={h2Class}>L’exploration du site : ce que fait notre robot</h2>
      <p className="mb-3 leading-relaxed">
        Notre robot s’identifie comme RepereBot (<Link href="/methode/robot" className="underline">page du robot</Link>). Il lit d’abord votre robots.txt et
        respecte ses interdictions, puis vos sitemaps, et explore les pages en largeur, quatre à la fois au plus, avec un délai entre deux requêtes.
        L’analyse publique s’arrête à {PUBLIC_ANALYSIS_MAX_PAGES} pages ou 45 secondes ; sur un grand site, l’échantillon est équilibré par rubrique et
        l’analyse le signale. Les offres payantes explorent jusqu’à 500 ou 2 000 pages. Les adresses privées et internes sont refusées (protection contre
        les requêtes détournées).
      </p>
      <p className="mb-3 leading-relaxed">
        Pour chaque page : statut et chaîne de redirections, en-têtes, titre, description, balises robots, canonique, langue, titres, nombre de mots,
        empreinte du texte (pour les doublons), images, données structurées, liens et un indice de rendu côté client.
      </p>

      <h2 id="seo" className={h2Class}>L’audit SEO : {SEO_CHECK_COUNT} contrôles en {SEO_SECTION_COUNT} familles</h2>
      <p className="mb-3 leading-relaxed">
        Chaque contrôle s’appuie sur une règle publiée par Google (Search Central) ou web.dev, à jour de 2026 : INP à la place de FID, fin des résultats
        enrichis FAQ depuis mai 2026, types de balisage retirés en 2025. La sévérité dépend du type de site (commerce local, PME, boutique). Les
        obligations françaises (mentions légales, CGV, information RGPD) sont vérifiées aussi.
      </p>
      <TableWrap
        caption="Familles de contrôles, poids dans la note globale et nombre de contrôles (lus dans le code de l’audit)."
        head={['Famille', 'Poids', 'Contrôles', 'Exemples']}
        rows={seo.map((s) => [s.label, `${s.weight}`, `${s.count}`, s.examples.join(' ; ')])}
      />
      <p className="mb-3 leading-relaxed">
        <b>Note par famille</b> : chaque constat retire une part qui dépend de sa sévérité (critique 60 %, élevée 35 %, moyenne 15 %, faible 4 %) et de la
        proportion de pages touchées, comme le font les outils de référence : c’est la proportion qui compte, pas le volume. <b>Note globale</b> :
        combinaison pondérée des familles applicables ; elle est plafonnée à 40 si un constat critique touche tout le site (robots.txt qui bloque
        tout, accueil exclu de Google). Toutes les notes sont arrondies à 5 points : nous refusons la fausse précision. La note mesure l’état de votre
        site, pas votre position dans Google.
      </p>
      <p className="mb-3 leading-relaxed">
        <b>Les 5 priorités</b> sont classées par sévérité × effet attendu ÷ effort, puis par nombre de pages touchées.
      </p>

      <h2 id="geo" className={h2Class}>L’audit GEO : ce qui est démontré, probable ou supposé</h2>
      <p className="mb-3 leading-relaxed">
        Le GEO est un domaine jeune. Chaque règle porte son niveau de preuve : <b>démontré</b> (documentation de l’éditeur de l’IA, ou expérience
        contrôlée publiée), <b>probable</b> (corrélation observée sur de grands volumes, ou recommandation d’un éditeur sans mesure publiée),
        <b> hypothèse</b> (bonne pratique sans preuve d’effet). llms.txt est <b>informatif</b> : Google dit ne pas l’utiliser, il ne compte pas dans
        la note.
      </p>
      <TableWrap
        caption="Familles de l’audit GEO, poids dans la note et niveau de preuve de leur règle principale."
        head={['Famille', 'Poids', 'Preuve', 'Exemple']}
        rows={GEO_SECTIONS.map((g) => [g.label, `${g.weight}`, g.evidence, g.example])}
      />
      <p className="mb-3 leading-relaxed">
        Un blocage des robots de recherche des IA (OAI-SearchBot, PerplexityBot, Claude-SearchBot) plafonne la note GEO à 35. Les passages de vos pages
        sont notés sur 100 selon des critères publiés (autonomie, chiffre précis, date, source, réponse directe, longueur, noms propres) ; c’est une
        heuristique, pas une prédiction. Les réécritures proposées sont rejetées si elles contiennent un chiffre, une date ou un prix absent de votre
        page et de votre fiche de vérité.
      </p>
      <p className="mb-3 leading-relaxed">
        Sources principales : documentation des robots d’OpenAI, d’Anthropic, de Perplexity, de Mistral, de Google et de Bing ; l’article GEO
        (Aggarwal et al., KDD 2024) ; des études de citations (Ahrefs, SE Ranking, Université de Toronto). Le détail est dans le{' '}
        <Link href="/guides/seo-geo-sites-pros-2026" className="underline">guide SEO + GEO</Link>.
      </p>

      <h2 id="donnees-google" className={h2Class}>Search Console, positions et vitesse</h2>
      <p className="mb-3 leading-relaxed">
        Avec votre accord (lecture seule), nous importons 16 mois de Search Console : requêtes, pages, pays, appareils, puis une synchronisation
        quotidienne ; les clics et impressions des aperçus IA de Google y sont compris, sans être isolés. La vitesse vient de PageSpeed Insights (labo)
        et du rapport CrUX de Chrome (terrain, 28 jours, 75e centile). Les positions de vos mots-clés sont relevées chaque semaine sur Google France
        par un fournisseur (DataForSEO), avec un plafond de dépense par compte ; sans ce fournisseur, l’écran le dit au lieu d’afficher des chiffres.
      </p>

      <h2 id="agent" className={h2Class}>L’agent de publication</h2>
      <p className="mb-3 leading-relaxed">
        L’agent transforme les correctifs des audits en modifications : titre, description, texte alternatif, balisage, redirection, passage réécrit.
        Chaque modification garde sa valeur d’origine exacte, attend votre validation, est appliquée par l’accès que vous avez donné (WordPress,
        Shopify, Webflow, PrestaShop), relue sur la page publique, puis remesurée 7 jours plus tard. Le journal est chaîné : une modification après
        coup se verrait. Tout se défait en un clic. Sans accès, vous recevez un fichier et les instructions.
      </p>
    </>
  );
}
