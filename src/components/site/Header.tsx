import Link from "next/link";
import { Logo } from "./Logo";
import { buttonClasses } from "@/components/ui/Button";
import { HeaderNav } from "./HeaderNav";
import { MobileMenu } from "./MobileMenu";
import { SiteTracking } from "./SiteTracking";
import { SITE_CSS } from "./site-css";
import { DEMO_HREF, LOGIN_HREF, NAV_GROUPS, PRIMARY_LINKS, RESOURCES_GROUP, analyseHrefFor, type LandingSegment } from "./nav";

export { SOLUTIONS } from "./nav";

/**
 * En-tête du site public (composant serveur). Seuls les menus déroulants et le menu mobile sont des îlots clients ;
 * tous les liens sont présents dans le HTML. `segment` adapte « Essai gratuit » (inscription sur le bon parcours).
 * Produit, Solutions, Outils gratuits, Tarifs, Ressources ; à droite : Voir la démo, Connexion, Essai gratuit.
 */
export function Header({ segment }: { segment?: LandingSegment } = {}) {
  const cta = analyseHrefFor(segment);
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <SiteTracking />
      <style href="repere-site-v4" precedence="default">
        {SITE_CSS}
      </style>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Logo size={30} />
        <HeaderNav groups={NAV_GROUPS} links={PRIMARY_LINKS} resources={RESOURCES_GROUP} />
        <div className="flex items-center gap-1.5">
          <Link
            href={DEMO_HREF}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[0.95rem] font-semibold text-primary hover:bg-primary-bg md:inline-flex lg:hidden xl:inline-flex"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
              <path d="M4.5 2.8v10.4L13 8z" />
            </svg>
            Voir la démo
          </Link>
          <Link href={LOGIN_HREF} className="hidden rounded-lg px-2.5 py-2 text-[0.95rem] font-medium text-ink/75 hover:text-ink lg:inline-flex">
            Connexion
          </Link>
          <Link href={cta} className={buttonClasses({ size: "sm", className: "lift whitespace-nowrap max-[359px]:hidden" })}>
            Analyse gratuite
          </Link>
          <MobileMenu groups={NAV_GROUPS} links={PRIMARY_LINKS} resources={RESOURCES_GROUP} cta={cta} />
        </div>
      </div>
    </header>
  );
}

export default Header;
