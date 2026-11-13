import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CtaBand, PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { HubDiagram } from "@/components/pages/v4/HubDiagram";
import { Icon } from "@/components/app/icons";

/** Libellés courts pour le schéma. */
const SHORT: Record<string, string> = { script: "Script de mesure", exports: "Exports CSV", ga4: "Google Analytics 4" };
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";

const PATH = "/integrations";
const TITLE = "Intégrations : WordPress, Google Analytics, Slack, webhook, Shopify";
const DESCRIPTION =
  "Les outils que Repéré connecte, avec leur état réel : disponible ou en préparation. WordPress, script sans cookie, Google Analytics 4, Slack, webhook, exports, Shopify.";
const UPDATED = "2026-11-09";

export const metadata = pageMeta({ path: PATH, title: "Intégrations", description: DESCRIPTION });

type Status = "disponible" | "en préparation";
type Integration = { id: string; name: string; status: Status; what: string; how: string; href?: { label: string; url: string } };

/** GA4 : disponible seulement quand les identifiants OAuth sont configurés sur le serveur. */
const ga4Ready = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function integrations(): Integration[] {
  return [
    {
      id: "wordpress",
      name: "WordPress",
      status: "disponible",
      what: "Une extension qui sert sur votre site le balisage schema.org préparé par Repéré et le tient à jour.",
      how: "Téléchargez l'extension depuis votre espace, installez-la, collez votre clé. Désactivable en un clic.",
      href: { label: "Le pilier Agir", url: "/fonctionnalites/agir#plugin" },
    },
    {
      id: "script",
      name: "Script de mesure sans cookie",
      status: "disponible",
      what: "Une ligne à coller sur n'importe quel site pour compter les visites venues des IA et les passages de leurs robots.",
      how: "Copiez la ligne depuis votre espace. Aucun bandeau de consentement nécessaire : pas de cookie, pas de donnée personnelle.",
      href: { label: "Le trafic IA", url: "/fonctionnalites/prouver#trafic" },
    },
    {
      id: "ga4",
      name: "Google Analytics 4",
      status: ga4Ready() ? "disponible" : "en préparation",
      what: "Lecture de vos visites venues des IA dans Google Analytics, si vous préférez ne pas ajouter de script.",
      how: "Connexion par votre compte Google, accès en lecture seule, révocable à tout moment.",
    },
    {
      id: "slack",
      name: "Slack",
      status: "disponible",
      what: "Les alertes (concurrent qui passe devant, erreur d'une IA sur vous, mesure terminée) dans le canal de votre choix.",
      how: "Collez l'adresse de webhook entrant de votre canal Slack dans Réglages, puis envoyez un message de test.",
    },
    {
      id: "webhook",
      name: "Webhook",
      status: "disponible",
      what: "Les mêmes événements envoyés à votre propre outil, signés pour que vous vérifiiez qu'ils viennent de nous.",
      how: "Indiquez une adresse HTTPS ; chaque envoi porte une signature HMAC à vérifier avec votre clé.",
    },
    {
      id: "exports",
      name: "Exports CSV et liens de partage",
      status: "disponible",
      what: "Chaque vue exportable en CSV ; le rapport partageable par un lien révocable, avec expiration.",
      how: "Bouton « Exporter » ou « Partager » sur chaque écran (offres Essentiel et Accompagné).",
      href: { label: "Rapports et partage", url: "/fonctionnalites/rapports-et-partage" },
    },
    {
      id: "shopify",
      name: "Shopify",
      status: "en préparation",
      what: "Les commandes venues des IA lues directement dans votre boutique, pour attribuer le chiffre d'affaires.",
      how: "En attendant : le script de mesure transmet la valeur des commandes, sans donnée client.",
      href: { label: "Le module e-commerce", url: "/fonctionnalites/e-commerce" },
    },
  ];
}

export default function IntegrationsPage() {
  const list = integrations();
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Intégrations", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "CollectionPage", dateModified: UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);
  const available = list.filter((i) => i.status === "disponible").length;

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Intégrations" }]}
        title="Ce que Repéré connecte"
        lead={`${available} intégrations disponibles aujourd'hui, ${list.length - available} en préparation. L'état affiché est l'état réel.`}
        aside={<HubDiagram label={`Repéré et ses ${list.length} intégrations : ${available} disponibles, ${list.length - available} en préparation`} items={list.map((it) => ({ id: it.id, label: SHORT[it.id] ?? it.name, ok: it.status === "disponible" }))} />}
      />

      <section aria-label="Liste des intégrations" className="bg-white py-16 sm:py-20">
        <Container>
          <ul className="ui-cascade grid gap-5 md:grid-cols-2">
            {list.map((it) => (
              <li key={it.id} id={it.id} className="scroll-mt-24 rounded-2xl bg-canvas p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">{it.name}</h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.82rem] font-semibold ${
                      it.status === "disponible" ? "bg-success-bg text-success-ink" : "bg-warning-bg text-warning-ink"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name={it.status === "disponible" ? "check" : "gear"} size={14} />
                      {it.status === "disponible" ? "Disponible" : "En préparation"}
                    </span>
                  </span>
                </div>
                <p className="mt-3 text-[1rem] text-ink/85">{it.what}</p>
                <p className="mt-2 text-[0.95rem] text-ink/70">{it.how}</p>
                {it.href ? (
                  <Link href={it.href.url} className="mt-3 inline-flex min-h-10 items-center font-semibold text-primary underline-offset-4 hover:underline">
                    {it.href.label}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-3xl text-[0.98rem] text-ink/80">
            Un outil manque ? <Link href="/contact" className={linkClass}>Dites-nous lequel</Link> : nous priorisons selon les demandes.
            Les données échangées avec chaque outil sont décrites sur la page <Link href="/securite" className={linkClass}>sécurité</Link>.
          </p>
        </Container>
      </section>

      <CtaBand title="Branchez Repéré sur vos outils." text="Compte gratuit pour commencer ; les intégrations s'activent avec Essentiel." />
    </SitePage>
  );
}
