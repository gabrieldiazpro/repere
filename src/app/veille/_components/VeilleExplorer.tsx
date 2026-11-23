"use client";

import { useEffect, useState } from "react";
import {
  AUDIENCES,
  AUDIENCE_LABEL,
  THEMES,
  THEME_LABEL,
  facetCounts,
  filterEntries,
  isAudience,
  isTheme,
  type VeilleAudience,
  type VeilleEntry,
  type VeilleTheme,
} from "@/lib/veille";
import { EntryRow } from "./ui";

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${active ? "" : "ring-1 ring-inset ring-line hover:ring-primary"}`}
      style={active ? { background: "var(--primary)", color: "#fff" } : { background: "#fff", color: "var(--ink)" }}
    >
      {children}
      <span className="tabular-nums" style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

/**
 * Liste filtrable des fiches. Tout le contenu est rendu côté serveur (les filtres ne font que masquer) ; l'état des
 * filtres est reflété dans l'adresse (?theme=…&cible=…) pour être partageable.
 */
export function VeilleExplorer({ entries }: { entries: VeilleEntry[] }) {
  const [theme, setTheme] = useState<VeilleTheme | null>(null);
  const [audience, setAudience] = useState<VeilleAudience | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("theme");
    const a = q.get("cible");
    if (isTheme(t)) setTheme(t);
    if (isAudience(a)) setAudience(a);
  }, []);

  function sync(t: VeilleTheme | null, a: VeilleAudience | null) {
    const q = new URLSearchParams(window.location.search);
    if (t) q.set("theme", t);
    else q.delete("theme");
    if (a) q.set("cible", a);
    else q.delete("cible");
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`);
  }

  const counts = facetCounts(entries);
  const shown = filterEntries(entries, { theme, audience });

  return (
    <div>
      <div className="space-y-4" role="group" aria-label="Filtrer les fiches">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Votre activité</legend>
          <div className="flex flex-wrap gap-2">
            <Chip active={audience === null} count={entries.length} onClick={() => { setAudience(null); sync(theme, null); }}>Toutes</Chip>
            {AUDIENCES.map((a) => (
              <Chip key={a} active={audience === a} count={counts.audiences[a]} onClick={() => { const n = audience === a ? null : a; setAudience(n); sync(theme, n); }}>
                {AUDIENCE_LABEL[a]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Thème</legend>
          <div className="flex flex-wrap gap-2">
            <Chip active={theme === null} count={entries.length} onClick={() => { setTheme(null); sync(null, audience); }}>Tous</Chip>
            {THEMES.map((t) => (
              <Chip key={t} active={theme === t} count={counts.themes[t]} onClick={() => { const n = theme === t ? null : t; setTheme(n); sync(n, audience); }}>
                {THEME_LABEL[t]}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="mt-5 text-sm" role="status" aria-live="polite" style={{ color: "var(--muted)" }}>
        {shown.length === entries.length ? `${entries.length} fiches, de la plus récente à la plus ancienne.` : `${shown.length} fiche${shown.length > 1 ? "s" : ""} sur ${entries.length} pour ce filtre.`}
      </p>
      <div className="mt-2">
        {shown.map((e) => <EntryRow key={e.slug} e={e} />)}
        {shown.length === 0 ? (
          <p className="border-t py-8" style={{ borderColor: "var(--line)" }}>
            Aucune fiche pour cette combinaison.{" "}
            <button type="button" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }} onClick={() => { setTheme(null); setAudience(null); sync(null, null); }}>
              Afficher toutes les fiches
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
