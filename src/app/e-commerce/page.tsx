import { SegmentLanding } from "@/components/site/SegmentLanding";
import { ProductsCited } from "@/components/site/segment-visuals";
import { demoProducts, orNull } from "@/components/site/demo-figures";
import { FACTS } from "@/components/site/facts";
import { DemoClip } from "@/components/site/DemoClip";
import { ProveScene } from "@/components/motion/scenes/live";
import { VAT_NOTICE, euros, planLink, tiersFor } from "@/components/site/plans-v2";
import { pageMeta } from "@/lib/seo/meta";
import { enginesLabel, frequencyAdverb, promptsCount } from "@/components/site/offer-facts";

/** Chiffres des comptes démo (trafic glissant sur 30 jours) recalculés chaque jour. */
export const revalidate = 86400;

const TITLE = "SEO e-commerce et IA : fiches produit, facettes, Shopping";
const DESCRIPTION =
  "Fiches produit, facettes, Shopping, réponses des IA : Repéré analyse votre boutique, corrige le catalogue avec vous et mesure les ventes.";

export const metadata = pageMeta({ path: "/e-commerce", title: TITLE, description: DESCRIPTION });

export default async function EcommercePage() {
  const products = await orNull(demoProducts());
  const tiers = tiersFor("ecommerce");
  const ess = tiers.essentielMonth ? euros(tiers.essentielMonth.priceCents) : "–";
  const acc = tiers.accompagne ? euros(tiers.accompagne.priceCents) : "–";
  const deepP = tiers.deep ? euros(tiers.deep.priceCents) : "–";
  const deep = tiersFor("ecommerce").deep;
  return (
    <SegmentLanding
      seo={{ title: TITLE, description: DESCRIPTION }}
      brief={[
        { label: "Pour qui", value: "Marques et boutiques en ligne sur Shopify, WooCommerce ou PrestaShop." },
        { label: "Ce que nous mesurons", value: `${promptsCount("ecommerce", "essentiel")} à ${promptsCount("ecommerce", "accompagne")} requêtes produit (« meilleur », « alternative à », budget), posées ${frequencyAdverb("ecommerce", "essentiel")} à ${enginesLabel("ecommerce", "essentiel")} (Essentiel) ; ${enginesLabel("ecommerce", "accompagne")} en Accompagné. Vos produits apparaissent-ils, face à quelles marques, sur quelles sources ?` },
        { label: "Prix", value: `Test gratuit sur 10 requêtes. Audit catalogue ${deepP}. Essentiel ${ess}/mois sans engagement. Accompagné ${acc}/mois, 3 mois minimum : nous faisons le travail. ${VAT_NOTICE}.` },
        { label: "Travail fait (Accompagné)", value: "20 fiches produit réécrites par mois, un guide d'achat, le balisage Product, Offer et FAQ, le flux Merchant vérifié et 3 démarches vers les comparatifs. Rien n'est publié sans votre accord." },
        { label: "Ce que nous ne faisons pas", value: "Aucune promesse d'affichage dans ChatGPT Shopping ou ailleurs, aucun avis acheté ou rédigé par nous." },
        { label: "Preuve", value: "Les visites et, si vos outils le permettent, les commandes venues des IA, dans votre Google Analytics ou Shopify." },
      ]}
      related={[
        { href: "/guides/fiche-produit-et-ia", label: "Fiches produit citées par les IA" },
        { href: "/guides/donnees-structurees-utiles", label: "Les données structurées qui servent encore en 2026" },
        { href: "/visibilite-ia/e-commerce", label: "Visibilité IA par catégorie de produits" },
        { href: "/guides/trafic-chatgpt-ga4", label: "Mesurer le trafic et les ventes venus de ChatGPT dans GA4" },
        { href: "/guides/avis-clients-ia", label: "Avis clients et IA : ce qui compte, ce qui est interdit" },
        { href: "/geo", label: "Qu'est-ce que le GEO (référencement IA) ?" },
        { href: "/questions", label: "Les questions les plus posées sur le référencement IA" },
      ]}
      segment="ecommerce"
      eyebrow="SEO e-commerce et référencement IA"
      title="Sur Google, dans Shopping et dans les IA, faites partie du choix."
      subtitle="« Meilleure crème solaire bio », « alternative à une marque connue », « cadeau pour un cycliste à moins de 50 € » : vos clients demandent à ChatGPT, Perplexity et Gemini, qui affichent désormais des produits dans leurs réponses. Repéré analyse votre boutique, prépare votre catalogue et mesure ce qui se vend."
      primaryCta="Analyser ma boutique"
      seoGeo={{
        title: "Le SEO d'une boutique, et ce que les IA lisent dans un catalogue",
        intro: "Une boutique gagne ou perd sur des milliers de pages à la fois : fiches, catégories, filtres. Les mêmes défauts gênent Google, Shopping et les IA.",
        items: [
          { reader: "both", title: "Des fiches produit qui répondent aux questions", text: "Matière, dimensions, compatibilité, entretien, délai : écrits en texte, pas seulement en images ou dans des onglets fermés." },
          { reader: "both", title: "Le balisage Product et Offer exact", text: "Prix, devise, disponibilité, retours et livraison, identiques à ce que le client voit sur la page." },
          { reader: "google", title: "Des facettes qui ne gaspillent pas l'exploration", text: "Couleur × taille × prix peut créer des milliers d'URL vides. Lesquelles indexer, lesquelles bloquer : nous le vérifions." },
          { reader: "google", title: "Google Shopping et Merchant Center", text: "Un flux produit sans erreurs, cohérent avec les fiches : c'est aussi une porte vers les réponses IA de Google." },
          { reader: "google", title: "Variantes et pagination propres", text: "Une variante rattachée à sa fiche principale ; des pages de catégorie paginées par de vrais liens." },
          { reader: "ia", title: "Les comparatifs et guides d'achat que citent les IA", text: "Les médias et les places de marché qui comptent dans votre catégorie, et où vos produits manquent." },
        ],
        guide: { href: "/guides/fiche-produit-et-ia", label: "Le guide : des fiches produit lisibles par Google et les IA" },
      }}
      secondaryCta={
        deep ? { label: `Audit catalogue approfondi (${euros(deep.priceCents)})`, href: planLink(deep) } : undefined
      }
      reassure={["Gratuit", "Shopify, WooCommerce, PrestaShop", "5 priorités à la fin"]}
      queriesTitle="Les requêtes produit que nous testons"
      queries={[
        { intent: "Le meilleur", items: ["Meilleure crème solaire bio pour le visage", "Meilleur shampoing solide pour cheveux secs", "Quelle gourde isotherme pour le vélo ?"] },
        { intent: "L'alternative", items: ["Alternative moins chère à une marque connue", "Marque française comme X mais sans plastique", "Équivalent vegan d'un best-seller"] },
        { intent: "L'idée cadeau", items: ["Cadeau pour un cycliste à moins de 50 €", "Coffret soin naturel pour la fête des mères", "Idée cadeau éco-responsable pour un collègue"] },
      ]}
      problems={[
        { title: "Les IA choisissent quelques produits", text: "Une réponse d'achat met en avant une poignée de références. Vos concurrents y sont peut-être déjà." },
        { title: "Vos fiches parlent aux humains, pas aux IA", text: "Descriptions vagues, pas de balisage Product, pas de réponses aux questions concrètes (taille, composition, usage) : l'IA préfère les fiches qui répondent." },
        { title: "Les avis et les comparatifs décident", text: "Les IA citent des guides d'achat, des comparatifs, Reddit, des marketplaces. Si vous n'y êtes pas, vos produits non plus." },
      ]}
      facts={[FACTS.valiuz, FACTS.adobe, FACTS.trust]}
      factsNote="En novembre 2026, aucune IA ne propose de paiement intégré pour une marque française : ce qui compte ici, c'est d'être choisi dans la réponse."
      proofNote="Le trafic venu des IA est mesuré dans votre propre Google Analytics ou Shopify : vous voyez vous-même les chiffres, produit par produit."
      steps={[
        { verb: "Mesurer", text: `${promptsCount("ecommerce", "essentiel")} à ${promptsCount("ecommerce", "accompagne")} requêtes produit, ${frequencyAdverb("ecommerce", "essentiel")}, sur ${enginesLabel("ecommerce", "essentiel")} : vos produits apparaissent-ils, avec quel prix, quel avis ?` },
        { verb: "Comprendre", text: "Les comparatifs, guides, forums et marketplaces cités, et ce qu'ont les fiches concurrentes que les vôtres n'ont pas." },
        { verb: "Agir", text: "Balisage Product, Offer et Review, llms.txt, flux Merchant vérifié, fiches produit réécrites pour répondre aux questions, guides d'achat, démarches vers les comparatifs. En Accompagné, nous le faisons et publions après validation." },
        { verb: "Prouver", text: "Sessions et, si disponible, commandes venues des IA, produit par produit ; part de voix de votre marque dans le temps." },
      ]}
      signature={
        products && products.products.length
          ? {
              title: "Les produits que les IA citent, et ceux qu'elles ignorent",
              intro: "Nous suivons vos produits phares dans les réponses aux questions d'achat : vous savez lequel les IA recommandent, et lequel il faut retravailler.",
              points: ["Chaque produit suivi, réponse par réponse", "Les marques citées à votre place", "Les fiches à réécrire en priorité"],
              visual: <ProductsCited d={products} />,
            }
          : undefined
      }
      stepsVisual={
        <>
          <DemoClip id="prouver" title="Les visites et ventes venues des IA" fallback={<ProveScene />} />
          <p className="text-[0.82rem] text-muted">Données de démonstration. Les effets réels varient ; nous ne promettons pas de résultat.</p>
        </>
      }
      features={[
        "Suivi par produit et par catégorie",
        "Détection des requêtes « alternative à »",
        "Cartographie des sources : comparatifs, Reddit, marketplaces",
        "Audit du balisage du catalogue",
        "Réécriture de fiches produit",
        "Guides d'achat",
        "Trafic et ventes IA via GA4 ou Shopify",
        "Alerte quand un concurrent apparaît",
      ]}
      faq={[
        { q: "Il existe des apps Shopify « GEO » à 20 € ; pourquoi vous ?", a: "Une app ajoute du balisage. Nous mesurons ce que répondent les IA, trouvons les sources qui comptent, réécrivons vos fiches et allons chercher les comparatifs. Et nous montrons l'effet sur votre trafic." },
        { q: "Vous touchez à ma boutique ?", a: "Via une application ou un accès collaborateur limité, uniquement sur les fiches et le balisage. Chaque modification est validée par vous et réversible." },
        { q: "Et les avis ?", a: "Nous vous aidons à en demander à vos vrais acheteurs, avec votre outil d'avis. Jamais d'avis achetés ou rédigés par nous." },
        { q: "Mes produits seront-ils dans ChatGPT Shopping ?", a: "Nous vérifions que votre boutique remplit les conditions techniques et que vos fiches sont lisibles. L'affichage, lui, dépend des IA : nous mesurons, nous ne promettons pas." },
        { q: "C'est rentable ?", a: "Vous le voyez vous-même : le rapport montre les visites et, quand vos outils le permettent, les commandes venues des IA." },
      ]}
      finalTitle="Votre catalogue est‑il lisible par Google et par les IA ? Réponse en 60 secondes."
    />
  );
}
