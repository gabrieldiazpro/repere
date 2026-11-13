import Link from "next/link";
import { SegmentLanding } from "@/components/site/SegmentLanding";
import { NeighborhoodMap } from "@/components/site/segment-visuals";
import { demoLocalMap, orNull } from "@/components/site/demo-figures";
import { FACTS } from "@/components/site/facts";
import { HallucinationScreen } from "@/components/site/mockups";
import { ChatScene } from "@/components/site/ChatScene";
import { VAT_NOTICE, euros, tiersFor } from "@/components/site/plans-v2";
import { pageMeta } from "@/lib/seo/meta";
import { enginesLabel, frequencyAdverb, v5OfferFacts } from "@/components/site/offer-facts";
import { demoAbsentAnswer } from "@/components/site/demo-figures";

/** Chiffres des comptes démo (trafic glissant sur 30 jours) recalculés chaque jour. */
export const revalidate = 86400;

const TITLE = "SEO local et IA : artisans et commerces";
const DESCRIPTION =
  "Google Maps et ChatGPT recommandent le commerce dont le site, la fiche et les avis concordent. Analyse gratuite du site, puis Essentiel dès 29 €/mois.";

export const metadata = pageMeta({ path: "/local", title: TITLE, description: DESCRIPTION });

export default async function LocalPage() {
  const map = await orNull(demoLocalMap());
  const tiers = tiersFor("local");
  const ess = tiers.essentielMonth ? euros(tiers.essentielMonth.priceCents) : "–";
  const acc = tiers.accompagne ? euros(tiers.accompagne.priceCents) : "–";
  const t = tiersFor("local");
  const chat = demoAbsentAnswer("local");
  const reseau = t.reseauMonth ? euros(t.reseauMonth.priceCents) : "79 €";
  return (
    <SegmentLanding
      seo={{ title: TITLE, description: DESCRIPTION }}
      brief={[
        { label: "Pour qui", value: "Artisans, commerces, restaurants, agences immobilières et instituts qui veulent être trouvés sur Google et cités quand on demande une adresse à une IA." },
        { label: "Ce que nous vérifions sur votre site", value: `SEO local : pages par service et par ville, nom, adresse et téléphone identiques partout, balisage LocalBusiness, mentions légales, vitesse sur mobile. ${v5OfferFacts("local", "essentiel").seoLines[0]} en Essentiel ; ${v5OfferFacts("local", "essentiel").keywords} mots-clés locaux suivis sur Google.` },
        { label: "Ce que nous mesurons", value: `Les questions de vos clients (« meilleur plombier dans le 11e », « ouvert le dimanche »), posées plusieurs fois (2 passages au test gratuit, 3 en suivi) à ${enginesLabel("local", "essentiel")} (Claude en plus en Accompagné) : qui est cité, à quel rang, sur quelles sources. Mesure ${frequencyAdverb("local", "essentiel")} en Essentiel, ${frequencyAdverb("local", "accompagne")} en Accompagné.` },
        { label: "Prix", value: `Test gratuit. Essentiel ${ess}/mois sans engagement. Accompagné ${acc}/mois, 3 mois minimum : nous faisons le travail. ${VAT_NOTICE}.` },
        { label: "Travail fait (Accompagné)", value: "Fiches Google, Bing et Apple complétées et tenues à jour, réponses à vos avis, demandes d'avis à vos vrais clients, annuaires corrigés. Rien n'est publié sans votre accord." },
        { label: "Ce que nous ne faisons pas", value: "Aucune promesse de position dans une IA, aucun faux avis." },
        { label: "Délai", value: `Résultat du test en quelques minutes. Les effets des corrections se mesurent en semaines ou en mois, d'où une mesure ${frequencyAdverb("local", "essentiel")} en Essentiel (${frequencyAdverb("local", "accompagne")} en Accompagné).` },
      ]}
      related={[
        { href: "/guides/seo-local-et-ia", label: "SEO local et IA : le guide pour les commerces" },
        { href: "/geo", label: "Qu'est-ce que le GEO (référencement IA) ?" },
        { href: "/guides/ia-disent-des-choses-fausses", label: "Quand une IA donne de fausses informations sur votre commerce" },
        { href: "/guides/avis-clients-ia", label: "Avis clients et IA : ce qui compte, ce qui est interdit" },
        { href: "/visibilite-ia", label: "Visibilité IA par métier : questions et annuaires clés" },
        { href: "/questions", label: "Les questions les plus posées sur le référencement IA" },
      ]}
      segment="local"
      eyebrow="SEO local et IA pour les commerces, artisans et restaurants"
      title="Sur Google comme dans ChatGPT, soyez le commerce qu'on recommande."
      subtitle="« Plombier ouvert le dimanche à Lyon 3 » se tape dans Google et se demande à ChatGPT. Repéré vérifie votre site, votre fiche et vos avis, vous dit quoi corriger, et le fait avec vous."
      primaryCta="Analyser mon site"
      seoGeo={{
        title: "Ce qui fait recommander un commerce, sur Google et dans les IA",
        intro: "Le SEO local et le référencement IA reposent sur les mêmes preuves : un site clair, une fiche complète, des coordonnées cohérentes et des avis récents.",
        items: [
          { reader: "both", title: "Le même nom, la même adresse, le même téléphone partout", text: "Site, fiche Google, Pages Jaunes, balisage : une seule contradiction et Google comme les IA hésitent entre deux versions." },
          { reader: "google", title: "Une page par service, et par ville vraiment servie", text: "« Débouchage à Villeurbanne » mérite sa page si vous y intervenez. Pas de pages copiées-collées où seul le nom de la ville change." },
          { reader: "both", title: "Un balisage LocalBusiness juste", text: "Nom, adresse, horaires, zone d'intervention, vérifiés contre le texte visible de vos pages." },
          { reader: "google", title: "Une fiche Google complète et vivante", text: "Catégorie principale exacte, horaires des jours fériés, photos récentes, réponses aux questions." },
          { reader: "ia", title: "Les annuaires que les IA lisent dans votre métier", text: "Nous partons des sources réellement citées dans les réponses, pas d'une liste générique de 200 annuaires." },
          { reader: "both", title: "Des avis récents, avec une réponse", text: "Demandés à vos vrais clients, jamais achetés ni rédigés par nous." },
        ],
        guide: { href: "/guides/seo-local-et-ia", label: "Le guide : SEO local et IA, ce qui compte vraiment" },
      }}
      secondaryCta={{ label: "Voir un exemple de rapport", href: "/rapport/demo-1" }}
      reassure={["Gratuit", "Sans carte bancaire", "2 minutes"]}
      queriesTitle="Ce que vos clients demandent aux IA"
      queries={[
        { intent: "Le meilleur près de chez moi", items: ["Meilleur plombier Paris 11e", "Un bon coiffeur pour cheveux bouclés à Lyon 7e", "Agence immobilière sérieuse dans le Marais"] },
        { intent: "Quand j'en ai besoin", items: ["Plombier ouvert le dimanche", "Serrurier disponible ce soir à Nantes", "Restaurant ouvert tard près de Bastille"] },
        { intent: "Pour être rassuré", items: ["Garage honnête avec des devis clairs", "Institut de beauté bien noté dans le 15e", "Électricien avec tarif annoncé à l'avance"] },
      ]}
      problems={[
        { title: "L'IA donne trois noms, pas dix", text: "Sur Google, on peut être 6e et recevoir des appels. Dans une réponse d'IA, si vous n'êtes pas dans les trois, le client ne vous voit pas." },
        { title: "Elle se trompe peut-être sur vous", text: "Horaires, adresse, services : les IA reprennent ce qu'elles trouvent, même faux." },
        { title: "Vous n'avez pas le temps", text: "Fiche Google, Bing, annuaires, avis : c'est beaucoup de petites tâches. Avec Accompagné, c'est nous qui les faisons." },
      ]}
      facts={[FACTS.parisConversational, FACTS.weeklyUse, FACTS.insites]}
      factsNote="L'étude Insites porte sur des commerces américains ; nous n'avons pas trouvé d'étude française équivalente."
      proofNote="Chaque résultat de votre rapport indique combien de réponses d'IA nous avons analysées et notre niveau de confiance. Pas de compteur gonflé, pas de logos inventés : nous afficherons des témoignages quand nos premiers clients nous auront donné leur accord écrit."
      steps={[
        { verb: "Mesurer", text: "Nous posons à ChatGPT, Gemini et Perplexity les questions de vos clients (« meilleur plombier dans votre quartier », « plombier ouvert le dimanche »…), plusieurs fois chacune ; Claude s'ajoute en Accompagné." },
        { verb: "Comprendre", text: "Nous voyons qui elles citent et d'où elles tiennent leurs infos : fiche Google, avis, Pages Jaunes, guides, TripAdvisor…" },
        { verb: "Agir", text: "Nous complétons et corrigeons vos fiches, répondons à vos avis, demandons des avis à vos vrais clients, ajoutons les infos qui manquent." },
        { verb: "Prouver", text: "Chaque mois, votre score, vos citations, vos concurrents et les visites venues des IA." },
      ]}
      signature={
        map
          ? {
              title: "Votre quartier, vu par les IA",
              intro: "Nous posons la même question en nommant chaque quartier autour de vous : vous voyez où les IA vous citent, et où un concurrent prend la place.",
              points: ["Une carte par zone, refaite à chaque mesure", "Le concurrent le plus cité dans chaque zone", "Les zones où agir en premier"],
              visual: <NeighborhoodMap map={map} />,
            }
          : undefined
      }
      stepsVisual={
        <>
          {chat ? <ChatScene chat={chat} /> : null}
          <HallucinationScreen />
        </>
      }
      features={[
        "Score mensuel sur 100",
        "3 concurrents suivis",
        "Fiches Google, Bing et Apple tenues à jour (Accompagné)",
        "Réponses à vos avis rédigées pour vous",
        "Alerte si un concurrent vous dépasse",
        "Alerte si une IA se trompe sur vous",
        "Rapport PDF clair",
        "Validation depuis votre téléphone",
      ]}
      pricingNote={<>Plusieurs établissements ? L&apos;offre Réseau démarre à {reseau}/mois jusqu&apos;à 5 établissements.{" "}<Link href="/tarifs" className="font-semibold text-primary underline underline-offset-4">Voir la page Tarifs</Link>.</>}
      faq={[
        { q: "Je n'y connais rien, c'est pour moi ?", a: "Oui. Vous n'avez rien de technique à faire. En Accompagné, vous validez nos propositions depuis votre téléphone." },
        { q: "Vous avez besoin de quoi ?", a: "Un accès gestionnaire à votre fiche Google (on vous guide, 3 minutes). Rien d'autre d'obligatoire." },
        { q: "Vous écrivez de faux avis ?", a: "Jamais. C'est illégal et interdit par Google. Nous demandons des avis à vos vrais clients et nous répondons à ceux que vous recevez." },
        { q: "Je serai premier sur ChatGPT ?", a: "Personne ne peut le promettre. Nous mettons en place ce que les IA lisent et nous mesurons chaque mois si ça bouge." },
        { q: "Je peux arrêter ?", a: "Essentiel : en un clic, à tout moment. Accompagné : après les 3 premiers mois, en un clic." },
      ]}
      finalTitle="Votre site est-il prêt pour Google et pour les IA ? Réponse en 60 secondes."
    />
  );
}
