import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "@/components/site/Logo";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL, FOUNDER, ONE_LINER } from "@/lib/seo/site";
import { CHECKS, SECTIONS } from "@/lib/seoaudit";
import { PUBLIC_ANALYSIS_MAX_PAGES } from "@/lib/entitlements";
import { CRAWL_BUDGET_MS } from "@/lib/analysis/run";
import { STUDY_PUBLISH_AT, studyPath } from "@/lib/studies";
import shotLocal from "./_visuels/repere-demo-app-local.png";
import shotPme from "./_visuels/repere-demo-app-concurrents-pme.png";
import shotEcom from "./_visuels/repere-demo-app-ia-ecom.png";

const PATH = "/presse";
const TITLE = "Espace presse";
const DESCRIPTION =
  "Kit presse de Repéré : présentation, chiffres vérifiables de la méthode et des études publiques, fondateur, contact presse, logos SVG et captures de l'application.";
const UPDATED = "2026-11-15";
const PRESS_EMAIL = (process.env.NEXT_PUBLIC_PRESS_EMAIL || CONTACT_EMAIL).trim();

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

/** Chiffres tirés du code de Repéré (ils changent si le produit change). */
const METHOD_FIGURES: { value: string; label: string; source: { text: string; href: string } }[] = [
  { value: String(CHECKS.length), label: `contrôles SEO, répartis en ${SECTIONS.length} familles, chacun relié à une documentation de Google`, source: { text: "Méthode", href: "/methode" } },
  { value: "8", label: "familles de contrôles GEO : ce que les IA peuvent lire, avec un niveau de preuve par règle", source: { text: "Méthode", href: "/methode" } },
  { value: String(PUBLIC_ANALYSIS_MAX_PAGES), label: `pages explorées en ${Math.round(CRAWL_BUDGET_MS / 1000)} secondes au plus par l'analyse gratuite, en respectant robots.txt`, source: { text: "Analyse gratuite", href: "/analyse" } },
  { value: "5", label: "IA interrogées selon l'offre : ChatGPT, Perplexity, Gemini, Claude et Mistral, chaque score avec sa marge d'erreur", source: { text: "Méthode", href: "/methode" } },
];

/** Chiffres des études publiques, repris de /etudes/ce-que-nous-savons-deja (source primaire citée). */
const STUDY_FIGURES: { value: string; label: string; source: { text: string; href: string } }[] = [
  {
    value: "48 %",
    label: "des Français de 12 ans et plus ont utilisé une IA générative en 2025, 15 points de plus qu'un an plus tôt",
    source: { text: "Arcep, Baromètre du numérique 2026", href: "https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/equipements-et-usages-du-numerique-090226.html" },
  },
  {
    value: "73 %",
    label: "de ces utilisateurs s'en servent pour rechercher de l'information",
    source: { text: "Arcep, Baromètre du numérique 2026", href: "https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/equipements-et-usages-du-numerique-090226.html" },
  },
  {
    value: "44 à 64 %",
    label: "des commerces ont au moins une information inexacte dans les réponses des IA, selon les deux études disponibles (États-Unis, Royaume-Uni)",
    source: { text: "Synthèse Repéré des études publiques", href: "/etudes/ce-que-nous-savons-deja" },
  },
];

const SHOTS: { img: StaticImageData; file: string; title: string; text: string }[] = [
  { img: shotLocal, file: "repere-demo-app-local.png", title: "L'écran du lundi", text: "Commerce local fictif « Plomberie Martin » : l'erreur d'une IA à corriger en premier, le score et sa marge d'erreur." },
  { img: shotPme, file: "repere-demo-app-concurrents-pme.png", title: "Les concurrents cités à votre place", text: "PME fictive « Paysia » : rang, part de voix et raisons pour lesquelles un concurrent passe devant." },
  { img: shotEcom, file: "repere-demo-app-ia-ecom.png", title: "Ce que disent les IA", text: "Boutique fictive « Maison Sora » : ton des réponses et note par IA, avec la marge de chaque mesure." },
];

const LOGOS = [
  { href: "/presse/logo-repere.svg", file: "logo-repere.svg", title: "Logo couleur", dark: false, lockup: true },
  { href: "/presse/logo-repere-blanc.svg", file: "logo-repere-blanc.svg", title: "Logo blanc, pour fond sombre", dark: true, lockup: true },
  { href: "/presse/pictogramme-repere.svg", file: "pictogramme-repere.svg", title: "Pictogramme seul", dark: false, lockup: false },
];

function Figure({ value, label, source }: (typeof METHOD_FIGURES)[number]) {
  const external = source.href.startsWith("http");
  return (
    <li className="border-t-2 border-ink/80 pt-4">
      <p className="font-display text-[2.6rem] font-bold leading-none tracking-[-0.02em] text-primary rp-num">{value}</p>
      <p className="mt-2 text-[1rem] text-ink/85">{label}</p>
      <p className="mt-2 text-[0.85rem] text-muted">
        Source :{" "}
        {external ? (
          <a href={source.href} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">{source.text}</a>
        ) : (
          <Link href={source.href} className="underline underline-offset-2">{source.text}</Link>
        )}
      </p>
    </li>
  );
}

export default function PressePage() {
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Presse", path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED, datePublished: UPDATED }, { withContext: false }), about: orgRef() },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Presse" }]}
        title="Espace presse"
        lead="Tout ce qu'il faut pour écrire sur Repéré : qui nous sommes en trois phrases, des chiffres que vous pouvez vérifier, des visuels libres d'usage et une personne à joindre."
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href={`mailto:${PRESS_EMAIL}?subject=${encodeURIComponent("Demande presse")}`} className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-strong">
            Écrire au contact presse
          </a>
          <a href="#visuels" className="inline-flex min-h-12 items-center px-2 font-semibold text-primary underline underline-offset-4 hover:no-underline">
            Télécharger les visuels
          </a>
        </div>
      </PageHero>

      <section aria-labelledby="presentation" className="bg-white py-16 sm:py-20">
        <Container size="narrow">
          <h2 id="presentation" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Repéré en trois phrases</h2>
          <div className="mt-6 space-y-4 border-l-4 border-accent pl-5 text-[1.15rem] leading-relaxed sm:text-[1.25rem]">
            <p>{ONE_LINER}</p>
            <p>
              Le service explore réellement le site d&apos;une entreprise, contrôle ce que Google et les IA peuvent en lire, puis réalise avec elle les corrections qui comptent, sans rien publier sans sa validation.
            </p>
            <p>
              Conçu en France pour les commerces locaux, les PME et les boutiques en ligne, Repéré est édité par Mycelo et se lance avec un programme de{" "}
              <Link href="/pilotes" className={linkClass}>dix entreprises pilotes</Link>.
            </p>
          </div>
          <p className="mt-6 text-[0.95rem] text-muted">Ces trois phrases peuvent être reprises telles quelles.</p>
        </Container>
      </section>

      <section aria-labelledby="chiffres" className="bg-canvas py-16 sm:py-20">
        <Container>
          <h2 id="chiffres" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Chiffres vérifiables</h2>
          <p className="mt-3 max-w-[64ch] text-lg text-ink/75">
            Repéré n&apos;est pas encore ouvert au public : nous ne communiquons aucun chiffre d&apos;utilisateurs, de clients ou de chiffre d&apos;affaires. Voici ce que fait la méthode, et ce que disent les études publiques.
          </p>
          <h3 className="mt-10 font-display text-xl font-bold">Ce que mesure Repéré</h3>
          <ul className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METHOD_FIGURES.map((f) => <Figure key={f.label} {...f} />)}
          </ul>
          <h3 className="mt-14 font-display text-xl font-bold">Ce que disent les études publiques</h3>
          <ul className="mt-5 grid gap-8 sm:grid-cols-3">
            {STUDY_FIGURES.map((f) => <Figure key={f.label} {...f} />)}
          </ul>
          <p className="mt-8 max-w-[70ch] text-[0.98rem] text-ink/80">
            Toutes les études, avec leur périmètre et le biais éventuel de leur éditeur :{" "}
            <Link href={studyPath("ce-que-nous-savons-deja")} className={linkClass}>Recherche IA en France, ce que nous savons déjà</Link>. Notre propre{" "}
            <Link href={studyPath("barometre-visibilite-ia")} className={linkClass}>Baromètre de la visibilité IA</Link> publiera ses résultats à partir de {STUDY_PUBLISH_AT} audits réels, pas avant.
          </p>
        </Container>
      </section>

      <section aria-labelledby="fondateur" className="bg-white py-16 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 id="fondateur" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Le fondateur</h2>
              <div className="mt-6 flex items-start gap-5">
                {FOUNDER.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={FOUNDER.image} alt={`Portrait de ${FOUNDER.name}`} width={96} height={96} className="h-24 w-24 shrink-0 rounded-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-dashed border-line text-[0.8rem] text-muted">Portrait</div>
                )}
                <div>
                  <p className="font-display text-xl font-bold">{FOUNDER.name || "[À COMPLÉTER : prénom et nom]"}</p>
                  <p className="text-muted">{FOUNDER.jobTitle}, Repéré</p>
                  <p className="mt-3 max-w-[60ch] text-ink/85">
                    {FOUNDER.bio || "[À COMPLÉTER : parcours en 2 ou 3 phrases, vérifiable, et pourquoi Repéré.]"}
                  </p>
                  {FOUNDER.linkedin ? (
                    <p className="mt-3">
                      <a href={FOUNDER.linkedin} className={linkClass} target="_blank" rel="noopener noreferrer">Profil LinkedIn</a>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <h2 className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Contact presse</h2>
              <p className="mt-6 text-lg">
                <a href={`mailto:${PRESS_EMAIL}?subject=${encodeURIComponent("Demande presse")}`} className={linkClass}>{PRESS_EMAIL}</a>
              </p>
              <p className="mt-3 max-w-[56ch] text-ink/80">
                Réponse sous 24 heures ouvrées. Interview, démonstration de l&apos;application en visio ou analyse d&apos;un site pour illustrer un article : demandez-nous.
              </p>
              <p className="mt-3 text-ink/80">
                Vous pouvez aussi passer par le <Link href="/contact?sujet=presse" className={linkClass}>formulaire de contact</Link>, sujet « Presse ».
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section id="visuels" aria-labelledby="visuels-h" className="scroll-mt-20 bg-canvas py-16 sm:py-20">
        <Container>
          <h2 id="visuels-h" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Visuels à télécharger</h2>
          <p className="mt-3 max-w-[64ch] text-lg text-ink/75">
            Libres d&apos;usage pour parler de Repéré. Merci de ne pas déformer ni recolorer le logo.
          </p>
          <h3 className="mt-10 font-display text-xl font-bold">Logo (SVG vectoriel)</h3>
          <ul className="mt-5 grid gap-5 sm:grid-cols-3">
            {LOGOS.map((l) => (
              <li key={l.file} className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_var(--color-line)]">
                <div className={`grid h-36 place-items-center ${l.dark ? "bg-primary-deep" : "bg-white"}`}>
                  <span className="inline-flex items-center gap-3">
                    <LogoMark size={48} />
                    {l.lockup ? <span className={`font-display text-[2rem] font-bold tracking-[-0.02em] ${l.dark ? "text-white" : "text-ink"}`}>Repéré</span> : null}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line p-4">
                  <span className="font-semibold">{l.title}</span>
                  <a href={l.href} download={l.file} className="shrink-0 font-semibold text-primary underline underline-offset-4 hover:no-underline">
                    Télécharger<span className="sr-only"> {l.title} en SVG</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.9rem] text-muted">Couleurs : indigo #3730A3, ambre #F5A524, encre #1B1F2E. Logotype en Bricolage Grotesque (licence SIL OFL).</p>

          <h3 className="mt-14 font-display text-xl font-bold">Captures de l&apos;application</h3>
          <p className="mt-2 max-w-[70ch] text-ink/80">
            Captures de la vraie application, sur les trois comptes de démonstration. Les entreprises et les chiffres sont fictifs, et l&apos;application l&apos;indique sur chaque écran : merci de garder la mention « données de démonstration » en légende.
          </p>
          <ul className="mt-6 grid gap-8 lg:grid-cols-3">
            {SHOTS.map((s, i) => (
              <li key={s.file}>
                <figure>
                  <Image src={s.img} unoptimized loading={i === 0 ? "eager" : "lazy"} alt={`Capture de l'application Repéré : ${s.title.toLowerCase()} (données de démonstration)`} sizes="(min-width: 1024px) 33vw, 100vw" className="h-auto w-full rounded-xl shadow-[0_0_0_1px_var(--color-line),0_20px_40px_-28px_rgba(30,26,92,.45)]" />
                  <figcaption className="mt-3">
                    <span className="font-semibold">{s.title}</span>
                    <span className="block text-[0.95rem] text-ink/75">{s.text}</span>
                    <a href={s.img.src} download={s.file} className="mt-2 inline-block font-semibold text-primary underline underline-offset-4 hover:no-underline">
                      Télécharger en PNG, 1440 × 900<span className="sr-only"> : {s.title}</span>
                    </a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[0.95rem] text-ink/80">
            Pour voir l&apos;application en mouvement : la <Link href="/demo" className={linkClass}>démo</Link>, sans inscription.
          </p>
        </Container>
      </section>
    </SitePage>
  );
}
