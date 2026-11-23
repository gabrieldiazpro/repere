"use client";

/** Bouton « Imprimer ou enregistrer en PDF » (boîte de dialogue d'impression du navigateur). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: "var(--primary)" }}>
      Imprimer
    </button>
  );
}
