"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { looksLikeSite } from "./lib";

export type QuickSegment = "local" | "pme" | "ecommerce";

export const QUICK_PLACEHOLDER: Record<QuickSegment, string> = {
  local: "ex. Plomberie Martin",
  pme: "ex. Paysia ou paysia.fr",
  ecommerce: "ex. Maison Sora ou maisonsora.fr",
};

/**
 * Mini-formulaire « un champ + un bouton ».
 * V5 : une adresse de site part vers l'analyse 60 s (/analyse?site=…&segment=…) ; un nom d'entreprise part vers le test
 * de visibilité IA par nom (/audit?nom=…&segment=…). Sans JavaScript : ?nom=… vers /audit (qui reprend la main).
 */
export function QuickAuditForm({
  segment,
  idPrefix,
  submitLabel = "Tester gratuitement",
  shortLabel = "Tester",
  dark = false,
  className = "",
}: {
  segment: QuickSegment;
  idPrefix: string;
  submitLabel?: string;
  /** Libellé court sous 640 px (le bouton partage la ligne avec le champ). */
  shortLabel?: string;
  dark?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const isSite = looksLikeSite(value);
  return (
    <form action={isSite ? "/analyse" : "/audit"} method="get" className={`max-w-xl ${className}`} aria-label="Tester gratuitement votre visibilité dans les IA">
      <input type="hidden" name="segment" value={segment} />
      <label htmlFor={`${idPrefix}-nom`} className={`block text-[0.9rem] font-semibold ${dark ? "text-white" : "text-ink"}`}>
        {segment === "ecommerce" ? "Votre marque ou votre boutique" : "Votre entreprise ou votre site"}
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id={`${idPrefix}-nom`}
          name={isSite ? "site" : "nom"}
          type="text"
          required
          autoComplete="organization"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={QUICK_PLACEHOLDER[segment]}
          className="block min-h-14 w-full min-w-0 flex-[1_1_13rem] rounded-xl border border-line bg-white px-4 text-base text-ink shadow-[inset_0_1px_2px_rgba(27,31,46,.05)] placeholder:text-muted/80 focus:border-primary focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
        <button type="submit" className={buttonClasses({ size: "lg", variant: dark ? "light" : "primary", className: "lift shrink-0 max-sm:px-4" })}>
          {/* Sur mobile, champ et bouton tiennent sur une ligne : l'action reste dans le premier écran. */}
          <span className="sm:hidden">{shortLabel}</span>
          <span className="max-sm:hidden">{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}

export default QuickAuditForm;
