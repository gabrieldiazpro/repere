import type { ReactNode } from "react";

export type DemoSegment = "local" | "pme" | "ecommerce";

/** Compte démo de chaque parcours (lecture seule côté serveur, voir middleware.ts). */
export const DEMO_ACCOUNT: Record<DemoSegment, string> = { local: "demo", pme: "demo-pme", ecommerce: "demo-ecom" };

/** Adresse d'entrée dans un compte démo (visite guidée). */
export function demoEntryHref(segment: DemoSegment, account: string = DEMO_ACCOUNT[segment]): string {
  return `/app?compte=${account}&visite=1&segment=${segment}`;
}

/**
 * Entrée dans un compte démo : un bouton (formulaire GET vers /app), pas un lien.
 * - C'est une action : le passage par ?compte= pose le cookie de démo (middleware.ts). Un <Link> serait préchargé par Next
 *   dès qu'il apparaît à l'écran et ouvrirait la session démo sans clic.
 * - /app est un espace privé (robots.txt : Disallow /app) : les robots n'ont pas à suivre ce chemin.
 * Le formulaire est en `display: contents` : le bouton se place dans la mise en page comme l'ancien lien.
 */
export function DemoEntry({ segment, account, className, children, ariaLabel }: { segment?: DemoSegment; account?: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  // Sans parcours (ex. compte démo agence) : seul le compte est transmis, le middleware choisit la page d'arrivée.
  return (
    <form action="/app" method="get" className="contents">
      <input type="hidden" name="compte" value={account ?? DEMO_ACCOUNT[segment ?? "local"]} />
      {segment ? (
        <>
          <input type="hidden" name="visite" value="1" />
          <input type="hidden" name="segment" value={segment} />
        </>
      ) : null}
      <button type="submit" className={className} aria-label={ariaLabel}>
        {children}
      </button>
    </form>
  );
}
