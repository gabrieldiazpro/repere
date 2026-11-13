import Link from "next/link";
import { Logo } from "./Logo";
import { VAT_NOTICE } from "./plans-v2";
import { FOOTER_COLUMNS } from "./nav";
import { BRAND, CONTACT_EMAIL, DESCRIPTOR, HOUSE_PAGE_PATH, TAGLINE } from "@/lib/seo/site";
import { housePageLive } from "@/lib/seo/house";

type Col = { title: string; links: { href: string; label: string }[] };

const columns: Col[] = [
  ...FOOTER_COLUMNS.map((c) => ({ title: c.title, links: c.links.map(({ href, label }) => ({ href, label })) })),
  {
    title: BRAND,
    links: [
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/aide", label: "Centre d'aide" },
      { href: "/connexion", label: "Connexion" },
    ],
  },
];

/** Pages légales : rangées dans la barre du bas, toujours au même endroit. */
const LEGAL = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgv", label: "CGV" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/dpa", label: "Sous-traitance des données (DPA)" },
];

function FooterCol({ col }: { col: Col }) {
  return (
    <nav aria-label={col.title}>
      {/* Pas de h2 dans le pied de page : il ne doit pas entrer dans le plan de chaque page. */}
      <p className="font-display text-base font-semibold text-white">{col.title}</p>
      <ul className="mt-3 space-y-1">
        {col.links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="inline-flex min-h-9 items-center py-1 text-[0.95rem] leading-snug underline-offset-4 hover:text-white hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function Footer() {
  const year = new Date().getFullYear();
  // Lien vers notre page officielle /p/repere seulement si elle est en ligne (jamais de lien cassé).
  const cols = (await housePageLive())
    ? columns.map((c) => (c.title === BRAND ? { ...c, links: [c.links[0], { href: HOUSE_PAGE_PATH, label: "Notre fiche officielle" }, ...c.links.slice(1)] } : c))
    : columns;
  const guides = cols.find((c) => c.title === "Guides");
  return (
    <footer className="on-dark bg-primary-deep text-on-deep">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]">
          <div className="max-w-sm">
            <Logo size={34} inverted descriptor />
            <p className="mt-5 font-display text-xl font-semibold text-white">{TAGLINE}</p>
            <p className="mt-4 text-[0.95rem]">
              Une question ? Écrivez-nous à{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-white underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
              . Réponse sous 48 h ouvrées, en français.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-5">
            {cols
              .filter((c) => c.title !== "Guides")
              .map((col) => (
                <FooterCol key={col.title} col={col} />
              ))}
          </div>
        </div>
        {guides ? (
          <nav aria-label={guides.title} className="mt-12 border-t border-white/15 pt-8">
            <p className="font-display text-base font-semibold text-white">{guides.title}</p>
            <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {guides.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="inline-flex min-h-9 items-center py-1 text-[0.92rem] leading-snug underline-offset-4 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="mt-12 space-y-3 border-t border-white/15 pt-6 text-sm">
          <p className="max-w-3xl">
            Repéré est un service indépendant, sans lien avec OpenAI, Google, Microsoft, Perplexity, Anthropic ou Mistral AI. ChatGPT,
            Gemini, Copilot, Perplexity, Claude et Le Chat sont des marques de leurs propriétaires respectifs. Nous ne promettons
            aucune position dans une IA : nous garantissons le travail fait et une mesure honnête.
          </p>
          <p>Prix nets : {VAT_NOTICE}.</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {BRAND}, {DESCRIPTOR}.
            </p>
            <nav aria-label="Informations légales">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {LEGAL.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex min-h-9 items-center underline-offset-4 hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
