import { SegmentLanding } from "@/components/site/SegmentLanding";
import { CompetitorMatrix } from "@/components/site/segment-visuals";
import { demoCompetitorMatrix } from "@/components/site/demo-figures";
import { FACTS } from "@/components/site/facts";
import { DemoClip } from "@/components/site/DemoClip";
import { UnderstandScene } from "@/components/motion/scenes/live";
import { ActScene } from "@/components/motion/scenes/ActScene";
import { VAT_NOTICE, euros, planLink, tiersFor } from "@/components/site/plans-v2";
import { pageMeta } from "@/lib/seo/meta";
import { enginesLabel, frequencyAdverb, promptsCount } from "@/components/site/offer-facts";

const TITLE = "SEO B2B et IA pour les PME : être dans la short-list";
const DESCRIPTION =
  "Vos acheteurs comparent sur Google et dans les IA. Repéré analyse votre site, suit positions et citations, et applique les corrections. Analyse gratuite.";

export const metadata = pageMeta({ path: "/pme", title: TITLE, description: DESCRIPTION });

export default function PmePage() {
  const matrix = demoCompetitorMatrix("pme");
  const tiers = tiersFor("pme");
  const ess = tiers.essentielMonth ? euros(tiers.essentielMonth.priceCents) : "–";
  const acc = tiers.accompagne ? euros(tiers.accompagne.priceCents) : "–";
  const deepP = tiers.deep ? euros(tiers.deep.priceCents) : "–";
  const deep = tiersFor("pme").deep;
  return (
    <SegmentLanding
      seo={{ title: TITLE, description: DESCRIPTION }}
      brief={[
        { label: "Pour qui", value: "PME, éditeurs de logiciels, cabinets de conseil, organismes de formation, ESN et industriels qui vendent à d'autres entreprises." },
        { label: "Ce que nous mesurons", value: `${promptsCount("pme", "essentiel")} à ${promptsCount("pme", "accompagne")} questions d'acheteurs de votre secteur (comparatif, « alternative à », prix), posées ${frequencyAdverb("pme", "essentiel")} à ${enginesLabel("pme", "essentiel")} (Essentiel) ; ${enginesLabel("pme", "accompagne")} en Accompagné. Votre part de voix face à 5 concurrents.` },
        { label: "Prix", value: `Test gratuit sur 10 questions. Audit approfondi ${deepP}. Essentiel ${ess}/mois sans engagement. Accompagné ${acc}/mois, 3 mois minimum : nous faisons le travail. ${VAT_NOTICE}.` },
        { label: "Travail fait (Accompagné)", value: "2 pages citables par mois, 3 fiches comparateurs ou annuaires B2B, 3 démarches vers les sources citées, mise en place du balisage schema.org, de llms.txt et des règles robots. Rien n'est publié sans votre accord." },
        { label: "Ce que nous ne faisons pas", value: "Aucune promesse de position, pas de faux avis ni de faux messages sur les forums." },
        { label: "Délai", value: "Test gratuit : résultat par e-mail. Audit approfondi : livré sous 5 jours ouvrés." },
      ]}
      related={[
        { href: "/guides/seo-geo-sites-pros-2026", label: "SEO + GEO pour les sites pros en 2026" },
        { href: "/guides/apparaitre-dans-chatgpt-pme", label: "Comment apparaître dans ChatGPT quand on est une PME" },
        { href: "/guides/search-console-debutants", label: "La Search Console pour débutants" },
        { href: "/visibilite-ia/pme", label: "Visibilité IA par secteur B2B : questions et sources citées" },
        { href: "/guides/trafic-chatgpt-ga4", label: "Mesurer le trafic venu de ChatGPT dans Google Analytics 4" },
        { href: "/comparatif", label: "Repéré, outils de mesure, agences GEO : le comparatif" },
        { href: "/geo", label: "Qu'est-ce que le GEO (référencement IA) ?" },
      ]}
      segment="pme"
      eyebrow="SEO B2B et référencement IA pour PME et entreprises de services"
      title="Vos acheteurs comparent sur Google et dans les IA. Soyez dans la short-list."
      subtitle="« Meilleur logiciel de paie pour PME », « cabinet de recrutement tech à Paris », « alternative à votre concurrent » : les acheteurs B2B posent ces questions aux IA avant de vous appeler. Repéré analyse votre site, suit vos positions et vos citations, et fait le travail avec vous."
      primaryCta="Analyser mon site"
      seoGeo={{
        title: "Le SEO B2B, et ce que les IA ajoutent",
        intro: "Un acheteur B2B se renseigne longtemps avant d'appeler. Il doit trouver vos pages sur Google, et retrouver votre nom quand il demande une liste à une IA.",
        items: [
          { reader: "google", title: "Une page par problème client, pas une page « Nos solutions »", text: "« Logiciel de paie pour cabinet comptable », « audit RGPD pour PME » : les requêtes précises convertissent, encore faut-il une page qui leur réponde." },
          { reader: "both", title: "Des pages comparatif et « alternative à » honnêtes", text: "Les acheteurs les cherchent, les IA les citent. Faits datés, sources, et ce que le concurrent fait mieux." },
          { reader: "ia", title: "Les comparateurs et annuaires B2B que citent les IA", text: "G2, Capterra, annuaires sectoriels, médias spécialisés : nous partons des sources réellement citées dans votre secteur." },
          { reader: "google", title: "Un site techniquement propre", text: "Titres uniques, pas de doublons ni de pages orphelines, redirections propres après une refonte, Search Console sans erreurs." },
          { reader: "both", title: "Des preuves citables", text: "Chiffres datés, cas clients signés, auteurs identifiés : ce qui rend une page crédible pour un acheteur et pour une IA." },
          { reader: "ia", title: "Le texte lisible sans JavaScript", text: "Beaucoup de sites B2B modernes s'affichent par script ; les robots d'OpenAI, d'Anthropic et de Perplexity ne l'exécutent pas." },
        ],
        guide: { href: "/guides/seo-geo-sites-pros-2026", label: "Le guide SEO + GEO pour les sites pros en 2026" },
      }}
      secondaryCta={
        deep
          ? { label: `Commander l'audit approfondi (${euros(deep.priceCents)})`, href: planLink(deep) }
          : undefined
      }
      reassure={["Gratuit", "Votre vrai site, exploré page par page", "5 priorités à la fin"]}
      queriesTitle="Les questions de vos acheteurs, posées aux IA"
      queries={[
        { intent: "Comparatif", items: ["Meilleur logiciel de paie pour PME", "Les 5 meilleurs cabinets de conseil RSE à Lyon", "Quel CRM pour une équipe de 10 commerciaux ?"] },
        { intent: "Alternative", items: ["Alternative à un logiciel trop cher pour une PME", "Concurrent français d'un outil américain", "Prestataire comme X mais avec support en France"] },
        { intent: "Prix et local", items: ["Combien coûte un organisme de formation Qualiopi ?", "Cabinet de recrutement tech à Paris", "Sous-traitant usinage aéronautique en Occitanie"] },
      ]}
      problems={[
        { title: "La short-list se fait sans vous", text: "Un acheteur qui demande « les 5 meilleurs » de votre secteur à une IA reçoit une liste. S'il n'y a pas votre nom, il ne vous contactera pas." },
        { title: "Les IA lisent d'autres sites que le vôtre", text: "Comparatifs, annuaires B2B, G2, Capterra, articles, Reddit, LinkedIn : c'est là que se décide qui est cité. Savez-vous lesquels comptent dans votre secteur ?" },
        { title: "Personne en interne n'a le temps", text: "Sans responsable marketing dédié, le référencement IA passe toujours après. Les agences démarrent vers 1 000 €/mois. Les outils vous laissent seul avec un tableau de bord." },
      ]}
      facts={[FACTS.g2Start, FACTS.sixsense, FACTS.orbit]}
      factsNote="Études internationales sur l'achat B2B. Le rapport G2 est publié par une plateforme d'avis qui vend de la visibilité : nous le citons avec ce biais."
      proofNote="Méthode publiée : pour chaque résultat, le nombre de questions, d'IA, de passages et le niveau de confiance. Votre rapport mensuel montre vos propres visites venues des IA, dans votre Google Analytics."
      steps={[
        { verb: "Mesurer", text: `${promptsCount("pme", "essentiel")} à ${promptsCount("pme", "accompagne")} questions d'acheteurs de votre secteur, posées ${frequencyAdverb("pme", "essentiel")} à ${enginesLabel("pme", "essentiel")}. Votre part de voix face à 5 concurrents.` },
        { verb: "Comprendre", text: "Les pages et domaines que les IA citent, votre présence sur chacun, et pourquoi vos concurrents passent devant (avis, comparatifs, contenus, données structurées)." },
        { verb: "Agir", text: "Pages « citables » (comparatifs, « alternative à », FAQ métier), balisage schema.org, llms.txt, fiches G2, Capterra et annuaires, démarches vers les sources citées. En Accompagné, nous rédigeons et publions après votre validation." },
        { verb: "Prouver", text: "Visites venues des IA (via Google Analytics), évolution de la part de voix, rapport mensuel et 30 minutes de point visio." },
      ]}
      signature={{
        title: "Qui chaque IA recommande à votre place",
        intro: "Sur les questions de vos acheteurs, chaque IA a ses favoris. La matrice montre, IA par IA, qui est cité et à quelle fréquence.",
        points: ["Vos 5 concurrents les plus cités, face à vous", "Les écarts entre ChatGPT, Gemini et Perplexity", "Le concurrent à rattraper en premier"],
        visual: <CompetitorMatrix m={matrix} />,
      }}
      stepsVisual={
        <>
          <DemoClip id="comprendre" title="Les sources des IA, et qui passe devant" fallback={<UnderstandScene />} />
          <DemoClip id="agir" title="Les actions de la semaine, déjà rédigées" fallback={<ActScene />} />
        </>
      }
      features={[
        "Questions par intention : comparatif, alternative, prix, local",
        "Part de voix et sentiment",
        "Cartographie des sources classée par opportunité",
        "Analyse « pourquoi eux »",
        "Rédaction de pages citables",
        "Balisage schema.org et llms.txt",
        "Trafic IA via GA4",
        "Rapport mensuel exportable pour votre direction",
      ]}
      pricingNote="Plus de 200 questions suivies ou plusieurs pays : nous établissons un devis."
      faq={[
        { q: "En quoi êtes-vous différents de Meteoria, Qwairy ou Peec ?", a: "Ce sont de bons outils de mesure pour des équipes marketing. Nous mesurons aussi, mais surtout nous faisons le travail : rédaction, balisage, démarches vers les sources. Et nous parlons à des dirigeants, pas seulement à des experts SEO." },
        { q: "Et par rapport à une agence ?", a: "Une agence GEO démarre généralement vers 950 à 2 500 €/mois. Nous automatisons la mesure et une partie de l'exécution, ce qui permet un prix de logiciel. Pour un dispositif sur mesure (relations presse, gros volume de contenu), une agence reste un bon choix." },
        { q: "Pourquoi l'audit est-il payant ?", a: "Le test gratuit vous montre le problème. L'audit approfondi est un vrai travail d'analyse (2 à 3 heures humaines) et un plan sur 90 jours que vous pouvez exécuter seul, avec nous ou avec votre agence. Il est déduit de votre premier mois d'Accompagné si vous souscrivez sous 30 jours." },
        { q: "Vous écrivez sur notre site ?", a: "Avec un accès délégué (WordPress, Webflow, HubSpot…) ou en vous livrant le texte prêt à publier. Rien n'est publié sans votre validation." },
        { q: "Vous postez sur Reddit ou des forums en notre nom ?", a: "Non. Nous repérons les discussions utiles et préparons des réponses ; c'est une vraie personne de votre équipe qui répond, identifiée comme telle. Le faux « client satisfait » est interdit et contre-productif." },
        { q: "Pouvez-vous promettre que nous serons cités ?", a: "Non. Nous nous engageons sur le travail fait et sur la mesure honnête de son effet." },
      ]}
      finalTitle="Votre site convainc‑t‑il Google et les IA ? Réponse en 60 secondes."
    />
  );
}
