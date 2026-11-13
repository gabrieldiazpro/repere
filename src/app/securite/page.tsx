import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Faq, type QA } from "@/components/site/blocks";
import { CtaBand, PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { DocLayout } from "@/components/pages/v4/DocLayout";
import { DataFlow } from "@/components/pages/v4/DataFlow";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, faqPageLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL } from "@/lib/seo/site";

const PATH = "/securite";
const TITLE = "Sécurité et données : comment Repéré protège vos informations";
const DESCRIPTION =
  "Données collectées, hébergement, chiffrement, connexion sans mot de passe, RGPD (export et suppression), sous-traitants et fonctionnement de notre robot.";
const UPDATED = "2026-11-09";

export const metadata = pageMeta({ path: PATH, title: "Sécurité et protection des données", description: DESCRIPTION });

type Block = { id: string; title: string; paras: string[]; points?: string[] };

const BLOCKS: Block[] = [
  {
    id: "donnees",
    title: "Les données que nous traitons",
    paras: [
      "Pour mesurer votre visibilité, nous avons besoin de peu : le nom de votre entreprise, votre activité, votre ville ou votre site, vos concurrents et les questions suivies. Ce sont des informations publiques ou professionnelles.",
      "Le script de mesure du trafic ne pose aucun cookie et ne collecte aucune donnée personnelle de vos visiteurs : il enregistre la page visitée et le site d'origine (par exemple chatgpt.com).",
    ],
    points: ["Jamais revendues, jamais utilisées pour de la publicité", "Aucune donnée de carte bancaire chez nous : le paiement passe par Stripe", "Les comptes démo sont fictifs et en lecture seule"],
  },
  {
    id: "connexion",
    title: "Connexion et accès",
    paras: [
      "La connexion se fait par lien magique envoyé par e-mail : pas de mot de passe à retenir, ni à voler. La session est conservée dans des cookies protégés (httpOnly), inaccessibles aux scripts de la page.",
      "Chaque membre d'une équipe a un rôle : propriétaire, administrateur, membre ou lecteur. Un lecteur consulte sans rien modifier.",
    ],
  },
  {
    id: "chiffrement",
    title: "Chiffrement",
    paras: [
      "Tous les échanges passent en HTTPS. Les jetons d'accès à vos outils connectés (Google Analytics, Slack, webhook) sont chiffrés en base (AES-256-GCM). Les webhooks que nous envoyons sont signés pour que vous puissiez vérifier qu'ils viennent de nous.",
      "Le site applique une politique de sécurité du contenu (CSP) et le HTTPS strict (HSTS).",
    ],
  },
  {
    id: "rgpd",
    title: "Vos droits (RGPD)",
    paras: [
      "Depuis votre espace, vous pouvez exporter toutes les données de votre compte ou demander leur suppression. Vous pouvez aussi nous écrire : réponse sous un mois au plus.",
      "Les liens de partage de rapport sont révocables à tout moment et peuvent expirer à une date choisie.",
    ],
  },
  {
    id: "ia",
    title: "Ce que nous envoyons aux IA",
    paras: [
      "Pour interroger les assistants et analyser leurs réponses, nous envoyons aux fournisseurs d'IA le minimum nécessaire : nom commercial, activité, ville, questions suivies et, pour le copilote, vos questions. Jamais les coordonnées de vos clients ni des données de paiement.",
      "Gemini est interrogé sans recherche web, conformément aux conditions de son API.",
    ],
  },
];

const SUBPROCESSORS: { name: string; role: string; where: string }[] = [
  { name: "Vercel", role: "Hébergement de l'application", where: "Région à confirmer avant ouverture commerciale" },
  { name: "Supabase", role: "Base de données", where: "Union européenne visée, à confirmer avant ouverture commerciale" },
  { name: "Stripe", role: "Paiement", where: "Selon le service" },
  { name: "Resend", role: "Envoi des e-mails (lien de connexion, résumé du lundi, alertes)", where: "Selon le service" },
  { name: "OpenAI, Google, Perplexity, Anthropic", role: "IA interrogées et analyse des réponses", where: "États-Unis, selon le service" },
  { name: "Mistral AI", role: "IA interrogée, si l'option est activée", where: "Éditeur français, selon le service" },
];

const FAQ: QA[] = [
  {
    q: "Où sont hébergées mes données ?",
    a: "Chez Vercel (application) et Supabase (base de données). La région exacte de chaque prestataire est publiée sur cette page et dans la politique de confidentialité ; les points encore à confirmer y sont signalés comme tels.",
  },
  {
    q: "Repéré peut-il publier quelque chose à ma place sans mon accord ?",
    a: "Non. Toute publication (fiche, page, réponse à un avis) vous est soumise et attend votre validation.",
  },
  {
    q: "Comment signaler une faille de sécurité ?",
    a: `Écrivez-nous à ${CONTACT_EMAIL} avec l'objet « Sécurité ». Nous accusons réception sous 48 heures ouvrées et vous tenons informé de la correction.`,
  },
];

const TOC = [
  ...BLOCKS.map((b) => ({ id: b.id, label: b.title })),
  { id: "sous-traitants", label: "Sous-traitants" },
  { id: "robot", label: "Notre robot, RepereBot" },
  { id: "faq", label: "Questions fréquentes" },
];

export default function SecuritePage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Sécurité", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    faqPageLd(PATH, FAQ, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Sécurité" }]}
        title="Vos données, et ce que nous en faisons"
        lead="Peu de données, chiffrées quand elles sont sensibles, jamais revendues, supprimées à votre demande. Ce qui reste à confirmer est indiqué comme tel."
        aside={
          <DataFlow
            label="Ce que nous envoyons aux IA, et ce qui ne part jamais"
            title="Quand nous interrogeons une IA"
            sent={["Votre nom commercial", "Votre activité et votre ville", "Les questions suivies", "Vos questions au copilote"]}
            never={["Les coordonnées de vos clients", "Vos données de paiement"]}
          />
        }
      >
      </PageHero>

      <section aria-label="Protection des données" className="bg-white py-16 sm:py-20">
        <Container>
          <DocLayout toc={TOC} idBase="secu">
          <div className="space-y-14">
            {BLOCKS.map((b) => (
              <section key={b.id} id={b.id} aria-labelledby={`${b.id}-title`} className="scroll-mt-24">
                <h2 id={`${b.id}-title`} className="text-[1.7rem] font-bold leading-tight sm:text-[2rem]">
                  {b.title}
                </h2>
                {b.paras.map((p) => (
                  <p key={p} className="mt-4 text-[1.05rem] text-ink/80">
                    {p}
                  </p>
                ))}
                {b.points ? (
                  <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[1.02rem] text-ink/80 marker:text-primary">
                    {b.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section id="sous-traitants" aria-labelledby="st-title" className="scroll-mt-24">
              <h2 id="st-title" className="text-[1.7rem] font-bold leading-tight sm:text-[2rem]">
                Sous-traitants
              </h2>
              <p className="mt-4 text-[1.05rem] text-ink/80">Les prestataires qui traitent des données pour faire fonctionner le service.</p>
              <div className="mt-5 relative overflow-x-auto rounded-2xl shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
                <table className="w-full min-w-[34rem] border-collapse text-left text-[0.95rem]">
                  <caption className="sr-only">Liste des sous-traitants</caption>
                  <thead className="bg-canvas">
                    <tr>
                      <th scope="col" className="px-4 py-3">Prestataire</th>
                      <th scope="col" className="px-4 py-3">Rôle</th>
                      <th scope="col" className="px-4 py-3">Lieu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUBPROCESSORS.map((s) => (
                      <tr key={s.name} className="border-t border-line/70 align-top">
                        <th scope="row" className="px-4 py-3 font-semibold">{s.name}</th>
                        <td className="px-4 py-3">{s.role}</td>
                        <td className="px-4 py-3 text-ink/80">{s.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[0.95rem] text-ink/80">
                Le détail juridique est dans la <Link href="/confidentialite" className={linkClass}>politique de confidentialité</Link>.
              </p>
            </section>

            <section id="robot" aria-labelledby="robot-title" className="scroll-mt-24">
              <h2 id="robot-title" className="text-[1.7rem] font-bold leading-tight sm:text-[2rem]">
                Notre robot, RepereBot
              </h2>
              <p className="mt-4 text-[1.05rem] text-ink/80">
                Quand vous auditez une page, notre robot la lit en s&apos;identifiant clairement (RepereBot), en respectant votre
                fichier robots.txt, avec un délai maximal de 8 secondes et une taille limitée. Il refuse les adresses internes
                ou privées. Il ne remplit aucun formulaire et ne se connecte à aucun compte.
              </p>
              <p className="mt-3 text-[0.95rem] text-ink/80">
                Comment le bloquer ou le reconnaître : <Link href="/methode/robot" className={linkClass}>la page de notre robot</Link>.
              </p>
            </section>

            <section id="faq" aria-labelledby="secu-faq-title" className="scroll-mt-24">
              <h2 id="secu-faq-title" className="text-[1.7rem] font-bold leading-tight sm:text-[2rem]">
                Questions fréquentes
              </h2>
              <div className="mt-6">
                <Faq items={FAQ} idPrefix="faq-secu" />
              </div>
            </section>
          </div>
          </DocLayout>
        </Container>
      </section>

      <CtaBand title="Des questions avant de commencer ?" text="Écrivez-nous ou essayez sans risque : le compte gratuit ne demande pas de carte bancaire." />
    </SitePage>
  );
}
