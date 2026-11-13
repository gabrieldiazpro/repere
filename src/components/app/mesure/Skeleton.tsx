// Squelette de chargement des écrans Mesure (en-tête, barre de filtres, indicateurs, liste).
export function MesureSkeleton({ title, kpis = true, rows = 5 }: { title: string; kpis?: boolean; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <header className="rp-ph">
        <div className="rp-ph-inner">
          <h1 className="rp-display rp-h1">{title}</h1>
        </div>
      </header>
      <div className="rp-page">
        <span className="sr-only">Chargement…</span>
        {/* Emplacement de l'en-tête-résultat (V4) : même hauteur, pas de saut à l'arrivée des données. */}
        <div className="rp-panel flex items-start justify-between gap-6 p-5 lg:p-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="rp-skel h-6 w-4/5 max-w-[520px]" />
            <div className="rp-skel h-3.5 w-2/5" />
            <div className="rp-skel mt-2 h-10 w-56 rounded-xl" />
          </div>
          <div className="hidden flex-col items-end gap-2 sm:flex">
            <div className="rp-skel h-11 w-24" />
            <div className="rp-skel h-3 w-28" />
          </div>
        </div>
        <div className="rp-skel h-9 w-full max-w-[560px]" />
        {kpis && (
          <div className="rp-panel grid grid-cols-2 gap-4 p-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="rp-skel h-3 w-24" />
                <div className="rp-skel h-7 w-16" />
              </div>
            ))}
          </div>
        )}
        <div className="rp-panel flex flex-col gap-4 p-4 lg:p-5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="rp-skel h-4" style={{ width: `${70 - (i % 3) * 12}%` }} />
              <div className="rp-skel h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
